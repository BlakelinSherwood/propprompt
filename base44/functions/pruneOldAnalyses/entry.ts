import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Deletes analyses older than 30 days. Run daily via scheduled automation.
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString();

  const old = await base44.asServiceRole.entities.Analysis.filter({
    created_date: { $lt: cutoffStr },
  });

  console.log(`[pruneOldAnalyses] Found ${old.length} analyses older than 30 days`);

  let deleted = 0;
  for (const a of old) {
    await base44.asServiceRole.entities.Analysis.delete(a.id);
    deleted++;
  }

  console.log(`[pruneOldAnalyses] Deleted ${deleted} analyses`);
  return Response.json({ deleted });
});