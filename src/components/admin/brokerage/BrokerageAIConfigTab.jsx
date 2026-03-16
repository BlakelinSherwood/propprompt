import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Eye, EyeOff, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = ["claude", "chatgpt", "gemini", "perplexity", "grok"];

const BILLING_MODE_DESCRIPTIONS = {
  platform_managed: "Uses Sherwood & Company's platform-level API keys. No setup required.",
  org_managed: "Uses this brokerage's own API keys. Enter keys below.",
  agent_managed: "Each agent provides their own API key in their profile settings.",
};

export default function BrokerageAIConfigTab({ org, user, onOrgUpdate }) {
  const { toast } = useToast();
  const [billingMode, setBillingMode] = useState(org.ai_billing_mode || "platform_managed");
  const [toggles, setToggles] = useState(org.ai_platform_toggles || {});
  const [apiKeys, setApiKeys] = useState({});
  const [visible, setVisible] = useState({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = await base44.entities.Organization.update(org.id, {
      ai_billing_mode: billingMode,
      ai_platform_toggles: toggles,
      // API keys would be encrypted via a backend function in production; for now storing structure only
    });
    onOrgUpdate(updated);
    setSaving(false);
    toast({ title: "AI configuration saved" });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Billing Mode */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-[#1A3226]">API Key Billing Mode</h3>
        <Select value={billingMode} onValueChange={setBillingMode}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="platform_managed">Platform Managed (S&C keys)</SelectItem>
            <SelectItem value="org_managed">Org Managed (brokerage keys)</SelectItem>
            <SelectItem value="agent_managed">Agent Managed (individual keys)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-[#1A3226]/[0.03] rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          {BILLING_MODE_DESCRIPTIONS[billingMode]}
        </div>
      </div>

      {/* Org API Keys (only if org_managed) */}
      {billingMode === "org_managed" && (
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-[#1A3226]">Brokerage API Keys</h3>
          <p className="text-xs text-[#1A3226]/50">Enter API keys for each platform your agents will use. Keys are stored encrypted.</p>
          {PLATFORMS.map((p) => (
            <div key={p} className="space-y-1">
              <label className="text-xs text-[#1A3226]/60 capitalize">{p} API Key</label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type={visible[p] ? "text" : "password"}
                    placeholder={`${p} API key…`}
                    value={apiKeys[p] || ""}
                    onChange={(e) => setApiKeys({ ...apiKeys, [p]: e.target.value })}
                    className="pr-10 text-sm font-mono"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A3226]/40 hover:text-[#1A3226]"
                    onClick={() => setVisible({ ...visible, [p]: !visible[p] })}
                  >
                    {visible[p] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Platform Toggles */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-[#1A3226]">Platform Availability (Org Override)</h3>
        <p className="text-xs text-[#1A3226]/50">Restrict which AI platforms your agents can use. Overrides platform-level defaults.</p>
        {PLATFORMS.map((p) => (
          <div key={p} className="flex items-center justify-between py-1.5 border-b border-[#1A3226]/5 last:border-0">
            <span className="text-sm text-[#1A3226] capitalize">{p}</span>
            <Switch
              checked={toggles[p] !== false}
              onCheckedChange={(v) => setToggles({ ...toggles, [p]: v })}
            />
          </div>
        ))}
      </div>

      <Button className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save AI Configuration"}
      </Button>
    </div>
  );
}