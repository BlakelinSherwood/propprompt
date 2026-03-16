import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-GCM decrypt
async function decryptPrompt(encrypted, keyStr) {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) return encrypted;
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(keyStr.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) },
    keyMaterial,
    fromB64(cipherB64)
  );
  return new TextDecoder().decode(decrypted);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, model } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Load analysis — verify ownership
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    if (analysis.run_by_email !== user.email &&
        analysis.on_behalf_of_email !== user.email &&
        user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!analysis.prompt_assembled) {
      return Response.json({ error: 'Prompt not assembled. Call assemblePrompt first.' }, { status: 400 });
    }

    // Decrypt the prompt server-side
    const encKey = Deno.env.get('ENCRYPTION_KEY') || '';
    const promptText = await decryptPrompt(analysis.prompt_assembled, encKey);

    // Resolve API key — waterfall
    const scKey = Deno.env.get('ANTHROPIC_API_KEY');
    const apiKey = scKey; // simplified: use SC key; resolveApiKey handles full waterfall
    if (!apiKey) return Response.json({ error: 'No Anthropic API key configured' }, { status: 500 });

    const selectedModel = model || 'claude-sonnet-4-6';

    // Call Anthropic streaming API
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        max_tokens: 4096,
        stream: true,
        system: 'You are PropPrompt™ v3.0, an AI-calibrated real estate analysis engine for Eastern Massachusetts developed by Sherwood & Company. Provide expert, data-driven real estate analysis. Always include the disclaimer footer at the end.',
        messages: [{ role: 'user', content: promptText }],
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      return Response.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
    }

    // Pipe SSE stream from Anthropic → frontend
    const encoder = new TextEncoder();
    let fullOutput = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body.getReader();
        const dec = new TextDecoder();
        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep incomplete line

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const event = JSON.parse(data);

                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  const token = event.delta.text;
                  fullOutput += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'token', text: token })}\n\n`));
                } else if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens || 0;
                } else if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                } else if (event.type === 'message_stop') {
                  // Save output to DB — never expose prompt_assembled
                  await base44.asServiceRole.entities.Analysis.update(analysisId, {
                    output_text: fullOutput,
                    status: 'complete',
                    tokens_used: inputTokens + outputTokens,
                    completed_at: new Date().toISOString(),
                  });
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done', tokensUsed: inputTokens + outputTokens })}\n\n`));
                }
              } catch (_) {
                // skip malformed lines
              }
            }
          }
        } catch (e) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});