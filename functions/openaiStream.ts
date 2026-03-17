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

// Section 5.1 model cascade for OpenAI
// o3 for multi_family investment_analysis on brokerage/enterprise tier
// gpt-4o default
function selectModel(analysis, subscriptionPlan) {
  const isPro = subscriptionPlan === 'brokerage' || subscriptionPlan === 'enterprise';
  if (isPro && analysis.assessment_type === 'investment_analysis' && analysis.property_type === 'multi_family') {
    return 'o3';
  }
  return 'gpt-4o';
}

async function resolveKey(base44, user, orgId, encKey) {
  const agentKeys = await base44.asServiceRole.entities.AiApiKey.filter({
    user_email: user.email, ai_platform: 'chatgpt', is_active: true,
  });
  if (agentKeys[0]?.encrypted_key) {
    return { apiKey: await decryptData(agentKeys[0].encrypted_key, encKey), source: 'agent_managed' };
  }
  if (orgId) {
    const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
    const org = orgs[0];
    if (org?.org_ai_api_keys?.chatgpt) {
      return { apiKey: await decryptData(org.org_ai_api_keys.chatgpt, encKey), source: 'org_managed' };
    }
    if (org?.parent_org_id) {
      const parents = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
      const parent = parents[0];
      if (parent?.org_ai_api_keys?.chatgpt) {
        return { apiKey: await decryptData(parent.org_ai_api_keys.chatgpt, encKey), source: 'brokerage_managed' };
      }
    }
  }
  const scKey = Deno.env.get('OPENAI_API_KEY');
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
    const promptText = analysis.prompt_assembled;

    const effectiveOrgId = orgId || analysis.org_id;
    let subscriptionPlan = 'team';
    if (effectiveOrgId) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ id: effectiveOrgId });
      subscriptionPlan = orgs[0]?.subscription_plan || 'team';
    }

    const keyResult = await resolveKey(base44, user, effectiveOrgId, encKey);
    if (!keyResult) return Response.json({ error: 'No OpenAI API key configured' }, { status: 500 });

    const selectedModel = selectModel(analysis, subscriptionPlan);
    console.log(`[openaiStream] model=${selectedModel} keySource=${keyResult.source}`);

    // o3 does not support streaming — use non-streaming and emit chunks manually
    const isO3 = selectedModel === 'o3';

    const requestBody = {
      model: selectedModel,
      messages: [
        {
          role: 'system',
          content: 'You are PropPrompt™ v3.0, an AI-calibrated real estate analysis engine for Eastern Massachusetts developed by Sherwood & Company. Provide expert, data-driven real estate analysis. Always include the disclaimer footer at the end.',
        },
        { role: 'user', content: promptText },
      ],
      stream: !isO3,
      max_completion_tokens: isO3 ? 8000 : undefined,
      max_tokens: isO3 ? undefined : 4096,
    };
    // Clean undefined keys
    Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k]);

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${keyResult.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error(`[openaiStream] OpenAI error: ${err}`);
      return Response.json({ error: `OpenAI API error: ${err}` }, { status: 500 });
    }

    const encoder = new TextEncoder();

    // o3: non-streaming — buffer full response then emit
    if (isO3) {
      const json = await openaiRes.json();
      const fullOutput = json.choices?.[0]?.message?.content || '';
      const tokensUsed = (json.usage?.prompt_tokens || 0) + (json.usage?.completion_tokens || 0);

      await base44.asServiceRole.entities.Analysis.update(analysisId, {
        output_text: fullOutput,
        status: 'complete',
        tokens_used: tokensUsed,
        ai_model: selectedModel,
        completed_at: new Date().toISOString(),
      });

      // Deduct quota
      try {
        await base44.functions.invoke("deductAnalysisQuota", {
          analysisId,
          orgId: analysis.org_id,
        });
      } catch (e) {
        console.warn("[openaiStream o3] quota deduction failed:", e.message);
      }

      // Emit full output in chunks so frontend stream consumer works
      const stream = new ReadableStream({
        start(controller) {
          const chunkSize = 80;
          for (let i = 0; i < fullOutput.length; i += chunkSize) {
            const token = fullOutput.slice(i, i + chunkSize);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token })}\n\n`));
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, keySource: keyResult.source, model: selectedModel })}\n\n`));
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      });
    }

    // Standard SSE streaming for gpt-4o
    let fullOutput = '';
    let tokensUsed = 0;

    const stream = new ReadableStream({
      async start(controller) {
        const reader = openaiRes.body.getReader();
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

                 // Deduct quota
                 try {
                   await base44.functions.invoke("deductAnalysisQuota", {
                     analysisId,
                     orgId: analysis.org_id,
                   });
                 } catch (e) {
                   console.warn("[openaiStream gpt-4o] quota deduction failed:", e.message);
                 }

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
                if (event.usage) tokensUsed = (event.usage.prompt_tokens || 0) + (event.usage.completion_tokens || 0);
              } catch (_) {}
            }
          }
        } catch (e) {
          console.error('[openaiStream] stream error:', e);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: e.message })}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' },
    });
  } catch (error) {
    console.error('[openaiStream] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});