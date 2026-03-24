# PropPrompt Analysis Output Expansion Guide

## Overview

This document defines 7 new structured data expansions to the Analysis JSON output schema. All expansions are **ADDITIVE** — no existing fields are removed or renamed.

**Version**: 4.1 (March 2026)  
**Architecture**: AI → JSON (structured output) → Template (consumer)

---

## Design Rules (Immutable)

1. **AI generates structured JSON output**, not Markdown-only text
2. **Templates consume `analysis.output_json`** as the primary data source
3. **Credit deducts on successful output display** — never on initiation, never on failure
4. **Fair housing compliance system prompt** applies to archetype, migration, and buyer profiling outputs
5. **Graceful ensemble degradation**: any Pro+ model failure falls back to Claude, report continues
6. **Branding resolved at export time** via `resolveBranding()` cascade
7. **Inspect before modifying** — extend don't duplicate, never break existing analysis/wizard/chatbot/billing

---

## Field Storage Location

All new fields are stored in the **Analysis entity**:

```javascript
// Structured output (primary data source for templates)
analysis.output_json: {
  migration_analysis: {...},
  buyer_archetypes: [{...}],
  tiered_comps: {...},
  portfolio_options: {...},  // client_portfolio only
  attribute_alignment_grid: {...},
  listing_timing: {...},
  location_priority_characteristics: {...}
}

// Legacy narrative text (fallback only)
analysis.output_text: "Full markdown narrative..."
```

---

## EXPANSION 1: migration_analysis

**When generated**: All listing-based analyses (listing_pricing, cma, buyer_intelligence)  
**Compliance**: Geographic origin only — no demographic references  
**Data structure**: See `lib/analysisOutputSchema.js` → `ANALYSIS_OUTPUT_SCHEMA.migration_analysis`

### Key Fields

- **intro_narrative** (2-3 sentences): Geographic patterns without demographics
- **feeder_markets** (5-8 markets): Ranked by migration_score, includes push/pull factors
- **location_type_context**: Determines which template pattern to apply
- **marketing_channel_recommendations**: Prioritized channels with rationale
- **employer_targets** (6-14 companies): Role-based, geography + commute only

### Example: Move-Up Family from Boston

```json
{
  "rank": 1,
  "origin_market": "Boston metro",
  "direction": "Outbound",
  "drive_time_minutes": 45,
  "buyer_type": "Move-up",
  "migration_score": 9,
  "push_factors": [
    "Price ceiling exceeded in current market",
    "School quality gap",
    "Space needs exceed inventory"
  ],
  "pull_factors": [
    "Value gap vs. origin market",
    "School system reputation",
    "Suburban lifestyle amenities"
  ],
  "price_psychology": "stretching_up"
}
```

---

## EXPANSION 2: buyer_archetypes

**When generated**: All analyses  
**Count**: 6–10 archetypes per analysis  
**Compliance**: Lifestyle/financial framing only — no protected class references

### Architecture

Each archetype is a **buyable persona** with:

1. **Segment identification**: Name, volume tier, speed
2. **Financial profile**: HHI range, price range, LTV/equity position
3. **Deep profile**: 3-4 sentences on who, why they fit, what they need, concerns
4. **Language calibration**: Phrases to use/avoid in marketing
5. **Attribute resonance**: Grid of 0–3 scores for property features
6. **Property type flag**: `all` or specific (controls visibility per property type)

### Mandatory Archetypes by Property Type

**Multi-family**:
- Local Value-Add Investor
- 1031 Exchange Buyer
- Owner-Occupant House Hacker
- Passive/Remote Investor

**Condo**:
- Urban Downsizer
- Young Professional First-Time
- Pied-à-Terre Buyer
- Investor/Rental Buyer

**Single-family**:
- At least 2 family-oriented + 2 non-family archetypes

### Attribute Resonance Scores

```
3 = Decisive (buyer actively seeks this)
2 = Important (significant consideration)
1 = Noted (contributes to decision)
0 = Not relevant (not a factor)
```

**Valid attribute keys**:
- Property: school_quality, walkability, lot_size, garage, transit_access, outdoor_space, renovation_quality, water_view, historic_character, turnkey_condition
- Financial: price_point, noi_yield, parking, storage, condo_fee_value
- Structural: expansion_potential, adu_potential, floor_level, natural_light, community_amenities
- Comfort: privacy, commute_time

---

## EXPANSION 3: tiered_comps

**When generated**: listing_pricing, cma, investment_analysis  
**Data structure**: 3 tiers (A, B, C) with 3–6 comps each (12–18 total)

### Tier Definitions

| Tier | Label | Role | Time Window | Comps | Weight |
|------|-------|------|-------------|-------|--------|
| **A** | Direct Comparables | Primary value base | 12 months preferred | 3–6 | PRIMARY |
| **B** | Nearby Similar | Secondary context | ±20% size, ±15 yr age | 3–6 | SECONDARY |
| **C** | Broader Market | Reference only | Different part of town | 3–6 | REFERENCE_ONLY |

### Special Cases

**Condos**: Include within-building sales as sub-tier of Tier A (set `within_building: true`)

**Multi-family**: Include both cap rate AND GRM comps as separate sub-tiers

### Data Fields per Comp

- Time-adjusted PPSF (with adjustment note)
- Condition vs. subject (Superior/Similar/Inferior)
- Key differences (1–2 facts)
- Data source confidence (MLS Confirmed / Registry / Estimated)
- Distance from subject

### Thin Market Flag

```javascript
thin_comp_flag: true  // If <4 Tier A+B comps within 18 months
// Triggers warning in template: "Limited comparable data"
```

---

## EXPANSION 4: portfolio_options

**When generated**: `assessment_type === "client_portfolio"` ONLY

**Condition**: Must NOT generate for listing_pricing, cma, buyer_intelligence, etc.

### 7 Options (A–G)

Each option has option-specific `detail` object:

| Option | Name | Equity Use | Best For |
|--------|------|-----------|----------|
| **A** | Hold | — | Rate lock assessment |
| **B** | Cash-Out Refi | 80% LTV max | Access equity at low rate |
| **C** | HELOC | 85% CLTV max | Flexibility + draw period |
| **D** | Value-Add Improvements | Heloc synergy | ROI-positive improvements |
| **E** | Sell & Move Up | Net proceeds | Rate shock analysis |
| **F** | Sell & Right-Size | Equity freed | Downsizing path |
| **G** | Leverage for 2nd Property | Heloc/20% down | Investment/rental income |

### Rate Environment Context

```javascript
rate_environment: {
  thirty_yr_fixed_today: 6.5,
  thirty_yr_fixed_1yr_ago: 7.1,
  client_estimated_rate: 3.875,     // Their locked rate
  rate_advantage_pct: 2.625,        // Savings if they refinance
  monthly_savings_vs_refi: 485,
  rate_outlook_narrative: "...",
  fed_forecast_summary: "..."
}
```

### ADU Option (Conditional)

```javascript
adu_option: {
  trigger: true,  // Or false if not eligible
  trigger_basis: "Lot >5,000 SF, town allows by-right ADU",
  // If trigger=true, include full ADU analysis:
  lot_size_sqft: 6200,
  adu_status_in_town: "By-right",
  estimated_build_cost: { low: 250000, high: 350000 },
  estimated_monthly_rental: { low: 2000, high: 2400 },
  simple_payback_years: 12.5,
  cap_rate_on_cost: 8.2,
  heloc_covers_build: "Partial"  // or "Yes" / "No"
}
```

---

## EXPANSION 5: attribute_alignment_grid

**When generated**: All analyses (derived from buyer_archetypes)

**Purpose**: Render a 2D table of archetypes × property attributes in templates

**Data structure**:
```javascript
{
  attributes: ["walkability", "school_quality", "lot_size", ...],  // columns
  segments: ["Remote-Flex Professional", "Move-Up Family", ...],   // rows
  scores: [[3, 2, 1, ...], [2, 3, 2, ...], ...]                   // 2D array
}
```

**Generated from**:
```javascript
// Use helper function from lib/analysisOutputSchema.js
import { buildAttributeAlignmentGrid } from '@/lib/analysisOutputSchema';
const grid = buildAttributeAlignmentGrid(archetypes);
```

---

## EXPANSION 6: listing_timing

**When generated**: All listing-based analyses  
**Purpose**: Advise on optimal listing window and seasonality

### Structure

```javascript
{
  optimal_window: {
    start_month: "April",
    end_month: "June",
    year: 2026
  },
  windows: [
    {
      period: "April–June",
      captures: ["Move-Up Family", "Remote-Flex Professional"],
      market_dynamic: "Peak spring buyer activity, school calendars drive urgency"
    },
    {
      period: "September–October",
      captures: ["Local Investor", "Downsizing Empty Nester"],
      market_dynamic: "Fall inventory refresh, back-to-school transition"
    }
  ],
  property_type_note: "Condos see strong winter demand; single-family peaks spring"
}
```

---

## EXPANSION 7: location_priority_characteristics

**When generated**: All analyses  
**Purpose**: Location-class-specific value drivers and research dynamics

### Location Classes & Typical Drivers

**Urban**:
- Walkability, transit access, parking, condition, outdoor space, noise

**Suburban**:
- Schools, lot size, condition, garage, layout, commute

**Coastal/Historic**:
- Water view tier, historic character, village walkability, lot size, garage, flood risk

**Rural/Exurban**:
- Acreage, privacy, septic/well condition, broadband, commute, condition

### Research Dynamics

```javascript
pricing_dynamics_to_research: [
  "Transit-oriented development impact on nearby values",
  "New construction pipeline within 1 mile",
  "Flood zone remapping or insurance changes",
  "School district boundary changes",
  "Short-term rental regulation impact",
  "Broadband availability as remote-work factor"
]
```

---

## Integration with Existing Systems

### PromptLibrary Integration

AI generates structured JSON outputs from pipeline prompts:

```
Ensemble Mode (Pro+):
  Market Research → Neighborhoods → Archetypes → Comps Tier → Value Synthesis
    ↓ (each step outputs JSON fragments)
  → output_json.migration_analysis
  → output_json.buyer_archetypes
  → output_json.tiered_comps
  → output_json.attribute_alignment_grid
    (combined by final assembly step)
```

**No breaking changes**: `output_text` (narrative) generated separately; both stored.

### Fair Housing Compliance

All archetype, migration, and buyer profiling outputs subject to system prompt:
- Lifestyle/financial framing only
- No race, ethnicity, religion, national origin, familial status, disability references
- Geography, role type, behavior patterns only

### Credit Deduction

```javascript
// Deduct AFTER successful output_json generation + display
await deductAnalysisQuota({
  analysisId,
  orgId,
  output_type: 'structured_json'  // tier-based cost
});
```

### Branding Resolution

```javascript
// At export time (PDF/PPTX generation):
const branding = await resolveBranding(analysisId);
// Priority: Agent > Team > Brokerage > System Default (#1A3226 / #B8982F)
```

---

## Checklist for Implementation

- [ ] Analysis entity includes `output_json` field
- [ ] AI prompts generate all 7 expansions for applicable analysis types
- [ ] `portfolio_options` generated ONLY when `assessment_type === "client_portfolio"`
- [ ] `attribute_alignment_grid` derived from `buyer_archetypes` using helper
- [ ] `output_text` (narrative) generated in parallel, stored separately
- [ ] No existing fields renamed or removed
- [ ] Fair housing system prompt applied to archetype/migration/buyer outputs
- [ ] Credit deduction occurs AFTER output_json success
- [ ] Branding resolved at export time via existing `resolveBranding()` cascade
- [ ] Template fallback to `output_text` if `output_json` unavailable

---

## Example: Complete Analysis Output Structure

```javascript
{
  id: "analysis_xyz",
  assessment_type: "listing_pricing",
  property_type: "single_family",
  status: "complete",
  output_text: "[Full markdown narrative]",
  output_json: {
    migration_analysis: { /* 5–8 feeder markets, channels, employers */ },
    buyer_archetypes: [ /* 6–10 archetypes ranked by volume */ ],
    tiered_comps: { /* 3 tiers with 12–18 comps */ },
    attribute_alignment_grid: { /* Derived grid for template rendering */ },
    listing_timing: { /* Optimal window + seasonality */ },
    location_priority_characteristics: { /* Location drivers + dynamics */ }
    // Note: portfolio_options NOT included (only for client_portfolio type)
  }
}
```

---

**Questions?** Refer to `lib/analysisOutputSchema.js` for complete TypeScript/JSON schema reference.