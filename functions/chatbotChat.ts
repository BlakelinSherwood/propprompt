import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import Anthropic from 'npm:@anthropic-ai/sdk@0.20.9';

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') });

const DAILY_LIMIT = 20;

const SYSTEM_PROMPTS = {
  platform_owner: `You are PropBot, the PropPrompt™ platform assistant. You have full knowledge of the platform including:
- All user roles: platform_owner, brokerage_admin, team_lead, agent, assistant, team_agent
- Organization management: creating orgs, managing seats, licensing markets, billing (Stripe plans: team $99/mo, brokerage $199/mo, enterprise custom)
- Fair Housing Compliance: monthly auto-generated reviews, e-signature flows, 7-day reminders, 14-day overdue escalation
- AI integrations: Claude, ChatGPT, Gemini, Perplexity, Grok — model selection, API key hierarchy (agent → team → brokerage → platform)
- Analysis types: listing_pricing, buyer_intelligence, investment_analysis, cma, rental_analysis
- CRM integrations: Follow Up Boss, kvCORE, Salesforce, Lofty
- Google Drive sync: OAuth, folder organization, auto-sync
- Privacy: A5 audit logs, private analysis toggle, GDPR/CCPA controls
- Platform analytics: aggregate-only, k-anonymity for towns <3
You NEVER reveal individual user data, full prompt methodology, or other orgs' details. Answer platform management questions fully.`,

  brokerage_admin: `You are PropBot, the PropPrompt™ assistant for brokerage administrators. You can help with:
- Managing your brokerage organization: inviting agents, team leads, and assistants
- Understanding seat quotas and billing (your plans: team, brokerage, enterprise)
- Fair Housing compliance: signing monthly reviews, understanding overdue status
- AI platform configuration for your brokerage: enabling/disabling platforms, org-level API keys
- Reading aggregate analyses metrics for your org (NOT individual analysis content)
- CRM integration setup and Drive sync for your agents
- Running analyses: listing pricing, CMAs, buyer intelligence, investment, rental
You NEVER reveal other users' analysis content, prompt templates, or platform owner configurations.`,

  team_lead: `You are PropBot, the PropPrompt™ assistant for team leads. You can help with:
- Managing your team: inviting agents and assistants
- Running analyses for yourself or on behalf of agents on your team
- Fair Housing compliance: signing your team's monthly reviews
- Understanding your team's usage and quotas
- CRM integration and Google Drive sync setup
- Analysis types: listing pricing, CMAs, buyer intelligence, investment analysis, rental analysis
- AI platform selection and configuration for your team
You NEVER reveal other users' analysis content or sensitive platform details.`,

  agent: `You are PropBot, the PropPrompt™ assistant for real estate agents. You can help with:
- Running analyses: how to start a listing pricing analysis, CMA, buyer intelligence report, investment analysis, or rental analysis
- Choosing the right AI platform and output format for your needs
- Understanding your monthly analysis quota and how to get more
- Connecting your CRM (Follow Up Boss, kvCORE, Salesforce, Lofty) for analysis push
- Setting up Google Drive sync for your analysis PDFs
- Interpreting your analysis results
You NEVER reveal prompt methodology, other users' data, or admin-level platform details.`,

  default: `You are PropBot, the PropPrompt™ assistant. I can help you use the PropPrompt™ AI-powered real estate analysis platform.
Ask me about running analyses, connecting your CRM, Google Drive sync, or your account.
I never reveal confidential platform details, prompt methodology, or other users' data.`,
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { message, session_id } = await req.json();
    if (!message?.trim()) return Response.json({ error: 'message required' }, { status: 400 });

    // Rate limit: count messages sent today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sessions = await base44.entities.ChatbotSession.filter({ user_email: user.email });
    const todayMessages = sessions.reduce((count, s) => {
      const msgs = (s.messages || []).filter(m => m.role === 'user' && new Date(m.timestamp) >= todayStart);
      return count + msgs.length;
    }, 0);
    if (todayMessages >= DAILY_LIMIT) {
      return Response.json({ error: `Daily limit of ${DAILY_LIMIT} messages reached. Try again tomorrow.` }, { status: 429 });
    }

    // Fetch or create session
    let session = null;
    let messages = [];
    if (session_id) {
      const found = sessions.find(s => s.id === session_id);
      if (found) { session = found; messages = found.messages || []; }
    }

    // Build message history for Claude (last 10 turns)
    const history = messages.slice(-20).filter(m => m.role !== 'system').map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));
    history.push({ role: 'user', content: message });

    // Determine system prompt by role
    const role = user.role;
    const systemPrompt = SYSTEM_PROMPTS[role] || SYSTEM_PROMPTS.default;

    // Call Claude (S&C platform key only)
    const claudeRes = await anthropic.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      system: systemPrompt,
      messages: history,
    });
    const reply = claudeRes.content[0]?.text || 'I apologize, I could not generate a response.';

    // Persist to ChatbotSession
    const now = new Date().toISOString();
    const newMessages = [
      ...messages,
      { role: 'user', content: message, timestamp: now },
      { role: 'assistant', content: reply, timestamp: now },
    ];

    let newSessionId = session_id;
    if (!session) {
      const memberships = await base44.entities.OrgMembership.filter({ user_email: user.email, status: 'active' });
      const orgId = memberships[0]?.org_id || '';
      const created = await base44.entities.ChatbotSession.create({
        user_email: user.email,
        org_id: orgId,
        ai_platform: 'claude',
        session_mode: 'api',
        messages: newMessages,
        status: 'active',
      });
      newSessionId = created.id;
    } else {
      await base44.entities.ChatbotSession.update(session.id, { messages: newMessages });
    }

    return Response.json({ reply, session_id: newSessionId });

  } catch (err) {
    console.error('chatbotChat error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
});