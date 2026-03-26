import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULTS = {
  primary_color: '#1A3226',
  accent_color: '#B8982F',
  background_color: '#FFFFFF',
  org_logo_url: null,
  agent_headshot_url: null,
};

/**
 * Resolves the full branding hierarchy for a given analysis.
 * Can be called as an HTTP endpoint OR imported logic via SDK invoke.
 * 
 * POST body: { analysisId }
 * Returns: flat branding object
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    const branding = await resolveBrandingForAnalysis(base44, analysisId);
    return Response.json({ branding });
  } catch (err) {
    console.error('[resolveBranding] error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});

/**
 * Core resolution logic — called directly by generateDocuments via service role.
 */
export async function resolveBrandingForAnalysis(base44Client, analysisId) {
  // 1. Load analysis
  const analyses = await base44Client.asServiceRole.entities.Analysis.filter({ id: analysisId });
  const analysis = analyses[0];
  if (!analysis) throw new Error('Analysis not found');

  const agentEmail = analysis.on_behalf_of_email || analysis.run_by_email;
  const orgId = analysis.org_id;

  // 2. Load the org
  const orgs = await base44Client.asServiceRole.entities.Organization.filter({ id: orgId });
  const org = orgs[0];

  let brokerageOrgId = orgId;
  let teamOrgId = null;

  if (org?.org_type === 'team') {
    teamOrgId = orgId;
    brokerageOrgId = org.parent_org_id || orgId;
  }

  // 3-5. Load OrgBranding records in parallel
  // Also look up BrandingConfig records for org-level color branding
  const [brokerageBrandingList, teamBrandingList, agentBrandingList, userList, brokeragingConfigList, teamBrandingConfigList] = await Promise.all([
    base44Client.asServiceRole.entities.OrgBranding.filter({ org_id: brokerageOrgId }),
    teamOrgId
      ? base44Client.asServiceRole.entities.OrgBranding.filter({ org_id: teamOrgId })
      : Promise.resolve([]),
    agentEmail
      ? base44Client.asServiceRole.entities.AgentBranding.filter({ user_id: agentEmail })
      : Promise.resolve([]),
    agentEmail
      ? base44Client.asServiceRole.entities.User.filter({ email: agentEmail })
      : Promise.resolve([]),
    base44Client.asServiceRole.entities.BrandingConfig.filter({ org_id: brokerageOrgId }),
    teamOrgId
      ? base44Client.asServiceRole.entities.BrandingConfig.filter({ org_id: teamOrgId })
      : Promise.resolve([]),
  ]);

  const brokerageBranding = brokerageBrandingList[0] || {};
  const teamBranding = teamBrandingList[0] || {};
  const agentBranding = agentBrandingList[0] || {};
  const agentUser = userList[0] || {};
  const brokerageBrandingConfig = brokeragingConfigList?.[0] || {};
  const teamBrandingConfig = teamBrandingConfigList?.[0] || {};

  // 6. Merge: brokerage → team → agent
  // For team, only override if the team has explicitly set the field (non-null, non-empty)
  // Determine resolution source for audit logging
  const hasAgentBranding = !!(agentBranding.display_name || agentBranding.title || agentBranding.direct_phone || agentBranding.direct_email || agentBranding.headshot_url);
  const hasOrgBranding = !!(brokerageBrandingConfig.primary_color || brokerageBranding.primary_color || teamBrandingConfig.primary_color);
  const resolutionSource = hasAgentBranding ? 'agent' : hasOrgBranding ? 'org' : 'platform_fallback';

  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const merged = {
    // Org identity layer
    org_name: teamBranding.org_name || brokerageBranding.org_name || org?.name || '',
    org_logo_url: teamBrandingConfig.org_logo_url || brokerageBrandingConfig.org_logo_url || teamBranding.logo_url || brokerageBranding.logo_url || null,
    org_tagline: teamBranding.tagline || brokerageBranding.tagline || '',
    org_address: teamBranding.address || brokerageBranding.address || '',
    org_phone: teamBranding.phone || brokerageBranding.phone || '',
    org_website: teamBranding.website || brokerageBranding.website || '',

    // Colors — team overrides brokerage, BrandingConfig overrides OrgBranding, fall back to hard defaults
    primary_color: teamBrandingConfig.primary_color || brokerageBrandingConfig.primary_color || teamBranding.primary_color || brokerageBranding.primary_color || DEFAULTS.primary_color,
    accent_color: teamBrandingConfig.accent_color || brokerageBrandingConfig.accent_color || teamBranding.accent_color || brokerageBranding.accent_color || DEFAULTS.accent_color,
    background_color: teamBrandingConfig.background_color || brokerageBrandingConfig.background_color || teamBranding.background_color || brokerageBranding.background_color || DEFAULTS.background_color,
    agent_headshot_url: agentBranding.headshot_url || teamBrandingConfig.agent_headshot_url || brokerageBrandingConfig.agent_headshot_url || null,

    // Agent personal layer
    agent_name: agentBranding.display_name || agentUser.full_name || agentEmail || '',
    agent_title: agentBranding.title || '',
    agent_phone: agentBranding.direct_phone || '',
    agent_email: agentBranding.direct_email || agentEmail || '',
    agent_license: agentBranding.license_number || '',
    agent_tagline: agentBranding.personal_tagline || '',
    signature_style: agentBranding.signature_style || 'name_title_contact',

    // Date tokens — resolved here so any template always has them
    report_date: today,
    generated_date: today,

    // Audit field
    resolution_source: resolutionSource,
  };

  return merged;
}