/**
 * AI Model Selection Utility
 * 
 * Routes analyses to appropriate Claude models based on complexity tier.
 * Currently hardcoded to Anthropic/Claude.
 * 
 * Future: This will support multi-platform routing when other platforms
 * are activated in the admin panel.
 * 
 * All platform routing logic is preserved commented out below for future use.
 */

const DEFAULT_MODELS = {
  complex: 'claude-opus-4-5',      // Listing pricing, portfolio, custom analyses
  standard: 'claude-sonnet-4-6',   // CMA, buyer intel, investment, rental
  background: 'claude-haiku-4-5-20251001', // Public records, quota checks, watches
};

/**
 * Determine complexity tier for an analysis type
 */
export function getAnalysisComplexityTier(analysisType, hasAddons = false) {
  if (hasAddons) return 'complex';

  const complexTypes = [
    'listing_pricing',
    'client_portfolio',
    'custom',
  ];

  const standardTypes = [
    'cma',
    'buyer_intelligence',
    'investment_analysis',
    'rental_analysis',
  ];

  if (complexTypes.includes(analysisType)) return 'complex';
  if (standardTypes.includes(analysisType)) return 'standard';
  return 'standard'; // default
}

/**
 * Get the appropriate Claude model for an analysis
 * 
 * @param {string} analysisType - Type of analysis being run
 * @param {boolean} hasAddons - Whether analysis has module add-ons
 * @returns {object} { platform: 'anthropic', model: 'claude-...' }
 */
export function selectAIModel(analysisType, hasAddons = false) {
  const tier = getAnalysisComplexityTier(analysisType, hasAddons);
  const model = DEFAULT_MODELS[tier] || DEFAULT_MODELS.standard;

  return {
    platform: 'anthropic',
    model,
    tier,
  };
}

/**
 * Get the appropriate Claude model for a background task
 * (quota checks, public records, territory watches, landing page stats)
 */
export function selectBackgroundTaskModel() {
  return {
    platform: 'anthropic',
    model: DEFAULT_MODELS.background,
    tier: 'background',
  };
}

/*
FUTURE: Multi-platform routing logic (preserved for activation)
==============================================================

export async function selectAIModelMultiPlatform(base44, analysisType, hasAddons = false) {
  // When multi-platform activation is enabled, this will:
  // 1. Check if a platform override exists in admin settings
  // 2. Route to that platform's model
  // 3. Fall back to Claude if not configured
  
  const tier = getAnalysisComplexityTier(analysisType, hasAddons);
  
  try {
    // Fetch active routing configuration
    const routings = await base44.asServiceRole.entities.AIModelRouting.filter({
      is_active: true,
    });
    
    // Check for platform-specific routing
    for (const routing of routings) {
      if (routing.routing_tier === tier) {
        return {
          platform: routing.platform,
          model: routing.model_string,
          tier,
        };
      }
    }
  } catch (err) {
    console.warn('[selectAIModel] Failed to fetch routing config, using default:', err.message);
  }
  
  // Fall back to Claude
  return selectAIModel(analysisType, hasAddons);
}

export async function selectBackgroundTaskModelMultiPlatform(base44) {
  try {
    const routing = await base44.asServiceRole.entities.AIModelRouting.filter({
      routing_tier: 'background',
      is_active: true,
    }, '-updated_at', 1);
    
    if (routing && routing.length > 0) {
      return {
        platform: routing[0].platform,
        model: routing[0].model_string,
        tier: 'background',
      };
    }
  } catch (err) {
    console.warn('[selectBackgroundModel] Failed to fetch routing config:', err.message);
  }
  
  return selectBackgroundTaskModel();
}
*/