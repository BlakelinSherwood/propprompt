/**
 * analysisTypeMatrix.js
 * Maps analysis_type → which expanded sections should be included.
 * Controls system prompt section assembly and deck builder logic.
 */

// Section inclusion matrix
// ✓ = always included, ○ = opt-in (toggle), ✗ = never included
const SECTION_MATRIX = {
  listing_pricing: {
    migration_analysis: true,
    buyer_archetypes_expanded: true,
    attribute_alignment_grid: true,
    tiered_comps: true,
    portfolio_options: false,
    adu_option: false,
    listing_timing: true,
    location_priorities: true,
    rate_environment: false,
  },
  cma: {
    migration_analysis: "optional", // ○ opt-in via include_migration
    buyer_archetypes_expanded: "optional", // ○ opt-in via include_archetypes
    attribute_alignment_grid: false,
    tiered_comps: true,
    portfolio_options: false,
    adu_option: false,
    listing_timing: false,
    location_priorities: true,
    rate_environment: false,
  },
  buyer_intelligence: {
    migration_analysis: true,
    buyer_archetypes_expanded: true,
    attribute_alignment_grid: true,
    tiered_comps: false,
    portfolio_options: false,
    adu_option: false,
    listing_timing: true,
    location_priorities: true,
    rate_environment: false,
  },
  investment_analysis: {
    migration_analysis: "optional", // ○ opt-in via include_migration
    buyer_archetypes_expanded: "optional", // ○ opt-in via include_archetypes
    attribute_alignment_grid: false,
    tiered_comps: true,
    portfolio_options: false,
    adu_option: false,
    listing_timing: false,
    location_priorities: true,
    rate_environment: true,
  },
  rental_analysis: {
    migration_analysis: false,
    buyer_archetypes_expanded: false,
    attribute_alignment_grid: false,
    tiered_comps: false,
    portfolio_options: false,
    adu_option: false,
    listing_timing: false,
    location_priorities: false,
    rate_environment: false,
  },
  client_portfolio: {
    migration_analysis: false,
    buyer_archetypes_expanded: false,
    attribute_alignment_grid: false,
    tiered_comps: true,
    portfolio_options: true,
    adu_option: true,
    listing_timing: false,
    location_priorities: true,
    rate_environment: true,
  },
  custom: {
    // Agent selects via module picker (selected_modules array)
    // All sections available if selected
    all_configurable: true,
  },
};

// Credit cost multipliers for expanded sections
const CREDIT_COSTS = {
  base: 1,
  migration_analysis: 1,
  buyer_archetypes_expanded: 1,
  portfolio_options: 2, // Large generation
};

/**
 * Get which sections should be included for an analysis type
 * @param {string} assessmentType - e.g., 'listing_pricing', 'cma'
 * @param {object} analysis - analysis record with include_migration, include_archetypes, selected_modules
 * @returns {object} { sectionName: boolean }
 */
export function getIncludedSections(assessmentType, analysis = {}) {
  const matrix = SECTION_MATRIX[assessmentType] || {};
  const result = {};

  Object.entries(matrix).forEach(([section, status]) => {
    if (status === true) {
      // Always included
      result[section] = true;
    } else if (status === "optional") {
      // Check opt-in flag
      if (section === "migration_analysis") {
        result[section] = analysis.include_migration === true;
      } else if (section === "buyer_archetypes_expanded") {
        result[section] = analysis.include_archetypes === true;
      }
    } else {
      result[section] = false;
    }
  });

  // Custom: check selected_modules
  if (assessmentType === "custom" && Array.isArray(analysis.selected_modules)) {
    const allSections = [
      "migration_analysis",
      "buyer_archetypes_expanded",
      "attribute_alignment_grid",
      "tiered_comps",
      "portfolio_options",
      "adu_option",
      "listing_timing",
      "location_priorities",
      "rate_environment",
    ];
    allSections.forEach((section) => {
      result[section] = analysis.selected_modules.includes(section);
    });
  }

  return result;
}

/**
 * Calculate total credit cost for an analysis
 * @param {string} assessmentType
 * @param {object} analysis
 * @returns {number} credit cost
 */
export function calculateAnalysisCost(assessmentType, analysis = {}) {
  let cost = CREDIT_COSTS.base;
  const sections = getIncludedSections(assessmentType, analysis);

  if (sections.migration_analysis) cost += CREDIT_COSTS.migration_analysis;
  if (sections.buyer_archetypes_expanded)
    cost += CREDIT_COSTS.buyer_archetypes_expanded;
  if (sections.portfolio_options) cost += CREDIT_COSTS.portfolio_options;

  return cost;
}

/**
 * Get system prompt sections to include
 * @param {string} assessmentType
 * @param {object} analysis
 * @returns {string[]} array of prompt_section names to include
 */
export function getPromptSections(assessmentType, analysis = {}) {
  const included = getIncludedSections(assessmentType, analysis);
  const sections = [
    "system_instructions",
    "intake_template",
    "disclaimer_footer",
  ];

  if (included.migration_analysis) sections.push("migration_module");
  if (included.buyer_archetypes_expanded) sections.push("buyer_archetype");
  if (included.tiered_comps) sections.push("valuation_module");
  if (included.portfolio_options) sections.push("portfolio_options");

  return sections;
}

export default {
  SECTION_MATRIX,
  CREDIT_COSTS,
  getIncludedSections,
  calculateAnalysisCost,
  getPromptSections,
};