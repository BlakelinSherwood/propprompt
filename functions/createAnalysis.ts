import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Create analysis record (service role to allow unauthenticated requests)
    const analysis = await base44.asServiceRole.entities.Analysis.create({
      run_by_email: body.run_by_email,
      on_behalf_of_email: body.on_behalf_of_email || null,
      org_id: body.org_id || null,
      assessment_type: body.assessment_type,
      property_type: body.property_type,
      location_class: body.location_class,
      ai_platform: body.ai_platform,
      ai_model: body.ai_model || null,
      output_format: body.output_format,
      status: 'draft',
      intake_data: {
        address: body.address,
        client_relationship: body.client_relationship,
        drive_sync: body.drive_sync,
      },
      drive_sync_status: body.drive_sync ? 'pending' : 'not_synced',
    });

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create analysis:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create analysis' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});