import WizardNav from "./WizardNav";

const OUTPUT_FORMATS = [
  {
    id: "narrative",
    title: "Narrative",
    icon: "📝",
    description: "Flowing prose analysis with section headings. Ideal for presenting to clients or inclusion in listing packages. Most human-readable format.",
    best_for: "Client presentations, listing packages",
  },
  {
    id: "structured",
    title: "Structured",
    icon: "🗂️",
    description: "Organized with labeled sections, sub-bullets, and clearly separated data tables. Best for internal review and agent reference during negotiations.",
    best_for: "Internal review, negotiation reference",
  },
  {
    id: "bullets",
    title: "Bullets",
    icon: "⚡",
    description: "Concise bullet-point summary optimized for speed. Key findings, price range, top archetypes, and action items only. Fastest to read and act on.",
    best_for: "Quick review, CRM notes, team briefs",
  },
];

export default function Step5OutputFormat({ intake, update, onNext, onBack }) {
  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Output Format
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Choose how the AI structures its response. This can be changed per-analysis regardless of your account default.
      </p>

      <div className="space-y-3 mb-8">
        {OUTPUT_FORMATS.map((f) => {
          const selected = intake.output_format === f.id;
          return (
            <button
              key={f.id}
              onClick={() => update({ output_format: f.id })}
              className={`w-full text-left rounded-xl border-2 p-5 transition-all
                ${selected ? "border-[#B8982F] bg-[#B8982F]/5" : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
            >
              <div className="flex items-start gap-4">
                <span className="text-2xl leading-none mt-0.5">{f.icon}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-[#1A3226]">{f.title}</span>
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0
                      ${selected ? "border-[#B8982F] bg-[#B8982F]" : "border-[#1A3226]/20"}`} />
                  </div>
                  <p className="text-xs text-[#1A3226]/55 leading-relaxed mb-2">{f.description}</p>
                  <p className="text-[10px] text-[#B8982F] font-medium">Best for: {f.best_for}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Drive Sync Toggle */}
      <div className="rounded-xl border border-[#1A3226]/10 p-4 flex items-center justify-between mb-8">
        <div>
          <p className="text-sm font-medium text-[#1A3226]">Sync to Google Drive</p>
          <p className="text-xs text-[#1A3226]/45 mt-0.5">Save PDF & PPTX outputs to your connected Drive folder</p>
        </div>
        <button
          onClick={() => update({ drive_sync: !intake.drive_sync })}
          className={`relative w-11 h-6 rounded-full transition-colors ${intake.drive_sync ? "bg-[#1A3226]" : "bg-[#1A3226]/20"}`}
        >
          <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform
            ${intake.drive_sync ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>

      <WizardNav step={5} onNext={onNext} onBack={onBack} canNext={!!intake.output_format} />
    </div>
  );
}