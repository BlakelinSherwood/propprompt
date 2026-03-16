import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, Unlock, Loader2 } from "lucide-react";

/**
 * PrivateToggle — Toggle analysis is_private flag.
 * Visible only when org.allow_agent_private_toggle = true.
 * Logs privacy event on every change.
 */
export default function PrivateToggle({ analysis, orgAllowsPrivate, onToggled }) {
  const [loading, setLoading] = useState(false);
  const [isPrivate, setIsPrivate] = useState(analysis.is_private || false);

  if (!orgAllowsPrivate) return null;

  async function handleToggle(e) {
    e.stopPropagation();
    e.preventDefault();
    setLoading(true);
    const newValue = !isPrivate;
    try {
      await base44.entities.Analysis.update(analysis.id, { is_private: newValue });

      await base44.functions.invoke("logPrivacyEvent", {
        event_type: newValue ? "marked_private" : "marked_public",
        entity_type: "Analysis",
        entity_id: analysis.id,
        org_id: analysis.org_id,
        metadata: {
          assessment_type: analysis.assessment_type,
          ai_platform: analysis.ai_platform,
        },
      });

      setIsPrivate(newValue);
      onToggled?.(newValue);
    } catch (err) {
      console.error("PrivateToggle error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleToggle}
      title={isPrivate ? "Private — click to make visible to org" : "Visible to org — click to make private"}
      className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all border
        ${isPrivate
          ? "bg-[#1A3226] border-[#1A3226] text-white"
          : "bg-white border-[#1A3226]/20 text-[#1A3226]/50 hover:border-[#1A3226]/40"
        }`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : isPrivate ? (
        <Lock className="w-3 h-3" />
      ) : (
        <Unlock className="w-3 h-3" />
      )}
      {isPrivate ? "Private" : "Visible"}
    </button>
  );
}