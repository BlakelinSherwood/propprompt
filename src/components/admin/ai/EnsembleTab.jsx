import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lock, Loader2, CheckCircle2, Info } from "lucide-react";

const SECTION_ROWS = [
  { key: "pricing_strategy",    label: "Pricing Strategy",    desc: "CMA, comparables, recommended price" },
  { key: "market_context",      label: "Market Context",       desc: "Live inventory, trends, demand" },
  { key: "neighbourhood",       label: "Neighbourhood",        desc: "Schools, amenities, local activity" },
  { key: "net_sheet",           label: "Net Sheet",            desc: "3-scenario seller proceeds" },
  { key: "buyer_archetypes",    label: "Buyer Archetypes",     desc: "Buyer personality profiles" },
  { key: "listing_copy",        label: "Listing Copy",         desc: "MLS description, headlines" },
  { key: "seller_presentation", label: "Seller Presentation",  desc: "Listing appointment narrative" },
  { key: "talking_points",      label: "Talking Points",       desc: "Agent script bullets" },
];

const PROVIDER_LABELS = {
  claude:     "Anthropic — Claude",
  chatgpt:    "OpenAI — ChatGPT",
  gemini:     "Google — Gemini",
  perplexity: "Perplexity — Sonar",
  grok:       "xAI — Grok",
};

const MODEL_LABELS = {
  "claude-opus-4-5": "Claude Opus 4.5",
  "claude-sonnet-4-20250514": "Claude Sonnet 4",
  "claude-haiku-4-5-20251001": "Claude Haiku 4.5",
  "gpt-4o": "GPT-4o",
  "gpt-4o-mini": "GPT-4o Mini",
  "o3-mini": "o3-mini",
  "gemini-2.0-flash": "Gemini 2.0 Flash",
  "gemini-2.5-pro-preview-03-25": "Gemini 2.5 Pro",
  "sonar-pro": "Sonar Pro",
  "sonar": "Sonar",
  "grok-3": "Grok 3",
  "grok-3-mini": "Grok 3 Mini",
};

const PROVIDER_MODELS = {
  claude:     ["claude-opus-4-5", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001"],
  chatgpt:    ["gpt-4o", "gpt-4o-mini", "o3-mini"],
  gemini:     ["gemini-2.0-flash", "gemini-2.5-pro-preview-03-25"],
  perplexity: ["sonar-pro", "sonar"],
  grok:       ["grok-3", "grok-3-mini"],
};

export default function EnsembleTab() {
  const [config, setConfig] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ownerTier, setOwnerTier] = useState(null);

  async function load() {
    const [configs, user] = await Promise.all([
      base44.asServiceRole.entities.PlatformConfig.filter({}),
      base44.auth.me(),
    ]);
    const cfg = configs[0] || {};
    setConfig(cfg);
    setAssignments(cfg.ensemble_section_assignments || {});
    // Check platform owner's own org tier
    if (user?.email) {
      const orgs = await base44.asServiceRole.entities.Organization.filter({ owner_email: user.email });
      setOwnerTier(orgs[0]?.subscription_tier || 'starter');
    }
  }

  useEffect(() => { load(); }, []);

  if (!config) return <div className="flex items-center justify-center h-40 text-[#1A3226]/40"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const enabledProviders = Object.entries({
    claude: config.claude_enabled,
    chatgpt: config.chatgpt_enabled,
    gemini: config.gemini_enabled,
    perplexity: config.perplexity_enabled,
    grok: config.grok_enabled,
  }).filter(([, v]) => v !== false).map(([k]) => k);

  async function toggleEnsemble(val) {
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = configs[0];
    if (cfg) await base44.asServiceRole.entities.PlatformConfig.update(cfg.id, { ensemble_mode_enabled: val });
    load();
  }

  async function savePrimary(val) {
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = configs[0];
    if (cfg) await base44.asServiceRole.entities.PlatformConfig.update(cfg.id, { ensemble_primary_provider: val });
    load();
  }

  async function saveFallback(val) {
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = configs[0];
    if (cfg) await base44.asServiceRole.entities.PlatformConfig.update(cfg.id, { ensemble_fallback_provider: val });
    load();
  }

  function updateAssignment(sectionKey, field, value) {
    setAssignments(prev => ({
      ...prev,
      [sectionKey]: { ...(prev[sectionKey] || {}), [field]: value }
    }));
  }

  async function saveAssignments() {
    setSaving(true);
    const configs = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const cfg = configs[0];
    if (cfg) await base44.asServiceRole.entities.PlatformConfig.update(cfg.id, { ensemble_section_assignments: assignments });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    load();
  }

  const ensembleOn = config.ensemble_mode_enabled === true;

  return (
    <div className="space-y-6">
      {ownerTier === 'starter' && (
        <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>Ensemble AI is available for your <strong>Pro</strong> and <strong>Team</strong> subscribers.</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-[#1A3226] mb-1">Ensemble AI Mode</h2>
        <p className="text-sm text-[#1A3226]/60 mb-4">
          Assign the best AI model to each section of the report. All sections run in parallel and are assembled by Claude into one seamless, client-ready output.
        </p>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-[#1A3226]">Enable Ensemble AI Mode</div>
            <div className="text-xs text-[#1A3226]/50">When on, each report section uses a specialised AI model</div>
          </div>
          <Switch checked={ensembleOn} onCheckedChange={toggleEnsemble} />
        </div>

        {!ensembleOn && (
          <div className="mt-4 pt-4 border-t border-[#1A3226]/5">
            <label className="text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide block mb-2">Use this model for all analyses</label>
            <Select value={config.ensemble_primary_provider || "claude"} onValueChange={savePrimary}>
              <SelectTrigger className="max-w-xs text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {enabledProviders.map(p => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {ensembleOn && (
          <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-green-700">
              Ensemble AI is active. Each report section will use the AI model best suited for that task, running in parallel for maximum quality.
            </p>
          </div>
        )}
      </div>

      {/* Fallback */}
      {ensembleOn && (
        <div className="bg-white border border-[#1A3226]/10 rounded-xl p-5 space-y-3">
          <div>
            <label className="text-sm font-medium text-[#1A3226] block">Fallback Provider</label>
            <p className="text-xs text-[#1A3226]/50">Used automatically if a primary section provider fails</p>
          </div>
          <Select value={config.ensemble_fallback_provider || "chatgpt"} onValueChange={saveFallback}>
            <SelectTrigger className="max-w-xs text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {enabledProviders.map(p => (
                <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Section Assignment Table */}
      {ensembleOn && (
        <div className="bg-white border border-[#1A3226]/10 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1A3226]/10">
            <h3 className="font-semibold text-[#1A3226]">Section Assignments</h3>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">Each section runs in parallel using the assigned provider</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-[#1A3226]/3 border-b border-[#1A3226]/10">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide w-40">Section</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide">What It Does</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide w-52">Primary Model</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-[#1A3226]/60 uppercase tracking-wide w-52">Fallback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A3226]/5">
                {SECTION_ROWS.map(row => {
                  const asgn = assignments[row.key] || {};
                  const primaryProvider = asgn.provider || "claude";
                  const primaryModel = asgn.model || (PROVIDER_MODELS[primaryProvider]?.[0] || "");
                  const fallbackProvider = asgn.fallback_provider || (config.ensemble_fallback_provider || "chatgpt");
                  return (
                    <tr key={row.key} className="hover:bg-[#1A3226]/2">
                      <td className="px-4 py-3 font-medium text-[#1A3226]">{row.label}</td>
                      <td className="px-4 py-3 text-[#1A3226]/60 text-xs">{row.desc}</td>
                      <td className="px-4 py-3">
                        <Select
                          value={`${primaryProvider}::${primaryModel}`}
                          onValueChange={val => {
                            const [p, m] = val.split("::");
                            updateAssignment(row.key, "provider", p);
                            updateAssignment(row.key, "model", m);
                          }}
                        >
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {enabledProviders.flatMap(p =>
                              (PROVIDER_MODELS[p] || []).map(m => (
                                <SelectItem key={`${p}::${m}`} value={`${p}::${m}`}>
                                  {PROVIDER_LABELS[p]} · {MODEL_LABELS[m] || m}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={fallbackProvider}
                          onValueChange={val => updateAssignment(row.key, "fallback_provider", val)}
                        >
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {enabledProviders.map(p => (
                              <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })}
                {/* Final Assembly — locked */}
                <tr className="bg-[#1A3226]/3">
                  <td className="px-4 py-3 font-medium text-[#1A3226]">Final Assembly</td>
                  <td className="px-4 py-3 text-[#1A3226]/60 text-xs">Claude always assembles the final report</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs text-[#1A3226]/60">
                      <Lock className="w-3 h-3" />
                      <span>Anthropic — Claude ✓</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1A3226]/40">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-[#1A3226]/10 flex items-center gap-3">
            <Button
              onClick={saveAssignments}
              disabled={saving}
              className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90"
            >
              {saving ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Saving…</> : "Save Assignments"}
            </Button>
            {saved && <span className="text-sm text-green-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}