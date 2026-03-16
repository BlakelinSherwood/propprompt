import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Shield, Lock, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function BrokeragePrivacyTab({ org, user, onOrgUpdate }) {
  const { toast } = useToast();
  const [allowPrivateToggle, setAllowPrivateToggle] = useState(org.allow_agent_private_toggle ?? false);
  const [fairHousingEnabled, setFairHousingEnabled] = useState(org.fair_housing_compliance_enabled ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = await base44.entities.Organization.update(org.id, {
      allow_agent_private_toggle: allowPrivateToggle,
      fair_housing_compliance_enabled: fairHousingEnabled,
    });
    onOrgUpdate(updated);
    setSaving(false);
    toast({ title: "Privacy settings saved" });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p>
          These settings control agent-level privacy options for this brokerage. Per PropPrompt™ policy, private analyses
          hide output from brokerage admins and team leads. Platform owner always has full visibility.
        </p>
      </div>

      {/* Agent Private Toggle */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1A3226] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#1A3226]/40" />
              Allow Agent Private Analyses
            </h3>
            <p className="text-xs text-[#1A3226]/50 mt-1">
              When enabled, agents can mark individual analyses as private. Private analyses show address, date, and type
              to admins but the output text is hidden.
            </p>
          </div>
          <Switch checked={allowPrivateToggle} onCheckedChange={setAllowPrivateToggle} />
        </div>
        {allowPrivateToggle && (
          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            Private analyses are not visible in aggregate reports or CRM push logs. Agents retain full control.
          </div>
        )}
      </div>

      {/* Fair Housing */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1A3226] flex items-center gap-2">
              <Shield className="w-4 h-4 text-[#1A3226]/40" />
              Monthly Fair Housing Compliance Reviews
            </h3>
            <p className="text-xs text-[#1A3226]/50 mt-1">
              Auto-generates monthly compliance review checklists. Required for brokerage-level subscribers.
              Disabling removes the monthly signature requirement.
            </p>
          </div>
          <Switch checked={fairHousingEnabled} onCheckedChange={setFairHousingEnabled} />
        </div>
      </div>

      <Button className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2" onClick={handleSave} disabled={saving}>
        <Save className="w-4 h-4" />
        {saving ? "Saving…" : "Save Privacy Settings"}
      </Button>
    </div>
  );
}