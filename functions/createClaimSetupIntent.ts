import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const setupIntent = await stripe.setupIntents.create({
      usage: 'off_session',
      metadata: {
        base44_app_id: Deno.env.get('BASE44_APP_ID'),
        user_email: user.email,
      },
    });

    return Response.json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      publishableKey: Deno.env.get('STRIPE_PUBLISHABLE_KEY'),
    });
  } catch (err) {
    console.error('[createClaimSetupIntent]', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});