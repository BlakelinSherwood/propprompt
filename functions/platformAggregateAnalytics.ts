/**
 * platformAggregateAnalytics — Aggregate-only analytics for platform_owner.
 * Per Addendum A3.3: NO individual analysis content, prompts, or addresses ever returned.
 * Town-level heat map applies k-anonymity: suppress towns with < 3 analyses.
 *
 * Returns:
 * - totalAnalysesByMonth[]
 * - analysesByType{}
 * - analysesByPlatform{}
 * - analysesByPropertyType{}
 * - orgCountByStatus{}
 * - userCountByRole{}
 * - fairHousingCounts{ signed, overdue, pending }
 * - townHeatMap[{ town, count }] — only towns with >= 3 analyses (k-anonymity)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const K_ANONYMITY_THRESHOLD = 3;

// Extract town from address without storing the address itself
function extractTown(address) {
  if (!address) return null;
  // MA address format: "123 Main St, Marblehead, MA 01945"
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 2].trim().toLowerCase();
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'platform_owner') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all data — but we only aggregate, NEVER return individual records
    const [analyses, orgs, users, fhReviews] = await Promise.all([
      base44.asServiceRole.entities.Analysis.list('-created_date', 2000),
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.FairHousingReview.list(),
    ]);

    // --- Analyses by month (last 12 months) ---
    const monthMap = {};
    for (const a of analyses) {
      const d = new Date(a.created_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[key] = (monthMap[key] || 0) + 1;
    }
    const totalAnalysesByMonth = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, count]) => ({ month, count }));

    // --- Aggregates ---
    const analysesByType = {};
    const analysesByPlatform = {};
    const analysesByPropertyType = {};
    const townRaw = {};

    for (const a of analyses) {
      analysesByType[a.assessment_type] = (analysesByType[a.assessment_type] || 0) + 1;
      analysesByPlatform[a.ai_platform] = (analysesByPlatform[a.ai_platform] || 0) + 1;
      analysesByPropertyType[a.property_type] = (analysesByPropertyType[a.property_type] || 0) + 1;

      // Town heat map — never store the raw address, only the extracted town
      const town = extractTown(a.intake_data?.address);
      if (town) townRaw[town] = (townRaw[town] || 0) + 1;
    }

    // Apply k-anonymity: suppress towns with < 3 analyses
    const townHeatMap = Object.entries(townRaw)
      .filter(([, count]) => count >= K_ANONYMITY_THRESHOLD)
      .sort(([, a], [, b]) => b - a)
      .map(([town, count]) => ({ town, count }));

    // --- Org counts ---
    const orgCountByStatus = {};
    const orgCountByType = {};
    for (const o of orgs) {
      orgCountByStatus[o.status] = (orgCountByStatus[o.status] || 0) + 1;
      orgCountByType[o.org_type] = (orgCountByType[o.org_type] || 0) + 1;
    }

    // --- User counts ---
    const userCountByRole = {};
    for (const u of users) {
      userCountByRole[u.role] = (userCountByRole[u.role] || 0) + 1;
    }

    // --- Fair housing aggregate (counts only) ---
    const fairHousingCounts = { signed: 0, overdue: 0, pending: 0, viewed: 0 };
    for (const r of fhReviews) {
      if (fairHousingCounts.hasOwnProperty(r.status)) {
        fairHousingCounts[r.status]++;
      }
    }

    return Response.json({
      totalAnalyses: analyses.length,
      totalOrgs: orgs.length,
      totalUsers: users.length,
      totalAnalysesByMonth,
      analysesByType,
      analysesByPlatform,
      analysesByPropertyType,
      orgCountByStatus,
      orgCountByType,
      userCountByRole,
      fairHousingCounts,
      townHeatMap,
      kAnonymityThreshold: K_ANONYMITY_THRESHOLD,
    });
  } catch (error) {
    console.error('[platformAggregateAnalytics] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});