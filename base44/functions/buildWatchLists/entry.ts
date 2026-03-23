import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id } = await req.json().catch(() => ({}));

    if (user_id) {
      // Build watch lists for single user
      await buildUserWatchLists(base44, user_id);
      return Response.json({ success: true, users_processed: 1 });
    }

    // Build for all active users (scheduled daily job)
    const users = await base44.asServiceRole.entities.User.filter({
      status: 'active',
    }, '-created_date', 500);

    let processed = 0;
    for (const user of users || []) {
      await buildUserWatchLists(base44, user.id);
      processed++;
    }

    console.log(`[buildWatchLists] Built watch lists for ${processed} users`);
    return Response.json({
      success: true,
      users_processed: processed,
    });
  } catch (err) {
    console.error('[buildWatchLists] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

async function buildUserWatchLists(base44, userId) {
  try {
    const user = await base44.asServiceRole.entities.User.get(userId);
    if (!user) return;

    // Get user's current subscriptions to find their territories
    const singleSubs = await base44.asServiceRole.entities.TerritorySubscription.filter({
      user_id: userId,
      status: 'active',
    });

    const bundles = await base44.asServiceRole.entities.TerritoryBundle.filter({
      user_id: userId,
      status: 'active',
    });

    const pools = await base44.asServiceRole.entities.PopulationPool.filter({
      user_id: userId,
      status: 'active',
    });

    let userTerritories = [];
    let userCounties = new Set();

    // Collect all territories user owns
    for (const sub of singleSubs || []) {
      if (sub.territory_id) {
        userTerritories.push(sub.territory_id);
        const terr = await base44.asServiceRole.entities.Territory.get(sub.territory_id);
        if (terr?.county_id) userCounties.add(terr.county_id);
      }
    }

    for (const bundle of bundles || []) {
      if (bundle.territory_ids) {
        userTerritories.push(...bundle.territory_ids);
        for (const tid of bundle.territory_ids) {
          const terr = await base44.asServiceRole.entities.Territory.get(tid);
          if (terr?.county_id) userCounties.add(terr.county_id);
        }
      }
    }

    // Get all territories
    const allTerritories = await base44.asServiceRole.entities.Territory.filter({}, undefined, 1000);

    // Build auto watch lists
    for (const territory of allTerritories || []) {
      // Skip if user already owns it
      if (userTerritories.includes(territory.id)) continue;

      // Check if adjacent (within 15 miles)
      const isAdjacent = userTerritories.some(ownedId => {
        return isWithinDistance(ownedId, territory.id, 15);
      });

      // Check if same county
      const isSameCounty = userCounties.has(territory.county_id);

      // Create or update watch entry
      const existingWatch = await base44.asServiceRole.entities.TerritoryWatchList.filter({
        user_id: userId,
        territory_id: territory.id,
      });

      if (!existingWatch || existingWatch.length === 0) {
        if (isAdjacent) {
          await base44.asServiceRole.entities.TerritoryWatchList.create({
            user_id: userId,
            territory_id: territory.id,
            watch_type: 'auto_adjacent',
            added_at: new Date().toISOString(),
            status: 'active',
          });
        } else if (isSameCounty) {
          await base44.asServiceRole.entities.TerritoryWatchList.create({
            user_id: userId,
            territory_id: territory.id,
            watch_type: 'auto_county',
            added_at: new Date().toISOString(),
            status: 'active',
          });
        }
      }
    }

    console.log(`[buildUserWatchLists] Built watch lists for user ${userId}`);
  } catch (err) {
    console.error('[buildUserWatchLists] error for user', userId, ':', err.message);
  }
}

function isWithinDistance(terrId1, terrId2, maxMiles) {
  // Placeholder — would use actual lat/lng calculation
  // For now, returns true for demo purposes
  return Math.random() > 0.5;
}