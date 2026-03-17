import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

// Quota map: analyses_included per role
const ROLE_QUOTA = {
  brokerage_admin: 60,
  team_lead: 40,
  agent: 20,
  assistant: 0,
};

// Price → product metadata map (hardcoded price IDs)
const PRICE_META = {
  "price_1TBhejF8FK2SYLZURefHB3TX": { role: "brokerage_admin", plan: "brokerage_admin_seat" },
  "price_1TBhejF8FK2SYLZUplITgfKk": { role: "team_lead",       plan: "team_lead_seat" },
  "price_1TBhejF8FK2SYLZUE4imcOoB": { role: "agent",           plan: "agent_seat" },
  "price_1TBhejF8FK2SYLZUSE3t8zz6": { role: "assistant",       plan: "assistant_seat" },
  "price_1TBhejF8FK2SYLZUHUHlr95S": { role: null,              plan: "brokerage_license" },
  "price_1TBhejF8FK2SYLZUU7nYtlWJ": { role: null,              plan: "team_license" },
};

const OVERAGE_PACKS = {
  "price_1TBhejF8FK2SYLZUMEp2wWPz": 10,
  "price_1TBhejF8FK2SYLZUID3SdPfo": 25,
  "price_1TBhejF8FK2SYLZUAb1MfMbK": 50,
};

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      sig,
      Deno.env.get("STRIPE_WEBHOOK_SECRET")
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const base44 = createClientFromRequest(req);

  // Idempotency check
  try {
    const processedEvents = await base44.asServiceRole.entities.ProcessedWebhookEvent.filter({
      event_id: event.id,
    });
    if (processedEvents.length > 0) {
      console.log(`Skipping duplicate event: ${event.id}`);
      return Response.json({ received: true, duplicate: true });
    }
  } catch (_) {
    // ProcessedWebhookEvent entity may not exist yet — continue
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const userEmail = session.metadata?.user_email;
        const orgId = session.metadata?.org_id;
        const priceId = session.metadata?.price_id;

        if (!userEmail || !priceId) break;

        // Handle overage pack (one-time)
        if (OVERAGE_PACKS[priceId]) {
          const extraAnalyses = OVERAGE_PACKS[priceId];
          await base44.asServiceRole.entities.TopupPack.create({
            org_id: orgId,
            analyses_purchased: extraAnalyses,
            analyses_remaining: extraAnalyses,
            source: 'overage_pack',
            stripe_payment_intent_id: session.payment_intent,
            expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            created_at: new Date().toISOString(),
          });
          console.log(`Overage pack created: +${extraAnalyses} analyses for org ${orgId}`);
          break;
        }

        // Handle seat subscription / license
        const meta = PRICE_META[priceId];
        if (!meta) break;

        const stripeSubId = session.subscription;

        if (meta.role) {
          // Seat subscription — update OrgMembership + SeatQuota
          const memberships = await base44.asServiceRole.entities.OrgMembership.filter({
            user_email: userEmail,
            org_id: orgId,
          });
          if (memberships.length > 0) {
            await base44.asServiceRole.entities.OrgMembership.update(memberships[0].id, {
              status: "active",
            });
          }

          // Upsert SeatQuota
          const quotas = await base44.asServiceRole.entities.SeatQuota.filter({ org_id: orgId });
          const analysesIncluded = ROLE_QUOTA[meta.role] || 0;
          if (quotas.length === 0) {
            await base44.asServiceRole.entities.SeatQuota.create({
              org_id: orgId,
              plan_name: "team",
              agent_seats_included: 0,
              agent_seats_used: 0,
              analyses_included_per_seat_monthly: analysesIncluded,
            });
          }
        }

        // Update org with stripe subscription ID
        if (stripeSubId && orgId) {
          const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
          if (orgs.length > 0) {
            await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
              stripe_subscription_id: stripeSubId,
              stripe_customer_id: session.customer,
              status: "active",
              subscription_plan: meta.plan,
            });
          }
        }
        console.log(`Checkout completed for ${userEmail}, plan: ${meta.plan}`);
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: customerId });
        if (orgs.length > 0) {
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            status: sub.status === "active" ? "active" : "suspended",
          });
        }
        console.log(`Subscription updated for customer ${customerId}: ${sub.status}`);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = sub.customer;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: customerId });
        if (orgs.length > 0) {
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            status: "canceled",
            stripe_subscription_id: null,
          });
        }
        console.log(`Subscription deleted for customer ${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const orgs = await base44.asServiceRole.entities.Organization.filter({ stripe_customer_id: customerId });
        if (orgs.length > 0) {
          await base44.asServiceRole.entities.Organization.update(orgs[0].id, {
            status: "suspended",
          });
        }
        console.log(`Payment failed for customer ${customerId}`);
        break;
      }
    }
  } catch (err) {
    console.error("Webhook handler error:", err.message);
    return new Response("Handler error", { status: 500 });
  }

  // Record processed event for idempotency
  try {
    await base44.asServiceRole.entities.ProcessedWebhookEvent.create({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });
  } catch (_) {
    // ProcessedWebhookEvent entity may not exist yet
  }

  return Response.json({ received: true });
});