import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process create events
    if (event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not a create event' });
    }

    // Only process if analysis has a contact_id
    if (!data?.contact_id) {
      return Response.json({ skipped: true, reason: 'no contact_id' });
    }

    // Fetch the contact
    const contacts = await base44.asServiceRole.entities.Contact.filter({ id: data.contact_id });
    if (contacts.length === 0) {
      return Response.json({ error: 'Contact not found' }, { status: 404 });
    }

    const contact = contacts[0];
    const currentCount = contact.analyses_count || 0;

    // Update contact with new count and last analysis date
    await base44.asServiceRole.entities.Contact.update(contact.id, {
      analyses_count: currentCount + 1,
      last_analysis_date: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      contact_id: contact.id,
      new_count: currentCount + 1,
    });
  } catch (error) {
    console.error('Error updating contact analysis count:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});