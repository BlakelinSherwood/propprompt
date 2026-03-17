import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { subscription_id, subscription_type } = await req.json();
    if (!subscription_id || !subscription_type) {
      return Response.json({ error: 'Missing subscription_id or subscription_type' }, { status: 400 });
    }

    // Fetch subscription to get territory IDs
    let territory_ids = [];
    try {
      if (subscription_type === 'single') {
        const sub = await base44.asServiceRole.entities.TerritorySubscription.get(subscription_id);
        if (sub?.territory_id) territory_ids = [sub.territory_id];
      } else if (subscription_type === 'bundle') {
        const bundle = await base44.asServiceRole.entities.TerritoryBundle.get(subscription_id);
        if (bundle?.territory_ids) territory_ids = bundle.territory_ids;
      } else if (subscription_type === 'pool') {
        const pool = await base44.asServiceRole.entities.PopulationPool.get(subscription_id);
        if (pool?.territory_ids) territory_ids = pool.territory_ids;
      } else if (subscription_type === 'buyout') {
        const buyout = await base44.asServiceRole.entities.FullBuyoutSubscription.get(subscription_id);
        if (buyout?.territory_id) territory_ids = [buyout.territory_id];
      }
    } catch (err) {
      console.error('[startOnboarding] Failed to fetch subscription:', err.message);
    }

    // Create onboarding_journey
    const journey = await base44.asServiceRole.entities.OnboardingJourney.create({
      user_id: user.id,
      subscription_id,
      subscription_type,
      territory_ids,
      journey_start: new Date().toISOString(),
      current_step: 'day_0',
      completed_steps: [],
      checklist_completion_pct: 0,
    });

    // Create Day 0 checklist items
    const checklistItems = [
      { item_key: 'watch_welcome', label: 'Watch Welcome video (Training Module 1.1)' },
      { item_key: 'first_analysis', label: 'Run your first analysis' },
      { item_key: 'add_clients', label: 'Add 5 past clients to your sphere' },
      { item_key: 'set_alerts', label: 'Set your territory alert preferences' },
      { item_key: 'complete_profile', label: 'Complete your profile (name, phone, headshot)' },
    ];

    for (const item of checklistItems) {
      await base44.asServiceRole.entities.OnboardingChecklistItem.create({
        journey_id: journey.id,
        item_key: item.item_key,
        label: item.label,
        completed: false,
      });
    }

    // Mark welcome modal to show
    await base44.auth.updateMe({
      onboarding_welcome_shown: false,
    });

    console.log(`[startOnboarding] Created journey ${journey.id} for user ${user.id}`);
    return Response.json({ success: true, journey_id: journey.id });
  } catch (err) {
    console.error('[startOnboarding] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});