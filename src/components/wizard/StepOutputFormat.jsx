import WizardShell from "./WizardShell";
import { AlignLeft, LayoutList, List } from "lucide-react";

const FORMATS = [
  {
    id: "narrative",
    label: "Narrative",
    icon: AlignLeft,
    description: "Flowing prose analysis written as a professional memo. Best for client-facing reports and presentation to sellers or buyers.",
    example: "\"The subject property at 14 Harbor View presents a compelling listing opportunity in the $1.2M–$1.35M corridor, supported by three independent valuation methods that converge within a 4.8% band...\"",
    best_for: "Seller presentations, buyer counseling sessions, board packages",
  },
  {
    id: "structured",
    label: "Structured",
    icon: LayoutList,
    description: "Organized sections with headers, tables, and labeled data blocks. Best for internal review, team analysis, and PPTX export.",
    example: "VALUATION CONVERGENCE\n• Comp Model: $1,247,000\n• Assessed × Ratio: $1,218,000\n• Prior Sale × Multiplier: $1,261,000\n→ Convergence Range: $1.22M–$1.26M",
    best_for: "PPTX generation, team review, investment analysis, MF pro forma",
  },
  {
    id: "bullets",
    label: "Bullet Points",
    icon: List,
    description: "Concise bullet-point format. Best for quick agent reference, meeting prep, and mobile use in the field.",
    example: "• List range: $1.22M–$1.26M (±2.2% mid)\n• Primary archetype: Boston-based equity-out buyer\n• Top risk: condo fee ($620/mo) reduces pool by ~15%",
    best_for: "Field reference, meeting prep, quick client Q&A, mobile use",
  },
];

export default function StepOutputFormat({ form, update, next, back, canProceed }) {
  return (
    <WizardShell
      step={5}
      title="Output Format"
      subtitle="Choose how the AI should structure and present its analysis."
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="space-y-3">
        {FORMATS.map((f) => {
          const selected = form.output_format === f.id;
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => update({ output_format: f.id })}
              className={`w-full text-left p-5 rounded-xl border-2 transition-all
                ${selected
                  ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/25 hover:bg-[#FAF8F4] bg-white"
                }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
                  ${selected ? "bg-[#1A3226] text-white" : "bg-[#1A3226]/8 text-[#1A3226]/40"}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className={`text-sm font-semibold ${selected ? "text-[#1A3226]" : "text-[#1A3226]/80"}`}>
                      {f.label}
                    </p>
                    {selected && (
                      <div className="w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0">
                        <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-[#1A3226]/60 mb-3 leading-relaxed">{f.description}</p>

                  {/* Example */}
                  <div className={`rounded-lg px-3 py-2 text-[11px] font-mono leading-relaxed whitespace-pre-line
                    ${selected ? "bg-[#1A3226]/5 text-[#1A3226]/60" : "bg-[#FAF8F4] text-[#1A3226]/35"}`}>
                    {f.example}
                  </div>
                  <p className={`text-[10px] mt-2 ${selected ? "text-[#B8982F]" : "text-[#1A3226]/30"}`}>
                    Best for: {f.best_for}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </WizardShell>
  );
}