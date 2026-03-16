/**
 * chatgptStream — SSE streaming handler for OpenAI ChatGPT.
 *
 * Model cascade (Section 5.1):
 *   - property_type=multi_family + assessment_type=investment_analysis + plan=brokerage/enterprise
 *     → o3 (deep reasoning, no streaming — buffered then streamed as one chunk)
 *   - default → gpt-4o (with web search tool enabled)
 *
 * Streams SSE tokens: data: { token } per chunk, then data: { done, keySource, model }
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function selectModel(analysis, org) {
  const plan = org?.subscription_plan;
  const isPro = plan === "brokerage" || plan === "enterprise";
  const isMFInvestment =
    analysis.property_type === "multi_family" &&
    analysis.assessment_type === "investment_analysis";

  if (isPro && isMFInvestment) return "o3";
  return "gpt-4o";
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { analysisId, orgId } = await req.json();
  if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });

  const [records, orgs] = await Promise.all([
    base44.asServiceRole.entities.Analysis.filter({ id: analysisId }),
    orgId ? base44.asServiceRole.entities.Organization.filter({ id: orgId }) : Promise.resolve([]),
  ]);
  const analysis = records[0];
  if (!analysis) return Response.json({ error: "Analysis not found" }, { status: 404 });
  const org = orgs[0] || null;

  // Resolve API key
  const keyRes = await base44.functions.invoke("resolveApiKey", {
    platform: "chatgpt",
    orgId: analysis.org_id || orgId,
    agentEmail: analysis.run_by_email,
  });
  if (!keyRes.data?.apiKey) {
    return Response.json({ error: keyRes.data?.error || "No OpenAI API key available" }, { status: 402 });
  }
  const { apiKey, source: keySource } = keyRes.data;
  const model = selectModel(analysis, org);

  // Assemble prompt
  const promptRes = await base44.functions.invoke("assemblePrompt", { analysisId });
  const prompt = promptRes.data?.prompt || `Analyze this real estate scenario: ${JSON.stringify(analysis.intake_data)}`;

  await base44.asServiceRole.entities.Analysis.update(analysisId, { status: "in_progress", ai_model: model });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(obj) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      }

      try {
        // o3 doesn't support streaming — buffer it
        if (model === "o3") {
          const response = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "o3",
              messages: [
                { role: "system", content: "You are PropPrompt™, an elite real estate AI. Provide thorough multi-family investment analysis for Eastern Massachusetts." },
                { role: "user", content: prompt },
              ],
            }),
          });
          if (!response.ok) {
            const err = await response.json();
            console.error("OpenAI o3 error:", err);
            send({ error: err.error?.message || "OpenAI API error" });
            controller.close();
            return;
          }
          const data = await response.json();
          const fullOutput = data.choices?.[0]?.message?.content || "";
          // Stream as chunks to give visual feedback
          const chunkSize = 100;
          for (let i = 0; i < fullOutput.length; i += chunkSize) {
            send({ token: fullOutput.slice(i, i + chunkSize) });
          }
          await base44.asServiceRole.entities.Analysis.update(analysisId, {
            status: "complete", output_text: fullOutput, completed_at: new Date().toISOString(),
            ai_model: model, intake_data: { ...analysis.intake_data, api_key_source: keySource },
          });
          send({ done: true, keySource, model });
          controller.close();
          return;
        }

        // gpt-4o with streaming + web search tool
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4o",
            stream: true,
            tools: [{
              type: "function",
              function: {
                name: "web_search",
                description: "Search the web for current real estate market data",
                parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
              },
            }],
            tool_choice: "auto",
            messages: [
              { role: "system", content: "You are PropPrompt™, an elite real estate AI analyst for Eastern Massachusetts. Use web search to retrieve current comps and market data where helpful." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!response.ok) {
          const err = await response.json();
          console.error("OpenAI gpt-4o error:", err);
          send({ error: err.error?.message || "OpenAI API error" });
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
              const delta = evt.choices?.[0]?.delta;
              if (delta?.content) {
                fullOutput += delta.content;
                send({ token: delta.content });
              }
            } catch (_) {}
          }
        }

        await base44.asServiceRole.entities.Analysis.update(analysisId, {
          status: "complete", output_text: fullOutput, completed_at: new Date().toISOString(),
          ai_model: model, intake_data: { ...analysis.intake_data, api_key_source: keySource },
        });
        send({ done: true, keySource, model });

      } catch (err) {
        console.error("chatgptStream error:", err);
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