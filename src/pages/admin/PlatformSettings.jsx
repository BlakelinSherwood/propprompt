import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Check, Eye, EyeOff, Loader2, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

const PLATFORMS = [
  {
    id: 'anthropic',
    name: 'Claude',
    provider: 'Anthropic',
    description: 'Advanced reasoning and text generation',
    configKey: 'anthropic_api_key',
    enabledKey: 'claude_enabled',
    wizardId: 'claude',
    models: { complex: 'claude-opus-4-5', standard: 'claude-sonnet-4-6', background: 'claude-haiku-4-5-20251001' },
  },
  {
    id: 'openai',
    name: 'ChatGPT',
    provider: 'OpenAI',
    description: 'Fast, reliable, excellent all-purpose model',
    configKey: 'openai_api_key',
    enabledKey: 'chatgpt_enabled',
    wizardId: 'chatgpt',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    provider: 'Google',
    description: 'Multimodal reasoning and web search',
    configKey: 'google_api_key',
    enabledKey: 'gemini_enabled',
    wizardId: 'gemini',
  },
  {
    id: 'perplexity',
    name: 'Perplexity',
    provider: 'Perplexity AI',
    description: 'Real-time web search and citations',
    configKey: 'perplexity_api_key',
    enabledKey: 'perplexity_enabled',
    wizardId: 'perplexity',
  },
  {
    id: 'grok',
    name: 'Grok',
    provider: 'xAI',
    description: 'Real-time data and reasoning',
    configKey: 'grok_api_key',
    enabledKey: 'grok_enabled',
    wizardId: 'grok',
  },
];

export default function PlatformSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [routing, setRouting] = useState({});
  const [loading, setLoading] = useState(true);
  const [platformConfig, setPlatformConfig] = useState(null);
  const [keyInputs, setKeyInputs] = useState({});
  const [showKey, setShowKey] = useState({});
  const [savingKey, setSavingKey] = useState({});

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const [routes, configs] = await Promise.all([
        base44.asServiceRole.entities.AIModelRouting.filter({}),
        base44.asServiceRole.entities.PlatformConfig.filter({}),
      ]);
      const map = {};
      (routes || []).forEach(r => { map[`${r.platform}_${r.routing_tier}`] = r; });
      setRouting(map);
      setPlatformConfig(configs[0] || {});
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveApiKey(platform) {
    const val = (keyInputs[platform.id] || '').trim();
    if (!val) return;
    setSavingKey(s => ({ ...s, [platform.id]: true }));
    try {
      const update = { [platform.configKey]: val, [platform.enabledKey]: true };
      if (platformConfig?.id) {
        await base44.asServiceRole.entities.PlatformConfig.update(platformConfig.id, update);
      } else {
        const created = await base44.asServiceRole.entities.PlatformConfig.create(update);
        setPlatformConfig(created);
      }
      setPlatformConfig(prev => ({ ...prev, ...update }));
      setKeyInputs(prev => ({ ...prev, [platform.id]: '' }));
      toast({ title: `${platform.name} API key saved`, description: 'Platform is now enabled.' });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingKey(s => ({ ...s, [platform.id]: false }));
    }
  }

  async function toggleEnabled(platform, enabled) {
    try {
      const update = { [platform.enabledKey]: enabled };
      if (platformConfig?.id) {
        await base44.asServiceRole.entities.PlatformConfig.update(platformConfig.id, update);
        setPlatformConfig(prev => ({ ...prev, ...update }));
      }
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  const [versionInput, setVersionInput] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  async function saveVersion() {
    const v = versionInput.trim();
    if (!v) return;
    setSavingVersion(true);
    try {
      if (platformConfig?.id) {
        await base44.asServiceRole.entities.PlatformConfig.update(platformConfig.id, { platform_version: v });
        setPlatformConfig(prev => ({ ...prev, platform_version: v }));
      } else {
        const created = await base44.asServiceRole.entities.PlatformConfig.create({ platform_version: v });
        setPlatformConfig(created);
      }
      setVersionInput('');
      toast({ title: `Platform version updated to v${v}` });
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSavingVersion(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3226]">Platform Settings</h1>
        <p className="text-sm text-[#1A3226]/60 mt-1">
          Manage platform version, API keys, and AI platform availability.
        </p>
      </div>

      {/* General Settings */}
      <div className="rounded-2xl border-2 border-[#1A3226]/20 bg-white p-6">
        <div className="flex items-center gap-3 mb-5">
          <Tag className="w-5 h-5 text-[#1A3226]/50" />
          <h2 className="text-base font-bold text-[#1A3226]">General Settings</h2>
        </div>
        <div>
          <label className="text-xs font-semibold text-[#1A3226]/60 uppercase">Platform Version</label>
          <p className="text-xs text-[#1A3226]/40 mb-2">Current: <span className="font-semibold text-[#1A3226]/70">v{platformConfig?.platform_version || '4.0'}</span> — shown on prompts and throughout the platform.</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder={`e.g. ${platformConfig?.platform_version || '4.0'}`}
              value={versionInput}
              onChange={e => setVersionInput(e.target.value)}
              className="px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#B8982F]/30 w-40"
            />
            <Button
              onClick={saveVersion}
              disabled={!versionInput.trim() || savingVersion}
              className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
            >
              {savingVersion ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Update'}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {PLATFORMS.map(platform => {
          const isEnabled = platformConfig?.[platform.enabledKey] !== false;
          const hasKey = !!(platformConfig?.[platform.configKey]);
          const isClaude = platform.id === 'anthropic';

          return (
            <div key={platform.id} className={`rounded-2xl border-2 bg-white p-6 ${
              isEnabled && hasKey ? 'border-[#1A3226]' : 'border-[#1A3226]/20'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    isEnabled && hasKey ? 'bg-green-100' : 'bg-[#1A3226]/10'
                  }`}>
                    {isEnabled && hasKey
                      ? <Check className="w-4 h-4 text-green-700" />
                      : <span className="w-2 h-2 rounded-full bg-[#1A3226]/30" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[#1A3226]">{platform.name} — {platform.provider}</h2>
                    <p className="text-xs text-[#1A3226]/50 mt-0.5">{platform.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasKey && (
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                      isEnabled ? 'bg-green-100 text-green-800' : 'bg-[#1A3226]/10 text-[#1A3226]/60'
                    }`}>{isEnabled ? 'ACTIVE' : 'DISABLED'}</span>
                  )}
                  {hasKey && !isClaude && (
                    <button
                      onClick={() => toggleEnabled(platform, !isEnabled)}
                      className="text-xs underline text-[#1A3226]/50 hover:text-[#1A3226]"
                    >{isEnabled ? 'Disable' : 'Enable'}</button>
                  )}
                </div>
              </div>

              {/* Model routing for Claude */}
              {isClaude && (
                <div className="space-y-3 bg-[#1A3226]/[0.03] rounded-xl p-4 mb-4">
                  <p className="text-sm font-semibold text-[#1A3226] mb-2">Model Routing</p>
                  {['complex', 'standard', 'background'].map(tier => {
                    const tierLabels = {
                      complex: 'Complex Analyses',
                      standard: 'Standard Analyses',
                      background: 'Background Tasks',
                    };
                    const defaults = { complex: 'claude-opus-4-5', standard: 'claude-sonnet-4-6', background: 'claude-haiku-4-5-20251001' };
                    const key = `anthropic_${tier}`;
                    const currentRoute = routing[key];
                    return (
                      <div key={tier} className="flex items-center justify-between border-b border-[#1A3226]/10 last:border-0 pb-2 last:pb-0">
                        <label className="text-sm text-[#1A3226]">{tierLabels[tier]}</label>
                        <input
                          type="text"
                          value={currentRoute?.model_string || defaults[tier]}
                          onChange={(e) => updateModel('anthropic', tier, e.target.value)}
                          className="px-3 py-1 border border-[#1A3226]/20 rounded-lg text-sm font-mono bg-white focus:outline-none w-64"
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* API Key input */}
              <div>
                <label className="text-xs font-semibold text-[#1A3226]/60 uppercase">
                  {hasKey ? 'Update API Key' : 'API Key'}
                </label>
                <div className="flex gap-2 mt-1.5">
                  <div className="relative flex-1">
                    <input
                      type={showKey[platform.id] ? 'text' : 'password'}
                      placeholder={hasKey ? '••••••••••••••• (saved)' : `Enter ${platform.name} API key`}
                      value={keyInputs[platform.id] || ''}
                      onChange={e => setKeyInputs(prev => ({ ...prev, [platform.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#B8982F]/30 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(s => ({ ...s, [platform.id]: !s[platform.id] }))}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]"
                    >
                      {showKey[platform.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <Button
                    onClick={() => saveApiKey(platform)}
                    disabled={!(keyInputs[platform.id] || '').trim() || savingKey[platform.id]}
                    className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white shrink-0"
                  >
                    {savingKey[platform.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : hasKey ? 'Update' : 'Save & Enable'}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}