import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Lock, Loader2, CheckCircle2, Save, History } from "lucide-react";

const TASK_ORDER = [
  "pricing_strategy",
  "live_market_context",
  "neighbourhood_demand",
  "seller_narrative",
  "buyer_archetypes",
  "net_sheet",
];

const TIER_ORDER = ["starter", "pro", "team", "broker"];

const PROVIDER_COLORS = {
  anthropic:  "#CC785C",
  openai:     "#10A37F",
  google:     "#4285F4",
  perplexity: "#20808D",
  xai:        "#1DA1F2",
  mistral:    "#FF7000",
  meta:       "#7C3AED",
};

const PROVIDER_LABELS = {
  anthropic:  "Anthropic",
  openai:     "OpenAI",
  google:     "Google",
  perplexity: "Perplexity",
  xai:        "xAI",
  mistral:    "Mistral",
  meta:       "Meta",
};

// Grouped model options: value = "provider::model", label shown in optgroup
const MODEL_GROUPS = [
  {
    provider: "anthropic",
    models: [
      { value: "anthropic::claude-sonnet-4-20250514",  label: "claude-sonnet-4-20250514 (Balanced)" },
      { value: "anthropic::claude-opus-4-5",           label: "claude-opus-4-5 (Flagship)" },
      { value: "anthropic::claude-haiku-4-5-20251001", label: "claude-haiku-4-5-20251001 (Fast)" },
    ],
  },
  {
    provider: "openai",
    models: [
      { value: "openai::gpt-4o",      label: "gpt-4o (Flagship)" },
      { value: "openai::gpt-4o-mini", label: "gpt-4o-mini (Fast / Budget)" },
      { value: "openai::o3-mini",     label: "o3-mini (Reasoning)" },
    ],
  },
  {
    provider: "google",
    models: [
      { value: "google::gemini-2.5-pro",        label: "gemini-2.5-pro (Flagship)" },
      { value: "google::gemini-2.5-flash",      label: "gemini-2.5-flash (Balanced)" },
      { value: "google::gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite (Fast / Budget)" },
    ],
  },
  {
    provider: "perplexity",
    models: [
      { value: "perplexity::sonar-pro", label: "sonar-pro (Flagship, Web-grounded)" },
      { value: "perplexity::sonar",     label: "sonar (Fast, Web-grounded)" },
    ],
  },
  {
    provider: "xai",
    models: [
      { value: "xai::grok-3",      label: "grok-3 (Flagship)" },
      { value: "xai::grok-3-mini", label: "grok-3-mini (Fast / Budget)" },
    ],
  },
];

function tierIndex(tier) {
  return TIER_ORDER.indexOf(tier);
}

function isLocked(taskMinTier, selectedTier) {
  return tierIndex(taskMinTier) > tierIndex(selectedTier);
}

function ModelBadge({ value }) {
  if (!value) return null;
  const [provider, model] = value.split("::");
  const color = PROVIDER_COLORS[provider] || "#888";
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: color, display: "inline-block", flexShrink: 0 }} />
      <span className="text-[11px] text-[#1A3226]/60 font-mono">{model}</span>
    </div>
  );
}

function TaskRow({ task, selectedTier, onChange, isDirty }) {
  const locked = isLocked(task.min_tier, selectedTier);
  const currentValue = `${task.provider}::${task.model}`;
  const isProPlus = task.min_tier !== "starter";

  return (
    <div
      className={`grid grid-cols-[1fr_280px_32px] gap-4 items-start px-5 py-4 border-b border-[#1A3226]/8 last:border-0 transition-opacity ${locked ? "opacity-40 pointer-events-none" : ""}`}
    >
      {/* LEFT — task info */}
      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-[#1A3226]">{task.task_name}</span>
          {isProPlus && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-[#B8982F]/15 text-[#B8982F] uppercase tracking-wide">Pro+</span>
          )}
          {locked && (
            <span className="flex items-center gap-0.5 text-[10px] text-[#1A3226]/40">
              <Lock className="w-2.5 h-2.5" /> Locked
            </span>
          )}
        </div>
        <p className="text-[12px] text-[#1A3226]/50 mt-0.5 leading-snug">{task.task_description}</p>
      </div>

      {/* MIDDLE — model selector */}
      <div>
        <label className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 font-medium block mb-1">Provider · Model</label>
        <select
          value={currentValue}
          disabled={locked}
          onChange={e => onChange(task.task_id, e.target.value)}
          className="w-full text-xs border border-[#1A3226]/15 rounded-lg px-2.5 py-1.5 bg-white text-[#1A3226] focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
        >
          {MODEL_GROUPS.map(group => (
            <optgroup key={group.provider} label={PROVIDER_LABELS[group.provider]}>
              {group.models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <ModelBadge value={currentValue} />
      </div>

      {/* RIGHT — changed dot */}
      <div className="flex items-start justify-center pt-7">
        {isDirty && (
          <span
            title="Unsaved change"
            style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#B8982F", display: "inline-block" }}
          />
        )}
      </div>
    </div>
  );
}

export default function EnsembleTab() {
  const [tasks, setTasks] = useState(null);
  // tierAssignments: { tier → { task_id → { provider, model } } }
  const [tierAssignments, setTierAssignments] = useState({});
  const [localAssignments, setLocalAssignments] = useState({});
  const [dirtyTaskIds, setDirtyTaskIds] = useState(new Set());
  const [ensembleOn, setEnsembleOn] = useState(true);
  const [selectedTier, setSelectedTier] = useState("broker");
  const [changeNote, setChangeNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
    load();
  }, []);

  // Reset dirty state when switching tiers
  useEffect(() => {
    setDirtyTaskIds(new Set());
    // Sync localAssignments to saved state for this tier
    setLocalAssignments(tierAssignments);
  }, [selectedTier]); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    try {
      const [records, cfgRes] = await Promise.all([
        base44.entities.EnsembleConfig.list(),
        base44.functions.invoke('getPlatformConfig', {}),
      ]);
      records.sort((a, b) => TASK_ORDER.indexOf(a.task_id) - TASK_ORDER.indexOf(b.task_id));
      setTasks(records);
      const saved = cfgRes.data?.config?.ensemble_section_assignments || {};
      setTierAssignments(saved);
      setLocalAssignments(saved);
      setDirtyTaskIds(new Set());
    } catch (e) {
      console.error('[EnsembleTab] load error:', e);
      setTasks([]);
    }
  }

  function handleChange(taskId, combinedValue) {
    const [provider, model] = combinedValue.split("::");
    setLocalAssignments(prev => ({
      ...prev,
      [selectedTier]: {
        ...(prev[selectedTier] || {}),
        [taskId]: { provider, model },
      },
    }));
    setDirtyTaskIds(prev => new Set([...prev, taskId]));
  }

  async function saveAll() {
    if (dirtyTaskIds.size === 0) return;
    setSaving(true);
    try {
      await base44.functions.invoke('updatePlatformConfig', {
        data: { ensemble_section_assignments: localAssignments },
      });
      const changedNames = tasks.filter(t => dirtyTaskIds.has(t.task_id)).map(t => t.task_name);
      setHistory(prev => [{
        timestamp: new Date(),
        note: changeNote,
        tasks: changedNames,
        tier: selectedTier,
        by: user?.full_name || user?.email || 'Platform Owner',
      }, ...prev].slice(0, 10));
      setTierAssignments(localAssignments);
      setChangeNote('');
      setDirtyTaskIds(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error('[EnsembleTab] save error:', e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* BLOCK 1: Mode Card */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[#1A3226]">Ensemble AI Mode</h2>
            <p className="text-sm text-[#1A3226]/55 mt-0.5 leading-snug">
              Assign the best AI model to each section of the report. All sections run in parallel and are assembled into one seamless, client-ready output.
            </p>
          </div>
        </div>

        {/* Toggle row */}
        <div className="flex items-center justify-between py-3 border-t border-[#1A3226]/8">
          <div>
            <div className="text-sm font-medium text-[#1A3226]">Enable Ensemble AI Mode</div>
            <div className="text-xs text-[#1A3226]/45">When on, each report section uses a specialised AI model</div>
          </div>
          <Switch checked={ensembleOn} onCheckedChange={setEnsembleOn} />
        </div>

        {/* Tier pills */}
        <div className="mt-3 pt-3 border-t border-[#1A3226]/8">
          <label className="text-xs font-medium text-[#1A3226]/45 uppercase tracking-wide block mb-2">Tier configuration</label>
          <div className="flex gap-2 flex-wrap">
            {TIER_ORDER.map(tier => (
              <button
                key={tier}
                onClick={() => setSelectedTier(tier)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold capitalize transition-all border ${
                  selectedTier === tier
                    ? "bg-[#1A3226] text-white border-[#1A3226]"
                    : "bg-white text-[#1A3226]/60 border-[#1A3226]/20 hover:border-[#1A3226]/40"
                }`}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* BLOCK 2 + 3: Table */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl overflow-hidden">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_280px_32px] gap-4 px-5 py-3 bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#1A3226]/50">Output</div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-[#1A3226]/50">Powered by</div>
          <div />
        </div>

        {/* Task rows */}
        {displayTasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#1A3226]/40">No ensemble tasks configured.</div>
        ) : (
          displayTasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              selectedTier={selectedTier}
              onChange={handleChange}
              isDirty={dirtyTaskIds.has(task.task_id)}
            />
          ))
        )}

        {/* Final Assembly row */}
        <div className="grid grid-cols-[1fr_280px_32px] gap-4 items-start px-5 py-4 bg-[#1A3226]/[0.02] border-t border-[#1A3226]/8">
          <div>
            <span className="text-[13px] font-medium text-[#1A3226]">Final Assembly</span>
            <p className="text-[12px] text-[#1A3226]/40 mt-0.5">Assembles all sections into the final client report</p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 font-medium block mb-1">Provider · Model</label>
            <select
              value={localAssignments[selectedTier]?.['final_assembly'] ? `${localAssignments[selectedTier]['final_assembly'].provider}::${localAssignments[selectedTier]['final_assembly'].model}` : 'anthropic::claude-sonnet-4-20250514'}
              onChange={e => handleChange('final_assembly', e.target.value)}
              className="w-full text-xs border border-[#1A3226]/15 rounded-lg px-2.5 py-1.5 bg-white text-[#1A3226] focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            >
              {MODEL_GROUPS.map(group => (
                <optgroup key={group.provider} label={PROVIDER_LABELS[group.provider]}>
                  {group.models.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <ModelBadge value={localAssignments[selectedTier]?.['final_assembly'] ? `${localAssignments[selectedTier]['final_assembly'].provider}::${localAssignments[selectedTier]['final_assembly'].model}` : 'anthropic::claude-sonnet-4-20250514'} />
          </div>
          <div className="flex items-start justify-center pt-7">
            {dirtyTaskIds.has('final_assembly') && (
              <span title="Unsaved change" style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#B8982F", display: "inline-block" }} />
            )}
          </div>
        </div>
      </div>

      {/* Action Bar */}
      {dirtyTaskIds.size > 0 && (
        <div className="bg-white border border-[#B8982F]/30 rounded-xl p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span
                  style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#B8982F", display: "inline-block" }}
                />
                <span className="text-sm font-medium text-[#1A3226]">
                  {dirtyTaskIds.size} unsaved change{dirtyTaskIds.size > 1 ? 's' : ''} on <span className="capitalize font-semibold">{selectedTier}</span> tier
                </span>
              </div>
              <Textarea
                placeholder="Add a note about this change (optional)…"
                value={changeNote}
                onChange={e => setChangeNote(e.target.value)}
                className="text-sm resize-none h-16"
              />
            </div>
            <div className="flex flex-col gap-2 pt-0.5">
              <Button
                onClick={saveAll}
                disabled={saving}
                className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? "Saving…" : "Save Changes"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#1A3226]/50 text-xs"
                onClick={() => { setDirtyTaskIds(new Set()); setLocalAssignments(tierAssignments); }}
              >
                Discard
              </Button>
            </div>
          </div>
          {saved && (
            <div className="mt-2 flex items-center gap-1.5 text-green-600 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Configuration saved successfully
            </div>
          )}
        </div>
      )}

      {/* Configuration History */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#1A3226]/[0.02] transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-[#1A3226]">
            <History className="w-4 h-4 text-[#1A3226]/50" />
            Configuration History
          </div>
          <span className="text-xs text-[#1A3226]/40">{showHistory ? "Hide" : "Show"}</span>
        </button>

        {showHistory && (
          <div className="border-t border-[#1A3226]/8">
            {history.length === 0 ? (
              <p className="px-5 py-6 text-sm text-[#1A3226]/40 text-center">No changes recorded in this session.</p>
            ) : (
              <div className="divide-y divide-[#1A3226]/5">
                {history.map((entry, i) => (
                  <div key={i} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#1A3226]/70">{entry.by}</span>
                      <span className="text-xs text-[#1A3226]/35">{entry.timestamp.toLocaleTimeString()}</span>
                    </div>
                    <p className="text-xs text-[#1A3226]/50 mt-0.5">
                     <span className="capitalize font-medium">{entry.tier}</span> tier — Updated: {entry.tasks.join(", ")}
                    </p>
                    {entry.note && (
                      <p className="text-xs italic text-[#1A3226]/40 mt-0.5">"{entry.note}"</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}