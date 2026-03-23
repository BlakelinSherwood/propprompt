import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const BANNED_PHRASES = [
  { pattern: /\bthe value is\s+\$/i, replacement: 'Estimated value range is approximately' },
  { pattern: /\byou will net\s+\$/i, replacement: 'Estimated net proceeds (to be verified)' },
  { pattern: /\byour payoff is\s+\$/i, replacement: 'Estimated remaining balance of approximately' },
  { pattern: /\bthe market will\b/i, replacement: 'Current market data suggests' },
  { pattern: /\bbuyers are looking for\b/i, replacement: 'Recent sales data indicates buyers have prioritized' },
  { pattern: /\bthis property (is|will be) worth\s+\$/i, replacement: 'The estimated value range for this property is approximately' }
];

const REQUIRED_DISCLAIMERS = {
  value_estimate: 'This is an estimated range based on available market data and is not an appraisal. Values may differ based on property condition, undisclosed improvements, or market changes after the search date.',
  mortgage_estimate: 'Mortgage payoff estimates are calculated from public recording data and historical rate assumptions. Obtain an official payoff statement from your lender before making financial decisions.',
  general_report: 'This report is prepared for use by licensed real estate professionals as a client communication and discussion tool. It is not a substitute for an appraisal, title search, legal advice, or financial planning consultation.'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { text, check_type } = await req.json();
    
    if (!text) {
      return Response.json({ error: 'text required' }, { status: 400 });
    }

    let cleanedText = text;
    const edits = [];
    let replacementCount = 0;

    // Check for banned phrases
    for (const banned of BANNED_PHRASES) {
      const matches = text.match(banned.pattern);
      if (matches) {
        cleanedText = cleanedText.replace(banned.pattern, banned.replacement);
        edits.push({
          type: 'banned_phrase',
          original: matches[0],
          replacement: banned.replacement,
          reason: 'Banned phrase replaced with compliant language'
        });
        replacementCount++;
      }
    }

    // Add required disclaimers if missing
    if (check_type === 'full_report' || !check_type) {
      if (!cleanedText.includes('This is an estimated') && !cleanedText.includes('not an appraisal')) {
        cleanedText += `\n\n${REQUIRED_DISCLAIMERS.value_estimate}`;
        edits.push({
          type: 'missing_disclaimer',
          added: 'value_estimate_disclaimer'
        });
      }
      
      if (!cleanedText.includes('Mortgage payoff estimates') && !cleanedText.includes('official payoff statement')) {
        cleanedText += `\n\n${REQUIRED_DISCLAIMERS.mortgage_estimate}`;
        edits.push({
          type: 'missing_disclaimer',
          added: 'mortgage_estimate_disclaimer'
        });
      }

      if (!cleanedText.includes('licensed real estate professionals') && !cleanedText.includes('not a substitute')) {
        cleanedText += `\n\n${REQUIRED_DISCLAIMERS.general_report}`;
        edits.push({
          type: 'missing_disclaimer',
          added: 'general_report_disclaimer'
        });
      }
    }

    const flagForReview = replacementCount > 3;

    const response = {
      cleaned_text: cleanedText,
      edits: edits,
      replacement_count: replacementCount,
      flag_for_review: flagForReview,
      compliance_status: replacementCount === 0 ? 'compliant' : 'auto_corrected'
    };

    return Response.json(response);
  } catch (error) {
    console.error('[languageComplianceCheck] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});