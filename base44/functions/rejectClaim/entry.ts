import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14.21.0';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY'));

function getClaimType(claim) {
  if (claim.pool_id || claim.type_requested === 'pool') return 'pool';
  if (claim.bundle_id || claim.type_requested === 'multi_bundle') return 'bundle';
  if (claim.buyout_id || claim.type_requested === 'county_bundle' || claim.type_requested === 'full_buyout') return 'buyout';
  return 'single';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin' && user?.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { claim_id, reason } = await req.json();
    if (!claim_id || !reason?.trim()) {
      return Response.json({ error: 'claim_id and reason required' }, { status: 400 });
    }

    const claims = await base44.asServiceRole.entities.TerritoryClaimRequest.filter({ id: claim_id });
    const claim = claims[0];
    if (!claim) return Response.json({ error: 'Claim not found' }, { status: 404 });
    if (claim.status !== 'pending') return Response.json({ error: 'Claim is not pending' }, { status: 400 });

    const now = new Date().toISOString();
    const claimType = getClaimType(claim);

    // Cancel Stripe SetupIntent if present
    if (claim.stripe_setup_intent_id) {
      try {
        await stripe.setupIntents.cancel(claim.stripe_setup_intent_id);
      } catch (e) {
        console.warn('[rejectClaim] Could not cancel SetupIntent:', e.message);
      }
    }

    // Mark rejected
    await base44.asServiceRole.entities.TerritoryClaimRequest.update(claim_id, {
      status: 'rejected',
      rejected_at: now,
      admin_note: reason,
    });

    // Revert territory statuses
    if (claimType === 'single' && claim.territory_id) {
      await base44.asServiceRole.entities.Territory.update(claim.territory_id, { status: 'available' });

    } else if (claimType === 'pool' && claim.pool_id) {
      const poolRows = await base44.asServiceRole.entities.PopulationPool.filter({ id: claim.pool_id });
      const pool = poolRows[0];
      if (pool) {
        await base44.asServiceRole.entities.PopulationPool.update(pool.id, { status: 'rejected' });
        const townIds = pool.territory_ids || [];
        for (const tid of townIds) {
          await base44.asServiceRole.entities.Territory.update(tid, { status: 'available', pool_id: null });
        }
      }

    } else if (claimType === 'bundle' && claim.bundle_id) {
      const bundleRows = await base44.asServiceRole.entities.TerritoryBundle.filter({ id: claim.bundle_id });
      const bundle = bundleRows[0];
      if (bundle) {
        await base44.asServiceRole.entities.TerritoryBundle.update(bundle.id, { status: 'rejected' });
        const members = await base44.asServiceRole.entities.TerritoryBundleMember.filter({ bundle_id: bundle.id });
        for (const m of members) {
          await base44.asServiceRole.entities.Territory.update(m.territory_id, { status: 'available' });
        }
      }

    } else if (claimType === 'buyout' && claim.territory_id) {
      // Territory remains available — seats_claimed stays 0
      // No territory update needed (buyout hasn't activated yet)
    }

    // Send rejection email
    const userRows = await base44.asServiceRole.entities.User.filter({ id: claim.user_id });
    const subscriber = userRows[0];
    if (subscriber?.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: subscriber.email,
        subject: `Update on your PropPrompt territory claim`,
        body: `Thank you for your interest in a PropPrompt territory. After review, we were unable to approve your claim for ${claim.brokerage_name} at this time.\n\nReason: ${reason}\n\nYou are welcome to reapply after the waiting period. If you have questions, please contact us.`,
      });
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error('[rejectClaim] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});