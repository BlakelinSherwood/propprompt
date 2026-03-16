import { Button } from "@/components/ui/button";

export default function WizardNav({ step, onNext, onBack, canNext = true }) {
  return (
    <div className="flex items-center justify-between border-t border-[#1A3226]/8 pt-6">
      {step > 1 ? (
        <Button
          variant="ghost"
          onClick={onBack}
          className="text-[#1A3226]/60 hover:text-[#1A3226] hover:bg-[#1A3226]/5"
        >
          ← Back
        </Button>
      ) : (
        <span />
      )}
      <Button
        onClick={onNext}
        disabled={!canNext}
        className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white disabled:opacity-40 px-6"
      >
        Continue →
      </Button>
    </div>
  );
}