import { Check } from "lucide-react";

export default function WizardProgress({ currentStep, labels }) {
  return (
    <div className="w-full">
      {/* Mobile: just step count */}
      <div className="flex sm:hidden items-center justify-between mb-1">
        <span className="text-xs text-[#1A3226]/50 font-medium">
          Step {currentStep} of {labels.length}
        </span>
        <span className="text-xs text-[#B8982F] font-medium">{labels[currentStep - 1]}</span>
      </div>
      <div className="sm:hidden h-1.5 rounded-full bg-[#1A3226]/10 overflow-hidden">
        <div
          className="h-full bg-[#B8982F] rounded-full transition-all duration-300"
          style={{ width: `${(currentStep / labels.length) * 100}%` }}
        />
      </div>

      {/* Desktop: full step row */}
      <div className="hidden sm:flex items-center">
        {labels.map((label, i) => {
          const stepNum = i + 1;
          const done = stepNum < currentStep;
          const active = stepNum === currentStep;
          return (
            <div key={stepNum} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                    ${done ? "bg-[#1A3226] text-white" : active ? "bg-[#B8982F] text-[#1A3226]" : "bg-[#1A3226]/10 text-[#1A3226]/40"}`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : stepNum}
                </div>
                <span
                  className={`text-[10px] font-medium whitespace-nowrap transition-colors
                    ${active ? "text-[#B8982F]" : done ? "text-[#1A3226]" : "text-[#1A3226]/30"}`}
                >
                  {label}
                </span>
              </div>
              {i < labels.length - 1 && (
                <div className={`flex-1 h-px mx-2 mb-5 transition-colors ${done ? "bg-[#1A3226]/40" : "bg-[#1A3226]/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}