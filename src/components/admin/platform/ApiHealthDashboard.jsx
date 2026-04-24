import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Zap, Edit2, Save, X, TrendingUp, DollarSign, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLATFORMS = [
  { key: "anthropic", label: "Anthropic (Claude)", color: "#cc785c", pingLabel: "Anthropic (Claude)", billingUrl: "https://console.anthropic.com/settings/billing" },
  { key: "openai",    label: "OpenAI (GPT-4o)",    color: "#10a37f", pingLabel: "OpenAI (GPT-4o)",    billingUrl: "https://platform.openai.com/settings/organization/billing/overview" },
  { key: "gemini",    label: "Google (Gemini)",    color: "#4285F4", pingLabel: "Google (Gemini)",    billingUrl: "https://console.cloud.google.com/billing" },
  { key: "perplexity",label: "Perplexity (Sonar)", color: "#20b2aa", pingLabel: "Perplexity (Sonar)", billingUrl: "https://www.perplexity.ai/settings/api" },
  { key: "rentcast",  label: "RentCast",           color: "#8b5cf6", pingLabel: "RentCast",           billingUrl: "https://app.rentcast.io/app/api" },
  { key: "attom",     label: "ATTOM",              color: "#f97316", pingLabel: "ATTOM",              billingUrl: "https://cloud-help.attomdata.com" },
];

const PROVIDER_MAP = {
  anthropic: "anthropic",
  openai: "openai",
  gemini: "google",
  perplexity: "perplexity",
};

function fmt(n) { return n != null ? `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"; }

function StatusBadge({ status, latency }) {
  if (status === "ok") return (
    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
      <CheckCircle className="w-4 h-4" /> Live {latency != null && <span className="text-emerald-400 font-normal">· {latency}ms</span>}
    </span>
  );
  if (status === "error") return (
    <span className="flex items-center gap-1 text-red-500 font-semibold text-xs">
      <XCircle className="w-4 h-4" /> Error
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-amber-500 font-semibold text-xs">
      <AlertTriangle className="w-4 h-4" /> Unknown
    </span>
  );
}

export default function ApiHealthDashboard() {
  const [pingResults, setPingResults] = useState({});
  const [pinging, setPinging] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);
  const [tokenStats, setTokenStats] = useState({});
  const [balances, setBalances] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Load saved balances from PlatformConfig
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoadingStats(true);
    try {
      const [configs, logs] = await Promise.all([
        base44.entities.PlatformConfig.filter({}),
        base44.entities.AITokenLog.list("-created_date", 1000),
      ]);
      const cfg = configs[0] || {};
      setBalances(cfg.api_balances || {});
      computeStats(logs);
    } catch (e) {
      console.error("[ApiHealthDashboard] loadData:", e.message);
    }
    setLoadingStats(false);
  }

  function computeStats(logs) {
    // Filter to last 30 days
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recent = (logs || []).filter(l => new Date(l.created_date).getTime() > cutoff);

    const stats = {};
    for (const log of recent) {
      const p = log.provider; // anthropic, openai, google, perplexity
      if (!p) continue;
      if (!stats[p]) stats[p] = { cost_cents: 0, calls: 0 };
      stats[p].cost_cents += log.cost_cents || 0;
      stats[p].calls += 1;
    }

    // Map provider names to platform keys
    const mapped = {};
    for (const [provider, s] of Object.entries(stats)) {
      const key = provider === "google" ? "gemini" : provider;
      mapped[key] = s;
    }
    setTokenStats(mapped);
  }

  async function runPing() {
    setPinging(true);
    try {
      const res = await base44.functions.invoke("checkApiHealth", {});
      const results = res.data?.results || [];
      const map = {};
      for (const r of results) {
        const platform = PLATFORMS.find(p => p.pingLabel === r.label);
        if (platform) map[platform.key] = r;
      }
      setPingResults(map);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("[ApiHealthDashboard] ping error:", e.message);
    }
    setPinging(false);
  }

  function startEdit(key) {
    setEditingKey(key);
    setEditValue(balances[key] != null ? String(balances[key]) : "");
  }

  async function saveBalance(key) {
    setSavingKey(key);
    const val = parseFloat(editValue);
    const updated = { ...balances };
    if (!isNaN(val) && val >= 0) updated[key] = val;
    else delete updated[key];

    try {
      const configs = await base44.entities.PlatformConfig.filter({});
      const cfg = configs[0];
      if (cfg) {
        await base44.entities.PlatformConfig.update(cfg.id, { api_balances: updated });
      }
      setBalances(updated);
    } catch (e) {
      console.error("[saveBalance] error:", e.message);
    }
    setEditingKey(null);
    setSavingKey(null);
  }

  function burnRate(key) {
    // Daily burn based on 30-day window
    const s = tokenStats[key];
    if (!s || !s.cost_cents) return null;
    return s.cost_cents / 100 / 30; // $ per day
  }

  function daysRemaining(key) {
    const bal = balances[key];
    const rate = burnRate(key);
    if (bal == null || !rate) return null;
    return Math.floor(bal / rate);
  }

  function urgencyColor(days) {
    if (days == null) return "text-[#1A3226]/40";
    if (days < 7) return "text-red-600 font-bold";
    if (days < 21) return "text-amber-600 font-semibold";
    return "text-emerald-600";
  }

  const totalMonthlyCost = Object.values(tokenStats).reduce((sum, s) => sum + (s?.cost_cents || 0), 0) / 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#1A3226]">API Platform Health</h2>
          <p className="text-xs text-[#1A3226]/50 mt-0.5">
            Live status, 30-day burn rates, and manual balance tracking.
            {lastChecked && <span className="ml-2 text-[#B8982F]">Last pinged: {lastChecked}</span>}
          </p>
        </div>
        <Button
          onClick={runPing}
          disabled={pinging}
          className="gap-2 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 text-sm"
          size="sm"
        >
          <RefreshCw className={`w-4 h-4 ${pinging ? "animate-spin" : ""}`} />
          {pinging ? "Pinging…" : "Ping All"}
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-[#B8982F]" />
            <span className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wide">30-Day AI Spend</span>
          </div>
          <div className="text-2xl font-bold text-[#1A3226]">{fmt(totalMonthlyCost)}</div>
          <div className="text-xs text-[#1A3226]/40 mt-0.5">from AITokenLog</div>
        </div>
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-[#B8982F]" />
            <span className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wide">Est. Daily Burn</span>
          </div>
          <div className="text-2xl font-bold text-[#1A3226]">{fmt(totalMonthlyCost / 30)}</div>
          <div className="text-xs text-[#1A3226]/40 mt-0.5">avg across all providers</div>
        </div>
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-[#B8982F]" />
            <span className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wide">Platforms Online</span>
          </div>
          <div className="text-2xl font-bold text-[#1A3226]">
            {Object.values(pingResults).filter(r => r.status === "ok").length}
            <span className="text-base font-normal text-[#1A3226]/40"> / {PLATFORMS.length}</span>
          </div>
          <div className="text-xs text-[#1A3226]/40 mt-0.5">{Object.keys(pingResults).length === 0 ? "click Ping All to check" : "last ping"}</div>
        </div>
      </div>

      {/* Platform cards */}
      <div className="space-y-3">
        {PLATFORMS.map((p) => {
          const ping = pingResults[p.key];
          const stats = tokenStats[p.key];
          const bal = balances[p.key];
          const rate = burnRate(p.key);
          const days = daysRemaining(p.key);
          const isEditing = editingKey === p.key;
          const isSaving = savingKey === p.key;

          return (
            <div key={p.key} className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
              <div className="flex items-start gap-4">
                {/* Color dot + name */}
                <div className="flex items-center gap-3 w-44 shrink-0">
                  <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: p.color }} />
                  <div>
                    <div className="text-sm font-semibold text-[#1A3226]">{p.label}</div>
                    <a href={p.billingUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-[#B8982F] hover:underline">
                      Open billing →
                    </a>
                  </div>
                </div>

                {/* Status */}
                <div className="w-36 shrink-0">
                  <div className="text-xs text-[#1A3226]/40 mb-1 uppercase tracking-wide">Status</div>
                  {ping ? (
                    <div>
                      <StatusBadge status={ping.status} latency={ping.latency_ms} />
                      {ping.detail && <div className="text-xs text-[#1A3226]/40 mt-0.5 leading-tight">{ping.detail}</div>}
                    </div>
                  ) : (
                    <span className="text-xs text-[#1A3226]/30">Not checked</span>
                  )}
                </div>

                {/* 30-day cost */}
                <div className="w-32 shrink-0">
                  <div className="text-xs text-[#1A3226]/40 mb-1 uppercase tracking-wide">30-Day Cost</div>
                  {stats ? (
                    <div>
                      <div className="text-sm font-bold text-[#1A3226]">{fmt(stats.cost_cents / 100)}</div>
                      <div className="text-xs text-[#1A3226]/40">{stats.calls} calls</div>
                    </div>
                  ) : (
                    <span className="text-xs text-[#1A3226]/30">No data</span>
                  )}
                </div>

                {/* Daily burn */}
                <div className="w-28 shrink-0">
                  <div className="text-xs text-[#1A3226]/40 mb-1 uppercase tracking-wide">Daily Burn</div>
                  {rate != null ? (
                    <div className="text-sm font-semibold text-[#1A3226]">{fmt(rate)}/day</div>
                  ) : (
                    <span className="text-xs text-[#1A3226]/30">—</span>
                  )}
                </div>

                {/* Balance + days remaining */}
                <div className="flex-1">
                  <div className="text-xs text-[#1A3226]/40 mb-1 uppercase tracking-wide">Current Balance</div>
                  {isEditing ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-[#1A3226]/60">$</span>
                      <input
                        autoFocus
                        type="number"
                        min="0"
                        step="0.01"
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveBalance(p.key); if (e.key === "Escape") setEditingKey(null); }}
                        className="w-28 border border-[#1A3226]/20 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                        placeholder="0.00"
                      />
                      <button onClick={() => saveBalance(p.key)} disabled={isSaving}
                        className="text-emerald-600 hover:text-emerald-700">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingKey(null)} className="text-[#1A3226]/40 hover:text-[#1A3226]">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {bal != null ? (
                        <div>
                          <span className="text-sm font-bold text-[#1A3226]">{fmt(bal)}</span>
                          {days != null && (
                            <span className={`ml-2 text-xs ${urgencyColor(days)}`}>
                              ~{days} days left
                            </span>
                          )}
                          {days == null && rate == null && (
                            <span className="ml-2 text-xs text-[#1A3226]/30">(no burn rate yet)</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[#1A3226]/30 italic">Enter balance manually</span>
                      )}
                      <button onClick={() => startEdit(p.key)}
                        className="text-[#1A3226]/30 hover:text-[#B8982F] transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-[#1A3226]/30 pt-2">
        Balance figures are entered manually — update them after each top-up. Burn rate and days remaining are calculated from your AITokenLog data.
        OpenAI, Perplexity, and Gemini do not expose a balance API endpoint.
      </p>
    </div>
  );
}