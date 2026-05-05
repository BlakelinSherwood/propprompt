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

### 1. Property Architecture Detection

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

### 2. Desirability Score Algorithm

Creates a 0-1 desirability score based on:

**Factors** (each -1.0 to +1.0):
- **Versatility**: Can basement/multiple levels adapt to different uses?
- **Updates**: Are dated multi-level homes currently attractive?
- **Marketing Flexibility**: Can agent highlight different selling points?
- **Maintenance Complexity**: Multiple roof lines, foundations cost more

**Score Calculation**:
```
Baseline: 0.5
+ Architecture score (15% weight) — how appealing is this type overall?
+ Market performance of similar comps (15% weight) — how fast do they sell?
+ Age appeal adjustment (10% weight) — is vintage or modern more desirable for this type?
= Final score (0-1)
```

**Interpretation**:
- **0.75+**: Highly desirable in current market
- **0.60-0.75**: Good appeal with selective demographics
- **0.45-0.60**: Requires strategic positioning
- **<0.45**: Market headwinds — pricing and presentation critical

### 3. PPSF Adjustment for Basement

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

### 4. Integration with AI Prompt Assembly

Add the following section to `assemblePrompt()` in `functions/assemblePrompt.js`:

```javascript
// STEP 1: Import architecture analyzer
import { 
  detectPropertyArchitecture, 
  calculateDesirabilityScore, 
  adjustPPSFForArchitecture,
  generateArchitectureNarrative 
} from '@/lib/propertyArchitectureAnalyzer';

// STEP 2: Detect architecture during prompt assembly
const architecture = detectPropertyArchitecture(intake);
const desirability = calculateDesirabilityScore(
  architecture, 
  intake, 
  analysis.agent_comps || []
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
const architectureContext = `
PROPERTY ARCHITECTURE ANALYSIS:
- Type: ${architecture.description} (${desirability.interpretation})
- Desirability Score: ${(desirability.score * 100).toFixed(0)}%
- Basement Factor: ${(architecture.basementFactor * 100).toFixed(0)}% of above-grade market value
- Effective Marketable Sqft: [calculated from above-grade + adjusted basement]

NARRATIVE:
${generateArchitectureNarrative(architecture, desirability, intake)}

VALUATION ADJUSTMENT:
When calculating PPSF ranges, use effective square footage which accounts for basement 
being worth ${(architecture.basementFactor * 100).toFixed(0)}% of above-grade. This explains 
any sqft discrepancies between MLS marketing claims and public record assessor data.
`;

// Add architectureContext to the full prompt assembly
```

### 5. Prompt Instruction Addition

Add this to the AI system prompt for valuation analysis:

```
PROPERTY ARCHITECTURE CONSIDERATION:
For split-level, raised ranch, multi-level, and similar homes, analyze how basement 
square footage affects market perception and PPSF calculations:

1. Identify discrepancies between public record sqft and MLS marketed sqft
2. Understand that multi-level homes are often marketed with different "livable sqft" 
   totals by different agents based on what they're emphasizing
3. When comparing comps, normalize PPSF by applying the basement factor 
   (provided in architecture analysis)
4. Explain any sqft discrepancies in the valuation narrative
5. Recognize that below-grade spaces (even with windows) command lower PPSF 
   and appeal to narrower buyer demographics

Example: A split-level with 2,182 SF recorded but 1,782 SF above-grade + 400 SF basement
should be valued based on effective sqft of ~2,062 SF (not 2,182), explaining why 
PPSF appears lower than listed comps that count full sqft without adjustment.
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