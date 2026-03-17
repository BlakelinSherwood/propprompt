/**
 * Analysis Module Configuration
 * 
 * All available modules for custom analysis builder and add-ons
 */

export const ANALYSIS_MODULES = {
  comp_valuation: {
    id: "comp_valuation",
    name: "Comp Valuation (three-tier)",
    description: "Three-tier comp structure with close, mid, and wide radius comparables",
    creditCost: 1,
    category: "valuation",
  },
  avm_gap_analysis: {
    id: "avm_gap_analysis",
    name: "AVM Gap Analysis",
    description: "Automated valuation model comparison and gap to market estimate",
    creditCost: 0.5,
    category: "valuation",
  },
  pricing_strategy_scenarios: {
    id: "pricing_strategy_scenarios",
    name: "Pricing Strategy Scenarios",
    description: "Three scenarios: aggressive, market-rate, value positioning with pros/cons",
    creditCost: 0.5,
    category: "strategy",
  },
  archetype_profile: {
    id: "archetype_profile",
    name: "Archetype Profile",
    description: "Dominant buyer archetype for this property type and territory",
    creditCost: 1,
    category: "market_intelligence",
  },
  archetype_listing_remarks: {
    id: "archetype_listing_remarks",
    name: "Archetype Listing Remarks",
    description: "3 MLS remark variations written to appeal to dominant archetype",
    creditCost: 1,
    category: "strategy",
  },
  migration_feeder_markets: {
    id: "migration_feeder_markets",
    name: "Migration Feeder Markets",
    description: "Top migration feeder markets sending buyers to this territory",
    creditCost: 1,
    category: "market_intelligence",
  },
  top_alternative_markets: {
    id: "top_alternative_markets",
    name: "Top Alternative Markets",
    description: "3 comparable markets buyer could consider at their price point",
    creditCost: 1,
    category: "market_intelligence",
  },
  offer_strategy: {
    id: "offer_strategy",
    name: "Offer Strategy",
    description: "Recommended offer positioning based on current market conditions",
    creditCost: 0.5,
    category: "strategy",
  },
  investment_metrics: {
    id: "investment_metrics",
    name: "Investment Metrics",
    description: "Cap rate, GRM, cash-on-cash return calculation",
    creditCost: 1,
    category: "investment",
  },
  five_year_projection: {
    id: "five_year_projection",
    name: "5-Year Projection",
    description: "Cash flow and appreciation projection over 5 years",
    creditCost: 0.5,
    category: "investment",
  },
  rent_range_analysis: {
    id: "rent_range_analysis",
    name: "Rent Range Analysis",
    description: "Market rent estimation by bedroom count and property type",
    creditCost: 1,
    category: "rental",
  },
  vacancy_and_demand: {
    id: "vacancy_and_demand",
    name: "Vacancy and Demand",
    description: "Vacancy rate, demand profile, and tenant market trends",
    creditCost: 0.5,
    category: "rental",
  },
  value_add_recommendations: {
    id: "value_add_recommendations",
    name: "Value-Add Recommendations",
    description: "Top improvements with cost/ROI estimates for this property and territory",
    creditCost: 1,
    category: "strategy",
  },
  equity_position_summary: {
    id: "equity_position_summary",
    name: "Equity Position Summary",
    description: "Current value estimate, equity, and options overview",
    creditCost: 0.5,
    category: "client_portfolio",
  },
  scenario_options: {
    id: "scenario_options",
    name: "Scenario Options",
    description: "Sell now, refi, HELOC, rent-and-buy, and value-add hold scenarios",
    creditCost: 1,
    category: "client_portfolio",
  },
  rent_control_exposure: {
    id: "rent_control_exposure",
    name: "Rent Control Exposure Check",
    description: "Rent control and stabilization exposure (MA, NH, VT, ME specific)",
    creditCost: 0.5,
    category: "rental",
  },
  seller_net_sheet: {
    id: "seller_net_sheet",
    name: "Seller Net Sheet",
    description: "Estimated net proceeds after commission, closing costs, and payoff",
    creditCost: 0.5,
    category: "strategy",
  },
  agent_talking_points: {
    id: "agent_talking_points",
    name: "Agent Talking Points",
    description: "Email subject line and follow-up conversation starters for clients",
    creditCost: 0.5,
    category: "strategy",
  },
};

/**
 * Get modules available for a specific analysis type
 */
export function getModulesForAnalysisType(assessmentType) {
  const moduleGroups = {
    listing_pricing: [
      "comp_valuation",
      "avm_gap_analysis",
      "pricing_strategy_scenarios",
      "archetype_profile",
      "migration_feeder_markets",
      "seller_net_sheet",
      "agent_talking_points",
    ],
    cma: [
      "comp_valuation",
      "avm_gap_analysis",
      "archetype_profile",
      "pricing_strategy_scenarios",
    ],
    buyer_intelligence: [
      "archetype_profile",
      "migration_feeder_markets",
      "offer_strategy",
      "agent_talking_points",
    ],
    investment_analysis: [
      "comp_valuation",
      "investment_metrics",
      "five_year_projection",
      "rent_range_analysis",
      "value_add_recommendations",
    ],
    rental_analysis: [
      "rent_range_analysis",
      "vacancy_and_demand",
      "rent_control_exposure",
      "archetype_profile",
    ],
    client_portfolio: [
      "equity_position_summary",
      "scenario_options",
      "value_add_recommendations",
      "agent_talking_points",
    ],
    custom: Object.keys(ANALYSIS_MODULES),
  };

  return (moduleGroups[assessmentType] || []).map(id => ANALYSIS_MODULES[id]);
}

/**
 * Calculate total credit cost for a set of modules
 */
export function calculateModuleCost(moduleIds) {
  let totalCost = 0;
  moduleIds.forEach(id => {
    const module = ANALYSIS_MODULES[id];
    if (module) {
      totalCost += module.creditCost;
    }
  });
  // Round up to nearest whole number
  return Math.ceil(totalCost);
}