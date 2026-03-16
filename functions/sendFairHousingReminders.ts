/**
 * sendFairHousingReminders — Weekly scheduled job.
 * - At 7 days overdue: sends email reminder
 * - At 14 days overdue: marks status = "overdue" (triggers dashboard banner)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();

    // Get all pending/viewed reviews
    const pendingReviews = await base44.asServiceRole.entities.FairHousingReview.filter({
      status: "pending",
    });
    const viewedReviews = await base44.asServiceRole.entities.FairHousingReview.filter({
      status: "viewed",
    });

    const allUnsigned = [...pendingReviews, ...viewedReviews];

    const results = [];

    for (const review of allUnsigned) {
      // Parse review period to get the due date (end of month)
      const [year, month] = review.review_period_month.split("-").map(Number);
      const dueDate = new Date(year, month, 1); // 1st of next month = due date
      const daysOverdue = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      if (daysOverdue < 0) continue; // Not yet due

      // 14+ days: mark overdue
      if (daysOverdue >= 14 && review.status !== "overdue") {
        await base44.asServiceRole.entities.FairHousingReview.update(review.id, {
          status: "overdue",
          overdue_banner_shown_at: now.toISOString(),
        });
        results.push({ id: review.id, action: "marked_overdue", daysOverdue });
      }

      // 7+ days: send email reminder (only once)
      if (daysOverdue >= 7 && !review.reminder_sent_at) {
        // Get reviewer name from User entity
        const users = await base44.asServiceRole.entities.User.filter({ email: review.reviewer_email });
        const reviewerName = users[0]?.full_name || review.reviewer_email;

        await base44.asServiceRole.integrations.Core.SendEmail({
          to: review.reviewer_email,
          subject: `⚠️ Action Required: Fair Housing Compliance Review — ${review.review_period_month}`,
          body: `Dear ${reviewerName},

Your Fair Housing Compliance Review for ${review.review_period_month} is awaiting your e-signature.

This review is now ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue. Please log in to PropPrompt™ and complete the review as soon as possible.

Your signature confirms that you have read and acknowledged your fair housing obligations for the month.

To sign: Log in at your PropPrompt™ dashboard → Compliance → Review & Sign.

If you have questions, contact your brokerage administrator.

—PropPrompt™ Compliance System`,
        });

        await base44.asServiceRole.entities.FairHousingReview.update(review.id, {
          reminder_sent_at: now.toISOString(),
        });

        results.push({ id: review.id, action: "email_sent", to: review.reviewer_email, daysOverdue });
      }
    }

    console.log("[sendFairHousingReminders] processed:", JSON.stringify(results));
    return Response.json({ processed: results.length, results });

  } catch (error) {
    console.error("[sendFairHousingReminders] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});