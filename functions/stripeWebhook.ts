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
  "price_1TBhHSPxCu5z2jl196ENxBaz": { role: "brokerage_admin", plan: "brokerage_admin_seat" },
  "price_1TBhHSPxCu5z2jl1q0RgV73T": { role: "team_lead",       plan: "team_lead_seat" },
  "price_1TBhHSPxCu5z2jl1zHQjECgx": { role: "agent",           plan: "agent_seat" },
  "price_1TBhHSPxCu5z2jl1UJgLYOYc": { role: "assistant",       plan: "assistant_seat" },
  "price_1TBhHSPxCu5z2jl11qXgCzrm": { role: null,              plan: "brokerage_license" },
  "price_1TBhHSPxCu5z2jl1Tz4NeQix": { role: null,              plan: "team_license" },
};

const OVERAGE_PACKS = {
  "price_1TBhHSPxCu5z2jl1KO2WXIjV": 10,
  "price_1TBhHRPxCu5z2jl1CStSQCYo": 25,
  "price_1TBhHSPxCu5z2jl1Lpq2Y131": 50,
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
          const quotas = await base44.asServiceRole.entities.SeatQuota.filter({ org_id: orgId });
          if (quotas.length > 0) {
            const q = quotas[0];
            await base44.asServiceRole.entities.SeatQuota.update(q.id, {
              analyses_included_per_seat_monthly: (q.analyses_included_per_seat_monthly || 0) + extraAnalyses,
            });
          }
          console.log(`Overage pack applied: +${extraAnalyses} analyses for org ${orgId}`);
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

  return Response.json({ received: true });
});