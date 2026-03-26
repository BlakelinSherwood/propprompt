import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // STEP 1 — Check for new threshold exceedances (last 24h)
    const exceedances = await base44.asServiceRole.entities.GenerationTimingLog.filter({
      threshold_exceeded: true,
      alert_sent: false,
    });
    const recentExceedances = exceedances.filter(e => {
      const createdAt = new Date(e.created_at);
      return Date.now() - createdAt.getTime() < 24 * 60 * 60 * 1000;
    });

    if (recentExceedances.length > 0) {
      // Mark all as alerted
      for (const exc of recentExceedances) {
        await base44.asServiceRole.entities.GenerationTimingLog.update(exc.id, { alert_sent: true });
      }

      // Group by tier and build summary
      const byTier = {};
      for (const exc of recentExceedances) {
        if (!byTier[exc.subscription_tier]) {
          byTier[exc.subscription_tier] = { count: 0, max: 0, types: new Set() };
        }
        byTier[exc.subscription_tier].count++;
        byTier[exc.subscription_tier].max = Math.max(byTier[exc.subscription_tier].max, exc.duration_seconds);
        byTier[exc.subscription_tier].types.add(exc.report_type);
      }

      const thresholds = { starter: 30, pro: 45, team: 45, broker: 60 };
      let alertBody = 'The following generation times exceeded thresholds:\n\n';
      for (const tier in byTier) {
        const data = byTier[tier];
        alertBody += `${tier.toUpperCase()} — ${data.count} report(s) exceeded ${thresholds[tier]}s threshold\n`;
        alertBody += `  Worst: ${data.max}s\n`;
        alertBody += `  Report types: ${Array.from(data.types).join(', ')}\n\n`;
      }
      alertBody += 'Review the Generation Performance tab in Admin → AI Models & Settings for details.';

      console.log('[GenerationTimeMonitor] Alert:', alertBody);
    }

    // STEP 2 — Compute rolling 7-day averages
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const allRecent = await base44.asServiceRole.entities.GenerationTimingLog.filter({});
    const last7d = allRecent.filter(r => r.created_at > sevenDaysAgo);

    const snapshot = { last_computed: new Date().toISOString() };
    for (const tier of ['starter', 'pro', 'team', 'broker']) {
      const tierRecords = last7d.filter(r => r.subscription_tier === tier);
      if (tierRecords.length === 0) {
        snapshot[tier] = { avg_7d: 0, p95_7d: 0, count_7d: 0, pct_exceeded_7d: 0 };
      } else {
        const durations = tierRecords.map(r => r.duration_seconds).sort((a, b) => a - b);
        const p95Idx = Math.floor(durations.length * 0.95);
        const exceeded = tierRecords.filter(r => r.threshold_exceeded).length;
        snapshot[tier] = {
          avg_7d: Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10,
          p95_7d: Math.round(durations[p95Idx] * 10) / 10,
          count_7d: tierRecords.length,
          pct_exceeded_7d: Math.round((exceeded / tierRecords.length) * 100 * 10) / 10,
        };
      }
    }

    const configs = await base44.asServiceRole.entities.PlatformConfig.list();
    const config = configs[0];
    if (config) {
      await base44.asServiceRole.entities.PlatformConfig.update(config.id, { generation_perf_snapshot: snapshot });
    }

    console.log('[GenerationTimeMonitor] Snapshot computed:', snapshot);
    return Response.json({ success: true, snapshot });
  } catch (error) {
    console.error('[GenerationTimeMonitor] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});