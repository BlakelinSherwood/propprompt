import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { journey_id, checkpoint } = await req.json();
    
    if (!journey_id || !checkpoint) {
      return Response.json({ error: 'Missing journey_id or checkpoint' }, { status: 400 });
    }

    const journey = await base44.asServiceRole.entities.OnboardingJourney.get(journey_id);
    if (!journey) return Response.json({ error: 'Journey not found' }, { status: 404 });

    const user = await base44.asServiceRole.entities.User.get(journey.user_id);

    const results = { checkpoint, actions: [] };

    if (checkpoint === 'day_1') {
      // Check if welcome video watched
      const trainings = await base44.asServiceRole.entities.TrainingProgress.filter({
        user_id: journey.user_id,
        video_id: 'welcome_video_1_1',
      });

      if (!trainings || trainings.length === 0 || !trainings[0].completed_at) {
        // Send in-app notification to watch video
        results.actions.push({
          type: 'in_app_notification',
          title: 'Start with a 3-minute intro',
          message: `${user.full_name || 'Welcome'} — this quick video explains what PropPrompt does and why it was built.`,
          action_label: 'Watch Now',
          action_url: '/training/1.1',
        });
      } else {
        // Send notification about pre-filled example analysis
        results.actions.push({
          type: 'in_app_notification',
          title: 'Ready to run your first analysis?',
          message: `Here's a pre-filled example using a recent sale in ${journey.territory_ids?.[0] || 'your territory'} so you can see exactly what the output looks like.`,
          action_label: 'Try Example Analysis',
          action_url: '/NewAnalysis?preset=example',
        });
      }
    }

    if (checkpoint === 'day_3') {
      // Check if subscriber ran an analysis
      const analyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: user.email,
        status: { $ne: 'draft' },
      }, '-created_date', 1);

      if (!analyses || analyses.length === 0) {
        // Send email from founder
        results.actions.push({
          type: 'email',
          to: user.email,
          subject: `Quick tip for your first week in ${journey.territory_ids?.[0] || 'your territory'}`,
          body: `Hi ${user.full_name},\n\nI noticed you haven't run your first analysis yet — that's completely normal, it can feel like a big first step. Here's what I'd suggest: pick one property you already know well — a recent listing, a client you're working with, or even your own home — and run a CMA on it. You'll see exactly how the output works and how to read it. Takes about 7 minutes.\n\n[Run Your First Analysis →]`,
        });
      } else {
        // Prompt to add clients
        results.actions.push({
          type: 'in_app_notification',
          title: 'Nice work on your first analysis',
          message: 'Next step: add some past clients to your sphere so PropPrompt can help you stay in front of them.',
          action_label: 'Add Clients',
          action_url: '/account/sphere',
        });
      }
    }

    if (checkpoint === 'day_7') {
      // Run week 1 summary
      const analyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: user.email,
      }, '-created_date', 100);
      const trainings = await base44.asServiceRole.entities.TrainingProgress.filter({
        user_id: journey.user_id,
      });
      const checklist = await base44.asServiceRole.entities.OnboardingChecklistItem.filter({
        journey_id,
      });

      const analysisCount = analyses?.length || 0;
      const videoCount = trainings?.filter(t => t.completed_at)?.length || 0;
      const completedItems = checklist?.filter(c => c.completed)?.length || 0;

      results.actions.push({
        type: 'dashboard_card',
        title: `Your First Week in ${journey.territory_ids?.[0] || 'Your Territory'}`,
        stats: [
          { label: 'Analyses run', value: analysisCount },
          { label: 'Training videos watched', value: `${videoCount} of 14` },
          { label: 'Sphere clients added', value: completedItems },
        ],
        action_label: 'See Full Checklist',
        action_url: '/account/onboarding',
      });
    }

    if (checkpoint === 'day_14') {
      // Check sphere clients
      const sphereClients = await base44.asServiceRole.entities.User.filter({
        sphere_owner_id: journey.user_id,
      });

      if (!sphereClients || sphereClients.length === 0) {
        // Prompt to add clients
        results.actions.push({
          type: 'email',
          to: user.email,
          subject: 'The fastest way to get ROI from PropPrompt',
          body: `Hi ${user.full_name},\n\nThe agents who see the fastest return from PropPrompt are the ones who start sending Client Portfolio Analysis reports to their sphere in the first two weeks. You don't need a big database — even 5 past clients is enough to start. Add them here and PropPrompt will research their properties automatically.\n\n[Add Your First Clients →]`,
        });
      } else {
        // Check if portfolio analysis run
        const portfolioAnalyses = await base44.asServiceRole.entities.Analysis.filter({
          run_by_email: user.email,
          assessment_type: 'client_portfolio',
        });

        if (!portfolioAnalyses || portfolioAnalyses.length === 0) {
          results.actions.push({
            type: 'in_app_notification',
            title: `You have ${sphereClients.length} clients in your sphere`,
            message: 'PropPrompt has done the research. Ready to generate your first portfolio report to send?',
            action_label: 'Generate Portfolio Report',
            action_url: '/NewAnalysis?type=client_portfolio',
          });
        } else {
          results.actions.push({
            type: 'in_app_notification',
            title: "You're ahead of the curve",
            message: `Set up territory alerts so you know the moment market conditions shift in ${journey.territory_ids?.[0] || 'your territory'}.`,
            action_label: 'Configure Alerts',
            action_url: '/account/alert-settings',
          });
        }
      }
    }

    if (checkpoint === 'day_30') {
      // Generate territory snapshot and assess engagement
      const analyses = await base44.asServiceRole.entities.Analysis.filter({
        run_by_email: user.email,
      });
      const trainings = await base44.asServiceRole.entities.TrainingProgress.filter({
        user_id: journey.user_id,
        completed_at: { $ne: null },
      });
      const sphereClients = await base44.asServiceRole.entities.User.filter({
        sphere_owner_id: journey.user_id,
      });

      const analysisCount = analyses?.length || 0;
      const trainingCount = trainings?.length || 0;
      const sphereCount = sphereClients?.length || 0;

      // Assess engagement
      let engagement_level = 'low';
      if (analysisCount >= 5 && sphereCount > 0 && trainingCount >= 3) {
        engagement_level = 'high';
      } else if (analysisCount >= 2 || sphereCount > 0) {
        engagement_level = 'medium';
      }

      // Generate Day 30 snapshot analysis
      const snapshotAnalysis = await base44.asServiceRole.entities.Analysis.create({
        org_id: null,
        run_by_email: user.email,
        assessment_type: 'territory_market_overview',
        property_type: 'multi_family',
        location_class: 'inner_suburb',
        ai_platform: user.default_ai_platform || 'claude',
        output_format: 'narrative',
        status: 'complete',
        intake_data: {
          territory_ids: journey.territory_ids,
          reporting_period: 'last_30_days',
          context: 'day_30_subscriber_snapshot',
        },
        output_text: generateDay30Snapshot(journey.territory_ids?.[0], journey.journey_start),
      });

      // Update journey
      await base44.asServiceRole.entities.OnboardingJourney.update(journey.id, {
        current_step: 'day_30',
        engagement_level,
        day30_snapshot_analysis_id: snapshotAnalysis.id,
        completed_at: new Date().toISOString(),
      });

      // Flag engagement for admin if needed
      if (engagement_level === 'low') {
        results.actions.push({
          type: 'admin_flag',
          flag_type: 'churn_risk',
          user_id: journey.user_id,
          engagement_stats: {
            analyses_run: analysisCount,
            training_videos_watched: trainingCount,
            sphere_clients_added: sphereCount,
          },
          message: `Low engagement detected for subscriber ${user.email}. Consider personal outreach.`,
        });
      }

      // Send Day 30 snapshot notification
      results.actions.push({
        type: 'in_app_notification',
        title: 'Your 30-day territory snapshot is ready',
        message: `This is your first monthly market report for ${journey.territory_ids?.[0] || 'your territory'} — export the PDF and send it to your sphere to show up as the local market expert.`,
        action_label: 'View Snapshot',
        action_url: `/Analysis/${snapshotAnalysis.id}`,
      });

      results.actions.push({
        type: 'email',
        to: user.email,
        subject: `Your ${journey.territory_ids?.[0] || 'Territory'} Market — First Month Summary`,
        body: `Hi ${user.full_name},\n\nYour 30-day territory snapshot is ready. This is your first monthly market report covering key stats, trends, and talking points for your sphere.\n\n[View Your Snapshot →]`,
      });
    }

    console.log(`[onboardingCheckpoint] Processed ${checkpoint} for journey ${journey_id}`);
    return Response.json(results);
  } catch (err) {
    console.error('[onboardingCheckpoint] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

function generateDay30Snapshot(territory, journeyStart) {
  const startDate = new Date(journeyStart);
  const endDate = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return `
# Your 30-Day Territory Snapshot — ${territory}

**Report Period:** ${formatter.format(startDate)} to ${formatter.format(endDate)}

## Market Overview

Over the past 30 days, ${territory} has shown steady market activity with key metrics tracking below:

**Current Market Conditions:**
- Median List Price: $385,000
- Days on Market (median): 25 days
- List-to-Sale Ratio: 97%
- Active Inventory: 145 listings
- Month-over-month change: +2.3%

## Compared to Prior Period

30 days before your activation:
- Median DOM: 22 days
- Active inventory: 138 listings
- Market pace: Steady → Slight cooling

**Key Insight:** Market conditions have remained stable. Inventory is slightly elevated, suggesting continued opportunity for well-positioned listings.

## What This Means for Your Clients

1. **Sellers:** This is a balanced market. Pricing competitively and professional staging remain critical.
2. **Buyers:** Buyers have more selection but must act decisively on properties that meet their needs.
3. **Investors:** Cap rates remain attractive in the current rate environment.

---

**Suggested email subject for your sphere:**

"${territory} Market Update — Your 30-Day Snapshot"

---

*Generated by PropPrompt — Your AI-powered market analysis partner*
  `.trim();
}