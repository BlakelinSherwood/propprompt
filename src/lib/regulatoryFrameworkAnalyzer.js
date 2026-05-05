/**
 * Regulatory & Legal Framework Analyzer
 * 
 * Detects and analyzes town/state regulations, zoning, conservation laws,
 * and legal restrictions that affect property value, development potential,
 * and marketability.
 */

export function detectRegulatoryFramework(intakeData, location) {
  const notes = (intakeData?.notes || '').toLowerCase();
  const address = (intakeData?.address || '').toLowerCase();
  const text = `${address} ${notes}`;
  
  const regulations = {
    historic_district: {
      keywords: ['historic', 'historic district', 'historical district', 'register', 'national register'],
      impact: 'negative',
      valueFactor: -0.05,
      description: 'Historic District',
      considerations: [
        'Exterior modifications require architectural review and approval',
        'Limited renovation flexibility and higher compliance costs',
        'May attract preservation-minded buyers with curb appeal premium',
        'Potential tax credits for qualified renovations (varies by state)'
      ]
    },
    conservation_area: {
      keywords: ['conservation', 'conservation area', 'protected land', 'conservation easement', 'wetland'],
      impact: 'negative',
      valueFactor: -0.08,
      description: 'Conservation/Wetland Restricted',
      considerations: [
        'Limited development potential on part or all of property',
        'Restrictions on cutting trees, draining water, or grading',
        'May not be buildable or have reduced buildable area',
        'Potential for conservation tax incentives (check state law)'
      ]
    },
    septic_system: {
      keywords: ['septic', 'septic system', 'septic requirement', 'well water', 'well system', 'on-site sewage'],
      impact: 'negative',
      valueFactor: -0.06,
      description: 'Septic/Well System',
      considerations: [
        'Higher ongoing maintenance and inspection costs',
        'Potential replacement costs ($10k-$25k+) reduce buyer pool',
        'Financing may be more difficult for buyers (some lenders hesitant)',
        'Soil testing and percolation requirements for additions/renovations',
        'Well water testing required (buyer concern for water quality)'
      ]
    },
    flood_zone: {
      keywords: ['flood zone', 'flood plain', 'fema flood', '100-year flood', 'flood insurance'],
      impact: 'negative',
      valueFactor: -0.10,
      description: 'FEMA Flood Zone',
      considerations: [
        'Flood insurance required (mandatory cost for mortgaged properties)',
        'Insurance costs typically $500-$2,000+ annually',
        'Limitations on renovation, additions, and basement finishing',
        'Potential future flood buyout programs (displaces property)',
        'Resale pool significantly reduced'
      ]
    },
    zoning_residential: {
      keywords: ['zoning: residential', 'zoned residential', 'residential district', 'single family zoning'],
      impact: 'neutral',
      valueFactor: 0,
      description: 'Residential Zoning',
      considerations: [
        'Clear market expectations for single/multi-family use',
        'Home business restrictions (check local bylaws for work-from-home limits)',
        'Lot size and setback requirements may limit additions',
        'Clear buyer pool for residential purposes'
      ]
    },
    zoning_mixed: {
      keywords: ['mixed use', 'business zoning', 'commercial zoning', 'multifamily', 'zoning variance'],
      impact: 'positive',
      valueFactor: 0.08,
      description: 'Mixed-Use/Commercial Zoning',
      considerations: [
        'Potential for home business, rental, or commercial conversion',
        'Higher economic value potential but more complex financing',
        'May attract investor buyers; may limit residential buyer pool',
        'Neighborhood may be more commercial (noise, traffic considerations)'
      ]
    },
    agricultural_preservation: {
      keywords: ['agricultural', 'ag preserve', 'agricultural district', 'ag zone', 'agricultural preservation'],
      impact: 'negative',
      valueFactor: -0.12,
      description: 'Agricultural Preservation District',
      considerations: [
        'Limited residential development potential',
        'Farm operations have legal protections (dust, noise, smells)',
        'Minimum lot sizes may be 2+ acres',
        'Subdivision restrictions reduce development value',
        'May appeal to rural/hobby farm buyers'
      ]
    },
    outfall_zone: {
      keywords: ['outfall', 'sewer outfall', 'treatment plant', 'wastewater', 'sewage line'],
      impact: 'negative',
      valueFactor: -0.07,
      description: 'Sewer Outfall/Treatment Area',
      considerations: [
        'Potential odor, noise, and environmental concerns',
        'Property near outfall may have restricted uses',
        'Buyer perception and resale difficulty',
        'Environmental testing may be required'
      ]
    },
    right_of_way: {
      keywords: ['right of way', 'easement', 'power line easement', 'utility easement', 'drainage easement'],
      impact: 'negative',
      valueFactor: -0.04,
      description: 'Easement/Right of Way',
      considerations: [
        'Utility company access for maintenance reduces privacy',
        'Restrictions on building/landscaping in easement area',
        'Power line easements may have health concerns (buyer perception)',
        'Limits on future development or expansion'
      ]
    },
    short_term_rental_restriction: {
      keywords: ['short term rental', 'str restriction', 'airbnb', 'vacation rental', 'no short term rental'],
      impact: 'negative',
      valueFactor: -0.05,
      description: 'Short-Term Rental Restricted',
      considerations: [
        'Investment/income potential severely limited',
        'Reduces buyer pool to owner-occupants only',
        'May indicate neighborhood character protection ordinance',
        'Check if restrictions are permanent or temporary'
      ]
    },
    property_tax_incentive: {
      keywords: ['tax incentive', 'tax abatement', 'tax reduction', 'tax break', 'current use'],
      impact: 'positive',
      valueFactor: 0.06,
      description: 'Property Tax Incentive Program',
      considerations: [
        'May have reduced property taxes (current use taxation, farmland)',
        'Tax break may end if land use changes (recapture penalty)',
        'Appeals to specific buyer demographics (farmers, agricultural)',
        'Future taxes may increase significantly if property sold for development'
      ]
    },
    historic_property_tax_credit: {
      keywords: ['historic tax credit', 'historic preservation credit', 'heritage preservation'],
      impact: 'positive',
      valueFactor: 0.04,
      description: 'Historic Property Tax Credit Eligible',
      considerations: [
        'Potential federal and state tax credits for certified rehab',
        'Credits can be 20-30% of qualified renovation costs',
        'Must follow Secretary of Interior Standards',
        'Appeals to renovation-focused buyers'
      ]
    }
  };
  
  const detected = [];
  const allFactors = [];
  let combinedFactor = 0;
  
  for (const [key, config] of Object.entries(regulations)) {
    if (config.keywords.some(kw => text.includes(kw))) {
      detected.push(key);
      allFactors.push({
        type: key,
        description: config.description,
        impact: config.impact,
        valueFactor: config.valueFactor,
        considerations: config.considerations
      });
      combinedFactor += config.valueFactor;
    }
  }
  
  return {
    detected,
    allFactors,
    combinedFactor: Math.max(-0.4, Math.min(0.2, combinedFactor)),
    summary: generateRegulatoryNarrative(allFactors)
  };
}

function generateRegulatoryNarrative(factors) {
  if (factors.length === 0) {
    return 'No significant regulatory restrictions detected. Property is in standard residential zoning with typical town regulations.';
  }
  
  const negatives = factors.filter(f => f.impact === 'negative');
  const positives = factors.filter(f => f.impact === 'positive');
  
  let narrative = '';
  
  if (negatives.length > 0) {
    narrative += `Regulatory considerations affecting value: ${negatives.map(f => f.description).join(', ')}. `;
    narrative += 'These restrictions may impact development potential, financing options, and buyer pool. ';
  }
  
  if (positives.length > 0) {
    narrative += `Regulatory advantages: ${positives.map(f => f.description).join(', ')}. `;
    narrative += 'These may provide tax incentives or appeal to specific buyer demographics. ';
  }
  
  return narrative;
}

export function calculateRegulatoryImpact(factors) {
  if (!factors || factors.length === 0) {
    return {
      score: 0.5, // neutral
      severity: 'none',
      affectsDevelopment: false,
      affectsFinancing: false,
      affectsBuyerPool: false,
      narrative: 'No regulatory constraints identified.'
    };
  }
  
  const hasNegative = factors.some(f => f.impact === 'negative');
  const negativeCount = factors.filter(f => f.impact === 'negative').length;
  const positiveCount = factors.filter(f => f.impact === 'positive').length;
  
  // Determine if regulatory factors significantly affect major criteria
  const affectsDevelopment = factors.some(f => 
    ['conservation_area', 'agricultural_preservation', 'flood_zone'].includes(f.type)
  );
  
  const affectsFinancing = factors.some(f =>
    ['flood_zone', 'septic_system', 'conservation_area'].includes(f.type)
  );
  
  const affectsBuyerPool = factors.some(f =>
    ['historic_district', 'flood_zone', 'short_term_rental_restriction'].includes(f.type)
  );
  
  let severity = 'none';
  if (negativeCount >= 3) severity = 'severe';
  else if (negativeCount === 2) severity = 'moderate';
  else if (negativeCount === 1) severity = 'minor';
  
  return {
    score: 0.5 + (positiveCount * 0.05) - (negativeCount * 0.08),
    severity,
    affectsDevelopment,
    affectsFinancing,
    affectsBuyerPool,
    narrative: generateRegulatoryNarrative(factors),
    factors
  };
}

export function generateRegulatoryDisclosure(factors, intakeData) {
  if (!factors || factors.length === 0) {
    return '';
  }
  
  let disclosure = 'REGULATORY & LEGAL FRAMEWORK:\n\n';
  
  for (const factor of factors) {
    disclosure += `${factor.description.toUpperCase()}\n`;
    disclosure += `Impact: ${factor.impact === 'negative' ? 'Restricts' : 'Enhances'} property value\n\n`;
    disclosure += 'Considerations:\n';
    factor.considerations.forEach(c => {
      disclosure += `• ${c}\n`;
    });
    disclosure += '\n';
  }
  
  return disclosure;
}

export function generateRegulatoryPricingGuidance(factors, intakeData) {
  const negativeFactors = factors.filter(f => f.impact === 'negative');
  const positiveFactors = factors.filter(f => f.impact === 'positive');
  
  if (negativeFactors.length === 0 && positiveFactors.length === 0) {
    return null;
  }
  
  let guidance = 'REGULATORY PRICING ADJUSTMENTS:\n\n';
  
  negativeFactors.forEach(f => {
    const adjustment = Math.round(f.valueFactor * 100);
    guidance += `- ${f.description}: ${adjustment}% adjustment\n`;
  });
  
  positiveFactors.forEach(f => {
    const adjustment = Math.round(f.valueFactor * 100);
    guidance += `+ ${f.description}: +${adjustment}% adjustment\n`;
  });
  
  const totalAdj = negativeFactors.reduce((s, f) => s + f.valueFactor, 0) + 
                   positiveFactors.reduce((s, f) => s + f.valueFactor, 0);
  guidance += `\nCombined regulatory impact: ${Math.round(totalAdj * 100)}%`;
  
  return guidance;
}