/**
 * platformAggregate — Aggregate-only analytics for platform_owner.
 * Per Section A3.3: NO individual analysis content, addresses, or output_text exposed.
 * k-anonymity: suppress towns with < 3 analyses.
 *
 * Returns:
 * - counts by org (analyses count, seat count, compliance status)
 * - analyses by type / platform / month (no addresses, no content)
 * - town heatmap with k=3 anonymity threshold
 * - fair housing aggregate: signed count, overdue count (no review text)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const K_ANON_THRESHOLD = 3;

function extractTown(address) {
  if (!address) return null;
  // "123 Main St, Marblehead, MA 01945" → "Marblehead"
  const parts = address.split(",").map((p) => p.trim());
  if (parts.length >= 2) {
    const townCandidate = parts[parts.length - 2];
    // Strip state + zip: "MA 01945" → skip; "Marblehead" → keep
    if (!/^\s*[A-Z]{2}\s*\d{0,5}\s*$/.test(townCandidate)) {
      return townCandidate;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "platform_owner" && user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch data — ONLY fields needed for aggregation, never output_text / prompt_assembled
    const [orgs, analyses, reviews, memberships] = await Promise.all([
      base44.asServiceRole.entities.Organization.list(),
      base44.asServiceRole.entities.Analysis.list("-created_date", 2000),
      base44.asServiceRole.entities.FairHousingReview.list(),
      base44.asServiceRole.entities.OrgMembership.list(),
    ]);

    // Analyses by type (no content)
    const byType = {};
    const byPlatform = {};
    const byMonth = {};
    const townCounts = {};

    for (const a of analyses) {
      // Skip private analyses entirely
      if (a.is_private) continue;

      const type = a.assessment_type || "unknown";
      byType[type] = (byType[type] || 0) + 1;

      const platform = a.ai_platform || "unknown";
      byPlatform[platform] = (byPlatform[platform] || 0) + 1;

      const month = a.created_date?.slice(0, 7) || "unknown";
      byMonth[month] = (byMonth[month] || 0) + 1;

      // Town heatmap — extract from address in intake_data
      const town = extractTown(a.intake_data?.address);
      if (town) townCounts[town] = (townCounts[town] || 0) + 1;
    }

    // Apply k-anonymity: suppress towns with < K_ANON_THRESHOLD analyses
    const townHeatmap = Object.entries(townCounts)
      .filter(([, count]) => count >= K_ANON_THRESHOLD)
      .map(([town, count]) => ({ town, count }))
      .sort((a, b) => b.count - a.count);

    // Fair housing aggregate (no review text — counts only)
    const fhByStat = {};
    for (const r of reviews) {
      fhByStat[r.status] = (fhByStat[r.status] || 0) + 1;
    }
    const fhByOrg = {};
    for (const r of reviews) {
      if (!fhByOrg[r.org_id]) fhByOrg[r.org_id] = { signed: 0, overdue: 0, pending: 0 };
      const s = r.status === "signed" ? "signed" : r.status === "overdue" ? "overdue" : "pending";
      fhByOrg[r.org_id][s]++;
    }

    // Org summary (aggregate counts, no analysis content)
    const orgSummary = orgs.map((o) => {
      const orgAnalyses = analyses.filter((a) => a.org_id === o.id && !a.is_private);
      const orgMembers = memberships.filter((m) => m.org_id === o.id && m.status === "active");
      const fh = fhByOrg[o.id] || { signed: 0, overdue: 0, pending: 0 };
      return {
        id: o.id,
        name: o.name,
        org_type: o.org_type,
        status: o.status,
        subscription_plan: o.subscription_plan,
        seat_count: orgMembers.length,
        analysis_count: orgAnalyses.length,
        fair_housing: fh,
        // NO: analyses content, addresses, output_text, intake_data
      };
    });

    return Response.json({
      summary: {
        total_orgs: orgs.length,
        total_analyses: analyses.filter((a) => !a.is_private).length,
        private_count: analyses.filter((a) => a.is_private).length, // counted but not revealed
        fair_housing: fhByStat,
      },
      by_type: byType,
      by_platform: byPlatform,
      by_month: byMonth,
      town_heatmap: townHeatmap,
      org_summary: orgSummary,
    });

  } catch (error) {
    console.error("[platformAggregate] error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});