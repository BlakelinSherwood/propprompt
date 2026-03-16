import WizardShell from "./WizardShell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Info } from "lucide-react";

const PROPERTY_TYPES = [
  { id: "single_family", label: "Single-Family" },
  { id: "condo", label: "Condo / Co-op" },
  { id: "multi_family", label: "Multi-Family (2–4 units)" },
  { id: "land", label: "Land / Lot" },
  { id: "commercial", label: "Commercial" },
];

const LOCATION_CLASSES = [
  {
    id: "urban_core",
    label: "Urban Core",
    desc: "Boston proper, Brookline, Cambridge, Somerville",
  },
  {
    id: "inner_suburb",
    label: "Inner Suburb",
    desc: "Newton, Lexington, Belmont, Arlington, Needham, Wellesley",
  },
  {
    id: "outer_suburb",
    label: "Outer Suburb",
    desc: "Route 128 belt, Lowell corridor, 495 towns",
  },
  {
    id: "coastal",
    label: "Coastal",
    desc: "Marblehead, Beverly, Gloucester, Hingham, Scituate, Duxbury",
  },
  {
    id: "rural",
    label: "Rural / Estate",
    desc: "Towns west of 495, Cape Ann outer towns, estate parcels",
  },
];

export default function StepPropertyDetails({ form, update, next, back, canProceed }) {
  return (
    <WizardShell
      step={4}
      title="Property Details"
      subtitle="Enter the subject property address, type, and location class. These drive module selection and market calibration."
      onNext={next}
      onBack={back}
      canProceed={canProceed()}
    >
      <div className="space-y-6">
        {/* Address */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-1.5 block uppercase tracking-wider">
            Property Address
          </Label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30 pointer-events-none" />
            <Input
              placeholder="123 Main Street, Marblehead, MA 01945"
              value={form.address}
              onChange={(e) => update({ address: e.target.value })}
              className="pl-10 border-[#1A3226]/15 bg-[#FAF8F4] focus-visible:ring-[#B8982F]/30 text-[#1A3226]"
            />
          </div>
          <div className="flex items-start gap-1.5 mt-1.5">
            <Info className="w-3 h-3 text-[#B8982F] mt-0.5 flex-shrink-0" />
            <p className="text-[11px] text-[#1A3226]/40">
              Eastern Massachusetts only. Market validation occurs at analysis launch.
            </p>
          </div>
        </div>

        {/* Property Type */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block uppercase tracking-wider">
            Property Type
          </Label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_TYPES.map((t) => {
              const sel = form.property_type === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => update({ property_type: t.id })}
                  className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all
                    ${sel
                      ? "border-[#1A3226] bg-[#1A3226] text-white shadow-sm"
                      : "border-[#1A3226]/12 text-[#1A3226]/60 hover:border-[#1A3226]/30 hover:text-[#1A3226] bg-white"
                    }`}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
          {form.property_type === "multi_family" && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-[#B8982F]/8 border border-[#B8982F]/20">
              <p className="text-[11px] text-[#B8982F] font-medium">
                Multi-Family activates the 5-method valuation requirement (Comp/Unit, Comp/SF, Cap Rate, GRM, Assessed Value Ratio).
              </p>
            </div>
          )}
          {form.property_type === "condo" && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-[#B8982F]/8 border border-[#B8982F]/20">
              <p className="text-[11px] text-[#B8982F] font-medium">
                Condo activates the Building Health Checklist and Condo Fee Purchasing Power Impact Model.
              </p>
            </div>
          )}
        </div>

        {/* Location Class */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block uppercase tracking-wider">
            Location Class
          </Label>
          <p className="text-[11px] text-[#1A3226]/40 mb-3">
            Select the class that best describes the <em>market context</em> — not just the physical location.
          </p>
          <div className="space-y-2">
            {LOCATION_CLASSES.map((lc) => {
              const sel = form.location_class === lc.id;
              return (
                <button
                  key={lc.id}
                  onClick={() => update({ location_class: lc.id })}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border-2 transition-all
                    ${sel
                      ? "border-[#1A3226] bg-[#1A3226]/[0.03] shadow-sm"
                      : "border-[#1A3226]/10 hover:border-[#1A3226]/25 hover:bg-[#FAF8F4] bg-white"
                    }`}
                >
                  <div className={`w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0 transition-all
                    ${sel ? "bg-[#B8982F]" : "bg-[#1A3226]/15"}`} />
                  <div>
                    <p className={`text-sm font-semibold ${sel ? "text-[#1A3226]" : "text-[#1A3226]/70"}`}>
                      {lc.label}
                    </p>
                    <p className="text-[11px] text-[#1A3226]/45 mt-0.5">{lc.desc}</p>
                  </div>
                  {sel && (
                    <div className="ml-auto w-4 h-4 rounded-full bg-[#1A3226] flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </WizardShell>
  );
}