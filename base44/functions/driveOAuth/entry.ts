import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';
const REDIRECT_URI = Deno.env.get('GOOGLE_REDIRECT_URI') || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'get_auth_url') {
      if (!GOOGLE_CLIENT_ID || !REDIRECT_URI) {
        return Response.json({ error: 'Google OAuth not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI in app secrets.' }, { status: 400 });
      }
      const state = btoa(JSON.stringify({ user_email: user.email, ts: Date.now() }));
      const url = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&access_type=offline&prompt=consent` +
        `&state=${encodeURIComponent(state)}`;
      return Response.json({ auth_url: url });
    }

    if (action === 'exchange_code') {
      const { code } = body;
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) return Response.json({ error: tokens.error_description || 'Token exchange failed' }, { status: 400 });

      // Get user's Google email
      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const profile = await profileRes.json();

      // Save drive connection
      const existing = await base44.entities.DriveConnection.filter({ user_email: user.email });
      const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
      const data = {
        user_email: user.email,
        status: 'connected',
        google_account_email: profile.email || '',
        oauth_access_token: tokens.access_token,
        oauth_refresh_token: tokens.refresh_token || (existing[0]?.oauth_refresh_token || ''),
        oauth_token_expires_at: expiry,
      };
      if (existing.length > 0) {
        await base44.entities.DriveConnection.update(existing[0].id, data);
      } else {
        await base44.entities.DriveConnection.create(data);
      }
      return Response.json({ success: true, google_account_email: profile.email });
    }

    if (action === 'disconnect') {
      const existing = await base44.entities.DriveConnection.filter({ user_email: user.email });
      if (existing.length > 0) {
        await base44.entities.DriveConnection.update(existing[0].id, { status: 'disconnected', oauth_access_token: '', oauth_refresh_token: '' });
      }
      return Response.json({ success: true });
    }

    if (action === 'get_status') {
      const existing = await base44.entities.DriveConnection.filter({ user_email: user.email });
      if (!existing.length) return Response.json({ connected: false });
      const conn = existing[0];
      return Response.json({
        connected: conn.status === 'connected',
        google_account_email: conn.google_account_email,
        status: conn.status,
        root_folder_name: conn.root_folder_name,
        subfolder_by_property_type: conn.subfolder_by_property_type,
        subfolder_by_assessment_type: conn.subfolder_by_assessment_type,
        auto_sync_pdf: conn.auto_sync_pdf,
        auto_sync_pptx: conn.auto_sync_pptx,
        last_sync_at: conn.last_sync_at,
      });
    }

    if (action === 'update_settings') {
      const { subfolder_by_property_type, subfolder_by_assessment_type, auto_sync_pdf, auto_sync_pptx } = body;
      const existing = await base44.entities.DriveConnection.filter({ user_email: user.email });
      if (!existing.length) return Response.json({ error: 'No Drive connection found' }, { status: 404 });
      await base44.entities.DriveConnection.update(existing[0].id, {
        subfolder_by_property_type, subfolder_by_assessment_type, auto_sync_pdf, auto_sync_pptx,
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err) {
    console.error('driveOAuth error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});