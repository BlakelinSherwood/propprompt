import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { log_level, function_name, message, context, error_details, user_email, analysis_id } = await req.json();

    if (!function_name || !message) {
      return Response.json({ error: 'function_name and message required' }, { status: 400 });
    }

    await base44.asServiceRole.entities.AppActivityLog.create({
      log_level: log_level || 'info',
      function_name,
      message,
      context: context || null,
      error_details: error_details || null,
      user_email: user_email || null,
      analysis_id: analysis_id || null,
      timestamp: new Date().toISOString(),
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[logActivity] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});