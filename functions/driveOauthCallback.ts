/**
 * driveOauthCallback — Handles Google OAuth callback for Drive.
 * Exchanges authorization code for tokens, stores in DriveConnection.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { code, state: csrfToken } = body;

    if (!code || !csrfToken) return Response.json({ error: 'code and state required' }, { status: 400 });

    // Verify CSRF token
    const stateRecords = await base44.asServiceRole.entities.OAuthState.filter({ token: csrfToken });
    const stateRecord = stateRecords[0];
    if (!stateRecord || stateRecord.expires_at < new Date().toISOString()) {
      return Response.json({ error: 'Invalid or expired state token' }, { status: 400 });
    }
    const userEmail = stateRecord.user_email;

    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_DRIVE_CLIENT_SECRET');
    const redirectUri = Deno.env.get('GOOGLE_DRIVE_REDIRECT_URI');

    if (!clientId || !clientSecret) {
      return Response.json({ error: 'Google Drive OAuth not configured' }, { status: 500 });
    }

    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) {
      return Response.json({ error: `Token exchange failed: ${JSON.stringify(tokens)}` }, { status: 400 });
    }

    // Get user's Google account email
    const infoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const info = await infoRes.json();

    // Upsert DriveConnection
    const existing = await base44.asServiceRole.entities.DriveConnection.filter({ user_email: userEmail });

    const connData = {
      user_email: userEmail,
      status: 'connected',
      google_account_email: info.email || '',
      oauth_access_token: tokens.access_token,
      oauth_refresh_token: tokens.refresh_token || existing[0]?.oauth_refresh_token,
      oauth_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      auto_sync_pdf: true,
      auto_sync_pptx: false,
    };

    if (existing.length > 0) {
      await base44.asServiceRole.entities.DriveConnection.update(existing[0].id, connData);
    } else {
      await base44.asServiceRole.entities.DriveConnection.create(connData);
    }

    // Delete used CSRF token
    await base44.asServiceRole.entities.OAuthState.delete(stateRecord.id);

    // Privacy log
    await base44.asServiceRole.entities.PrivacyLog.create({
      event_type: 'drive_connected',
      actor_email: userEmail,
      metadata: { google_email: info.email },
    });

    console.log(`[driveOauthCallback] Drive connected for ${userEmail} → ${info.email}`);
    return Response.json({ success: true, googleEmail: info.email });

  } catch (error) {
    console.error('[driveOauthCallback] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});