import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    const isScheduled = req.headers.get('x-scheduled-job') === 'true';
    const { run_type = 'daily' } = await req.json().catch(() => ({}));

    // Daily comprehensive scan
    if (run_type === 'daily') {
      return await runDailyDigest(base44);
    }

    // Event-based urgent check (every 2 hours)
    if (run_type === 'urgent_claims') {
      return await checkUrgentClaims(base44);
    }

    return Response.json({ error: 'Invalid run_type' }, { status: 400 });
  } catch (err) {
    console.error('[monitorTerritoryHealth] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function runDailyDigest(base44) {
  const today = new Date();
  const digestDate = today.toISOString().split('T')[0];
  const items = [];

  try {
    // CATEGORY 1: CHURN RISK
    const churnRisks = await identifyChurnRisks(base44);
    items.push(...churnRisks);

    // CATEGORY 2: UPSELL OPPORTUNITIES
    const upsells = await identifyUpsells(base44);
    items.push(...upsells);

    // CATEGORY 3: APPROVAL QUEUE URGENCY
    const approvals = await checkApprovalUrgency(base44);
    items.push(...approvals);

    // CATEGORY 4: TECHNICAL ISSUES
    const technical = await identifyTechnicalIssues(base44);
    items.push(...technical);

    // CATEGORY 5: EXPIRING TOP-UPS (auto-notify subscribers)
    await notifyExpiringTopups(base44);

    // Generate all items in AdminDigestItem
    for (const item of items) {
      await base44.asServiceRole.entities.AdminDigestItem.create({
        digest_date: digestDate,
        category: item.category,
        severity: item.severity,
        subject_user_id: item.subject_user_id || null,
        subject_territory_id: item.subject_territory_id || null,
        subject_subscription_id: item.subject_subscription_id || null,
        summary: item.summary,
        recommended_action: item.recommended_action,
        draft_email_subject: item.draft_email_subject || null,
        draft_email_body: item.draft_email_body || null,
      });
    }

    // Calculate revenue metrics
    const revenue = await calculateRevenueSnapshot(base44);

    // Create digest run record
    const digestRun = await base44.asServiceRole.entities.AdminDigestRun.create({
      run_date: digestDate,
      run_completed_at: new Date().toISOString(),
      items_generated: items.length,
      urgent_count: items.filter(i => i.severity === 'urgent').length,
      review_count: items.filter(i => i.severity === 'review').length,
      churn_risk_count: items.filter(i => i.category === 'churn_risk').length,
      upsell_count: items.filter(i => i.category === 'upsell').length,
      mrr_snapshot: revenue.mrr,
      mrr_change: revenue.mrr_change,
      new_mrr_today: revenue.new_mrr,
      churned_mrr_today: revenue.churned_mrr,
      pending_mrr: revenue.pending_mrr,
      topup_revenue_mtd: revenue.topup_mtd,
      revenue_share_mtd: revenue.revenue_share_mtd,
    });

    // Send digest email (would use SendEmail integration)
    const digestBody = formatDigestEmail(items, revenue);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: 'admin@propprompt.com', // Placeholder - would be actual admin email
      subject: `PropPrompt Daily — ${digestDate} · ${items.length} items need attention`,
      body: digestBody,
      from_name: 'PropPrompt Monitoring',
    });

    // Update digest run with email sent time
    await base44.asServiceRole.entities.AdminDigestRun.update(digestRun.id, {
      email_sent_at: new Date().toISOString(),
    });

    console.log(`[monitorTerritoryHealth] Daily digest completed: ${items.length} items, ${digestRun.id}`);
    return Response.json({
      success: true,
      digest_run_id: digestRun.id,
      items_count: items.length,
      urgent_count: items.filter(i => i.severity === 'urgent').length,
    });
  } catch (err) {
    console.error('[runDailyDigest] error:', err.message);
    throw err;
  }
}

async function identifyChurnRisks(base44) {
  const items = [];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const twentyOneDaysAgo = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000);

  try {
    const users = await base44.asServiceRole.entities.User.filter({
      status: 'active',
    }, '-last_login_at', 500);

    for (const subscriber of users) {
      // Check: Zero analyses in 30 days
      const recentAnalyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: subscriber.email,
        created_at: { $gte: thirtyDaysAgo },
      });

      const lastMonthAnalyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: subscriber.email,
        created_at: {
          $gte: sixtyDaysAgo,
          $lt: thirtyDaysAgo,
        },
      });

      let churnReason = null;
      let severity = 'review';

      if (!recentAnalyses || recentAnalyses.length === 0) {
        churnReason = 'zero_analyses_30days';
        severity = 'urgent';
      } else if (lastMonthAnalyses && recentAnalyses.length < lastMonthAnalyses.length * 0.5) {
        churnReason = 'declining_usage_50pct';
        severity = 'review';
      }

      if (!subscriber.last_login_at || new Date(subscriber.last_login_at) < twentyOneDaysAgo) {
        churnReason = 'no_login_21days';
        severity = 'urgent';
      }

      if (churnReason) {
        items.push({
          category: 'churn_risk',
          severity,
          subject_user_id: subscriber.id,
          summary: `${subscriber.full_name} (${subscriber.email}) — ${churnReason}`,
          recommended_action: 'Send personal check-in email from founder',
          draft_email_subject: `Quick check-in — how is PropPrompt working for you?`,
          draft_email_body: `Hi ${subscriber.full_name},\n\nI wanted to check in and see how PropPrompt is working for you. It looks like things have been quieter recently, and I'm curious if there's anything we can improve or if you're running into any friction.\n\nWhat are you working on these days?\n\nHappy to jump on a quick call if that's helpful.\n\nBest,\n[Founder Name]`,
        });
      }
    }
  } catch (err) {
    console.error('[identifyChurnRisks] error:', err.message);
  }

  return items;
}

async function identifyUpsells(base44) {
  const items = [];

  try {
    const users = await base44.asServiceRole.entities.User.filter({
      status: 'active',
    }, '-created_date', 500);

    for (const subscriber of users) {
      // Check: Hit cap 3 months in a row
      const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const analyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: subscriber.email,
        created_at: { $gte: threeMonthsAgo.toISOString() },
      });

      if (analyses && analyses.length >= (subscriber.analyses_limit || 20) * 3) {
        items.push({
          category: 'upsell',
          severity: 'review',
          subject_user_id: subscriber.id,
          summary: `${subscriber.full_name} hitting analysis cap 3+ months`,
          recommended_action: 'Suggest tier upgrade to expand analysis allowance',
          draft_email_subject: `More analyses, more reach — upgrade option`,
          draft_email_body: `Hi ${subscriber.full_name},\n\nYou've been running a lot of analyses — that's great! You've hit your monthly limit ${Math.ceil(analyses.length / (subscriber.analyses_limit || 20))} times in the past 3 months.\n\nUpgrading to the next tier would give you more analyses plus additional features. Happy to discuss what makes sense for your practice.`,
        });
      }

      // Check: Top-up packs 2+ months in a row
      const topups = await base44.asServiceRole.entities.TopupPack.filter({
        user_id: subscriber.id,
        created_at: { $gte: threeMonthsAgo.toISOString() },
      });

      if (topups && topups.length >= 2) {
        items.push({
          category: 'upsell',
          severity: 'review',
          subject_user_id: subscriber.id,
          summary: `${subscriber.full_name} purchasing top-ups 2+ months`,
          recommended_action: 'Recommend annual plan or higher tier for cost savings',
          draft_email_subject: `Save more with an upgrade`,
          draft_email_body: `Hi ${subscriber.full_name},\n\nYou've purchased top-up packs 2 months in a row. An upgrade to a higher plan would give you more analyses for less cost overall.`,
        });
      }
    }
  } catch (err) {
    console.error('[identifyUpsells] error:', err.message);
  }

  return items;
}

async function checkApprovalUrgency(base44) {
  const items = [];

  try {
    const claims = await base44.asServiceRole.entities.TerritoryClaimRequest.filter({
      status: 'pending_approval',
    }, '-created_at', 100);

    const now = new Date();

    for (const claim of claims || []) {
      if (!claim.auto_approve_at) continue;

      const approveAt = new Date(claim.auto_approve_at);
      const hoursUntilApprove = (approveAt - now) / (1000 * 60 * 60);

      let severity = 'info';
      let summary = '';

      if (hoursUntilApprove <= 4) {
        severity = 'urgent';
        summary = `⏰ Territory claim auto-approving in ${Math.round(hoursUntilApprove)} hours`;
      } else if (hoursUntilApprove <= 24) {
        severity = 'review';
        summary = `Territory claim auto-approving in ${Math.round(hoursUntilApprove)} hours`;
      }

      if (severity !== 'info') {
        items.push({
          category: 'approval_urgent',
          severity,
          subject_subscription_id: claim.id,
          summary: `${summary} — ${claim.brokerage_name}, ${claim.territory_name}`,
          recommended_action: 'Review claim details and approve or reject',
        });
      }

      // Check: Overdue (pending > 36 hours)
      const hoursCreated = (now - new Date(claim.created_at)) / (1000 * 60 * 60);
      if (hoursCreated > 36) {
        items.push({
          category: 'approval_urgent',
          severity: 'urgent',
          subject_subscription_id: claim.id,
          summary: `⏰ OVERDUE: Claim pending ${Math.round(hoursCreated)} hours — auto-approve imminent`,
          recommended_action: 'Action immediately or claim will auto-approve',
        });
      }
    }
  } catch (err) {
    console.error('[checkApprovalUrgency] error:', err.message);
  }

  return items;
}

async function identifyTechnicalIssues(base44) {
  const items = [];

  try {
    // Check: Analysis jobs stuck in processing > 10 minutes
    const stuckAnalyses = await base44.asServiceRole.entities.Analysis.filter({
      status: 'in_progress',
      created_at: { $lt: new Date(Date.now() - 10 * 60 * 1000).toISOString() },
    });

    if (stuckAnalyses && stuckAnalyses.length > 0) {
      items.push({
        category: 'technical',
        severity: 'urgent',
        summary: `${stuckAnalyses.length} analysis job(s) stuck in processing for 10+ minutes`,
        recommended_action: 'Check Deno function logs and restart if needed',
      });
    }

    // Check: Top-ups expiring in 7 days with 50%+ remaining
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const expiringTopups = await base44.asServiceRole.entities.TopupPack.filter({
      expires_at: { $lte: sevenDaysFromNow },
      analyses_remaining: { $gte: 50 },
    });

    for (const topup of expiringTopups || []) {
      const subscriber = await base44.asServiceRole.entities.User.get(topup.user_id);
      
      // Notify subscriber automatically
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: subscriber.email,
        subject: `You have ${topup.analyses_remaining} analyses expiring soon`,
        body: `Hi ${subscriber.full_name},\n\nYou have ${topup.analyses_remaining} analyses remaining in a top-up pack that expires on ${new Date(topup.expires_at).toLocaleDateString()}. Log in to use them before they expire!`,
        from_name: 'PropPrompt',
      });
    }

    if (expiringTopups && expiringTopups.length > 0) {
      items.push({
        category: 'technical',
        severity: 'info',
        summary: `${expiringTopups.length} top-up pack(s) expiring in 7 days with 50%+ remaining — subscribers notified`,
        recommended_action: 'Monitor if subscribers use credits before expiry',
      });
    }
  } catch (err) {
    console.error('[identifyTechnicalIssues] error:', err.message);
  }

  return items;
}

async function checkUrgentClaims(base44) {
  // Called every 2 hours to catch urgent claim approvals
  const items = [];

  try {
    const claims = await base44.asServiceRole.entities.TerritoryClaimRequest.filter({
      status: 'pending_approval',
      auto_approve_at: { $lt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() },
    }, '-auto_approve_at', 10);

    for (const claim of claims || []) {
      // Send immediate push notification and email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: 'admin@propprompt.com',
        subject: `⏰ Territory claim auto-approving in ${Math.round((new Date(claim.auto_approve_at) - Date.now()) / (1000 * 60 * 60))} hours`,
        body: `URGENT: Territory claim for ${claim.brokerage_name}, ${claim.territory_name} will auto-approve soon.`,
        from_name: 'PropPrompt Urgent Alert',
      });
    }

    return Response.json({
      success: true,
      urgent_claims_found: claims?.length || 0,
      alerts_sent: claims?.length || 0,
    });
  } catch (err) {
    console.error('[checkUrgentClaims] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

async function notifyExpiringTopups(base44) {
  // Automatically notify subscribers about expiring top-ups
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const expiringTopups = await base44.asServiceRole.entities.TopupPack.filter({
    expires_at: { $lte: sevenDaysFromNow, $gte: new Date().toISOString() },
    analyses_remaining: { $gt: 0 },
  });

  for (const topup of expiringTopups || []) {
    const subscriber = await base44.asServiceRole.entities.User.get(topup.user_id);
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: subscriber.email,
      subject: `⏰ ${topup.analyses_remaining} analyses expire on ${new Date(topup.expires_at).toLocaleDateString()}`,
      body: `Hi ${subscriber.full_name},\n\nYou have ${topup.analyses_remaining} analyses remaining in a top-up pack that expires ${new Date(topup.expires_at).toLocaleDateString()}. Use them before they're gone!`,
      from_name: 'PropPrompt',
    });
  }
}

async function calculateRevenueSnapshot(base44) {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  // Simplified revenue calculation (would be more complex in production)
  const subscriptions = await base44.asServiceRole.entities.TerritorySubscription.filter({
    status: 'active',
  });

  const bundles = await base44.asServiceRole.entities.TerritoryBundle.filter({
    status: 'active',
  });

  const topups = await base44.asServiceRole.entities.TopupPack.filter({
    created_at: { $gte: firstOfMonth.toISOString() },
  });

  // Placeholder calculations
  const mrr = (subscriptions?.length || 0) * 100 + (bundles?.length || 0) * 200;
  const topupRevenue = topups?.reduce((sum, t) => sum + (t.price_paid || 0), 0) || 0;

  return {
    mrr,
    mrr_change: 0,
    new_mrr: 0,
    churned_mrr: 0,
    pending_mrr: 0,
    topup_mtd: topupRevenue,
    revenue_share_mtd: 0,
  };
}

function formatDigestEmail(items, revenue) {
  const urgent = items.filter(i => i.severity === 'urgent');
  const review = items.filter(i => i.severity === 'review');

  let body = `<h2>PropPrompt Daily Digest</h2>`;

  if (urgent.length > 0) {
    body += `<h3>🚨 URGENT</h3><ul>`;
    for (const item of urgent) {
      body += `<li>${item.summary}</li>`;
    }
    body += `</ul>`;
  }

  if (review.length > 0) {
    body += `<h3>⚠️ REVIEW THIS WEEK</h3><ul>`;
    for (const item of review) {
      body += `<li>${item.summary}</li>`;
    }
    body += `</ul>`;
  }

  body += `<h3>📊 REVENUE SNAPSHOT</h3>`;
  body += `<p>MRR: $${revenue.mrr.toLocaleString()} | Top-up MTD: $${revenue.topup_mtd.toLocaleString()}</p>`;

  return body;
}