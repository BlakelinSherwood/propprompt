/**
 * Property Architecture & Desirability Analyzer
 * 
 * Detects property type (split level, raised ranch, multi-level, etc.)
 * Creates desirability score based on architecture characteristics
 * Accounts for basement square footage in PPSQFT calculations
 */

export function detectPropertyArchitecture(intakeData) {
  const address = intakeData?.address || '';
  const notes = intakeData?.notes || '';
  const propertyType = intakeData?.property_type || '';
  const text = `${address} ${notes}`.toLowerCase();
  
  const architectures = {
    split_level: {
      keywords: ['split level', 'split-level', 'bi-level'],
      basementFactor: 0.7, // basement worth ~70% of above-grade sqft in PPSF calc
      description: 'Split Level',
      desirabilityFactors: {
        versatility: 0.8, // good for different uses
        updates: 0.6, // often dated
        marketingFlexibility: 0.9, // can market different levels
        maintenanceComplexity: -0.3 // multiple roof lines
      }
    },
    raised_ranch: {
      keywords: ['raised ranch', 'raised-ranch', 'bi-level ranch'],
      basementFactor: 0.65, // basement counts less in market perception
      description: 'Raised Ranch',
      desirabilityFactors: {
        versatility: 0.75,
        updates: 0.5,
        marketingFlexibility: 0.85,
        maintenanceComplexity: -0.2
      }
    },
    multi_level: {
      keywords: ['multi level', 'multi-level', 'multi story', 'townhouse'],
      basementFactor: 0.75,
      description: 'Multi-Level',
      desirabilityFactors: {
        versatility: 0.7,
        updates: 0.6,
        marketingFlexibility: 0.75,
        maintenanceComplexity: -0.4
      }
    },
    colonial: {
      keywords: ['colonial', 'two story'],
      basementFactor: 0.8,
      description: 'Colonial',
      desirabilityFactors: {
        versatility: 0.7,
        updates: 0.7,
        marketingFlexibility: 0.6,
        maintenanceComplexity: -0.2
      }
    },
    ranch: {
      keywords: ['ranch', 'single level', 'one story', 'rancher'],
      basementFactor: 0.75,
      description: 'Ranch',
      desirabilityFactors: {
        versatility: 0.6,
        updates: 0.7,
        marketingFlexibility: 0.5,
        maintenanceComplexity: 0.2 // single roof, easier maintenance
      }
    },
    cape: {
      keywords: ['cape cod', 'cape', 'cottage'],
      basementFactor: 0.65,
      description: 'Cape Cod',
      desirabilityFactors: {
        versatility: 0.65,
        updates: 0.6,
        marketingFlexibility: 0.65,
        maintenanceComplexity: -0.1
      }
    },
    condo: {
      keywords: ['condo', 'condominium', 'condo unit'],
      basementFactor: 0, // no basement typically
      description: 'Condominium',
      desirabilityFactors: {
        versatility: 0.5,
        updates: 0.7,
        marketingFlexibility: 0.4,
        maintenanceComplexity: 0.4 // HOA handles exterior
      }
    }
  };
  
  // Detect architecture type
  let detectedType = null;
  let basementFactor = 0.75; // default
  
  for (const [key, config] of Object.entries(architectures)) {
    if (config.keywords.some(kw => text.includes(kw))) {
      detectedType = key;
      basementFactor = config.basementFactor;
      break;
    }
  }
  
  // If no match, default to property type or generic
  if (!detectedType) {
    detectedType = propertyType?.includes('single') ? 'colonial' : 'ranch';
  }
  
  return {
    detectedType,
    basementFactor,
    ...architectures[detectedType]
  };
}

export function calculateDesirabilityScore(architecture, intakeData, comps = []) {
  if (!architecture) return { score: 0.5, factors: {} };
  
  const factors = { ...architecture.desirabilityFactors };
  let totalScore = 0.5; // baseline
  
  // Factor 1: Market appeal of architecture (weighted -10 to +10 on scale)
  const archScore = Object.values(factors).reduce((a, b) => a + b, 0);
  totalScore += archScore * 0.15; // 15% weight
  
  // Factor 2: Recent market performance of similar types
  if (comps && comps.length > 0) {
    const similarComps = comps.filter(c => 
      c.condition_vs_subject === 'Similar' || !c.condition_vs_subject
    );
    if (similarComps.length > 0) {
      const avgDOM = similarComps.reduce((sum, c) => sum + (c.days_on_market || 25), 0) / similarComps.length;
      // Faster sales = more desirable (invert DOM)
      const domScore = Math.max(-0.2, 0.3 - (avgDOM / 50));
      totalScore += domScore * 0.15; // 15% weight
    }
  }
  
  // Factor 3: Age/condition appeal (newer multi-level = harder to market)
  const yearBuilt = intakeData?.year_built || 1980;
  const age = new Date().getFullYear() - yearBuilt;
  if (architecture.detectedType.includes('level')) {
    // Older split/raised levels are seen as "character", newer ones as dated
    const ageAppeal = age > 40 ? 0.15 : age < 20 ? -0.15 : 0;
    totalScore += ageAppeal * 0.1; // 10% weight
  }
  
  // Normalize to 0-1 scale
  totalScore = Math.max(0, Math.min(1, totalScore));
  
  return {
    score: totalScore,
    factors,
    archScore,
    interpretation: scoreToInterpretation(totalScore, architecture.description)
  };
}

export function adjustPPSFForArchitecture(comps, architecture, subjectSqft, basementSqft = 0) {
  if (!architecture || !comps || comps.length === 0) return comps;
  
  const { basementFactor } = architecture;
  
  // Calculate effective above-grade square footage for subject
  const aboveGradeSqft = subjectSqft - (basementSqft || 0);
  const basementAdjustment = basementSqft ? basementSqft * basementFactor : 0;
  const effectiveSubjectSqft = aboveGradeSqft + basementAdjustment;
  
  return comps.map(comp => {
    // Assume comps may also have basement discrepancies
    const compBasementSqft = comp.basement_sqft || 0;
    const compAboveGradeSqft = comp.square_feet - compBasementSqft;
    const compBasementAdj = compBasementSqft * basementFactor;
    const compEffectiveSqft = compAboveGradeSqft + compBasementAdj;
    
    return {
      ...comp,
      // Store original for reference
      original_sqft: comp.square_feet,
      basement_sqft_used: compBasementSqft,
      // Use effective sqft for PPSF calculation
      effective_sqft: compEffectiveSqft,
      raw_ppsf: comp.sale_price / compEffectiveSqft,
      // Re-calculate adjusted PPSF if adjustment exists
      adjusted_ppsf: comp.adjusted_ppsf ? 
        (comp.sale_price / compEffectiveSqft) * (comp.adjusted_ppsf / comp.raw_ppsf) : 
        (comp.sale_price / compEffectiveSqft)
    };
  });
}

export function generateArchitectureNarrative(architecture, desirability, intakeData) {
  const { description, detectedType, basementFactor } = architecture;
  const { score, interpretation } = desirability;
  const yearBuilt = intakeData?.year_built || 'unknown';
  const sqft = intakeData?.sqft || 0;
  const basementSqft = intakeData?.basement_sqft || 0;
  
  let narrative = ``;
  
  switch (detectedType) {
    case 'split_level':
      narrative = `This ${description} property offers distinct separation between living zones, which appeals to buyers seeking flexibility in use and renovation potential. The multiple levels with distinct footprints can present marketing challenges depending on how the basement and above-grade spaces are positioned. With ${basementSqft ? `${basementSqft} SF of basement space factored at ${Math.round(basementFactor * 100)}% market recognition` : `finished basement potential`}, the effective marketable space is positioned at ${score > 0.6 ? 'a premium' : 'a competitive'} level within the market. Splits built in the 1970s-1980s appeal to buyers seeking authentic vintage character, while those from recent decades may face perception challenges around dated aesthetics.`;
      break;
      
    case 'raised_ranch':
      narrative = `This ${description} combines ranch simplicity with a raised foundation, popular in many Northeast markets. The lower level can be marketed as either recreation space, additional bedrooms, or storage depending on finish level. With basement considerations at ${Math.round(basementFactor * 100)}% of market value, pricing should reflect realistic marketable square footage. This architecture type appeals to investors and families upgrading from smaller homes, though some buyers view the two-entry concept as outdated or requiring additional maintenance.`;
      break;
      
    case 'multi_level':
      narrative = `This ${description} provides multiple living zones with separation, ideal for multi-generational use or significant renovation flexibility. Market perception of multi-level homes varies by era—older examples appeal to authenticity seekers, while newer constructions are viewed as either character-filled or dated depending on finishes. The basement factor of ${Math.round(basementFactor * 100)}% reflects that lower-level spaces command lower market premiums than above-grade living areas.`;
      break;
      
    case 'ranch':
      narrative = `This single-level ${description} appeals to empty-nesters, accessibility-conscious buyers, and those avoiding stairs. Single-level homes typically command strong market demand with straightforward pricing. Basement space (${basementSqft} SF at ${Math.round(basementFactor * 100)}% recognition) adds utility but doesn't increase value proportionally to above-grade additions. The simpler maintenance profile and broad appeal support strong market positioning.`;
      break;
      
    case 'colonial':
      narrative = `This classic ${description} remains a market favorite, appealing across demographics. Traditional two-story layouts provide strong curb appeal and clear functional separation between living and sleeping zones. Basement space at ${Math.round(basementFactor * 100)}% market factor adds value for storage, recreation, or future finishing. This architecture type shows consistent market strength and appeals to a broad buyer pool.`;
      break;
      
    default:
      narrative = `This ${description} with ${sqft} SF of living space (${basementSqft} SF basement factored at ${Math.round(basementFactor * 100)}% market recognition) is positioned strategically based on the effective marketable square footage and buyer demand for this architecture type.`;
  }
  
  return narrative;
}

function scoreToInterpretation(score, archType) {
  if (score > 0.75) return `${archType} is highly desirable in current market conditions`;
  if (score > 0.6) return `${archType} shows good market appeal with selective buyer demographics`;
  if (score > 0.45) return `${archType} requires strategic positioning due to market perception challenges`;
  return `${archType} may face headwinds in current market—pricing and presentation are critical`;
}