import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== "admin" && user.role !== "platform_owner")) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const config = configs[0];
    const apiKey = config?.google_api_key;
    if (!apiKey) return Response.json({ error: "No Google API key configured" }, { status: 400 });

    const res = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`);
    const data = await res.json();
    const names = (data.models || []).map(m => m.name);
    return Response.json({ models: names, total: names.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});