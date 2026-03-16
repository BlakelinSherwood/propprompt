import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function decryptData(encrypted, keyStr) {
  const [ivB64, cipherB64] = encrypted.split(':');
  if (!ivB64 || !cipherB64) return encrypted;
  const fromB64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyStr.padEnd(32, '0').slice(0, 32)),
    { name: 'AES-GCM' }, false, ['decrypt']
  );
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(ivB64) }, keyMaterial, fromB64(cipherB64)
  );
  return new TextDecoder().decode(plain);
}

// Grok always uses grok-3 (Section 5.1)
function selectModel() {
  return 'grok-3';
}

async function resolveKey(base44, user, orgId, encKey) {
  const agentKeys = await base44.asServiceRole.entities.AiApiKey.filter({
    user_email: user.email, ai_platform: 'grok', is_active: true,
  });
  if (agentKeys[0]?.encrypted_key) {
    return { apiKey: await decryptData(agentKeys[0].encrypted_key, encKey), source: 'agent_managed' };
  }
  if (orgId) {
    const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
    const org = orgs[0];
    if (org?.org_ai_api_keys?.grok) {
      return { apiKey: await decryptData(org.org_ai_api_keys.grok, encKey), source: 'org_managed' };
    }
    if (org?.parent_org_id) {
      const parents = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
      const parent = parents[0];
      if (parent?.org_ai_api_keys?.grok) {
        return { apiKey: await decryptData(parent.org_ai_api_keys.grok, encKey), source: 'brokerage_managed' };
      }
    }
  }
  const scKey = Deno.env.get('XAI_API_KEY');
  if (scKey) return { apiKey: scKey, source: 'sc_managed' };
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, orgId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

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

    const encKey = Deno.env.get('ENCRYPTION_KEY') || '';
    const promptText = await decryptData(analysis.prompt_assembled, encKey);
    const effectiveOrgId = orgId || analysis.org_id;

    const keyResult = await resolveKey(base44, user, effectiveOrgId, encKey);
    if (!keyResult) return Response.json({ error: 'No xAI/Grok API key configured' }, { status: 500 });

    const selectedModel = selectModel();
    console.log(`[grokStream] model=${selectedModel} keySource=${keyResult.source}`);

    // xAI API is OpenAI-compatible
    const xaiRes = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyResult.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: selectedModel,
        stream: true,
        max_tokens: 4096,
        messages: [
          {
            role: 'system',
            content: 'You are PropPrompt™ v3.0, an AI-calibrated real estate analysis engine for Eastern Massachusetts developed by Sherwood & Company. Provide expert, data-driven real estate analysis. Always include the disclaimer footer at the end.',
          },
          { role: 'user', content: promptText },
        ],
      }),
    });

    if (!xaiRes.ok) {
      const err = await xaiRes.text();
      console.error(`[grokStream] xAI error: ${err}`);
      return Response.json({ error: `xAI/Grok API error: ${err}` }, { status: 500 });
    }

    const encoder = new TextEncoder();
    let fullOutput = '';
    let tokensUsed = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = xaiRes.body.getReader();
        const dec = new TextDecoder();
        let buffer = '';
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += dec.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') {
                await base44.asServiceRole.entities.Analysis.update(analysisId, {
                  output_text: fullOutput,
                  status: 'complete',
                  tokens_used: tokensUsed,
                  ai_model: selectedModel,
                  completed_at: new Date().toISOString(),
                });
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, keySource: keyResult.source, model: selectedModel })}\n\n`));
                continue;
              }
              try {
                const event = JSON.parse(data);
                const token = event.choices?.[0]?.delta?.content || '';
                if (token) {
                  fullOutput += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                }
                if (event.usage) {
                  tokensUsed = (event.usage.prompt_tokens || 0) + (event.usage.completion_tokens || 0);
                }
              } catch (_) {}
            }
          }
        } catch (e) {
          console.error('[grokStream] stream error:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive', 'Access-Control-Allow-Origin': '*' },
    });
  } catch (error) {
    console.error('[grokStream] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});