import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// AES-256-CBC encryption using Web Crypto API
async function encryptText(plaintext, keyHex) {
  const encoder = new TextEncoder();
  const keyBytes = encoder.encode(keyHex.padEnd(32).slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'AES-CBC' }, false, ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(16));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    cryptoKey,
    encoder.encode(plaintext)
  );
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

function buildPrompt(analysis, promptParts, format) {
  const intake = analysis.intake_data || {};
  const followup = analysis.followup_answers || {};

  // Substitute intake data into template tokens
  function fillTemplate(text) {
    if (!text) return '';
    return text
      .replace(/\[PROPERTY_ADDRESS\]/g, intake.address || 'Not provided')
      .replace(/\[PROPERTY_TYPE\]/g, analysis.property_type || '')
      .replace(/\[LOCATION_CLASS\]/g, analysis.location_class || '')
      .replace(/\[ASSESSMENT_TYPE\]/g, analysis.assessment_type || '')
      .replace(/\[CLIENT_RELATIONSHIP\]/g, intake.client_relationship || '')
      .replace(/\[OUTPUT_FORMAT\]/g, format || 'narrative')
      .replace(/\[BEDROOMS\]/g, intake.bedrooms || '')
      .replace(/\[BATHROOMS\]/g, intake.bathrooms || '')
      .replace(/\[SQFT\]/g, intake.sqft || '')
      .replace(/\[YEAR_BUILT\]/g, intake.year_built || '')
      .replace(/\[LIST_PRICE\]/g, intake.list_price || 'Not specified')
      .replace(/\[ADDITIONAL_NOTES\]/g, intake.additional_notes || 'None')
      .replace(/\[FOLLOWUP_ANSWERS\]/g, JSON.stringify(followup, null, 2) || 'None');
  }

  const sections = [
    'system_instructions',
    'intake_template',
    'followup_protocol',
    'valuation_module',
    'archetype_module',
    'avm_module',
    'listing_strategy_module',
    'disclaimer_footer'
  ];

  const parts = sections
    .map(section => promptParts[section])
    .filter(Boolean)
    .map(fillTemplate);

  // Format modifier
  const formatModifier = format === 'structured'
    ? '\n\nOUTPUT FORMAT: Respond with clearly labeled sections using headers (##). Use tables where helpful.'
    : format === 'bullets'
    ? '\n\nOUTPUT FORMAT: Respond primarily in bullet points and sub-bullets. Keep each point concise.'
    : '\n\nOUTPUT FORMAT: Respond in flowing narrative paragraphs with professional real estate language.';

  parts.splice(-1, 0, formatModifier); // Insert before disclaimer

  return parts.join('\n\n---\n\n');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: 'analysisId required' }, { status: 400 });

    // Load analysis
    const analyses = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = analyses[0];
    if (!analysis) return Response.json({ error: 'Analysis not found' }, { status: 404 });

    // Load prompt library parts for this assessment/property combo
    const promptRecords = await base44.asServiceRole.entities.PromptLibrary.filter({
      assessment_type: analysis.assessment_type,
      is_active: true
    });

    // Build a map: section → text (prefer property-specific over 'all')
    const promptMap = {};
    for (const rec of promptRecords) {
      if (rec.property_type === analysis.property_type || rec.property_type === 'all') {
        // property-specific takes priority
        if (!promptMap[rec.prompt_section] || rec.property_type === analysis.property_type) {
          promptMap[rec.prompt_section] = rec.prompt_text;
        }
      }
    }

    // If no prompts found in library, use a built-in fallback system prompt
    if (Object.keys(promptMap).length === 0) {
      promptMap['system_instructions'] = `You are PropPrompt™, an AI-Calibrated Real Estate Analysis System developed for Sherwood & Company, Brokered by Compass, specializing in Eastern Massachusetts real estate markets. You provide professional, data-informed analysis for licensed real estate agents. You are bound by all applicable Fair Housing laws and Massachusetts real estate regulations. Never make statements about neighborhood demographics, school quality in relation to demographics, or any language that could constitute steering.`;
      promptMap['intake_template'] = `PROPERTY ANALYSIS REQUEST\n\nProperty Address: [PROPERTY_ADDRESS]\nProperty Type: [PROPERTY_TYPE]\nLocation Classification: [LOCATION_CLASS]\nAssessment Type: [ASSESSMENT_TYPE]\nClient Relationship: [CLIENT_RELATIONSHIP]\nBedrooms: [BEDROOMS] | Bathrooms: [BATHROOMS]\nSquare Footage: [SQFT] | Year Built: [YEAR_BUILT]\nList Price / Target: [LIST_PRICE]\nAdditional Notes: [ADDITIONAL_NOTES]`;
      promptMap['followup_protocol'] = `FOLLOW-UP CONTEXT:\n[FOLLOWUP_ANSWERS]`;
      promptMap['valuation_module'] = `Provide a thorough valuation analysis based on the property details above. Include comparable sales analysis, market trend assessment, and price positioning recommendations specific to the Eastern Massachusetts market and the [LOCATION_CLASS] location class.`;
      promptMap['disclaimer_footer'] = `---\n**DISCLAIMER:** This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional. PropPrompt™ analyses are tools to augment, not replace, professional judgment. This analysis was generated by PropPrompt™ v3.0 for Sherwood & Company, Brokered by Compass.`;
    }

    const assembled = buildPrompt(analysis, promptMap, analysis.output_format);

    // Encrypt before storing
    const encryptionKey = Deno.env.get('ENCRYPTION_KEY');
    const encrypted = await encryptText(assembled, encryptionKey);

    // Store encrypted prompt, update status
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      prompt_assembled: encrypted,
      status: 'in_progress'
    });

    // Return the PLAIN prompt only to this authorized server call — never expose to frontend directly
    // The claudeStream function will call this and receive the plaintext
    return Response.json({ 
      success: true, 
      prompt: assembled,  // returned only to server-to-server calls
      systemPrompt: promptMap['system_instructions'] || '',
      userPrompt: assembled.replace(promptMap['system_instructions'] || '', '').trim()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});