export default function WizardShell({ step, title, subtitle, children, onNext, onBack, canProceed }) {
  return (
    <div className="p-6 lg:p-8">
      {/* Step header */}
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">
          Step {step} of 5
        </p>
        <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-[#1A3226]/50 mt-1 leading-relaxed">{subtitle}</p>
        )}
      </div>

      {/* Content */}
      <div className="mb-8">{children}</div>

      {/* Navigation */}
      <div className="flex items-center justify-between border-t border-[#1A3226]/8 pt-5">
        {onBack ? (
          <button
            onClick={onBack}
            className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/30 transition-all"
          >
            ← Back
          </button>
        ) : (
          <div />
        )}
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="px-6 py-2.5 rounded-xl bg-[#1A3226] text-white text-sm font-semibold hover:bg-[#1A3226]/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          Continue →
        </button>
      </div>
    </div>
  );
}