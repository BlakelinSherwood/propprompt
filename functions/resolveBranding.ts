import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    const branding = await resolveBrandingForAnalysis(base44, analysisId);
    return Response.json({ branding });
  } catch (error) {
    console.error('resolveBranding error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

export async function resolveBrandingForAnalysis(base44, analysisId) {
  const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
  const analysis = analyses[0];
  if (!analysis) throw new Error('Analysis not found');

  const orgId = analysis.org_id;
  const runByEmail = analysis.run_by_email;

  const orgs = await base44.asServiceRole.entities.Organization.filter({ id: orgId });
  const org = orgs[0] || {};

  let brokerageOrg = org;
  if (org.org_type === 'team' && org.parent_org_id) {
    const parents = await base44.asServiceRole.entities.Organization.filter({ id: org.parent_org_id });
    brokerageOrg = parents[0] || org;
  }

  const [brokerageBrandingArr, teamBrandingArr, agentBrandingArr, users] = await Promise.all([
    base44.asServiceRole.entities.OrgBranding.filter({ org_id: brokerageOrg.id }),
    org.org_type === 'team'
      ? base44.asServiceRole.entities.OrgBranding.filter({ org_id: orgId })
      : Promise.resolve([]),
    base44.asServiceRole.entities.AgentBranding.filter({ user_email: runByEmail }),
    base44.asServiceRole.entities.User.filter({ email: runByEmail }),
  ]);

  const bb = brokerageBrandingArr[0] || {};
  const tb = teamBrandingArr[0] || {};
  const ab = agentBrandingArr[0] || {};
  const agentUser = users[0] || {};

  return {
    org_name:           tb.org_name         || bb.org_name         || org.name          || '',
    org_logo_url:       tb.logo_url          || bb.logo_url          || null,
    org_tagline:        tb.tagline           || bb.tagline           || '',
    org_address:        tb.address           || bb.address           || '',
    org_phone:          tb.phone             || bb.phone             || '',
    org_website:        tb.website           || bb.website           || '',
    primary_color:      tb.primary_color     || bb.primary_color     || '#333333',
    accent_color:       tb.accent_color      || bb.accent_color      || '#666666',
    background_color:   tb.background_color  || bb.background_color  || '#FFFFFF',
    agent_name:         ab.display_name      || agentUser.full_name  || runByEmail,
    agent_title:        ab.title             || '',
    agent_phone:        ab.direct_phone      || '',
    agent_email:        ab.direct_email      || runByEmail,
    agent_license:      ab.license_number    || '',
    agent_tagline:      ab.personal_tagline  || '',
    agent_headshot_url: ab.headshot_url      || null,
    signature_style:    ab.signature_style   || 'name_title_contact',
  };
}