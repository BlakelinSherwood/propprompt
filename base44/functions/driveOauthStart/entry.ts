/**
 * driveOauthStart — Returns the Google OAuth authorization URL for Drive.
 * Frontend redirects user to this URL.
 * Scope: drive.file only (per Addendum A7).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const clientId = Deno.env.get('GOOGLE_DRIVE_CLIENT_ID');
    const redirectUri = Deno.env.get('GOOGLE_DRIVE_REDIRECT_URI') || `${Deno.env.get('APP_BASE_URL')}/api/drive-callback`;

    if (!clientId) return Response.json({ error: 'Google Drive not configured. Set GOOGLE_DRIVE_CLIENT_ID.' }, { status: 500 });

    // Generate CSRF token instead of using user email as state
    const csrfToken = crypto.randomUUID();
    await base44.asServiceRole.entities.OAuthState.create({
      token: csrfToken,
      user_email: user.email,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email',
      access_type: 'offline',
      prompt: 'consent',
      state: csrfToken,
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return Response.json({ authUrl });

  } catch (error) {
    console.error('[driveOauthStart] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});