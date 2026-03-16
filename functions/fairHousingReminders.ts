/**
 * fairHousingReminders — Weekly scheduled job.
 * Sends email reminders to reviewers with overdue unsigned reviews.
 * - 7 days overdue: email reminder
 * - 14 days overdue: mark status=overdue (triggers banner in dashboard)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const pendingReviews = await base44.asServiceRole.entities.FairHousingReview.filter({
      status: 'pending',
    });

    // Also check 'viewed' (seen but not signed)
    const viewedReviews = await base44.asServiceRole.entities.FairHousingReview.filter({
      status: 'viewed',
    });

    const overdueThreshold = 14 * 24 * 3600 * 1000; // 14 days in ms
    const reminderThreshold = 7 * 24 * 3600 * 1000;  // 7 days in ms

    let reminders = 0;
    let overdueMarked = 0;

    for (const review of [...pendingReviews, ...viewedReviews]) {
      // Reviews are created on the 1st of each month
      const [year, month] = review.review_period_month.split('-').map(Number);
      const createdDate = new Date(year, month - 1, 1); // 1st of that month
      const ageMs = now.getTime() - createdDate.getTime();

      if (ageMs >= overdueThreshold) {
        // Mark overdue
        await base44.asServiceRole.entities.FairHousingReview.update(review.id, {
          status: 'overdue',
          overdue_banner_shown_at: now.toISOString(),
        });
        overdueMarked++;
        console.log(`[fairHousingReminders] Marked overdue: review=${review.id} org=${review.org_id}`);

      } else if (ageMs >= reminderThreshold && !review.reminder_sent_at) {
        // Send 7-day reminder email
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: review.reviewer_email,
          from_name: 'PropPrompt™ Compliance',
          subject: `Action Required: Fair Housing Review for ${review.review_period_month}`,
          body: `
<p>Dear ${review.reviewer_email},</p>

<p>Your <strong>Monthly Fair Housing Compliance Review</strong> for <strong>${review.review_period_month}</strong> is awaiting your signature.</p>

<p>This review is required for your organization's compliance record. Please log in to PropPrompt™, navigate to your <strong>Brokerage Admin Dashboard</strong>, and sign the review at your earliest convenience.</p>

<p>If this review is not signed within 7 more days, your dashboard will display an overdue warning banner.</p>

<p>
  <strong>Organization:</strong> ${review.org_id}<br/>
  <strong>Review Period:</strong> ${review.review_period_month}<br/>
  <strong>Status:</strong> Awaiting signature
</p>

<hr/>
<p style="font-size:11px;color:#666;">
  This is an automated compliance reminder from PropPrompt™, developed by Sherwood &amp; Company. 
  For questions, contact compliance@sherwoodcompany.com.
</p>
          `.trim(),
        });

        await base44.asServiceRole.entities.FairHousingReview.update(review.id, {
          reminder_sent_at: now.toISOString(),
        });

        reminders++;
        console.log(`[fairHousingReminders] Sent reminder: review=${review.id} to=${review.reviewer_email}`);
      }
    }

    return Response.json({ reminders, overdueMarked });
  } catch (error) {
    console.error('[fairHousingReminders] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});