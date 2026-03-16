import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Switch } from "@/components/ui/switch";
import { Lock, Unlock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

/**
 * Renders a private/public toggle on an analysis card.
 * Visible only if the org cascade allows agent private analyses.
 * Logs every state change to PrivacyLog.
 */
export default function AnalysisPrivateToggle({ analysis, orgAllowsPrivate, onToggled }) {
  const [isPrivate, setIsPrivate] = useState(analysis.is_private ?? false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  if (!orgAllowsPrivate) return null;

  async function handleToggle(newValue) {
    setSaving(true);
    await base44.entities.Analysis.update(analysis.id, { is_private: newValue });

    // Log to privacy audit
    await base44.functions.invoke("logPrivacyEvent", {
      event_type: newValue ? "analysis_deleted" : "data_export_delivered", // closest available types
      entity_type: "Analysis",
      entity_id: analysis.id,
      org_id: analysis.org_id,
      metadata: {
        action: newValue ? "marked_private" : "marked_public",
        address: analysis.intake_data?.address,
        assessment_type: analysis.assessment_type,
      },
    });

    setIsPrivate(newValue);
    setSaving(false);
    onToggled?.(newValue);
    toast({
      title: newValue ? "Analysis marked private" : "Analysis marked public",
      description: newValue
        ? "Output is now hidden from admins and team leads."
        : "Analysis is now visible to your org admins.",
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPrivate
        ? <Lock className="w-3.5 h-3.5 text-[#1A3226]/50" />
        : <Unlock className="w-3.5 h-3.5 text-[#1A3226]/25" />
      }
      <Switch
        checked={isPrivate}
        onCheckedChange={handleToggle}
        disabled={saving}
        className="h-4 w-7 data-[state=checked]:bg-[#1A3226]"
      />
      <span className="text-xs text-[#1A3226]/50">{isPrivate ? "Private" : "Visible"}</span>
    </div>
  );
}