# Property Architecture & Basement Square Footage Analysis

## Overview

This guide explains how to integrate property architecture detection and basement square footage adjustments into the valuation analysis to account for marketing challenges and effective square footage discrepancies common in split-levels, raised ranches, and multi-level homes.

## Problem Statement

Split-level, raised ranch, and multi-level homes present unique valuation challenges:

1. **Square Footage Discrepancies**: Basement space recorded in public records may not match MLS-marketed livable square footage due to:
   - Lower levels being below-grade (not counted as finished "living space" in standard measurements)
   - Partial basement windows vs. full windows (affects classification)
   - Unfinished areas being finished post-sale (current records lag reality)

2. **Price Per Square Foot (PPSF) Distortions**: 
   - Standard PPSF calculations don't account for multi-level architecture
   - Basement sqft shouldn't be weighted equally to above-grade sqft
   - Different buyer archetypes value basement space differently

3. **Marketing Complexity**:
   - Agents often advertise different "livable sqft" totals based on which spaces they want to emphasize
   - Comparables vary widely in how they count basement square footage
   - No standardization across MLS records and public assessor databases

## Solution Architecture

### 1. Topography Detection

Automatically detects property slope and elevation characteristics:
- **Hilltop**: Elevated terrain (+0.15 desirability) — views, drainage benefits, but driveway complexity
- **Steep Slope**: -0.15 desirability — maintenance cost, accessibility challenges, driveway danger
- **Gentle Slope**: +0.05 — balanced views and accessibility
- **Flat**: +0.10 — accessibility, flood risk, straightforward parking
- **Valley**: -0.10 — flood risk, limited sun, privacy benefit

Each topography has sub-factors: views, drainage, driveway complexity, flood risk, erosion risk, maintenance cost.

### 2. Street Characteristics Detection

Identifies street-level factors that impact buyer perception:
- **Blind Curve**: -0.20 desirability — safety concern, delivery/emergency access risk
- **Double Line Parking**: -0.10 — guest parking restricted, parking stress
- **High Traffic**: -0.15 — noise, child safety, resale perception
- **Quiet Street**: +0.15 — residential appeal, safety, neighborhood quality
- **Limited Access**: -0.12 — single driveway, emergency access concerns, mover logistics
- **Corner Lot**: -0.08 — traffic exposure, privacy loss, but visibility for business

### 3. Property Architecture Detection

The analyzer automatically detects property type based on intake data:
- Split Level
- Raised Ranch
- Multi-Level / Townhouse
- Colonial
- Ranch
- Cape Cod
- Condominium

Each type has a **basementFactor** (0.0 - 1.0) representing market perception of basement space:
- **Split Level**: 0.70 (basement worth ~70% of above-grade sqft)
- **Raised Ranch**: 0.65 (basement perception slightly lower)
- **Colonial**: 0.80 (finished basements well-integrated)
- **Ranch**: 0.75 (basement is separate space)

### 4. Desirability Score Algorithm

Creates a 0-1 desirability score based on five weighted factors:

**Score Calculation**:
```
Baseline: 0.5
+ Architecture appeal (15% weight)
+ Market performance of similar comps (15% weight)
+ Age/condition appeal (10% weight)
+ Topography factor (15% weight) — hilltop/slope/valley impact
+ Street characteristics factor (10% weight) — blind curve/parking/traffic impact
= Final score (0-1)
```

**Interpretation**:
- **0.75+**: Highly desirable in current market
- **0.60-0.75**: Good appeal with selective demographics
- **0.45-0.60**: Requires strategic positioning due to one or more challenges
- **<0.45**: Multiple headwinds — pricing and targeted marketing essential

**Example**: Split-level on steep slope with blind curve street:
- Architecture factor: +0.10 (split-level baseline)
- Topography factor: -0.15 (steep slope penalty)
- Street factor: -0.20 (blind curve + driveway safety issues)
- Comp performance: 0 (baseline)
- Age appeal: 0 (neutral)
- **Final: 0.5 + 0.10 - 0.15 - 0.20 = 0.25** (significant headwinds — requires strategic pricing and positioning)

### 5. PPSF Adjustment for Basement

When calculating effective square footage for PPSF:

```javascript
// For subject property:
aboveGradeSqft = totalSqft - basementSqft
basementAdjustment = basementSqft * basementFactor
effectiveSubjectSqft = aboveGradeSqft + basementAdjustment

// Example: 2,182 SF total, 400 SF basement, Split Level (0.70 factor):
aboveGradeSqft = 1,782 SF
basementAdjustment = 400 × 0.70 = 280 SF
effectiveSubjectSqft = 1,782 + 280 = 2,062 SF (vs. recorded 2,182 SF)

// PPSF is then calculated on effective sqft, not recorded sqft
```

### 6. Integration with AI Prompt Assembly

Add the following section to `assemblePrompt()` in `functions/assemblePrompt.js`:

```javascript
// STEP 1: Import architecture & site analyzer
import { 
  detectPropertyArchitecture,
  detectTopography,
  detectStreetCharacteristics,
  calculateDesirabilityScore, 
  adjustPPSFForArchitecture,
  generateArchitectureNarrative,
  generatePropertyContextNarrative
} from '@/lib/propertyArchitectureAnalyzer';

// STEP 2: Detect all site characteristics during prompt assembly
const architecture = detectPropertyArchitecture(intake);
const topography = detectTopography(intake);
const streetChar = detectStreetCharacteristics(intake);
const desirability = calculateDesirabilityScore(
  architecture, 
  intake, 
  analysis.agent_comps || [],
  topography,
  streetChar
);

// STEP 3: Adjust comps' PPSF if basement data available
let adjustedComps = analysis.agent_comps;
if (intake.basement_sqft) {
  adjustedComps = adjustPPSFForArchitecture(
    analysis.agent_comps,
    architecture,
    intake.sqft,
    intake.basement_sqft
  );
}

// STEP 4: Include in prompt context
const siteAnalysisContext = `
PROPERTY SITE & ARCHITECTURE ANALYSIS:
- Architecture: ${architecture.description} (${desirability.interpretation})
- Topography: ${topography.detectedTopo} (${topography.desirabilityFactor > 0 ? '+' : ''}${(topography.desirabilityFactor * 100).toFixed(0)}% desirability impact)
- Street Characteristics: ${streetChar.description} (${streetChar.combinedFactor > 0 ? '+' : ''}${(streetChar.combinedFactor * 100).toFixed(0)}% desirability impact)
- Overall Desirability Score: ${(desirability.score * 100).toFixed(0)}%
- Basement Factor: ${(architecture.basementFactor * 100).toFixed(0)}% of above-grade market value

ARCHITECTURAL CONTEXT:
${generateArchitectureNarrative(architecture, desirability, intake)}

SITE CONTEXT:
${generatePropertyContextNarrative(architecture, desirability, intake)}

VALUATION ADJUSTMENTS:
1. Use effective square footage (above-grade + ${(architecture.basementFactor * 100).toFixed(0)}% of basement)
2. Apply topography considerations (${topography.desirabilityFactor > 0 ? 'positive' : 'negative'} impact on pricing power)
3. Account for street-level restrictions (${streetChar.combinedFactor > 0 ? 'supportive' : 'limiting'} factors for buyer pool)
4. Adjust comparable PPSF if similar homes present topography/street challenges
`;

// Add siteAnalysisContext to the full prompt assembly
```

### 7. Prompt Instruction Addition

Add this to the AI system prompt for valuation analysis:

```
COMPREHENSIVE SITE & ARCHITECTURE CONSIDERATION:

ARCHITECTURE:
For split-level, raised ranch, multi-level, and similar homes:
- Identify discrepancies between public record sqft and MLS marketed sqft
- Normalize PPSF by applying the basement factor (0.65-0.80 depending on type)
- Explain any sqft discrepancies in the valuation narrative
- Recognize that below-grade spaces command lower PPSF and narrower buyer appeal

TOPOGRAPHY:
For hilltop, slope, or valley properties:
- Hilltop: Positive for views and drainage, negative for driveway access/safety
- Steep slopes: Reduce pricing power due to maintenance, accessibility, mover logistics
- Valleys: Higher flood risk, limited sunlight, but potential privacy appeal
- Adjust comparable PPSF if topography differs (sloped property vs. flat comp)

STREET CHARACTERISTICS:
For blind curves, double-line parking, high-traffic, or limited-access properties:
- Blind curve at property end: Safety concern impacts buyer pool (-20% desirability)
- Double-line parking: Guest parking restrictions affect buyer satisfaction (-10%)
- High traffic: Noise and safety perception reduce appeal for families (-15%)
- Limited access: Emergency response and moving logistics impact appeal (-12%)
- Consider if comparables have similar street-level constraints

COMBINED IMPACT EXAMPLE:
A split-level (durable but dated) + steep slope driveway + blind curve street could 
score 0.35-0.45 desirability, requiring significant positioning strategy. PPSF should 
reflect these cumulative challenges, even if individual comps don't capture all factors.
```

## Implementation Checklist

- [ ] Import architecture analyzer in `functions/assemblePrompt.js`
- [ ] Call `detectPropertyArchitecture()` when assembling prompts
- [ ] Calculate `desirabilityScore()` for context
- [ ] Adjust comps PPSF using `adjustPPSFForArchitecture()`
- [ ] Include architecture narrative in prompt
- [ ] Update AI system prompt with architecture consideration instructions
- [ ] Test with split-level and raised ranch comps
- [ ] Verify PPSF adjustments make sense vs. original comps
- [ ] Document in valuation summary section of PDF reports

## Example Output

In the PDF valuation narrative:

> "This Split Level property has 2,182 SF recorded in public assessor records, but 1,782 SF 
> of above-grade living space plus 400 SF of below-grade basement. Using the split-level 
> basement factor of 70% market recognition, the effective marketable square footage is 
> 2,062 SF. This explains the apparent sqft discrepancy between MLS marketing (which may 
> claim full 2,182 SF) and our valuation basis. When adjusting comparable PPSF ranges to 
> account for this architectural reality, the implied value range of $885,000–$975,000 
> reflects normalized pricing for the effective living space..."

## Technical Notes

- Architecture detection is case-insensitive and keyword-based
- Desirability score is market-agnostic (can be tuned per region)
- Basement factor is conservative (basement space genuinely does command lower $/SF)
- Comps adjustment creates `effective_sqft` field without overwriting original data
- Generated narratives are AI-friendly prompts, not user-facing text (AI refines them)