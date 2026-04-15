import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysis_id } = await req.json();
    if (!analysis_id) return Response.json({ error: 'analysis_id required' }, { status: 400 });

    // Fetch analysis
    const analyses = await base44.entities.Analysis.filter({ id: analysis_id });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    // Verify ownership
    if (analysis.run_by_email !== user.email) {
      return Response.json({ error: 'Not authorized to rerun this analysis' }, { status: 403 });
    }

    // Deduct 1 token for rerun
    try {
      await base44.functions.invoke('deductAnalysisQuota', {
        user_email: user.email,
        count: 1,
      });
    } catch (quotaErr) {
      return Response.json({ error: 'Insufficient analysis quota' }, { status: 402 });
    }

    // Reset analysis status to draft so user can regenerate output
    await base44.entities.Analysis.update(analysis_id, {
      status: 'draft',
      output_text: null,
      output_json: null,
      output_pdf_url: null,
      output_pptx_url: null,
      completed_at: null,
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[rerunnAnalysis] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});