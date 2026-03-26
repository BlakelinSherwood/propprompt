import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

const PROVIDERS = [
  {
    id: "claude",
    name: "Anthropic",
    subtitle: "Claude",
    tagline: "Deep reasoning · Full report assembly · Structured analysis",
    keyField: "anthropic_api_key",
    modelField: "anthropic_model",
    enabledField: "claude_enabled",
    pingField: "anthropic_last_ping",
    pingAtField: "anthropic_last_ping_at",
    models: [
      { value: "claude-opus-4-5", label: "claude-opus-4-5 ★ Recommended — Best Quality" },
      { value: "claude-sonnet-4-20250514", label: "claude-sonnet-4-20250514 — Balanced" },
      { value: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5-20251001 — Fastest" },
    ],
  },
  {
    id: "chatgpt",
    name: "OpenAI",
    subtitle: "ChatGPT",
    tagline: "Persuasive copy · Listing descriptions · Seller presentations",
    keyField: "openai_api_key",
    modelField: "openai_model",
    enabledField: "chatgpt_enabled",
    pingField: "openai_last_ping",
    pingAtField: "openai_last_ping_at",
    models: [
      { value: "gpt-4o", label: "gpt-4o ★ Recommended" },
      { value: "gpt-4o-mini", label: "gpt-4o-mini — Fast & Cost Efficient" },
      { value: "o3-mini", label: "o3-mini — Reasoning Tasks" },
    ],
  },
  {
    id: "gemini",
    name: "Google",
    subtitle: "Gemini",
    tagline: "Real-time data · Neighbourhood context · Market conditions",
    keyField: "google_api_key",
    modelField: "gemini_model",
    enabledField: "gemini_enabled",
    pingField: "gemini_last_ping",
    pingAtField: "gemini_last_ping_at",
    models: [
      { value: "gemini-2.5-flash", label: "gemini-2.5-flash ★ Recommended — Fast" },
      { value: "gemini-2.5-pro", label: "gemini-2.5-pro — Highest Quality" },
      { value: "gemini-2.0-flash-lite", label: "gemini-2.0-flash-lite — Fastest" },
    ],
  },
  {
    id: "perplexity",
    name: "Perplexity",
    subtitle: "Perplexity AI",
    tagline: "Web-grounded · Live market signals · Migration data",
    keyField: "perplexity_api_key",
    modelField: "perplexity_model",
    enabledField: "perplexity_enabled",
    pingField: "perplexity_last_ping",
    pingAtField: "perplexity_last_ping_at",
    models: [
      { value: "sonar-pro", label: "sonar-pro ★ Recommended — Web Grounded" },
      { value: "sonar", label: "sonar — Fast" },
    ],
  },
  {
    id: "grok",
    name: "xAI",
    subtitle: "Grok",
    tagline: "Buyer archetypes · Agent talking points · Conversational tone",
    keyField: "grok_api_key",
    modelField: "grok_model",
    enabledField: "grok_enabled",
    pingField: "grok_last_ping",
    pingAtField: "grok_last_ping_at",
    models: [
      { value: "grok-3", label: "grok-3 ★ Recommended" },
      { value: "grok-3-mini", label: "grok-3-mini — Fast" },
    ],
  },
  {
    id: "groq",
    name: "Groq / Llama",
    subtitle: "Groq",
    tagline: "Ultra-fast inference · High-volume structured output",
    keyField: "groq_api_key",
    modelField: "groq_model",
    enabledField: "groq_enabled",
    pingField: "groq_last_ping",
    pingAtField: "groq_last_ping_at",
    phase2: true,
    models: [
      { value: "llama-3.3-70b-versatile", label: "llama-3.3-70b-versatile ★ Recommended" },
      { value: "llama-3.1-8b-instant", label: "llama-3.1-8b-instant — Ultra Fast" },
    ],
  },
];

function StatusBadge({ config, provider }) {
  const key = config[provider.keyField];
  const ping = config[provider.pingField];
  if (!key) return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Not Configured</span>;
  if (ping === "success") return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Verified ✓</span>;
  if (ping === "error") return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">Connection Error</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">Key Saved</span>;
}

function ProviderCard({ provider, config, onUpdate }) {
  const [keyInput, setKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const hasKey = !!config[provider.keyField];
  const isEnabled = config[provider.enabledField] !== false;
  const pingOk = config[provider.pingField] === "success";
  const pingAt = config[provider.pingAtField];

  const maskedKey = hasKey ? `••••••••${String(config[provider.keyField]).slice(-4)}` : "";

  async function updateCfg(data) {
    await base44.functions.invoke('updatePlatformConfig', { data });
    onUpdate();
  }

  async function saveKey() {
    if (!keyInput.trim()) return;
    setSaving(true);
    await updateCfg({ [provider.keyField]: keyInput.trim() });
    setKeyInput("");
    setSaving(false);
  }

  async function removeKey() {
    setSaving(true);
    await updateCfg({
      [provider.keyField]: null,
      [provider.enabledField]: false,
      [provider.pingField]: null,
    });
    setSaving(false);
  }

  async function toggleEnabled(val) {
    await updateCfg({ [provider.enabledField]: val });
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const start = Date.now();
    const result = await base44.functions.invoke('testProviderConnection', { provider: provider.id });
    const latencyMs = Date.now() - start;
    const data = result?.data;
    if (data?.success) {
      setTestResult({ success: true, latencyMs });
      await base44.functions.invoke('updatePlatformConfig', { data: { [provider.pingField]: 'success', [provider.pingAtField]: new Date().toISOString().split('T')[0] } });
    } else {
      setTestResult({ success: false, error: data?.error || 'Connection failed' });
      await base44.functions.invoke('updatePlatformConfig', { data: { [provider.pingField]: 'error' } });
    }
    onUpdate();
    setTesting(false);
  }

  if (provider.phase2) {
    return (
      <div className="border border-[#1A3226]/10 rounded-xl p-5 opacity-60 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 bg-[#1A3226]/10 text-[#1A3226]/60 text-xs font-medium text-center py-1">
          Phase 2 — Coming Soon
        </div>
        <div className="mt-5 flex items-start justify-between">
          <div>
            <div className="font-bold text-[#1A3226] text-lg">{provider.name}</div>
            <div className="text-xs text-[#1A3226]/50">{provider.tagline}</div>
          </div>
          <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-400">Phase 2</span>
        </div>
        <p className="text-xs text-[#1A3226]/40 mt-3">
          Groq/Llama will be available in a future update. The fastest inference available — being added in Phase 2.
        </p>
      </div>
    );
  }

  return (
    <div className="border border-[#1A3226]/10 rounded-xl p-5 space-y-4 bg-white">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-bold text-[#1A3226] text-lg">{provider.name} <span className="font-normal text-[#1A3226]/60 text-base">· {provider.subtitle}</span></div>
          <div className="text-xs text-[#1A3226]/50 mt-0.5">{provider.tagline}</div>
        </div>
        <StatusBadge config={config} provider={provider} />
      </div>

      {/* API Key Row */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[#1A3226]/70 uppercase tracking-wide">API Key</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              type={showKey ? "text" : "password"}
              placeholder={hasKey ? maskedKey : "Paste API key…"}
              value={keyInput}
              onChange={e => setKeyInput(e.target.value)}
              className="pr-9 text-sm"
            />
            <button className="absolute right-2 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]" onClick={() => setShowKey(v => !v)}>
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <Button onClick={saveKey} disabled={!keyInput.trim() || saving} size="sm" className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90">
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save Key"}
          </Button>
          {hasKey && (
            <Button onClick={removeKey} disabled={saving} variant="outline" size="sm" className="text-red-500 border-red-200 hover:bg-red-50">
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Test Connection Row */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-[#1A3226]/70 uppercase tracking-wide">Connection Test</label>
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            onClick={testConnection}
            disabled={!hasKey || testing}
            variant="outline"
            size="sm"
            className="border-[#1A3226]/20 text-[#1A3226]"
          >
            {testing ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Testing…</> : "Test Connection"}
          </Button>
          {testResult && (
            testResult.success
              ? <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Connected — {testResult.latencyMs}ms</span>
              : <span className="text-red-500 text-sm flex items-center gap-1"><XCircle className="w-4 h-4" /> {testResult.error}</span>
          )}
          {!testResult && pingAt && (
            <span className="text-xs text-[#1A3226]/40">
              Last tested: {new Date(pingAt).toLocaleDateString()} — {config[provider.pingField] === "success" ? "✓ OK" : "✗ Error"}
            </span>
          )}
        </div>
      </div>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between pt-2 border-t border-[#1A3226]/5">
        <div>
          <div className="text-sm font-medium text-[#1A3226]">Active — use for PropPrompt analyses</div>
          {!pingOk && hasKey && (
            <div className="text-xs text-[#1A3226]/40 flex items-center gap-1 mt-0.5">
              <AlertCircle className="w-3 h-3" /> Run Test Connection first
            </div>
          )}
        </div>
        <Switch
          checked={isEnabled}
          onCheckedChange={toggleEnabled}
          disabled={!pingOk}
        />
      </div>
    </div>
  );
}

export default function ApiKeysTab() {
  const [config, setConfig] = useState(null);

  async function load() {
    try {
      const res = await base44.functions.invoke('getPlatformConfig', {});
      setConfig(res.data?.config || {});
    } catch (e) {
      console.error('[ApiKeysTab] load error:', e);
      setConfig({});
    }
  }

  useEffect(() => { load(); }, []);

  if (!config) return <div className="flex items-center justify-center h-40 text-[#1A3226]/40"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#1A3226]/60">
        API keys are stored in PlatformConfig and used for all PropPrompt analyses. Keys are never exposed to agents.
      </p>
      <div className="grid grid-cols-1 gap-4">
        {PROVIDERS.map(p => (
          <ProviderCard key={p.id} provider={p} config={config} onUpdate={load} />
        ))}
      </div>
    </div>
  );
}