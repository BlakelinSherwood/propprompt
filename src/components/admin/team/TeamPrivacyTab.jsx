import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Shield, Lock, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

export default function TeamPrivacyTab({ org, parentOrg, user, onOrgUpdate }) {
  const { toast } = useToast();
  const parentAllows = parentOrg?.allow_agent_private_toggle ?? true; // default allow if no parent
  const [allowPrivate, setAllowPrivate] = useState(org.allow_agent_private_toggle ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const updated = await base44.entities.Organization.update(org.id, { allow_agent_private_toggle: allowPrivate });
    onOrgUpdate(updated);
    setSaving(false);
    toast({ title: "Privacy settings saved" });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-blue-50 border border-blue-100 rounded-xl p-4">
        <Shield className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <p>Private analyses show address, date, and type to team leads but hide output text. Platform owner always sees all.</p>
      </div>

      {!parentAllows && (
        <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>The parent brokerage has disabled agent private analyses. This team setting is overridden and cannot be enabled.</p>
        </div>
      )}

      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1A3226] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#1A3226]/40" /> Allow Agent Private Analyses
            </h3>
            <p className="text-xs text-[#1A3226]/50 mt-1">
              Agents can mark analyses private. Admins see metadata only — output is hidden.
            </p>
          </div>
          <Switch
            checked={allowPrivate && parentAllows}
            onCheckedChange={setAllowPrivate}
            disabled={!parentAllows}
          />
        </div>
      </div>

      <Button className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2" onClick={handleSave} disabled={saving || !parentAllows}>
        <Save className="w-4 h-4" />{saving ? "Saving…" : "Save Privacy Settings"}
      </Button>
    </div>
  );
}