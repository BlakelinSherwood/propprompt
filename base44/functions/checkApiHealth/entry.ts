/**
 * checkApiHealth — pings each AI/data platform with a minimal call to verify the key is live.
 * Returns status + latency for each provider.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = configs[0] || {};

    const anthropicKey = cfg.anthropic_api_key || Deno.env.get('ANTHROPIC_API_KEY');
    const openaiKey    = cfg.openai_api_key    || Deno.env.get('OPENAI_API_KEY');
    const geminiKey    = cfg.google_api_key    || Deno.env.get('GEMINI_API_KEY');
    const perplexityKey= cfg.perplexity_api_key|| Deno.env.get('PERPLEXITY_API_KEY');
    const rentcastKey  = Deno.env.get('RENTCAST_API_KEY');
    const attomKey     = Deno.env.get('ATTOM_API_KEY');

    async function ping(label, fn) {
      const start = Date.now();
      try {
        const result = await fn();
        return { label, status: result.ok ? 'ok' : 'error', latency_ms: Date.now() - start, detail: result.detail || null };
      } catch (e) {
        return { label, status: 'error', latency_ms: Date.now() - start, detail: e.message };
      }
    }

    const results = await Promise.all([

      ping('Anthropic (Claude)', async () => {
        if (!anthropicKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        });
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) return { ok: false, detail: 'Invalid API key' };
        if (r.status === 403) return { ok: false, detail: 'Insufficient credits or permissions' };
        if (!r.ok) return { ok: false, detail: body?.error?.message || `HTTP ${r.status}` };
        return { ok: true, detail: `${(body.data || []).length} models available` };
      }),

      ping('OpenAI (GPT-4o)', async () => {
        if (!openaiKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${openaiKey}` },
        });
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) return { ok: false, detail: 'Invalid API key' };
        if (r.status === 429) return { ok: false, detail: 'Rate limited or quota exceeded' };
        if (!r.ok) return { ok: false, detail: body?.error?.message || `HTTP ${r.status}` };
        return { ok: true, detail: `${(body.data || []).length} models available` };
      }),

      ping('Google (Gemini)', async () => {
        if (!geminiKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        );
        const body = await r.json().catch(() => ({}));
        if (r.status === 400 || r.status === 403) return { ok: false, detail: body?.error?.message || 'Invalid key or no access' };
        if (!r.ok) return { ok: false, detail: body?.error?.message || `HTTP ${r.status}` };
        return { ok: true, detail: `${(body.models || []).length} models available` };
      }),

      ping('Perplexity (Sonar)', async () => {
        if (!perplexityKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${perplexityKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'sonar',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
        });
        const body = await r.json().catch(() => ({}));
        if (r.status === 401) return { ok: false, detail: 'Invalid API key' };
        if (r.status === 402) return { ok: false, detail: 'Insufficient credits' };
        if (r.status === 429) return { ok: false, detail: 'Rate limited' };
        if (!r.ok) return { ok: false, detail: body?.error?.message || `HTTP ${r.status}` };
        return { ok: true, detail: 'Responding' };
      }),

      ping('RentCast', async () => {
        if (!rentcastKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch('https://api.rentcast.io/v1/properties?address=100+Main+St,+Boston,+MA&limit=1', {
          headers: { 'X-Api-Key': rentcastKey, Accept: 'application/json' },
        });
        const body = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) return { ok: false, detail: 'Invalid key or no access' };
        if (r.status === 402) return { ok: false, detail: 'Plan limit reached or billing issue' };
        if (r.status === 429) return { ok: false, detail: 'Rate limited' };
        if (!r.ok) return { ok: false, detail: body?.message || `HTTP ${r.status}` };
        return { ok: true, detail: 'Key active' };
      }),

      ping('ATTOM', async () => {
        if (!attomKey) return { ok: false, detail: 'No API key configured' };
        const r = await fetch(
          'https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/address?address1=100+Main+St&address2=Boston%2C+MA',
          { headers: { apikey: attomKey, Accept: 'application/json' } },
        );
        const body = await r.json().catch(() => ({}));
        if (r.status === 401 || r.status === 403) return { ok: false, detail: 'Invalid key or subscription issue' };
        if (r.status === 429) return { ok: false, detail: 'Rate limited' };
        // 404 = key works but no property found — that's fine
        if (r.status === 404 || r.ok) return { ok: true, detail: 'Key active' };
        return { ok: false, detail: body?.status?.msg || `HTTP ${r.status}` };
      }),

    ]);

    return Response.json({ results, checked_at: new Date().toISOString() });

  } catch (err) {
    console.error('[checkApiHealth] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});