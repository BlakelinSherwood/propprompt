/**
 * claudeStream — SSE streaming handler for Anthropic Claude.
 *
 * Model cascade (Section 5.1):
 *   - source=agent_managed                 → claude-3-5-sonnet-20241022 (cost-conscious)
 *   - default                              → claude-opus-4-5 (platform default, highest quality)
 *
 * Streams SSE tokens: data: { token } per chunk, then data: { done, keySource, model }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function selectModel(analysis, keySource) {
  if (keySource === "agent") return "claude-3-5-sonnet-20241022";
  return "claude-opus-4-5";
}

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

  // Resolve API key via waterfall
  const keyRes = await base44.functions.invoke("resolveApiKey", {
    platform: "claude",
    orgId: analysis.org_id || orgId,
    agentEmail: analysis.run_by_email,
  });
  if (!keyRes.data?.apiKey) {
    return Response.json({ error: keyRes.data?.error || "No Claude API key available" }, { status: 402 });
  }
  const { apiKey, source: keySource } = keyRes.data;
  const model = selectModel(analysis, keySource);

  // Assemble prompt
  const promptRes = await base44.functions.invoke("assemblePrompt", { analysisId });
  const prompt = promptRes.data?.prompt || `You are a PropPrompt™ real estate AI. Analyze: ${JSON.stringify(analysis.intake_data)}`;

  // Update analysis status
  await base44.asServiceRole.entities.Analysis.update(analysisId, {
    status: "in_progress",
    ai_model: model,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model,
            max_tokens: 4096,
            stream: true,
            messages: [{ role: "user", content: prompt }],
            system: "You are PropPrompt™, an elite real estate AI analyst serving Eastern Massachusetts brokerages. Provide thorough, data-driven analysis with professional narrative quality.",
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error("Anthropic API error:", err);
          send({ error: err.error?.message || "Claude API error" });
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
              if (evt.type === "content_block_delta" && evt.delta?.text) {
                fullOutput += evt.delta.text;
                send({ token: evt.delta.text });
              }
            } catch (_) {}
          }
        }

        // Persist output
        await base44.asServiceRole.entities.Analysis.update(analysisId, {
          status: "complete",
          output_text: fullOutput,
          completed_at: new Date().toISOString(),
          ai_model: model,
          intake_data: { ...analysis.intake_data, api_key_source: keySource },
        });

        // Deduct quota
        try {
          await base44.functions.invoke("deductAnalysisQuota", {
            analysisId,
            orgId: analysis.org_id,
          });
        } catch (e) {
          console.warn("[claudeStream] quota deduction failed:", e.message);
        }

        send({ done: true, keySource, model });
      } catch (err) {
        console.error("claudeStream error:", err);
        await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "failed" });
        send({ error: err.message });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});