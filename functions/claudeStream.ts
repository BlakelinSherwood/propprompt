import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULT_MODEL = 'claude-sonnet-4-6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, orgId, model } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Step 1: Assemble prompt server-side
    const assembleRes = await base44.functions.invoke('assemblePrompt', { analysisId });
    const assembleData = assembleRes.data;
    if (!assembleData?.success) {
      return Response.json({ error: assembleData?.error || 'Prompt assembly failed' }, { status: 500 });
    }

    // Step 2: Resolve API key via waterfall
    const keyRes = await base44.functions.invoke('resolveApiKey', {
      orgId,
      platform: 'claude',
      userEmail: user.email
    });
    const keyData = keyRes.data;
    if (!keyData?.apiKey) {
      return Response.json({ error: 'No Claude API key available' }, { status: 402 });
    }

    const selectedModel = model || DEFAULT_MODEL;
    const systemPrompt = assembleData.systemPrompt;
    const userPrompt = assembleData.userPrompt || assembleData.prompt;

    // Step 3: Stream from Anthropic
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': keyData.apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        stream: true,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      // Update analysis status to failed
      await base44.asServiceRole.entities.Analysis.update(analysisId, { status: 'failed' });
      return Response.json({ error: `Anthropic API error: ${errText}` }, { status: anthropicRes.status });
    }

    // Step 4: Transform Anthropic SSE → client SSE, accumulate for storage
    let fullOutput = '';
    const keySource = keyData.source;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const reader = anthropicRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    const token = parsed.delta.text;
                    fullOutput += token;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                  } else if (parsed.type === 'message_stop') {
                    // Save output and mark complete
                    await base44.asServiceRole.entities.Analysis.update(analysisId, {
                      status: 'complete',
                      output_text: fullOutput,
                      ai_model: selectedModel,
                      completed_at: new Date().toISOString()
                    });
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, keySource })}\n\n`));
                  } else if (parsed.type === 'error') {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: parsed.error?.message || 'Stream error' })}\n\n`));
                  }
                } catch (_) {
                  // skip unparseable lines
                }
              }
            }
          }
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err.message })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});