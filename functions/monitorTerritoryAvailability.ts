import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { territory_id, old_status, new_status } = await req.json();

    if (new_status !== 'available') {
      return Response.json({ skipped: true, reason: 'territory_not_available' });
    }

    // Fetch territory details
    const territory = await base44.asServiceRole.entities.Territory.get(territory_id);
    if (!territory) {
      return Response.json({ error: 'Territory not found' }, { status: 404 });
    }

    // Find all subscribers watching this territory
    const watchList = await base44.asServiceRole.entities.TerritoryWatchList.filter({
      territory_id,
      status: 'active',
    });

    const subscriberIds = watchList?.map(w => w.user_id) || [];

    // Also find subscribers with auto-generated watches (adjacent/county)
    const allWatchers = await base44.asServiceRole.entities.TerritoryWatchList.filter({
      territory_id,
    });

    if (!allWatchers || allWatchers.length === 0) {
      return Response.json({
        success: true,
        territory_id,
        alerts_created: 0,
        reason: 'no_watchers',
      });
    }

    // Process alerts for each watcher
    const alerts = [];
    for (const watch of allWatchers) {
      if (watch.status !== 'active') continue;

      const subscriber = await base44.asServiceRole.entities.User.get(watch.user_id);
      const alert = await processWatchAlert(base44, subscriber, territory, watch);
      if (alert) alerts.push(alert);
    }

    console.log(`[monitorTerritoryAvailability] Territory ${territory_id} now available. Created ${alerts.length} alerts.`);

    return Response.json({
      success: true,
      territory_id,
      territory_name: `${territory.city_town}, ${territory.state}`,
      alerts_created: alerts.length,
    });
  } catch (err) {
    console.error('[monitorTerritoryAvailability] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function processWatchAlert(base44, subscriber, territory, watchEntry) {
  try {
    // Get subscriber's current subscription to determine tier
    const subscriptions = await base44.asServiceRole.entities.TerritorySubscription.filter({
      user_id: subscriber.id,
      status: 'active',
    }, '-created_date', 1);

    const currentSub = subscriptions?.[0];
    const tier = currentSub?.tier || 'pro';

    // Get pricing config
    const pricing = await base44.asServiceRole.entities.PricingConfig.filter({}, undefined, 1);
    const config = pricing?.[0];

    // Calculate distance (simplified — would use actual geo calculation)
    const distance = calculateDistance(currentSub?.territory_id, territory.id);

    // Determine alert reason and message
    let alert_reason = watchEntry.watch_type;
    let reason_text = '';

    if (watchEntry.watch_type === 'auto_adjacent') {
      reason_text = `A territory next to yours just opened (${distance} miles away).`;
    } else if (watchEntry.watch_type === 'auto_county') {
      reason_text = `A territory in ${territory.county} County just became available.`;
    } else if (watchEntry.watch_type === 'manual') {
      reason_text = `A territory you're watching just became available.`;
    }

    // Build pricing summary
    const pricing_summary = `Single seat: $${config?.pro_monthly_price || 79}/mo\n${territory.seats_total} seats available`;

    // Generate pre-filled claim URL
    const pre_filled_claim_url = `/claim?type=single&territory_id=${territory.id}&source=territory_watch&ref_subscription=${currentSub?.id || ''}`;

    // Create alert record
    const alert = await base44.asServiceRole.entities.TerritoryWatchAlert.create({
      watch_list_id: watchEntry.id,
      user_id: subscriber.id,
      territory_id: territory.id,
      alert_reason,
      pricing_summary,
      pre_filled_claim_url,
      created_at: new Date().toISOString(),
    });

    // Send email immediately
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: subscriber.email,
      subject: `🟢 ${territory.city_town}, ${territory.state} just opened — borders your territory`,
      body: `Hi ${subscriber.full_name},\n\n${reason_text}\n\n${territory.city_town}, ${territory.state}\nPopulation: ${territory.population.toLocaleString()}\nSeats available: ${territory.seats_total}\nDistance: ${distance} miles\n\n${pricing_summary}\n\nThese go fast. Click below to claim before another agent does.\n\n[Claim ${territory.city_town}, ${territory.state} →]\n${pre_filled_claim_url}\n\nThis link pre-fills your brokerage information from your existing subscription.\n\nBest,\n[Founder Name]\nBroker · Founder`,
      from_name: 'PropPrompt Territory Watch',
    });

    // Update watch list with alert time
    await base44.asServiceRole.entities.TerritoryWatchList.update(watchEntry.id, {
      last_alerted_at: new Date().toISOString(),
    });

    // Record email sent
    await base44.asServiceRole.entities.TerritoryWatchAlert.update(alert.id, {
      email_sent_at: new Date().toISOString(),
    });

    return alert;
  } catch (err) {
    console.error('[processWatchAlert] error:', err.message);
    return null;
  }
}

function calculateDistance(territoryId1, territoryId2) {
  // Placeholder — would use actual lat/lng distance calculation
  // For now, returns mock distance
  return Math.floor(Math.random() * 20) + 1;
}