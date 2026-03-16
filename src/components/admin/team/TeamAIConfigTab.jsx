import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Save, Info, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const PLATFORMS = ["claude", "chatgpt", "gemini", "perplexity", "grok"];

export default function TeamAIConfigTab({ org, parentOrg, user, onOrgUpdate }) {
  const { toast } = useToast();
  const [billingMode, setBillingMode] = useState(org.ai_billing_mode || "platform_managed");
  const [toggles, setToggles] = useState(org.ai_platform_toggles || {});
  const [apiKeys, setApiKeys] = useState({});
  const [visible, setVisible] = useState({});
  const [saving, setSaving] = useState(false);

  // If parent brokerage is org_managed, team cannot override
  const parentIsOrgManaged = parentOrg?.ai_billing_mode === "org_managed";

  async function handleSave() {
    setSaving(true);
    const updated = await base44.entities.Organization.update(org.id, {
      ai_billing_mode: billingMode,
      ai_platform_toggles: toggles,
    });
    onOrgUpdate(updated);
    setSaving(false);
    toast({ title: "AI configuration saved" });
  }

  if (parentIsOrgManaged) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="flex items-start gap-3 p-5 rounded-xl bg-[#1A3226]/[0.03] border border-[#1A3226]/10">
          <Lock className="w-5 h-5 text-[#1A3226]/40 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-[#1A3226] text-sm">AI Configuration Managed by Brokerage</p>
            <p className="text-xs text-[#1A3226]/50 mt-1">
              {parentOrg?.name} is managing API keys at the brokerage level. Team-level AI configuration is not available.
              Contact your brokerage admin to change the billing mode.
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
          <h3 className="font-semibold text-[#1A3226] text-sm">Inherited Settings from {parentOrg?.name}</h3>
          {PLATFORMS.map((p) => (
            <div key={p} className="flex items-center justify-between py-1.5 border-b border-[#1A3226]/5 last:border-0">
              <span className="text-sm text-[#1A3226] capitalize">{p}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${parentOrg?.ai_platform_toggles?.[p] !== false ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                {parentOrg?.ai_platform_toggles?.[p] !== false ? "enabled" : "disabled"}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <h3 className="font-semibold text-[#1A3226]">API Key Mode</h3>
        <Select value={billingMode} onValueChange={setBillingMode}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="platform_managed">Platform Managed (S&C keys)</SelectItem>
            <SelectItem value="org_managed">Team Managed (team keys)</SelectItem>
            <SelectItem value="agent_managed">Agent Managed (individual keys)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-[#1A3226]/[0.03] rounded-lg p-3">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          {billingMode === "platform_managed" && "Uses S&C platform API keys."}
          {billingMode === "org_managed" && "Enter team-level API keys below."}
          {billingMode === "agent_managed" && "Agents provide their own API keys."}
        </div>
      </div>

      {billingMode === "org_managed" && (
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-[#1A3226]">Team API Keys</h3>
          {PLATFORMS.map((p) => (
            <div key={p} className="space-y-1">
              <label className="text-xs text-[#1A3226]/60 capitalize">{p} API Key</label>
              <div className="relative">
                <Input type={visible[p] ? "text" : "password"} placeholder={`${p} key…`} value={apiKeys[p] || ""} onChange={(e) => setApiKeys({ ...apiKeys, [p]: e.target.value })} className="pr-10 text-sm font-mono" />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#1A3226]/40" onClick={() => setVisible({ ...visible, [p]: !visible[p] })}>
                  {visible[p] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-[#1A3226]">Platform Toggles</h3>
        {PLATFORMS.map((p) => (
          <div key={p} className="flex items-center justify-between py-1.5 border-b border-[#1A3226]/5 last:border-0">
            <span className="text-sm text-[#1A3226] capitalize">{p}</span>
            <Switch checked={toggles[p] !== false} onCheckedChange={(v) => setToggles({ ...toggles, [p]: v })} />
          </div>
        ))}
      </div>

      <Button className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4" />{saving ? "Saving…" : "Save Configuration"}
      </Button>
    </div>
  );
}