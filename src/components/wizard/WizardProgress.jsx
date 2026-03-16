const STEP_LABELS = [
  "AI Platform",
  "Assessment Type",
  "Client",
  "Property",
  "Output Format",
  "Confirm & Launch",
];

export default function WizardProgress({ currentStep, totalSteps }) {
  return (
    <div className="w-full">
      {/* Step indicators */}
      <div className="flex items-center gap-0">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1;
          const done = stepNum < currentStep;
          const active = stepNum === currentStep;
          return (
            <div key={stepNum} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center flex-shrink-0">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all
                    ${done ? "bg-[#B8982F] text-white" : active ? "bg-[#1A3226] text-white ring-4 ring-[#1A3226]/10" : "bg-[#1A3226]/10 text-[#1A3226]/40"}`}
                >
                  {done ? (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNum
                  )}
                </div>
                <span className={`hidden sm:block text-[10px] mt-1 font-medium whitespace-nowrap
                  ${active ? "text-[#1A3226]" : done ? "text-[#B8982F]" : "text-[#1A3226]/30"}`}>
                  {label}
                </span>
              </div>
              {i < totalSteps - 1 && (
                <div className={`flex-1 h-0.5 mx-1 transition-all ${done ? "bg-[#B8982F]" : "bg-[#1A3226]/10"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}