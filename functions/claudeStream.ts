import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-GCM decrypt (iv:ciphertext base64 format)
async function decryptPrompt(encrypted, keyStr) {
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

async function decryptKey(encrypted, keyStr) {
  return decryptPrompt(encrypted, keyStr);
}

// Model selection cascade — agent never picks directly
// claude-opus-4 for brokerage/enterprise tier investment_analysis
// claude-sonnet-4-5 default
function selectModel(analysis, subscriptionPlan) {
  const tier = subscriptionPlan || 'team';
  const isPro = tier === 'brokerage' || tier === 'enterprise';
  if (isPro && analysis.assessment_type === 'investment_analysis') {
    return 'claude-opus-4-5';
  }
  return 'claude-sonnet-4-5';
}

// Key waterfall: agent → org → parent brokerage → S&C
async function resolveKey(base44, user, orgId, encKey) {
  // 1. Agent personal key
  const agentKeys = await base44.asServiceRole.entities.AiApiKey.filter({
    user_email: user.email, ai_platform: 'claude', is_active: true,
  });
  if (agentKeys[0]?.encrypted_key) {
    return { apiKey: await decryptKey(agentKeys[0].encrypted_key, encKey), source: 'agent_managed' };
  }
  // 2. Org key
  if (orgId) {
    const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
    const org = orgs[0];
    if (org?.org_ai_api_keys?.claude) {
      return { apiKey: await decryptKey(org.org_ai_api_keys.claude, encKey), source: 'org_managed' };
    }
    // 3. Parent brokerage key
    if (org?.parent_org_id) {
      const parents = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
      const parent = parents[0];
      if (parent?.org_ai_api_keys?.claude) {
        return { apiKey: await decryptKey(parent.org_ai_api_keys.claude, encKey), source: 'brokerage_managed' };
      }
    }
  }
  // 4. S&C platform key
  const scKey = Deno.env.get('ANTHROPIC_API_KEY');
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
    const promptText = await decryptPrompt(analysis.prompt_assembled, encKey);

    // Resolve org subscription plan for model selection
    const effectiveOrgId = orgId || analysis.org_id;
    let subscriptionPlan = 'team';
    if (effectiveOrgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: effectiveOrgId });
      subscriptionPlan = orgs[0]?.subscription_plan || 'team';
    }

    const keyResult = await resolveKey(base44, user, effectiveOrgId, encKey);
    if (!keyResult) return Response.json({ error: 'No Anthropic API key configured' }, { status: 500 });

    const selectedModel = selectModel(analysis, subscriptionPlan);
    console.log(`[claudeStream] model=${selectedModel} keySource=${keyResult.source}`);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': keyResult.apiKey,
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
      console.error(`[claudeStream] Anthropic error: ${err}`);
      return Response.json({ error: `Anthropic API error: ${err}` }, { status: 500 });
    }

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
            buffer = lines.pop();
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const event = JSON.parse(data);
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                  const token = event.delta.text;
                  fullOutput += token;
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
                } else if (event.type === 'message_start' && event.message?.usage) {
                  inputTokens = event.message.usage.input_tokens || 0;
                } else if (event.type === 'message_delta' && event.usage) {
                  outputTokens = event.usage.output_tokens || 0;
                } else if (event.type === 'message_stop') {
                  await base44.asServiceRole.entities.Analysis.update(analysisId, {
                    output_text: fullOutput,
                    status: 'complete',
                    tokens_used: inputTokens + outputTokens,
                    ai_model: selectedModel,
                    completed_at: new Date().toISOString(),
                  });
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, keySource: keyResult.source, model: selectedModel })}\n\n`));
                }
              } catch (_) {}
            }
          }
        } catch (e) {
          console.error('[claudeStream] stream error:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
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
    console.error('[claudeStream] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});