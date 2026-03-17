import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Check, AlertCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORMS = [
  {
    id: 'anthropic',
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Advanced reasoning and text generation',
    status: 'active',
    models: {
      complex: 'claude-opus-4-5',
      standard: 'claude-sonnet-4-6',
      background: 'claude-haiku-4-5-20251001',
    },
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Strong structured output and financial tables. Future: Agent+ tier.',
    status: 'inactive',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    description: 'Multimodal reasoning and web search. Future: Market research automation.',
    status: 'inactive',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    description: 'Real-time web search and citations. Future: Market data pulls.',
    status: 'inactive',
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    description: 'Real-time data and humor. Future: Specialized analysis types.',
    status: 'inactive',
  },
];

export default function PlatformSettings() {
  const { user } = useAuth();
  const [expandedTier, setExpandedTier] = useState(null);
  const [routing, setRouting] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRouting();
  }, []);

  async function loadRouting() {
    try {
      const routes = await base44.asServiceRole.entities.AIModelRouting.filter({});
      const map = {};
      (routes || []).forEach(r => {
        map[`${r.platform}_${r.routing_tier}`] = r;
      });
      setRouting(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function updateModel(platform, tier, newModel) {
    try {
      const key = `${platform}_${tier}`;
      const existing = routing[key];

      if (existing) {
        await base44.asServiceRole.entities.AIModelRouting.update(existing.id, {
          model_string: newModel,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.AIModelRouting.create({
          platform,
          routing_tier: tier,
          model_string: newModel,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        });
      }

      loadRouting();
    } catch (err) {
      console.error(err);
    }
  }

  const activePlatform = PLATFORMS.find(p => p.status === 'active');
  const futurePlatforms = PLATFORMS.filter(p => p.status === 'inactive');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3226]">AI Platform Configuration</h1>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          Claude (Anthropic) is the active platform. Additional platforms are configured here when ready to activate.
        </p>
      </div>

      {/* Active Platform */}
      <div className="rounded-2xl border-2 border-[#1A3226] bg-white p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-green-700" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#1A3226]">{activePlatform.name} — {activePlatform.provider}</h2>
              <p className="text-sm text-[#1A3226]/60 mt-1">Active platform for all analyses</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">ACTIVE</span>
        </div>

        <div className="space-y-4 bg-[#1A3226]/[0.03] rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-[#1A3226] mb-3">Model Routing</p>

          {['complex', 'standard', 'background'].map(tier => {
            const tierLabels = {
              complex: 'Complex Analyses (Listing Pricing, Portfolio, Custom)',
              standard: 'Standard Analyses (CMA, Buyer Intel, Investment)',
              background: 'Background Tasks (Public Records, Quota Checks, Watch Lists)',
            };

            const key = `anthropic_${tier}`;
            const currentRoute = routing[key];
            const defaultModel = activePlatform.models[tier];

            return (
              <div key={tier} className="border-b border-[#1A3226]/10 last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-[#1A3226]">{tierLabels[tier]}</label>
                  <input
                    type="text"
                    value={currentRoute?.model_string || defaultModel}
                    onChange={(e) => updateModel('anthropic', tier, e.target.value)}
                    className="px-3 py-1.5 border border-[#1A3226]/20 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#B8982F]/30"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-[#1A3226]/50 px-4 py-2 bg-[#1A3226]/[0.03] rounded-lg">
          When Anthropic releases new models, update the model strings above. Changes take effect on the next analysis run.
        </p>
      </div>

      {/* Future Platforms */}
      <div>
        <h3 className="text-lg font-bold text-[#1A3226] mb-4">Future Platforms — Not Yet Active</h3>
        <div className="grid gap-4">
          {futurePlatforms.map(platform => (
            <div key={platform.id} className="rounded-2xl border-2 border-[#1A3226]/20 bg-[#1A3226]/[0.02] p-6 opacity-60">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-[#1A3226]/70">⬜ {platform.name} — {platform.provider}</h3>
                  <p className="text-sm text-[#1A3226]/50 mt-1">{platform.description}</p>
                </div>
                <span className="px-3 py-1 bg-[#1A3226]/10 text-[#1A3226]/70 text-xs font-semibold rounded-full">NOT ACTIVE</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-[#1A3226]/60 uppercase">API Key</label>
                  <input
                    type="password"
                    placeholder="Enter API key for future activation"
                    className="w-full mt-1.5 px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm bg-white/50 focus:outline-none focus:ring-2 focus:ring-[#B8982F]/30"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs opacity-50 cursor-not-allowed"
                    disabled
                  >
                    Configure
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs opacity-50 cursor-not-allowed"
                    disabled
                    title="Activation routes analyses to this platform. Only activate when integration is fully tested."
                  >
                    Activate
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}