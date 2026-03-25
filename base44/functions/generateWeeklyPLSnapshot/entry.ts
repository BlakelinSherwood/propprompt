import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no user) and manual admin triggers
    let user = null;
    try { user = await base44.auth.me(); } catch (e) { /* scheduled call — no user */ }
    if (user && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // ── 1. Calculate previous week's date range ──────────────────────────────
    // week_start = most recent Monday that is 7+ days ago
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
    // Days since last Monday (at least 7 days ago)
    const daysToLastMonday = dayOfWeek === 0 ? 7 : dayOfWeek + 6; // previous Mon
    const weekStart = new Date(today);
    weekStart.setUTCDate(today.getUTCDate() - daysToLastMonday);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6); // Sunday

    const weekStartStr = weekStart.toISOString().slice(0, 10);
    const weekEndStr   = weekEnd.toISOString().slice(0, 10);
    const weekEndEOD   = new Date(weekEnd); weekEndEOD.setUTCHours(23, 59, 59, 999);

    console.log(`[generateWeeklyPLSnapshot] Generating snapshot for ${weekStartStr} → ${weekEndStr}`);

    // ── 2. Check for existing snapshot ──────────────────────────────────────
    const existing = await base44.asServiceRole.entities.WeeklyPLSnapshot.filter({ week_start_date: weekStartStr });
    if (existing.length > 0) {
      console.log(`[generateWeeklyPLSnapshot] Snapshot already exists for ${weekStartStr} — skipping.`);
      return Response.json({ skipped: true, week: weekStartStr, message: `Snapshot already exists for ${weekStartStr}` });
    }

    // ── 3. Query subscription/agent data ────────────────────────────────────
    let activeAgents = 0, newAgents = 0, churnedAgents = 0, grossRevenueCents = 0;

    try {
      const allSubs = await base44.asServiceRole.entities.TerritorySubscription.filter({});

      // Active = status active during the week
      activeAgents = allSubs.filter(s => s.status === 'active').length;

      // New = approved_at within the week
      newAgents = allSubs.filter(s => {
        if (!s.approved_at) return false;
        const d = new Date(s.approved_at);
        return d >= weekStart && d <= weekEndEOD;
      }).length;

      // Churned = cancelled/paused updated within the week
      churnedAgents = allSubs.filter(s => {
        if (!['cancelled', 'paused'].includes(s.status)) return false;
        const d = new Date(s.updated_date || s.created_date);
        return d >= weekStart && d <= weekEndEOD;
      }).length;

      // Gross revenue: sum monthly_price of active subs (weekly portion = monthly / 4.33)
      // This is an approximation; precise Stripe data can be entered manually.
      const weeklyRevenue = allSubs
        .filter(s => s.status === 'active' && s.monthly_price)
        .reduce((sum, s) => sum + (s.monthly_price / 4.33), 0);
      grossRevenueCents = Math.round(weeklyRevenue * 100);

      console.log(`[generateWeeklyPLSnapshot] Subscriptions — active: ${activeAgents}, new: ${newAgents}, churned: ${churnedAgents}, est. revenue: $${(grossRevenueCents / 100).toFixed(2)}`);
    } catch (e) {
      console.warn('[generateWeeklyPLSnapshot] Subscription query failed — defaulting to 0:', e.message);
    }

    // ── 4. Query AITokenLog for the week ────────────────────────────────────
    let aiCostCents = 0, totalReports = 0;

    try {
      const tokenLogs = await base44.asServiceRole.entities.AITokenLog.filter({});
      const weekLogs = tokenLogs.filter(l => {
        const d = new Date(l.created_date);
        return d >= weekStart && d <= weekEndEOD;
      });

      aiCostCents = weekLogs.reduce((sum, l) => sum + (l.cost_cents || 0), 0);

      // Count distinct analysis_ids
      const analysisIds = new Set(weekLogs.map(l => l.analysis_id).filter(Boolean));
      totalReports = analysisIds.size;

      // Fallback: also count from Analysis entity if no token logs yet
      if (totalReports === 0) {
        const analyses = await base44.asServiceRole.entities.Analysis.filter({ status: 'complete' });
        totalReports = analyses.filter(a => {
          const d = new Date(a.completed_at || a.created_date);
          return d >= weekStart && d <= weekEndEOD;
        }).length;
      }

      console.log(`[generateWeeklyPLSnapshot] AI costs: $${(aiCostCents / 100).toFixed(4)}, reports: ${totalReports}`);
    } catch (e) {
      console.warn('[generateWeeklyPLSnapshot] AITokenLog query failed — defaulting to 0:', e.message);
    }

    // ── 5. Create WeeklyPLSnapshot record ────────────────────────────────────
    const otherCostCents = 0;
    const netPlCents = grossRevenueCents - aiCostCents - otherCostCents;

    const snapshot = await base44.asServiceRole.entities.WeeklyPLSnapshot.create({
      week_start_date:         weekStartStr,
      week_end_date:           weekEndStr,
      active_agents:           activeAgents,
      new_agents:              newAgents,
      churned_agents:          churnedAgents,
      total_reports_generated: totalReports,
      gross_revenue_cents:     grossRevenueCents,
      ai_cost_cents:           aiCostCents,
      other_cost_cents:        otherCostCents,
      net_pl_cents:            netPlCents,
      notes:                   '',
    });

    console.log(`[generateWeeklyPLSnapshot] Snapshot created for ${weekStartStr} → ${weekEndStr}. Net P/L: $${(netPlCents / 100).toFixed(2)}`);

    return Response.json({
      success: true,
      week: weekStartStr,
      snapshot_id: snapshot.id,
      summary: {
        active_agents:    activeAgents,
        new_agents:       newAgents,
        churned_agents:   churnedAgents,
        total_reports:    totalReports,
        gross_revenue:    `$${(grossRevenueCents / 100).toFixed(2)}`,
        ai_cost:          `$${(aiCostCents / 100).toFixed(2)}`,
        net_pl:           `$${(netPlCents / 100).toFixed(2)}`,
      },
    });

  } catch (error) {
    console.error('[generateWeeklyPLSnapshot] Fatal error — no partial record created:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});