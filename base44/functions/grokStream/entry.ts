/**
 * grokStream — SSE streaming handler for xAI Grok.
 *
 * Model: grok-3 always (Section 5.1 — no cascade, single model).
 * Uses OpenAI-compatible endpoint at api.x.ai.
 * Grok-3 supports live web search via built-in tool.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MODEL = "grok-3";

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { analysisId, orgId } = await req.json();
  if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });

  const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
  const analysis = records[0];
  if (!analysis) return Response.json({ error: "Analysis not found" }, { status: 404 });

  // Ownership check
  if (analysis.run_by_email !== user.email &&
      analysis.on_behalf_of_email !== user.email &&
      user.role !== 'platform_owner') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const keyRes = await base44.functions.invoke("resolveApiKey", {
    platform: "grok",
    orgId: analysis.org_id || orgId,
    agentEmail: analysis.run_by_email,
  });
  if (!keyRes.data?.apiKey) {
    return Response.json({ error: keyRes.data?.error || "No Grok API key available" }, { status: 402 });
  }
  const { apiKey, source: keySource } = keyRes.data;

  const promptRes = await base44.functions.invoke("assemblePrompt", { analysisId });
  const prompt = promptRes.data?.prompt || `Analyze: ${JSON.stringify(analysis.intake_data)}`;

  await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress", ai_model: MODEL });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        const response = await fetch("https://api.x.ai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            stream: true,
            messages: [
              {
                role: "system",
                content: "You are PropPrompt™, an elite real estate AI analyst serving Eastern Massachusetts brokerages. Leverage your real-time knowledge to provide sharp, current, data-backed property analysis. Be direct, authoritative, and quantitatively precise.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.35,
            max_tokens: 4096,
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error("Grok API error:", err);
          send({ error: err.error?.message || "Grok API error" });
          controller.close();
          return;
        }

        const reader = response.body.getReader();
        const dec = new TextDecoder();
        let buffer = "";
        let fullOutput = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const raw = line.slice(6).trim();
            if (raw === "[DONE]") continue;
            try {
              const evt = JSON.parse(raw);
              const delta = evt.choices?.[0]?.delta?.content;
              if (delta) {
                fullOutput += delta;
                send({ token: delta });
              }
            } catch (_) {}
          }
        }

        await base44.asServiceRole.entities.Analysis.update(analysisId, {
          status: "complete", output_text: fullOutput, completed_at: new Date().toISOString(),
          ai_model: MODEL, intake_data: { ...analysis.intake_data, api_key_source: keySource },
        });

        try {
          await base44.functions.invoke("deductAnalysisQuota", { analysisId, orgId: analysis.org_id });
        } catch (e) {
          console.warn("[grokStream] quota deduction failed:", e.message);
        }

        send({ done: true, keySource, model: MODEL });

      } catch (err) {
        console.error("grokStream error:", err);
        await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "failed" });
        send({ error: err.message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
});