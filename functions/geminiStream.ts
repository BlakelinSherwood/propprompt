/**
 * geminiStream — SSE streaming handler for Google Gemini.
 *
 * Model cascade (Section 5.1):
 *   - location_class=coastal OR intake_data.address contains North Shore submarket keywords
 *     → gemini-2.0-pro-exp (higher reasoning for coastal/luxury markets)
 *   - default → gemini-2.0-flash (fast, cost-efficient)
 *
 * Uses Gemini generateContent API with streamGenerateContent endpoint.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const NORTH_SHORE_KEYWORDS = [
  "marblehead", "swampscott", "gloucester", "rockport", "manchester",
  "essex", "hamilton", "wenham", "beverly", "salem", "nahant",
  "north shore", "cape ann",
];

function selectModel(analysis) {
  const isCoastal = analysis.location_class === "coastal";
  const address = (analysis.intake_data?.address || "").toLowerCase();
  const isNorthShore = NORTH_SHORE_KEYWORDS.some((kw) => address.includes(kw));

  if (isCoastal || isNorthShore) return "gemini-2.0-pro-exp";
  return "gemini-2.0-flash";
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

  const keyRes = await base44.functions.invoke("resolveApiKey", {
    platform: "gemini",
    orgId: analysis.org_id || orgId,
    agentEmail: analysis.run_by_email,
  });
  if (!keyRes.data?.apiKey) {
    return Response.json({ error: keyRes.data?.error || "No Gemini API key available" }, { status: 402 });
  }
  const { apiKey, source: keySource } = keyRes.data;
  const model = selectModel(analysis);

  const promptRes = await base44.functions.invoke("assemblePrompt", { analysisId });
  const prompt = promptRes.data?.prompt || `Analyze: ${JSON.stringify(analysis.intake_data)}`;

  await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress", ai_model: model });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`;

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: `You are PropPrompt™, an elite real estate AI analyst for Eastern Massachusetts. Provide detailed, professional analysis.\n\n${prompt}` }],
            }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 4096,
            },
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error("Gemini API error:", err);
          send({ error: err.error?.message || "Gemini API error" });
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
            try {
              const evt = JSON.parse(raw);
              const text = evt.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                fullOutput += text;
                send({ token: text });
              }
            } catch (_) {}
          }
        }

        await base44.asServiceRole.entities.Analysis.update(analysisId, {
          status: "complete", output_text: fullOutput, completed_at: new Date().toISOString(),
          ai_model: model, intake_data: { ...analysis.intake_data, api_key_source: keySource },
        });

        // Deduct quota
        try {
          await base44.functions.invoke("deductAnalysisQuota", {
            analysisId,
            orgId: analysis.org_id,
          });
        } catch (e) {
          console.warn("[geminiStream] quota deduction failed:", e.message);
        }

        send({ done: true, keySource, model });

      } catch (err) {
        console.error("geminiStream error:", err);
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