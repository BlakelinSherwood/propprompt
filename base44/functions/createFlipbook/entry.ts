import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Load analysis to check ownership
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });
    if (analysis.run_by_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Ensure PDF exists — generate if needed
    let pdfUrl = analysis.output_pdf_url;
    if (!pdfUrl) {
      const pdfRes = await base44.functions.invoke('generateDocuments', { analysisId, format: 'pdf' });
      pdfUrl = pdfRes?.data?.url;
      if (!pdfUrl) throw new Error('PDF generation failed');
    }

    // Fetch PDF bytes
    const pdfFetch = await fetch(pdfUrl);
    if (!pdfFetch.ok) throw new Error(`Failed to fetch PDF: ${pdfFetch.status}`);
    const pdfBuffer = await pdfFetch.arrayBuffer();

    // Upload as public file
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    const filename = `${analysisId}.pdf`;
    const file = new File([blob], filename, { type: 'application/pdf' });
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const publicUrl = uploadRes?.file_url;
    if (!publicUrl) throw new Error('File upload failed');

    // Create flipbook record
    const today = new Date().toISOString().slice(0, 10);
    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const record = await base44.asServiceRole.entities.FlipbookLink.create({
      analysis_id: analysisId,
      created_by: user.email,
      pdf_storage_path: `flipbooks/${today}/${filename}`,
      pdf_public_url: publicUrl,
      share_token: token,
      expires_at: expiresAt,
      is_expired: false,
      view_count: 0,
    });

    console.log(`[createFlipbook] Created flipbook for analysis ${analysisId}, token: ${token}`);
    return Response.json({ record, token, publicUrl });

  } catch (error) {
    console.error('[createFlipbook] error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});