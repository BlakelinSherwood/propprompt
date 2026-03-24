import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import WizardShell from "./WizardShell";

export default function StepReportEnhancements({ intake, update, onNext, onBack }) {
  const canNext = true; // All fields optional

  return (
    <WizardShell
      step={5}
      title="Report Enhancements"
      subtitle="Optional advanced analysis modules that provide deeper market insights."
      onNext={onNext}
      onBack={onBack}
      canProceed={canNext}
    >
      <div className="space-y-4">
        {/* Migration Analysis Toggle */}
        <div className="flex items-start gap-4 p-4 rounded-lg border border-[#1A3226]/10 hover:border-[#1A3226]/20 transition-colors">
          <div className="flex-1 min-w-0">
            <Label className="text-sm font-medium text-[#1A3226] block mb-1">
              Include Migration & Buyer Origin Analysis
            </Label>
            <p className="text-xs text-[#1A3226]/60">
              Maps feeder markets, buyer migration patterns, and price psychology. Adds 1-2 min to generation time.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Switch
              checked={intake.include_migration || false}
              onCheckedChange={(checked) => update({ include_migration: checked })}
            />
          </div>
        </div>

        {/* Buyer Archetypes Toggle */}
        <div className="flex items-start gap-4 p-4 rounded-lg border border-[#1A3226]/10 hover:border-[#1A3226]/20 transition-colors">
          <div className="flex-1 min-w-0">
            <Label className="text-sm font-medium text-[#1A3226] block mb-1">
              Include Buyer Archetype Profiles
            </Label>
            <p className="text-xs text-[#1A3226]/60">
              Psychographic buyer segments with language calibration and attribute resonance scoring.
            </p>
          </div>
          <div className="flex-shrink-0 mt-0.5">
            <Switch
              checked={intake.include_archetypes || false}
              onCheckedChange={(checked) => update({ include_archetypes: checked })}
            />
          </div>
        </div>

        <p className="text-xs text-[#1A3226]/40 pt-2">
          Both enhancements are included at no extra charge with Pro and Team tiers.
        </p>
      </div>
    </WizardShell>
  );
}