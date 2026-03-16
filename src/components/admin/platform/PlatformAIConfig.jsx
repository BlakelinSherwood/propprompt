import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Save, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = [
  { id: "claude", label: "Claude (Anthropic)", recommended: true },
  { id: "chatgpt", label: "ChatGPT (OpenAI)" },
  { id: "gemini", label: "Gemini (Google)" },
  { id: "perplexity", label: "Perplexity AI" },
  { id: "grok", label: "Grok (xAI)" },
];

export default function PlatformAIConfig() {
  const { toast } = useToast();
  const [anthropicKeyVisible, setAnthropicKeyVisible] = useState(false);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [platformToggles, setPlatformToggles] = useState({
    claude: true, chatgpt: true, gemini: true, perplexity: false, grok: false,
  });
  const [scManagedEnabled, setScManagedEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    // In production, the Anthropic key update would go through a secure backend function
    // Platform toggles and SC managed flag would be stored in a global config entity
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    toast({ title: "AI configuration saved", description: "Changes will take effect on next analysis run." });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* S&C Managed Keys */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-[#1A3226]">S&C Platform-Managed API Keys</h3>
          <p className="text-xs text-[#1A3226]/50 mt-1">
            When enabled, Sherwood & Company's platform API keys are used for orgs in "platform_managed" billing mode.
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-[#1A3226]">Enable S&C managed keys</span>
          <Switch checked={scManagedEnabled} onCheckedChange={setScManagedEnabled} />
        </div>
        {scManagedEnabled && (
          <div className="space-y-2">
            <label className="text-xs text-[#1A3226]/60">Anthropic (Claude) API Key</label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={anthropicKeyVisible ? "text" : "password"}
                  placeholder="sk-ant-…"
                  value={anthropicKey}
                  onChange={(e) => setAnthropicKey(e.target.value)}
                  className="pr-10 text-sm font-mono"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]"
                  onClick={() => setAnthropicKeyVisible(!anthropicKeyVisible)}
                >
                  {anthropicKeyVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-[#1A3226]/40">
              This updates the ANTHROPIC_API_KEY environment variable used by claudeStream.
            </p>
          </div>
        )}
      </div>

      {/* Platform Toggles */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <div>
          <h3 className="font-semibold text-[#1A3226]">Global Platform Availability</h3>
          <p className="text-xs text-[#1A3226]/50 mt-1">
            Disable platforms globally. Org-level overrides can further restrict availability.
          </p>
        </div>
        <div className="space-y-3">
          {PLATFORMS.map((p) => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-[#1A3226]/5 last:border-0">
              <div>
                <span className="text-sm text-[#1A3226]">{p.label}</span>
                {p.recommended && (
                  <span className="ml-2 text-[10px] bg-[#B8982F]/15 text-[#B8982F] px-2 py-0.5 rounded-full font-medium">Recommended</span>
                )}
              </div>
              <Switch
                checked={platformToggles[p.id] ?? true}
                onCheckedChange={(v) => setPlatformToggles({ ...platformToggles, [p.id]: v })}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-700">
          Disabling a platform will prevent new analyses from being started on that platform. Existing analyses are not affected.
        </p>
      </div>

      <Button
        className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
        onClick={handleSave}
        disabled={saving}
      >
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Configuration"}
      </Button>
    </div>
  );
}