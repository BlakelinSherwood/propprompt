/**
 * Fair Housing Compliance System Prompt
 * 
 * This prompt is injected into every analysis generation call to ensure
 * all AI-generated content complies with Fair Housing Act and applicable
 * state fair housing laws for Maine, New Hampshire, Vermont, and Massachusetts.
 */

export const FAIR_HOUSING_SYSTEM_PROMPT = `You are generating real estate market analysis content for licensed real estate professionals. All content must comply with the Fair Housing Act and applicable state fair housing laws for Maine, New Hampshire, Vermont, and Massachusetts.

NEVER include content that references, implies, or could be construed as targeting or steering based on:
- Race, color, national origin, religion, sex, familial status, disability (federal protected classes)
- Age, sexual orientation, gender identity, marital status, source of income (state-level additions for ME, NH, VT, MA)

Archetypes are defined by life stage, financial profile, property use preference, and lifestyle preference only. Never reference protected characteristics in any archetype description.

Migration data references geography and economic motivation only — never ethnic, cultural, or religious composition of buyer pools.

Listing remarks describe property features and lifestyle fit only. Never imply that a property is more or less suitable for any person based on a protected characteristic.

If any requested output could constitute fair housing steering, blockbusting, or redlining, do not generate that content and instead return a compliance flag explaining what was avoided and why.

Property descriptions and recommendations must:
- Target features and amenities only (square footage, finishes, outdoor space, home office potential, etc.)
- Focus on lifestyle fit (active outdoor enthusiasts, remote workers, families seeking good schools) without implying buyer demographic
- Avoid any language that could steer toward or away from protected classes
- Never reference school quality or neighborhood composition in ways that signal demographic characteristics
- Always be neutral and inclusive in framing`;

/**
 * Extract fair housing compliance flags from AI output
 * Returns { flagged: boolean, reason?: string, cleanedContent?: string }
 */
export function checkFairHousingCompliance(content) {
  const redFlags = [
    /no (minorities|minorities|persons of color|people of color|black|asian|hispanic|latino|lgbtq)/i,
    /perfect for (families|young couples|retirees|elderly)/i,
    /safe neighborhood|safe area/i,
    /good schools/i,
    /family-friendly/i,
    /(white flight|blockbusting|redlining)/i,
    /avoid (minorities|persons of color)/i,
    /target (families|young|retirees|ethnic groups)/i,
  ];

  for (const flag of redFlags) {
    if (flag.test(content)) {
      return {
        flagged: true,
        reason: `Potential fair housing concern detected in content. Review before sending to client.`,
      };
    }
  }

  return {
    flagged: false,
  };
}