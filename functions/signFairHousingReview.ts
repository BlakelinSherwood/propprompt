/**
 * signFairHousingReview — E-signature endpoint.
 * Captures: timestamp, IP address, SHA-256 hash of review content, typed name.
 * Marks review as "signed". Immutable once set.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { reviewId, signatureName, liabilityAccepted } = await req.json();
    if (!reviewId || !signatureName) {
      return Response.json({ error: "reviewId and signatureName required" }, { status: 400 });
    }
    if (!liabilityAccepted) {
      return Response.json({ error: "Must accept liability disclosure" }, { status: 400 });
    }

    // Load review
    const reviews = await base44.asServiceRole.entities.FairHousingReview.filter({ id: reviewId });
    const review = reviews[0];
    if (!review) return Response.json({ error: "Review not found" }, { status: 404 });

    // Only the designated reviewer can sign
    if (review.reviewer_email !== user.email) {
      return Response.json({ error: "Only the designated reviewer may sign" }, { status: 403 });
    }

    // Already signed — immutable
    if (review.status === "signed") {
      return Response.json({ error: "Review already signed" }, { status: 409 });
    }

    // Compute SHA-256 hash of review content
    const contentHash = await sha256(review.review_text || "");

    // Capture IP address
    const ipAddress =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const signedAt = new Date().toISOString();

    await base44.asServiceRole.entities.FairHousingReview.update(reviewId, {
      status: "signed",
      signed_at: signedAt,
      signature_name: signatureName,
      liability_disclosure_accepted: true,
    });

    // Privacy log
    await base44.asServiceRole.entities.PrivacyLog.create({
      event_type: "privacy_notice_accepted",
      actor_email: user.email,
      org_id: review.org_id,
      entity_type: "FairHousingReview",
      entity_id: reviewId,
      ip_address: ipAddress,
      user_agent: req.headers.get("user-agent") || "",
      metadata: {
        review_period: review.review_period_month,
        content_hash: contentHash,
        signature_name: signatureName,
        signed_at: signedAt,
      },
    });

    console.log(`[signFairHousingReview] signed by ${user.email}, reviewId=${reviewId}, hash=${contentHash}`);

    return Response.json({
      success: true,
      signedAt,
      contentHash,
      ipAddress,
    });

  } catch (error) {
    console.error("[signFairHousingReview] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});