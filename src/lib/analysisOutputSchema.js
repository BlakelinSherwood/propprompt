/**
 * analysisOutputSchema.js — Reference implementation for expanded Analysis JSON output.
 *
 * This file documents the complete structure that AI generates for:
 * - migration_analysis
 * - buyer_archetypes
 * - tiered_comps
 * - portfolio_options (client_portfolio assessment type only)
 * - attribute_alignment_grid
 * - listing_timing
 * - location_priority_characteristics
 *
 * All fields are ADDITIVE — no existing fields are removed or renamed.
 * Template rendering consumes analysis.output_json as the primary data source.
 * Fall back to analysis.output_text (narrative) if structured output unavailable.
 */

export const ANALYSIS_OUTPUT_SCHEMA = {
  migration_analysis: {
    intro_narrative: "string (2-3 sentences, geographic only, no demographics)",
    feeder_markets: [
      {
        rank: "number (1-based priority, 5-8 total markets)",
        origin_market: "string (metro area or region name)",
        direction: "string (e.g. 'North', 'South', 'Inbound', 'Same market')",
        drive_time_minutes: "number",
        estimated_buyer_share_pct: "number (% of likely buyer pool)",
        buyer_type: "string (Move-up|Move-down|Lateral|Relocation|Downsizer|Investor|First-time|Second-home|Return buyer)",
        migration_score: "number (1-10, volume + intent)",
        avg_budget_range: { low: "number", high: "number" },
        push_factors: "array<string> (max 3, why they leave origin)",
        pull_factors: "array<string> (max 3, why they target this submarket)",
        price_psychology: "string (stretching_up|cashing_out_equity|lateral_move|downsizing_into_quality)",
        negotiation_implication: "string (one sentence on offer behavior)",
        driver: "string (single-word: value|schools|lifestyle|commute|space|investment|downsizing|remote_work)"
      }
    ],
    location_type_context: "string (urban|suburban|coastal_historic|rural_exurban)",
    marketing_channel_recommendations: [
      {
        channel: "string (LinkedIn Ads|Instagram Geo|Zillow Premium|Local Print|Open House|Agent Network|Relocation Services|Direct Mail)",
        targeting_rationale: "string (why this channel for these buyers)",
        priority: "string (PRIMARY|SECONDARY|SUPPLEMENTAL)"
      }
    ],
    employer_targets: [
      {
        company_name: "string",
        relevance: "string (why this employer sends buyers here)",
        priority: "string (HIGHEST|HIGH|GROWING)",
        role_targets: "string (e.g. 'Senior engineers', 'Directors+', 'Medical staff')",
        commute_time_minutes: "number",
        office_location: "string"
      }
    ]
  },

  buyer_archetypes: [
    {
      rank: "number (1-based, 6-10 total archetypes per analysis)",
      segment_name: "string (e.g. 'Remote-Flex Professional', 'Move-Up Family', 'Downsizing Empty Nester')",
      hhi_range: { low: "number", high: "number" },
      price_range: { low: "number", high: "number" },
      speed: "string (Fast|Moderate|Patient|Urgent)",
      volume: "string (HIGHEST|VERY HIGH|HIGH|MID-HIGH|MODERATE|GROWING|NICHE)",
      estimated_pool_pct: "number (% of total buyer pool for this property)",
      deep_profile: "string (3-4 sentences: who, why fits, what they need, concerns)",
      geographic_origin: "string (ties to migration_analysis.feeder_markets)",
      language_calibration: {
        avoid_phrases: "array<string> (3-5 phrases that repel this archetype)",
        use_phrases: "array<string> (3-5 phrases calibrated to this archetype)"
      },
      attribute_resonance: {
        "[attribute_key]": "number (0=not relevant, 1=noted, 2=important, 3=decisive)",
        "example_attributes": "[school_quality, walkability, lot_size, garage, transit_access, outdoor_space, renovation_quality, water_view, historic_character, turnkey_condition, price_point, noi_yield, parking, storage, privacy, commute_time, condo_fee_value, expansion_potential, adu_potential, floor_level, natural_light, community_amenities]"
      },
      property_type_flag: "string (all|single_family|condo|multi_family)"
    }
  ],

  tiered_comps: {
    methodology_note: "string (1-2 sentences on selection and tiering)",
    time_adjustment_method: "string (describe appreciation rate and source)",
    tiers: [
      {
        tier_id: "string (A|B|C)",
        tier_label: "string (Direct Comparables|Nearby Similar|Broader Market Context)",
        tier_description: "string (one sentence on role)",
        ppsf_range: { low: "number", high: "number" },
        weight: "string (PRIMARY|SECONDARY|REFERENCE_ONLY)",
        comps: [
          {
            address: "string",
            sale_date: "string (MM/YYYY)",
            sale_price: "number",
            square_feet: "number",
            raw_ppsf: "number",
            adjusted_ppsf: "number",
            adjustment_note: "string (time adjustment detail or 'Current — no adj.')",
            beds: "number",
            baths: "number",
            property_type: "string",
            distance_miles: "number",
            year_built: "number",
            condition_vs_subject: "string (Superior|Similar|Inferior)",
            key_differences: "string (1-2 key diffs from subject)",
            data_source: "string (MLS Confirmed|Registry|Estimated)",
            within_building: "boolean (true for condo in-building comps)"
          }
        ]
      }
    ],
    implied_value_range: {
      low: "number",
      high: "number",
      midpoint: "number",
      basis: "string (e.g. 'Tier A adjusted PPSF × subject SF')"
    },
    comp_date_window: {
      primary_months: "number (default 12)",
      extended_months: "number (default 60, hard cap)",
      extended_used: "boolean (true if any comp older than primary window)",
      thin_comp_flag: "boolean (true if <4 Tier A+B comps within 18 months)"
    }
  },

  portfolio_options: {
    "_note": "Only generated when assessment_type === 'client_portfolio'",
    estimated_current_value: {
      low: "number",
      high: "number",
      midpoint: "number",
      source: "string (e.g. 'Three-method convergence')"
    },
    estimated_equity: {
      gross_equity: "number",
      mortgage_balance: "number",
      mortgage_balance_source: "string (REGISTRY-ESTIMATED|CLIENT-PROVIDED)",
      heloc_balance: "number",
      ltv_pct: "number",
      equity_tier: "string (Strong (<60%)|Good (60-75%)|Standard (75-80%)|Limited (>80%))"
    },
    equity_growth: {
      purchase_price: "number",
      purchase_date: "string (YYYY-MM-DD)",
      total_cost_basis: "number",
      improvements_total: "number",
      improvements_source: "string (CLIENT-PROVIDED|None reported)",
      value_created: "number",
      return_on_basis: "number (multiplier, e.g. 1.85)",
      annualized_appreciation_pct: "number",
      years_owned: "number"
    },
    options: [
      {
        option_id: "string (A-G)",
        option_name: "string",
        option_label: "string (short subtitle)",
        equity_accessible: "string (dollar range or '—')",
        best_scenario: "string (when this option makes sense)",
        key_tradeoff: "string (what client gives up)",
        detail: "object (option-specific structure, see below)"
      }
    ],
    "_option_details": {
      "A_HOLD": {
        client_estimated_rate: "number",
        client_rate_source: "string",
        current_market_rate: "number",
        market_rate_source: "string",
        monthly_payment_advantage: "number",
        annualized_rate_lock_benefit: "number",
        projected_value_3yr: "number",
        projected_value_5yr: "number",
        projected_equity_3yr: "number",
        appreciation_rate_used: "number",
        conclusion: "string"
      },
      "B_CASH_OUT_REFI": {
        max_loan_80_ltv: "number",
        current_balance: "number",
        max_cash_available: "number",
        new_rate: "number",
        new_monthly_payment: "number",
        current_monthly_payment: "number",
        monthly_payment_change: "number",
        estimated_closing_costs: "number",
        closing_cost_pct: "number",
        breakeven_months: "number",
        rate_lock_assessment: "string",
        conclusion: "string"
      },
      "C_HELOC": {
        max_cltv_85: "number",
        first_mortgage_balance: "number",
        available_heloc_line: "number",
        current_heloc_rate: "number",
        current_prime_rate: "number",
        interest_only_monthly: "number",
        rate_sensitivity: "number (cost per 0.25% prime increase)",
        fed_direction: "string",
        draw_period_years: "number",
        repayment_period_years: "number",
        best_use_cases: "array<string>",
        condo_lender_note: "string or null",
        conclusion: "string"
      },
      "D_VALUE_ADD_IMPROVEMENTS": {
        improvements: [
          {
            type: "string",
            estimated_cost_range: { low: "number", high: "number" },
            estimated_value_added: { low: "number", high: "number" },
            estimated_roi_pct: "number",
            priority: "string (HIGH|MEDIUM|LOW)",
            property_specific_note: "string"
          }
        ],
        roi_source: "string",
        highest_roi_recommendation: "string",
        avoid_recommendation: "string",
        heloc_synergy_note: "string",
        conclusion: "string"
      },
      "E_SELL_AND_MOVE_UP": {
        net_proceeds: "number",
        transaction_cost_pct: "number",
        transaction_costs: "number",
        move_up_examples: [
          { description: "string", price_range: { low: "number", high: "number" } }
        ],
        rate_shock: {
          new_loan_amount: "number",
          new_monthly_at_market: "number",
          current_monthly: "number",
          monthly_increase: "number",
          annual_increase: "number"
        },
        conclusion: "string"
      },
      "F_SELL_AND_RIGHT_SIZE": {
        net_proceeds: "number",
        right_size_examples: [
          { description: "string", price_range: { low: "number", high: "number" } }
        ],
        equity_freed: "number",
        monthly_carrying_cost_reduction: "number",
        mortgage_elimination_possible: "boolean",
        conclusion: "string"
      },
      "G_LEVERAGE_EQUITY_FOR_SECOND_PROPERTY": {
        heloc_available: "number",
        investment_purchase_power_20_down: "number",
        estimated_rental_income: { low: "number", high: "number" },
        rental_source: "string",
        monthly_heloc_cost: "number",
        estimated_net_monthly_carry: "number",
        second_home_purchase_power: { low: "number", high: "number" },
        risk_factors: "array<string>",
        conclusion: "string"
      }
    },
    adu_option: {
      trigger: "boolean",
      trigger_basis: "string (why yes/no)",
      "if_trigger_true": {
        lot_size_sqft: "number",
        adu_status_in_town: "string (By-right|Conditional|Prohibited)",
        adu_size_limit: "string",
        owner_occupancy_required: "boolean",
        estimated_build_cost: { low: "number", high: "number" },
        cost_per_sqft: "number",
        estimated_monthly_rental: { low: "number", high: "number" },
        rental_source: "string",
        gross_annual_revenue: "number",
        operating_expense_pct: "number",
        net_annual_income: "number",
        simple_payback_years: "number",
        cap_rate_on_cost: "number",
        heloc_covers_build: "string (Yes|Partial|No)",
        site_specific_note: "string"
      }
    },
    rate_environment: {
      thirty_yr_fixed_today: "number",
      thirty_yr_fixed_1yr_ago: "number",
      client_estimated_rate: "number",
      rate_advantage_pct: "number",
      monthly_savings_vs_refi: "number",
      rate_outlook_narrative: "string",
      rate_source: "string",
      rate_date: "string (YYYY-MM-DD)",
      fed_forecast_summary: "string"
    }
  },

  attribute_alignment_grid: {
    attributes: "array<string> (column headers — property features)",
    segments: "array<string> (row headers — archetype segment names)",
    scores: "array<array<number>> (2D grid: segments × attributes, values 0-3)"
  },

  listing_timing: {
    optimal_window: {
      start_month: "string (e.g. 'March')",
      end_month: "string (e.g. 'May')",
      year: "number"
    },
    windows: [
      {
        period: "string (e.g. 'March–May', 'September–October')",
        captures: "array<string> (which archetype segments are active)",
        market_dynamic: "string (why this window works)"
      }
    ],
    property_type_note: "string (condo/MF-specific seasonality note)"
  },

  location_priority_characteristics: {
    location_class: "string (urban|suburban|coastal_historic|rural_exurban)",
    priority_value_drivers: [
      {
        rank: "number",
        driver: "string",
        relevance_to_subject: "string (one sentence on why this matters here)"
      }
    ],
    pricing_dynamics_to_research: "array<string> (4-6 location-specific dynamics)"
  }
};

/**
 * Generate attribute alignment grid from buyer_archetypes.
 * Called after archetypes are generated to produce the grid for template rendering.
 */
export function buildAttributeAlignmentGrid(archetypes) {
  if (!archetypes || archetypes.length === 0) {
    return { attributes: [], segments: [], scores: [] };
  }

  // Collect all unique attribute keys from all archetypes
  const allAttributes = new Set();
  archetypes.forEach(arch => {
    if (arch.attribute_resonance) {
      Object.keys(arch.attribute_resonance).forEach(attr => allAttributes.add(attr));
    }
  });

  const attributes = Array.from(allAttributes).sort();
  const segments = archetypes.map(a => a.segment_name);
  const scores = archetypes.map(arch =>
    attributes.map(attr => arch.attribute_resonance?.[attr] ?? 0)
  );

  return { attributes, segments, scores };
}