import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { jsPDF } from 'npm:jspdf@4.0.0';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  return res.json();
}

async function getOrCreateFolder(accessToken, parentId, folderName) {
  // Search for existing folder
  const q = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentId ? ` and '${parentId}' in parents` : ''}`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) return searchData.files[0].id;

  // Create folder
  const body = { name: folderName, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) body.parents = [parentId];
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const folder = await createRes.json();
  return folder.id;
}

async function uploadToDrive(accessToken, folderId, filename, content, mimeType) {
  const metadata = { name: filename, parents: folderId ? [folderId] : [] };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Fetch analysis
    const analyses = await base44.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });
    if (!analysis.output_text) return Response.json({ error: 'Analysis not complete yet' }, { status: 400 });

    // Fetch Drive connection
    const connections = await base44.entities.DriveConnection.filter({ user_email: user.email, status: 'connected' });
    const conn = connections[0];
    if (!conn) return Response.json({ error: 'No Drive connection found' }, { status: 404 });

    // Refresh token if needed
    let accessToken = conn.oauth_access_token;
    const expiresAt = conn.oauth_token_expires_at ? new Date(conn.oauth_token_expires_at) : new Date(0);
    if (expiresAt < new Date()) {
      const refreshed = await refreshAccessToken(conn.oauth_refresh_token);
      if (refreshed.error) return Response.json({ error: 'Token refresh failed: ' + refreshed.error }, { status: 401 });
      accessToken = refreshed.access_token;
      await base44.entities.DriveConnection.update(conn.id, {
        oauth_access_token: accessToken,
        oauth_token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      });
    }

    // Build folder structure
    let folderId = conn.root_folder_id || null;
    if (!folderId) {
      folderId = await getOrCreateFolder(accessToken, null, 'PropPrompt Analyses');
      await base44.entities.DriveConnection.update(conn.id, { root_folder_id: folderId, root_folder_name: 'PropPrompt Analyses' });
    }

    if (conn.subfolder_by_assessment_type && analysis.assessment_type) {
      folderId = await getOrCreateFolder(accessToken, folderId, analysis.assessment_type.replace(/_/g, ' '));
    }
    if (conn.subfolder_by_property_type && analysis.property_type) {
      folderId = await getOrCreateFolder(accessToken, folderId, analysis.property_type.replace(/_/g, ' '));
    }

    // Generate PDF in memory
    const doc = new jsPDF();
    const address = analysis.intake_data?.address || 'Analysis';
    const typeLabel = analysis.assessment_type?.replace(/_/g, ' ') || 'Analysis';
    doc.setFontSize(14);
    doc.text(`PropPrompt™ — ${typeLabel}`, 20, 20);
    doc.setFontSize(11);
    doc.text(address, 20, 30);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(analysis.output_text.replace(/[#*`]/g, ''), 170);
    doc.text(lines, 20, 44);
    const pdfBuffer = doc.output('arraybuffer');

    // Upload PDF
    const filename = `PropPrompt-${typeLabel}-${address.substring(0, 30)}-${new Date().toISOString().split('T')[0]}.pdf`;
    const uploadResult = await uploadToDrive(accessToken, folderId, filename, pdfBuffer, 'application/pdf');

    if (!uploadResult.id) {
      await base44.entities.Analysis.update(analysisId, { drive_sync_status: 'failed' });
      return Response.json({ error: 'Drive upload failed', detail: uploadResult }, { status: 500 });
    }

    // Update analysis with Drive metadata
    await base44.entities.Analysis.update(analysisId, {
      drive_file_id: uploadResult.id,
      drive_url: uploadResult.webViewLink || null,
      drive_sync_status: 'synced',
    });
    await base44.entities.DriveConnection.update(conn.id, { last_sync_at: new Date().toISOString() });

    return Response.json({ success: true, drive_file_id: uploadResult.id, drive_url: uploadResult.webViewLink });

  } catch (err) {
    console.error('driveSync error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});