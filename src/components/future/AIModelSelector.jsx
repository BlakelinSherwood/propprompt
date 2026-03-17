// Reserved for future multi-platform activation — do not delete

import { useState } from 'react';
import { Button } from '@/components/ui/button';

/**
 * AI Model/Platform Selection Component
 * 
 * This component was used to let subscribers choose between
 * Claude, ChatGPT, Gemini, Perplexity, and Grok.
 * 
 * Currently disabled from the analysis flow.
 * Will be re-enabled when multi-platform activation is ready.
 * 
 * Preserved here with full logic intact for future use.
 */

export default function AIModelSelector({ value = 'claude', onChange, disabled = true }) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const platforms = [
    {
      id: 'claude',
      name: 'Claude',
      icon: '🧠',
      description: 'Advanced reasoning and analysis',
      requiredTier: null,
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      icon: '💬',
      description: 'Fast, structured output',
      requiredTier: 'agent',
    },
    {
      id: 'gemini',
      name: 'Gemini',
      icon: '🔍',
      description: 'Multimodal reasoning',
      requiredTier: 'agent',
    },
    {
      id: 'perplexity',
      name: 'Perplexity',
      icon: '🌐',
      description: 'Real-time web search',
      requiredTier: 'team',
    },
    {
      id: 'grok',
      name: 'Grok',
      icon: '⚡',
      description: 'Real-time data',
      requiredTier: 'team',
    },
  ];

  if (disabled) {
    return null; // Hidden from current flow
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-semibold text-[#1A3226]">AI Platform</label>
        <p className="text-xs text-[#1A3226]/60 mt-1">
          Choose which AI model to use for this analysis.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {platforms.map(platform => (
          <button
            key={platform.id}
            onClick={() => onChange(platform.id)}
            disabled={disabled}
            className={`p-3 rounded-lg border-2 transition-all text-center ${
              value === platform.id
                ? 'border-[#B8982F] bg-[#B8982F]/5'
                : 'border-[#1A3226]/10 hover:border-[#1A3226]/20'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="text-xl mb-1">{platform.icon}</div>
            <p className="text-xs font-semibold text-[#1A3226]">{platform.name}</p>
            <p className="text-xs text-[#1A3226]/50 mt-1">{platform.description}</p>
            {platform.requiredTier && (
              <p className="text-xs text-[#B8982F] mt-1 font-medium">{platform.requiredTier}+</p>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}