/**
 * signFairHousingReview — E-signature endpoint.
 * Captures: timestamp, SHA-256 hash of review content, IP address, full name.
 * Review becomes immutable after signing per Addendum A4.4.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { reviewId, signatureName, liabilityAccepted } = await req.json();

    if (!reviewId || !signatureName || !liabilityAccepted) {
      return Response.json({ error: 'reviewId, signatureName, and liabilityAccepted required' }, { status: 400 });
    }

    const reviews = await base44.asServiceRole.entities.FairHousingReview.filter({ id: reviewId });
    const review = reviews[0];
    if (!review) return Response.json({ error: 'Review not found' }, { status: 404 });

    // Only the designated reviewer or platform_owner can sign
    if (review.reviewer_email !== user.email && user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden — you are not the designated reviewer' }, { status: 403 });
    }

    if (review.status === 'signed') {
      return Response.json({ error: 'Review already signed — immutable' }, { status: 409 });
    }

    // Compute SHA-256 of review content
    const contentHash = await sha256(review.review_text || '');

    // Capture IP from headers
    const ip = req.headers.get('x-forwarded-for') ||
                req.headers.get('cf-connecting-ip') ||
                req.headers.get('x-real-ip') ||
                'unknown';

    const signedAt = new Date().toISOString();

    await base44.asServiceRole.entities.FairHousingReview.update(reviewId, {
      status: 'signed',
      signed_at: signedAt,
      signature_name: signatureName,
      liability_disclosure_accepted: true,
    });

    // Log to PrivacyLog
    await base44.asServiceRole.entities.PrivacyLog.create({
      event_type: 'privacy_notice_accepted', // closest match
      actor_email: user.email,
      org_id: review.org_id,
      entity_type: 'FairHousingReview',
      entity_id: reviewId,
      ip_address: ip,
      metadata: {
        action: 'fair_housing_review_signed',
        review_period_month: review.review_period_month,
        content_hash: contentHash,
        signature_name: signatureName,
        signed_at: signedAt,
      },
    });

    return Response.json({ success: true, signedAt, contentHash });
  } catch (error) {
    console.error('[signFairHousingReview] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});