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
    listing_pricing: {
      base: ['migration_analysis', 'buyer_archetype', 'tiered_comps', 'listing_timing', 'attribute_alignment_grid', 'location_priority_characteristics'],
    },
    cma: {
      base: ['tiered_comps', 'location_priority_characteristics'],
      migration_opt: ['migration_analysis'],
      archetype_opt: ['buyer_archetype'],
    },
    buyer_intelligence: {
      base: ['migration_analysis', 'buyer_archetype', 'listing_timing', 'attribute_alignment_grid', 'location_priority_characteristics'],
    },
    investment_analysis: {
      base: ['tiered_comps', 'location_priority_characteristics', 'rate_environment'],
      migration_opt: ['migration_analysis'],
      archetype_opt: ['buyer_archetype'],
    },
    rental_analysis: {
      base: [],
    },
    client_portfolio: {
      base: ['tiered_comps', 'portfolio_options', 'adu_option', 'location_priority_characteristics', 'rate_environment'],
    },
    custom: {
      base: analysis.selected_modules || [],
    },
  };
  
  const config = matrix[assessmentType] || { base: [] };
  let sections = ['system_instructions', 'intake_template', 'disclaimer_footer', ...config.base];
  
  // Add opt-in sections for CMA and Investment
  if (analysis.include_migration && config.migration_opt) {
    sections.push(...config.migration_opt);
  }
  if (analysis.include_archetypes && config.archetype_opt) {
    sections.push(...config.archetype_opt);
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
  return `ASSESSMENT TYPE: ${analysis.assessment_type?.replace(/_/g, " ").toUpperCase()}
PROPERTY TYPE: ${analysis.property_type?.replace(/_/g, " ")}
ADDRESS: ${d.address || "Not provided"}
LOCATION CLASS: ${analysis.location_class || "unknown"}
CLIENT RELATIONSHIP: ${d.client_relationship || "buyer's agent"}
TODAY'S DATE: ${today}

INTAKE DATA:
${JSON.stringify(d, null, 2)}

Perform a complete PropPrompt™ analysis for the above property. Follow the JSON schema and all instructions in the system prompt exactly. Return a single JSON object with all required fields populated with real, specific data for this property, location, and market conditions.`;
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

    // Strip any conflicting output-format instructions from library prompts
    const cleanedPromptText = promptText
      .replace(/use markdown formatting\.?/gi, '')
      .replace(/respond with (?:a )?(?:markdown|narrative|prose).*?\./gi, '')
      .trim();

    const assembled = substituteTokens(cleanedPromptText, analysis, territory);

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