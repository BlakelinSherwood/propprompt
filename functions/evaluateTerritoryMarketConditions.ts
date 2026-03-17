import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Load active territories
    const territories = await base44.entities.Territory.filter({
      status: { "$in": ["active", "sublicensed"] }
    }, '', 1000);

    if (!territories.length) {
      return Response.json({ success: true, evaluated: 0, alerts: 0 });
    }

    let alertsCreated = 0;
    const evaluations = [];

    for (const territory of territories) {
      try {
        // Find subscriber(s) who own this territory
        const subscribers = await findTerritorySubscribers(base44, territory);
        
        for (const subscriber of subscribers) {
          // Load alert settings
          const settings = await base44.entities.TerritoryAlertSettings.filter({
            user_id: subscriber.user_id,
            territory_id: territory.id
          });
          
          const alertSettings = settings?.[0] || {
            dom_threshold_days: 21,
            price_change_pct_threshold: 5.0,
            inventory_months_threshold: 1.5,
            email_alerts_enabled: true,
            in_app_alerts_enabled: true
          };

          // Skip if alerts paused
          if (alertSettings.pause_until && new Date(alertSettings.pause_until) > new Date()) {
            continue;
          }

          // Evaluate conditions
          const evaluation = await evaluateMarketConditions(
            base44,
            territory,
            alertSettings
          );

          evaluations.push(evaluation);

          // Generate alert if significance score >= 3
          if (evaluation.significanceScore >= 3) {
            const alert = await generateAlert(
              base44,
              territory,
              subscriber.user_id,
              evaluation,
              alertSettings
            );
            
            if (alert) {
              alertsCreated++;
              
              // Send email if enabled
              if (alertSettings.email_alerts_enabled) {
                await sendAlertEmail(base44, subscriber.user_id, alert);
              }
            }
          }

          // Log evaluation
          await base44.entities.TerritoryIntelligenceLog.create({
            territory_id: territory.id,
            evaluated_at: new Date().toISOString(),
            conditions_checked: evaluation.conditionsChecked,
            conditions_triggered: evaluation.conditionsTriggered.length,
            alert_generated: evaluation.significanceScore >= 3,
            significance_score: evaluation.significanceScore,
            market_snapshot: evaluation.marketData
          });
        }
      } catch (err) {
        console.error(`Error evaluating territory ${territory.id}:`, err.message);
        continue;
      }
    }

    return Response.json({
      success: true,
      evaluated: territories.length,
      alerts: alertsCreated
    });
  } catch (error) {
    console.error("Territory evaluation error:", error.message);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});

async function findTerritorySubscribers(base44, territory) {
  const subscribers = [];

  // Check single territory subscriptions
  const singleSubs = await base44.entities.TerritorySubscription.filter({
    territory_id: territory.id,
    status: "active"
  });
  subscribers.push(...singleSubs.map(s => ({ user_id: s.user_id, type: "single" })));

  // Check bundles
  const bundleMembers = await base44.entities.TerritoryBundleMember.filter({
    territory_id: territory.id
  });
  const bundleIds = bundleMembers.map(m => m.bundle_id);
  
  if (bundleIds.length > 0) {
    const bundles = await base44.entities.TerritoryBundle.filter({
      id: { "$in": bundleIds },
      status: "active"
    });
    subscribers.push(...bundles.map(b => ({ user_id: b.owner_user_id, type: "bundle" })));
  }

  // Check pools
  const pools = await base44.entities.PopulationPool.filter({
    territory_ids: { "$in": [territory.id] },
    status: "active"
  });
  subscribers.push(...pools.map(p => ({ user_id: p.owner_user_id, type: "pool" })));

  // Check buyouts
  const buyouts = await base44.entities.FullBuyoutSubscription.filter({
    territory_id: territory.id,
    status: "active"
  });
  subscribers.push(...buyouts.map(b => ({ user_id: b.user_id, type: "buyout" })));

  return [...new Map(subscribers.map(s => [s.user_id, s])).values()];
}

async function evaluateMarketConditions(base44, territory, settings) {
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // Get historical analyses for trend comparison
  const recentAnalyses = await base44.entities.Analysis.filter({
    location_class: territory.location_class,
    status: "complete",
    completed_at: { "$gte": ninetyDaysAgo.toISOString() }
  }, '-completed_at', 50);

  const conditionsTriggered = [];
  let significanceScore = 0;
  const marketData = {};

  // Get last evaluation to compare
  const lastEval = (await base44.entities.TerritoryIntelligenceLog.filter(
    { territory_id: territory.id },
    '-evaluated_at',
    1
  ))?.[0];

  // MARKET HEAT TRIGGERS
  if (territory.seats_claimed >= territory.seats_total) {
    conditionsTriggered.push("high_demand");
    significanceScore += 2;
    marketData.high_demand = true;
  }

  // MARKET COOLING TRIGGERS
  if (territory.status === "available" && territory.seats_claimed === 0) {
    conditionsTriggered.push("no_claimed_seats");
    significanceScore += 1;
  }

  // OPPORTUNITY TRIGGERS
  if (recentAnalyses.length > 0) {
    const latestAnalysis = recentAnalyses[0];
    if (latestAnalysis.intake_data?.location_class === "urban_core") {
      conditionsTriggered.push("urban_market_activity");
      significanceScore += 1;
      marketData.recent_analysis_count = recentAnalyses.length;
    }
  }

  // Prevent duplicate alerts on same condition
  if (lastEval?.conditions_triggered?.includes("high_demand") && 
      conditionsTriggered.includes("high_demand")) {
    if (!lastEval.alert_generated) {
      // Condition already triggered without alert, don't re-trigger
      conditionsTriggered.splice(conditionsTriggered.indexOf("high_demand"), 1);
      significanceScore -= 2;
    }
  }

  return {
    conditionsChecked: 8,
    conditionsTriggered,
    significanceScore: Math.max(0, significanceScore),
    marketData,
    territory
  };
}

async function generateAlert(base44, territory, userId, evaluation, settings) {
  const alertTypes = {
    high_demand: "market_heat",
    no_claimed_seats: "opportunity"
  };

  const alertType = alertTypes[evaluation.conditionsTriggered[0]] || "market_heat";

  const summaryText = `Market activity detected in ${territory.city_town}, ${territory.state_id}. ` +
    `${evaluation.conditionsTriggered.length} significant condition(s) triggered. ` +
    `This may indicate a shift in local market dynamics worth monitoring. ` +
    `Consider running a detailed market report to assess impact on your territories.`;

  const alert = await base44.entities.TerritoryIntelligenceAlerts.create({
    territory_id: territory.id,
    user_id: userId,
    alert_type: alertType,
    significance_score: evaluation.significanceScore,
    summary_text: summaryText,
    conditions_triggered: evaluation.conditionsTriggered,
    market_data: evaluation.marketData,
    relevant_client_ids: []
  });

  return alert;
}

async function sendAlertEmail(base44, userId, alert) {
  const user = await base44.entities.User.filter({ id: userId }, '', 1);
  if (!user?.[0]?.email) return;

  try {
    await base44.integrations.Core.SendEmail({
      to: user[0].email,
      subject: `Market shift in ${alert.territory_id} — Check your alerts`,
      body: alert.summary_text
    });
  } catch (err) {
    console.error("Email send failed:", err.message);
  }
}