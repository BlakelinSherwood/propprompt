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

export function detectTopography(intakeData) {
  const notes = (intakeData?.notes || '').toLowerCase();
  const address = (intakeData?.address || '').toLowerCase();
  const text = `${address} ${notes}`;
  
  const topographies = {
    hilltop: {
      keywords: ['hill', 'hilltop', 'elevated', 'high ground', 'rise', 'crest'],
      desirabilityFactor: 0.15, // positive for views, negative for driveway
      factors: {
        views: 0.2,
        drainage: 0.1,
        drivewayComplexity: -0.2,
        floodRisk: 0.3,
        sunExposure: 0.1
      }
    },
    steep_slope: {
      keywords: ['steep', 'slope', 'sloped', 'hillside', 'grade change', 'steep driveway', 'steep slope'],
      desirabilityFactor: -0.15,
      factors: {
        views: 0.1,
        drainage: -0.2,
        drivewayComplexity: -0.3,
        floodRisk: 0.2,
        erosionRisk: -0.2,
        maintenanceCost: -0.2
      }
    },
    gentle_slope: {
      keywords: ['gentle slope', 'gradual', 'sloping', 'tiered'],
      desirabilityFactor: 0.05,
      factors: {
        views: 0.05,
        drainage: 0.1,
        drivewayComplexity: -0.05,
        floodRisk: 0.05
      }
    },
    flat: {
      keywords: ['flat', 'level', 'even terrain'],
      desirabilityFactor: 0.1,
      factors: {
        drainage: -0.1,
        drivewayComplexity: 0.2,
        floodRisk: -0.1,
        accessibility: 0.2
      }
    },
    valley: {
      keywords: ['valley', 'low spot', 'depression', 'basin'],
      desirabilityFactor: -0.1,
      factors: {
        floodRisk: -0.3,
        drainage: -0.2,
        sunExposure: -0.15,
        views: -0.2
      }
    }
  };
  
  let detectedTopo = 'flat';
  let topoFactor = 0;
  
  for (const [key, config] of Object.entries(topographies)) {
    if (config.keywords.some(kw => text.includes(kw))) {
      detectedTopo = key;
      topoFactor = config.desirabilityFactor;
      return { detectedTopo, topoFactor, ...config };
    }
  }
  
  return { detectedTopo, topoFactor, ...topographies[detectedTopo] };
}

export function detectStreetCharacteristics(intakeData) {
  const notes = (intakeData?.notes || '').toLowerCase();
  const address = (intakeData?.address || '').toLowerCase();
  const text = `${address} ${notes}`;
  
  const characteristics = {
    blind_curve: {
      keywords: ['blind curve', 'blind turn', 'curve at end', 'curves into', 'turn blind'],
      desirabilityFactor: -0.2,
      factors: {
        accessibilityAndSafety: -0.3,
        trafficPattern: -0.15,
        deliveryAndEmergency: -0.2,
        guestParking: -0.1
      }
    },
    double_line: {
      keywords: ['double line', 'double yellow', 'no parking', 'restricted parking'],
      desirabilityFactor: -0.1,
      factors: {
        guestParking: -0.25,
        streetParking: -0.2,
        resalePerception: -0.1
      }
    },
    high_traffic: {
      keywords: ['high traffic', 'busy street', 'main road', 'highway', 'major road', 'busy road'],
      desirabilityFactor: -0.15,
      factors: {
        noiseAndActivity: -0.25,
        childSafety: -0.2,
        trafficPattern: -0.2,
        guestExperience: -0.15
      }
    },
    quiet_street: {
      keywords: ['quiet street', 'quiet', 'dead end', 'cul-de-sac', 'tree-lined', 'peaceful', 'residential'],
      desirabilityFactor: 0.15,
      factors: {
        noiseAndActivity: 0.25,
        childSafety: 0.2,
        neighborhoodAppeal: 0.2
      }
    },
    limited_access: {
      keywords: ['limited access', 'single access', 'one driveway', 'shared driveway', 'narrow access'],
      desirabilityFactor: -0.12,
      factors: {
        accessibilityAndSafety: -0.25,
        emergencyAccess: -0.2,
        moverFriendliness: -0.15
      }
    },
    corner_lot: {
      keywords: ['corner lot', 'corner property', 'on corner'],
      desirabilityFactor: -0.08,
      factors: {
        trafficExposure: -0.2,
        privacyAndNoise: -0.15,
        visibilityAndCommerce: 0.15
      }
    }
  };
  
  const detected = [];
  const allFactors = {};
  let combinedFactor = 0;
  
  for (const [key, config] of Object.entries(characteristics)) {
    if (config.keywords.some(kw => text.includes(kw))) {
      detected.push(key);
      combinedFactor += config.desirabilityFactor;
      Object.assign(allFactors, config.factors);
    }
  }
  
  return {
    detected: detected.length > 0 ? detected : ['standard'],
    combinedFactor: Math.max(-0.4, Math.min(0.25, combinedFactor)), // cap to reasonable range
    factors: allFactors,
    description: detected.length > 0 ? detected.join(', ') : 'Standard street characteristics'
  };
}

export function calculateDesirabilityScore(architecture, intakeData, comps = [], topography = null, streetChar = null) {
  if (!architecture) return { score: 0.5, factors: {} };
  
  // Detect topography and street characteristics if not provided
  const topo = topography || detectTopography(intakeData);
  const street = streetChar || detectStreetCharacteristics(intakeData);
  
  const factors = { 
    ...architecture.desirabilityFactors,
    ...topo.factors,
    ...street.factors
  };
  
  let totalScore = 0.5; // baseline
  
  // Factor 1: Market appeal of architecture (15% weight)
  const archScore = Object.values(architecture.desirabilityFactors).reduce((a, b) => a + b, 0);
  totalScore += archScore * 0.15;
  
  // Factor 2: Recent market performance of similar types (15% weight)
  if (comps && comps.length > 0) {
    const similarComps = comps.filter(c => 
      c.condition_vs_subject === 'Similar' || !c.condition_vs_subject
    );
    if (similarComps.length > 0) {
      const avgDOM = similarComps.reduce((sum, c) => sum + (c.days_on_market || 25), 0) / similarComps.length;
      const domScore = Math.max(-0.2, 0.3 - (avgDOM / 50));
      totalScore += domScore * 0.15;
    }
  }
  
  // Factor 3: Age/condition appeal (10% weight)
  const yearBuilt = intakeData?.year_built || 1980;
  const age = new Date().getFullYear() - yearBuilt;
  if (architecture.detectedType.includes('level')) {
    const ageAppeal = age > 40 ? 0.15 : age < 20 ? -0.15 : 0;
    totalScore += ageAppeal * 0.1;
  }
  
  // Factor 4: Topography impact (15% weight)
  totalScore += topo.desirabilityFactor * 0.15;
  
  // Factor 5: Street characteristics impact (10% weight)
  totalScore += street.combinedFactor * 0.1;
  
  // Normalize to 0-1 scale
  totalScore = Math.max(0, Math.min(1, totalScore));
  
  return {
    score: totalScore,
    factors,
    archScore,
    topoFactor: topo.desirabilityFactor,
    streetFactor: street.combinedFactor,
    topography: topo,
    streetCharacteristics: street,
    interpretation: scoreToInterpretation(totalScore, architecture.description, topo, street)
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

export function generatePropertyContextNarrative(architecture, desirability, intakeData) {
  const { description, detectedType, basementFactor } = architecture;
  const { score, topography, streetCharacteristics } = desirability;
  const yearBuilt = intakeData?.year_built || 'unknown';
  const sqft = intakeData?.sqft || 0;
  const basementSqft = intakeData?.basement_sqft || 0;
  
  let narrative = [];
  
  // Topography narrative
  if (topography) {
    switch (topography.detectedTopo) {
      case 'hilltop':
        narrative.push(`The property sits on elevated terrain with views and excellent drainage characteristics. Driveway access may require grading or upslope approach, which appeals to buyers seeking privacy and vistas but requires careful presentation of any maintenance considerations.`);
        break;
      case 'steep_slope':
        narrative.push(`The property is situated on sloped terrain with a sloped driveway approach. While this creates visual interest and potential drainage benefits, it may present challenges for accessibility, mover logistics, and driveway maintenance that should be positioned strategically to the right buyer demographic.`);
        break;
      case 'gentle_slope':
        narrative.push(`The property benefits from gentle topography with gradual slope, providing good drainage and visual variety while maintaining practical accessibility.`);
        break;
      case 'valley':
        narrative.push(`The property is situated in lower terrain, which may impact drainage and water management. Buyers valuing privacy and shelter from wind may find this appealing, though flood risk and sunlight exposure should be carefully evaluated and disclosed.`);
        break;
    }
  }
  
  // Street characteristics narrative
  if (streetCharacteristics && streetCharacteristics.detected.length > 0) {
    const issues = [];
    if (streetCharacteristics.detected.includes('blind_curve')) {
      issues.push(`blind curve at end of street affecting visibility and safety`);
    }
    if (streetCharacteristics.detected.includes('double_line')) {
      issues.push(`double line parking restrictions limiting guest parking`);
    }
    if (streetCharacteristics.detected.includes('high_traffic')) {
      issues.push(`high traffic volume along the street`);
    }
    if (streetCharacteristics.detected.includes('limited_access')) {
      issues.push(`limited access to the property`);
    }
    if (streetCharacteristics.detected.includes('corner_lot')) {
      issues.push(`corner lot exposure with dual street frontage`);
    }
    
    if (issues.length > 0 && streetCharacteristics.combinedFactor < -0.1) {
      narrative.push(`Street-level considerations: ${issues.join('; ')}. These factors may impact buyer perception and should be addressed through strategic positioning, pricing adjustments, or marketing focus on other property strengths.`);
    }
  }
  
  return narrative.join(' ');
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

function scoreToInterpretation(score, archType, topography, streetChar) {
  let base = '';
  if (score > 0.75) {
    base = `${archType} is highly desirable in current market conditions`;
  } else if (score > 0.6) {
    base = `${archType} shows good market appeal with selective buyer demographics`;
  } else if (score > 0.45) {
    base = `${archType} requires strategic positioning due to market perception challenges`;
  } else {
    base = `${archType} may face headwinds in current market—pricing and presentation are critical`;
  }
  
  let constraints = [];
  if (topography && topography.desirabilityFactor < -0.05) {
    constraints.push(`topography challenges (${topography.detectedTopo})`);
  }
  if (streetChar && streetChar.combinedFactor < -0.1) {
    constraints.push(`street characteristics (${streetChar.description})`);
  }
  
  if (constraints.length > 0) {
    base += `. Note: ${constraints.join(' and ')} may require pricing adjustments or targeted marketing.`;
  }
  
  return base;
}