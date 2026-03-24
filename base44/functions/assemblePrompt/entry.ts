/**
 * assemblePrompt — Builds the full prompt for an analysis from the PromptLibrary.
 *
 * NEW: Honors analysis-type-specific section inclusion matrix.
 * Conditionally includes migration_analysis, buyer_archetypes, tiered_comps, etc.
 * based on assessment_type and opt-in flags (include_migration, include_archetypes).
 *
 * Lookup order:
 * 1. Exact match: ai_platform + assessment_type + property_type + is_active
 * 2. Fallback: ai_platform + assessment_type + property_type=all + is_active
 * 3. Fallback: generic + assessment_type + property_type=all + is_active
 * 4. Hard-coded baseline prompt if nothing found
 *
 * Replaces [PLACEHOLDER] tokens with analysis intake data.
 * Decrypts prompt_text (ENC: prefix) before substitution.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Inline section inclusion matrix (avoid import issues)
function getPromptSections(assessmentType, analysis) {
  const matrix = {
    listing_pricing: ['migration_analysis', 'buyer_archetype', 'valuation_module'],
    cma: ['valuation_module', 'location_priorities'],
    buyer_intelligence: ['migration_analysis', 'buyer_archetype'],
    investment_analysis: ['valuation_module', 'location_priorities', 'rate_environment'],
    rental_analysis: [],
    client_portfolio: ['valuation_module', 'portfolio_options', 'location_priorities', 'rate_environment'],
    custom: analysis.selected_modules || [],
  };
  
  let sections = ['system_instructions', 'intake_template', 'disclaimer_footer'];
  const base = matrix[assessmentType] || [];
  sections = [...sections, ...base];
  
  // Conditionally add opt-in sections for CMA and Investment
  if ((assessmentType === 'cma' || assessmentType === 'investment_analysis') && analysis.include_migration) {
    sections.push('migration_analysis');
  }
  if ((assessmentType === 'cma' || assessmentType === 'investment_analysis') && analysis.include_archetypes) {
    sections.push('buyer_archetype');
  }
  
  return sections;
}

async function getDecryptKey() {
  const raw = Deno.env.get("ENCRYPTION_KEY");
  if (!raw) throw new Error("ENCRYPTION_KEY environment variable is required");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(raw.slice(0, 32).padEnd(32, "0")),
    { name: "AES-GCM" },
    false,
    ["decrypt"]
  );
}

async function decryptText(encrypted) {
  const key = await getDecryptKey();
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

function substituteTokens(template, analysis, territory, extras = {}) {
  const d = analysis.intake_data || {};
  const t = territory || {};
  return template
    .replace(/\[ADDRESS\]/g, d.address || "")
    .replace(/\[PROPERTY_TYPE\]/g, analysis.property_type || "")
    .replace(/\[ASSESSMENT_TYPE\]/g, analysis.assessment_type || "")
    .replace(/\[LOCATION_CLASS\]/g, analysis.location_class || "")
    .replace(/\[CLIENT_RELATIONSHIP\]/g, d.client_relationship || "")
    .replace(/\[OUTPUT_FORMAT\]/g, analysis.output_format || "narrative")
    .replace(/\[AI_PLATFORM\]/g, analysis.ai_platform || "")
    .replace(/\[AGENT_EMAIL\]/g, analysis.run_by_email || "")
    .replace(/\[ORG_ID\]/g, analysis.org_id || "")
    .replace(/\[REGISTRY_URL\]/g, t.registry_url || "")
    .replace(/\[GIS_URL\]/g, t.gis_url || "")
    .replace(/\[TOWN_URL\]/g, t.town_url || "")
    .replace(/\[PERPLEXITY_DATA\]/g, extras.perplexity_data ? JSON.stringify(extras.perplexity_data, null, 2) : "(not available)")
    .replace(/\[GEMINI_DATA\]/g, extras.gemini_data ? JSON.stringify(extras.gemini_data, null, 2) : "(not available)")
    .replace(/\[REGISTRY_DATA\]/g, extras.registry_data ? JSON.stringify(extras.registry_data, null, 2) : "(not available)")
    .replace(/\[INTAKE_JSON\]/g, JSON.stringify(d, null, 2));
}

function buildBaselinePrompt(analysis) {
  const d = analysis.intake_data || {};
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `You are PropPrompt™, an elite AI real estate analyst for Eastern Massachusetts. Today's date is ${today}. All market data, pricing trends, and comparable sales should reflect conditions as of this date.

ASSESSMENT TYPE: ${analysis.assessment_type?.replace(/_/g, " ").toUpperCase()}
PROPERTY TYPE: ${analysis.property_type?.replace(/_/g, " ")}
ADDRESS: ${d.address || "Not provided"}
LOCATION CLASS: ${analysis.location_class || "unknown"}
CLIENT RELATIONSHIP: ${d.client_relationship || "buyer's agent"}
OUTPUT FORMAT: ${analysis.output_format || "narrative"}

INTAKE DATA:
${JSON.stringify(d, null, 2)}

Provide a thorough, professional real estate analysis. Include:
1. Executive Summary
2. Market Context (current conditions, recent trends)
3. Property/Pricing Analysis
4. Comparable Properties
5. Strategic Recommendations
6. Risk Factors
7. Conclusion

Use current market knowledge for Eastern Massachusetts. Be data-driven and specific. Use markdown formatting.`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { analysisId } = await req.json();
    if (!analysisId) return Response.json({ error: "analysisId required" }, { status: 400 });

    const records = await base44.asServiceRole.entities.Analysis.filter({ id: analysisId });
    const analysis = records[0];
    if (!analysis) return Response.json({ error: "Analysis not found" }, { status: 404 });

    // Try to find a prompt in the library
    const allPrompts = await base44.asServiceRole.entities.PromptLibrary.filter({
      is_active: true,
      prompt_section: "full_assembled",
    });

    const platform = analysis.ai_platform;
    const assessmentType = analysis.assessment_type;
    const propertyType = analysis.property_type;

    // Priority lookup
    // Try to find a matching territory for URL tokens
    let territory = null;
    try {
      const address = analysis.intake_data?.address || "";
      // Extract city name heuristic: last word before state/zip
      const cityMatch = address.match(/,\s*([^,]+?)\s*(?:,\s*MA|\s+MA|\s+0\d{4}|$)/i);
      if (cityMatch) {
        const cityName = cityMatch[1].trim();
        const territories = await base44.asServiceRole.entities.Territory.filter({ city_town: cityName });
        if (territories.length > 0) territory = territories[0];
      }
    } catch (e) {
      // Territory lookup is best-effort; never block prompt assembly
    }

    // ── NEW: Filter prompts based on analysis type matrix ──────────────────────
    const requiredSections = getPromptSections(assessmentType, analysis);
    const libraryPromptsForAnalysis = allPrompts.filter(
      (p) => requiredSections.includes(p.prompt_section) || p.prompt_section === "full_assembled"
    );

    // If we have modular prompts, assemble from sections
    let promptText = "";
    let promptSource = "baseline";

    if (libraryPromptsForAnalysis.length > 0) {
      promptSource = "library-modular";
      // Sort by priority and concatenate
      const byPlatform = libraryPromptsForAnalysis.filter(
        (p) => p.ai_platform === platform && p.assessment_type === assessmentType
      );
      const toUse = byPlatform.length > 0 ? byPlatform : libraryPromptsForAnalysis;
      promptText = (await Promise.all(
        toUse.map(async (p) => {
          let text = p.prompt_text || "";
          if (text.startsWith("FILE:")) {
            const fileUri = text.slice(5);
            const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
              file_uri: fileUri,
              expires_in: 120,
            });
            const res = await fetch(signed_url);
            return res.text();
          }
          if (text.startsWith("ENC:")) return decryptText(text.slice(4));
          return text;
        })
      )).then((texts) => texts.join("\n\n"));
    } else {
      // Fallback: use full_assembled or baseline
      const match =
        allPrompts.find(
          (p) =>
            p.ai_platform === platform &&
            p.assessment_type === assessmentType &&
            p.property_type === propertyType &&
            p.prompt_section === "full_assembled"
        ) ||
        allPrompts.find(
          (p) =>
            p.ai_platform === platform &&
            p.assessment_type === assessmentType &&
            p.property_type === "all" &&
            p.prompt_section === "full_assembled"
        ) ||
        allPrompts.find(
          (p) => p.ai_platform === "generic" && p.assessment_type === assessmentType && p.property_type === "all"
        ) ||
        null;

      if (!match) {
        return Response.json({ prompt: buildBaselinePrompt(analysis), source: "baseline" });
      }

      promptText = match.prompt_text || "";
      if (promptText.startsWith("FILE:")) {
        const fileUri = promptText.slice(5);
        const { signed_url } = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
          file_uri: fileUri,
          expires_in: 120,
        });
        const fileRes = await fetch(signed_url);
        promptText = await fileRes.text();
      }
      if (promptText.startsWith("ENC:")) {
        promptText = await decryptText(promptText.slice(4));
      }
      promptSource = "library";
    }

    const assembled = substituteTokens(promptText, analysis, territory);

    // Store assembled prompt and included sections on the analysis
    await base44.asServiceRole.entities.Analysis.update(analysisId, {
      prompt_assembled: assembled,
      selected_modules: requiredSections,
    });

    return Response.json({ prompt: assembled, source: promptSource });

  } catch (error) {
    console.error("assemblePrompt error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});