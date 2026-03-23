/**
 * driveUpload — Upload a PDF (base64-encoded) to the user's Google Drive.
 * Uses stored OAuth tokens from DriveConnection entity.
 * Scope: drive.file only.
 * Stores drive_file_id and drive_url on the Analysis record.
 * Refreshes token automatically if expired.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

async function refreshAccessToken(conn) {
  const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
  if (!clientId || !clientSecret) throw new Error('Google Drive OAuth credentials not configured');

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: conn.oauth_refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function ensureValidToken(base44, conn) {
  if (!conn.oauth_refresh_token) throw new Error('No refresh token — please reconnect Google Drive');

  const expiry = conn.oauth_token_expires_at ? new Date(conn.oauth_token_expires_at) : new Date(0);
  const needsRefresh = expiry <= new Date(Date.now() + 60_000); // refresh if < 1 min left

  if (needsRefresh) {
    const accessToken = await refreshAccessToken(conn);
    await base44.asServiceRole.entities.DriveConnection.update(conn.id, {
      oauth_access_token: accessToken,
      oauth_token_expires_at: new Date(Date.now() + 3600_000).toISOString(),
    });
    return accessToken;
  }
  return conn.oauth_access_token;
}

function buildFolderPath(analysis, conn) {
  const parts = ['PropPrompt Analyses'];
  if (conn.subfolder_by_property_type) {
    parts.push(analysis.property_type?.replace(/_/g, ' ') || 'Other');
  }
  if (conn.subfolder_by_assessment_type) {
    parts.push(analysis.assessment_type?.replace(/_/g, ' ') || 'Other');
  }
  return parts;
}

async function getOrCreateFolder(accessToken, folderName, parentId) {
  // Search for existing folder
  const q = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`);
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchData = await searchRes.json();
  if (searchData.files?.length > 0) return searchData.files[0].id;

  // Create new folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const created = await createRes.json();
  return created.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId, pdfBase64, fileName } = await req.json();
    if (!analysisId || !pdfBase64) {
      return Response.json({ error: 'analysisId and pdfBase64 required' }, { status: 400 });
    }

    // Load analysis
    const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = records[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });
    if (analysis.run_by_email !== user.email && user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Load Drive connection
    const connections = await base44.asServiceRole.entities.DriveConnection.filter({
      user_email: user.email,
      status: 'connected',
    });
    if (connections.length === 0) {
      return Response.json({ error: 'No connected Google Drive account found' }, { status: 400 });
    }
    const conn = connections[0];

    // Ensure valid access token
    const accessToken = await ensureValidToken(base44, conn);

    // Determine parent folder
    let parentFolderId = conn.root_folder_id || 'root';
    if (!conn.root_folder_id) {
      // Create default root folder
      parentFolderId = await getOrCreateFolder(accessToken, 'PropPrompt Analyses', 'root');
      await base44.asServiceRole.entities.DriveConnection.update(conn.id, {
        root_folder_id: parentFolderId,
        root_folder_name: 'PropPrompt Analyses',
      });
    }

    // Create subfolder path if configured
    const folderPath = buildFolderPath(analysis, conn);
    let currentParent = parentFolderId;
    for (let i = 1; i < folderPath.length; i++) {
      currentParent = await getOrCreateFolder(accessToken, folderPath[i], currentParent);
    }

    // Upload PDF via multipart
    const pdfBytes = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));
    const safeName = fileName || `PropPrompt-Analysis-${analysisId}.pdf`;

    const metadata = JSON.stringify({
      name: safeName,
      parents: [currentParent],
      description: `PropPrompt™ Analysis — ${analysis.assessment_type} — ${analysis.intake_data?.address || ''}`,
    });

    const boundary = 'proprompt_boundary_' + Date.now();
    const delimiter = `--${boundary}\r\n`;
    const closeDelimiter = `--${boundary}--`;

    const metaPart = `Content-Type: application/json\r\n\r\n${metadata}\r\n`;
    const filePart = `Content-Type: application/pdf\r\nContent-Transfer-Encoding: base64\r\n\r\n${pdfBase64}\r\n`;

    const body = delimiter + metaPart + delimiter + filePart + closeDelimiter;

    const uploadRes = await fetch(DRIVE_UPLOAD_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.json();
      console.error('[driveUpload] Upload error:', err);
      return Response.json({ error: `Drive upload failed: ${JSON.stringify(err)}` }, { status: 500 });
    }

    const uploadData = await uploadRes.json();
    const fileId = uploadData.id;
    const driveUrl = `https://drive.google.com/file/d/${fileId}/view`;

    // Update analysis with Drive metadata
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      drive_file_id: fileId,
      drive_url: driveUrl,
      drive_sync_status: 'synced',
    });

    // Update last sync
    await base44.asServiceRole.entities.DriveConnection.update(conn.id, {
      last_sync_at: new Date().toISOString(),
    });

    // Privacy log
    await base44.asServiceRole.entities.PrivacyLog.create({
      event_type: 'drive_connected',
      actor_email: user.email,
      entity_type: 'Analysis',
      entity_id: analysisId,
      org_id: analysis.org_id,
      metadata: { fileId, driveUrl, fileName: safeName },
    });

    console.log(`[driveUpload] Uploaded ${safeName} → Drive ${fileId}`);
    return Response.json({ success: true, fileId, driveUrl, fileName: safeName });

  } catch (error) {
    console.error('[driveUpload] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});