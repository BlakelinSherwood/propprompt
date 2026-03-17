import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const DEFAULTS = {
  primary_color: '#333333',
  accent_color: '#666666',
  background_color: '#FFFFFF',
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
  const [brokerageBrandingList, teamBrandingList, agentBrandingList, userList] = await Promise.all([
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
  ]);

  const brokerageBranding = brokerageBrandingList[0] || {};
  const teamBranding = teamBrandingList[0] || {};
  const agentBranding = agentBrandingList[0] || {};
  const agentUser = userList[0] || {};

  // 6. Merge: brokerage → team → agent
  // For team, only override if the team has explicitly set the field (non-null, non-empty)
  const merged = {
    // Org identity layer
    org_name: teamBranding.org_name || brokerageBranding.org_name || org?.name || '',
    org_logo_url: teamBranding.logo_url || brokerageBranding.logo_url || null,
    org_tagline: teamBranding.tagline || brokerageBranding.tagline || '',
    org_address: teamBranding.address || brokerageBranding.address || '',
    org_phone: teamBranding.phone || brokerageBranding.phone || '',
    org_website: teamBranding.website || brokerageBranding.website || '',

    // Colors — team overrides brokerage, fall back to hard defaults
    primary_color: teamBranding.primary_color || brokerageBranding.primary_color || DEFAULTS.primary_color,
    accent_color: teamBranding.accent_color || brokerageBranding.accent_color || DEFAULTS.accent_color,
    background_color: teamBranding.background_color || brokerageBranding.background_color || DEFAULTS.background_color,

    // Agent personal layer
    agent_name: agentBranding.display_name || agentUser.full_name || agentEmail || '',
    agent_title: agentBranding.title || '',
    agent_phone: agentBranding.direct_phone || '',
    agent_email: agentBranding.direct_email || agentEmail || '',
    agent_license: agentBranding.license_number || '',
    agent_tagline: agentBranding.personal_tagline || '',
    agent_headshot_url: agentBranding.headshot_url || null,
    signature_style: agentBranding.signature_style || 'name_title_contact',
  };

  return merged;
}