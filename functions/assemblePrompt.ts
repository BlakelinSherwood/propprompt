/**
 * assemblePrompt — Builds the full prompt for an analysis from the PromptLibrary.
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

function substituteTokens(template, analysis, territory) {
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

    let match =
      allPrompts.find((p) => p.ai_platform === platform && p.assessment_type === assessmentType && p.property_type === propertyType) ||
      // No library entry — use baseline
      return Response.json({ prompt: buildBaselinePrompt(analysis), source: "baseline" });
    }

    let promptText = match.prompt_text || "";
    if (promptText.startsWith("ENC:")) {
      promptText = await decryptText(promptText.slice(4));
    }

    const assembled = substituteTokens(promptText, analysis, territory);

    // Store assembled prompt on the analysis
    await base44.asServiceRole.entities.Analysis.update(analysisId, { prompt_assembled: assembled });

    return Response.json({ prompt: assembled, source: "library", promptId: match.id });

  } catch (error) {
    console.error("assemblePrompt error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});