import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function lightenHex(hex, percent) {
  const clean = (hex || '#333333').replace('#', '');
  const num = parseInt(clean, 16);
  const r = Math.min(255, (num >> 16) + Math.round(((num >> 16) * percent) / 100));
  const g = Math.min(255, ((num >> 8) & 0x00FF) + Math.round((((num >> 8) & 0x00FF) * percent) / 100));
  const b = Math.min(255, (num & 0x0000FF) + Math.round(((num & 0x0000FF) * percent) / 100));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

const ASSESSMENT_LABELS = {
  listing_pricing: 'Listing Pricing Analysis',
  buyer_intelligence: 'Buyer Intelligence Report',
  investment_analysis: 'Investment Analysis',
  cma: 'Comparative Market Analysis',
  rental_analysis: 'Rental Analysis',
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, format, email_to, email_subject } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });
    if (!['pdf', 'pptx', 'email'].includes(format)) {
      return Response.json({ error: 'format must be pdf, pptx, or email' }, { status: 400 });
    }

    if (format === 'pptx') {
      const memberships = await base44.asServiceRole.entities.OrgMembership.filter({ user_email: user.email, status: 'active' });
      if (memberships.length > 0) {
        const orgs = await base44.asServiceRole.entities.Organization.filter({ id: memberships[0].org_id });
        const org = orgs[0];
        if (!org || !['team', 'brokerage', 'enterprise'].includes(org.subscription_plan)) {
          return Response.json({ error: 'PPTX export requires a Pro or Team plan.' }, { status: 403 });
        }
      }
    }

    const brandingRes = await base44.functions.invoke('resolveBranding', { analysisId });
    const branding = brandingRes?.data?.branding;
    if (!branding) throw new Error('Failed to resolve branding');

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    Object.assign(branding, {
      report_date: today, generated_date: today,
      agent_name: branding.agent_name || '', agent_title: branding.agent_title || '',
      agent_phone: branding.agent_phone || '', agent_email: branding.agent_email || '',
      org_name: branding.org_name || 'PropPrompt', org_logo_url: branding.org_logo_url || '',
      agent_headshot_url: branding.agent_headshot_url || '',
    });

    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    const now = new Date().toISOString();

    if (format === 'email') {
      if (!email_to) return Response.json({ error: 'email_to is required' }, { status: 400 });
      const subject = email_subject || `${ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis'} — ${analysis.intake_data?.address || ''}`;
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email_to, subject, body: '',
        from_name: branding.agent_name || branding.org_name || 'PropPrompt',
      });
      await base44.asServiceRole.entities.AnalysisEmail.create({
        analysis_id: analysis.id, sent_to: email_to, sent_at: now, subject,
        included_pdf: !!(analysis.output_pdf_url),
      });
      await base44.asServiceRole.entities.Analysis.update(analysis.id, { last_exported_at: now, last_export_format: 'email' });
      return Response.json({ success: true, sent_to: email_to });
    }

    if (format === 'pptx') {
      const pptxRes = await base44.functions.invoke('generatePptx', { analysisId, branding });
      const pptxUrl = pptxRes?.data?.url;
      if (!pptxUrl) throw new Error('PPTX generation failed');
      await base44.asServiceRole.entities.Analysis.update(analysisId, { output_pptx_url: pptxUrl, last_exported_at: now, last_export_format: 'pptx' });
      return Response.json({ url: pptxUrl, format: 'pptx' });
    }

    // PDF — delegate to specialized renderers
    branding.primary_color_light = lightenHex(branding.primary_color || '#1A3226', 15);

    let fileUrl = null;
    let driveUrl = null;
    let filename = `${(ASSESSMENT_LABELS[analysis.assessment_type] || 'Analysis').replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    // Specialized renderers return a base64 PDF directly
    const DELEGATED_TYPES = ['client_portfolio', 'investment_analysis', 'rental_analysis'];
    if (DELEGATED_TYPES.includes(analysis.assessment_type)) {
      let delegateFn, subFormat;
      if (analysis.assessment_type === 'client_portfolio') {
        delegateFn = 'generatePortfolioPdf';
      } else {
        delegateFn = 'generateDocsExtra';
        subFormat = analysis.assessment_type === 'investment_analysis' ? 'investment' : 'rental';
      }
      const res = await base44.functions.invoke(delegateFn, { analysisId, branding, ...(subFormat ? { subFormat } : {}) });
      const url = res?.data?.url || null;
      const b64 = res?.data?.base64 || null;
      if (url) {
        await base44.asServiceRole.entities.Analysis.update(analysisId, { output_pdf_url: url, last_exported_at: now, last_export_format: 'pdf' });
        return Response.json({ url, format: 'pdf' });
      }
      if (!b64) throw new Error(`${delegateFn} generation failed`);
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      filename = res?.data?.filename || filename;
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const file = new File([blob], filename, { type: 'application/pdf' });
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
      fileUrl = uploadRes?.file_url || null;
      if (!fileUrl) throw new Error('File upload failed');
    } else {
      // CMA, Listing Pricing, Buyer Intelligence — rendered inline via generateReportPdfs
      const pdfRes = await base44.functions.invoke('generateReportPdfs', { analysisId, branding });
      const b64 = pdfRes?.data?.base64;
      if (!b64) throw new Error('generateReportPdfs failed');
      filename = pdfRes?.data?.filename || filename;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));

      // Check Drive auto-sync
      const driveConnections = await base44.asServiceRole.entities.DriveConnection.filter({ user_email: user.email, status: 'connected' });
      const drive = driveConnections[0];
      if (drive?.auto_sync_pdf) {
        const driveRes = await base44.functions.invoke('driveUpload', {
          analysisId, filename, mimeType: 'application/pdf',
          bytesBase64: btoa(String.fromCharCode(...bytes)),
          folderId: drive.root_folder_id,
        });
        driveUrl = driveRes?.data?.driveUrl || null;
        fileUrl = driveUrl;
      } else {
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const file = new File([blob], filename, { type: 'application/pdf' });
        const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({ file });
        fileUrl = uploadRes?.file_url || null;
      }
      if (!fileUrl) throw new Error('File upload failed');
    }

    const updateData = { last_exported_at: now, last_export_format: 'pdf', output_pdf_url: fileUrl };
    if (driveUrl) { updateData.drive_url = driveUrl; updateData.drive_sync_status = 'synced'; }
    await base44.asServiceRole.entities.Analysis.update(analysisId, updateData);

    return Response.json({ url: fileUrl, format: 'pdf' });

  } catch (err) {
    console.error('[generateDocuments] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});