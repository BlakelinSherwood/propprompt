import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Stripe from 'npm:stripe@14';

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { price_id, org_id, success_url, cancel_url } = await req.json();
    if (!price_id) return Response.json({ error: "price_id required" }, { status: 400 });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: price_id, quantity: 1 }],
      mode: [
        "price_1TBhejF8FK2SYLZUMEp2wWPz",
        "price_1TBhejF8FK2SYLZUID3SdPfo",
        "price_1TBhejF8FK2SYLZUAb1MfMbK"
      ].includes(price_id) ? "payment" : "subscription",
      success_url: success_url || `${req.headers.get("origin")}/Billing?success=1`,
      cancel_url: cancel_url || `${req.headers.get("origin")}/Billing?canceled=1`,
      metadata: {
        base44_app_id: Deno.env.get("BASE44_APP_ID"),
        user_email: user.email,
        org_id: org_id || "",
        price_id,
      },
      customer_email: user.email,
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("Checkout error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});