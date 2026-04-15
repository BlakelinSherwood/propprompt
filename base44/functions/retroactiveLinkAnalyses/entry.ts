import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all analyses run by this user without a contact_id
    const allAnalyses = await base44.asServiceRole.entities.Analysis.filter({
      run_by_email: user.email,
    });
    const analyses = allAnalyses.filter(a => !a.contact_id);

    // Get org from first analysis if available
    const orgId = analyses[0]?.org_id;
    if (!orgId) {
      return Response.json({
        success: true,
        message: 'No analyses found for this user',
        linked: 0,
        total: 0,
      });
    }

    // Get all contacts for this org
    const contacts = await base44.asServiceRole.entities.Contact.filter({
      org_id: orgId,
    });

    let linkedCount = 0;

    // Match and link
    for (const analysis of analyses) {
      const address = analysis.intake_data?.address?.toLowerCase().trim();
      if (!address) continue;

      const match = contacts.find(
        (c) =>
          c.property_address &&
          c.property_address.toLowerCase().trim() === address
      );

      if (match) {
        await base44.asServiceRole.entities.Analysis.update(analysis.id, {
          contact_id: match.id,
        });
        linkedCount++;
      }
    }

    return Response.json({
      success: true,
      message: `Retroactively linked ${linkedCount} analyses out of ${analyses.length}`,
      linked: linkedCount,
      total: analyses.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});