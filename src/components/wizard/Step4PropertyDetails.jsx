import { useState } from "react";
import { MapPin, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import WizardNav from "./WizardNav";

const PROPERTY_TYPES = [
  { id: "single_family", label: "Single-Family" },
  { id: "condo", label: "Condo / TH" },
  { id: "multi_family", label: "Multi-Family" },
  { id: "land", label: "Land" },
  { id: "commercial", label: "Commercial" },
];

const LOCATION_CLASSES = [
  {
    id: "urban_core",
    label: "Urban Core",
    desc: "Boston, Cambridge, Somerville, Brookline",
  },
  {
    id: "inner_suburb",
    label: "Inner Suburb",
    desc: "Newton, Lexington, Belmont, Arlington, Wellesley",
  },
  {
    id: "outer_suburb",
    label: "Outer Suburb",
    desc: "Route 128–495 corridor and beyond",
  },
  {
    id: "coastal",
    label: "Coastal",
    desc: "Marblehead, Hingham, Cohasset, Duxbury, Cape Ann",
  },
  {
    id: "rural",
    label: "Rural / Estate",
    desc: "Concord, Carlisle, Lincoln, western suburbs",
  },
];

const MA_TOWNS = ["Boston", "Cambridge", "Somerville", "Brookline", "Newton", "Lexington", "Belmont",
  "Arlington", "Watertown", "Needham", "Wellesley", "Waltham", "Marblehead", "Salem", "Beverly",
  "Gloucester", "Swampscott", "Manchester", "Rockport", "Ipswich", "Hingham", "Cohasset", "Scituate",
  "Duxbury", "Plymouth", "Norwell", "Marshfield", "Concord", "Carlisle", "Lincoln", "Lowell",
  "Andover", "North Andover", "Lawrence", "Haverhill", "Chelmsford", "Billerica", "Tewksbury"];

function validateEasternMA(address) {
  if (!address || address.length < 5) return null;
  const upper = address.toUpperCase();
  if (upper.includes(", MA") || upper.includes(",MA") || upper.includes(" MA ") || upper.endsWith(" MA")) return true;
  return MA_TOWNS.some((t) => upper.includes(t.toUpperCase())) ? true : "warn";
}

export default function Step4PropertyDetails({ intake, update, onNext, onBack }) {
  const [suggestions, setSuggestions] = useState([]);
  const marketCheck = validateEasternMA(intake.address);

  const canNext = intake.address && intake.property_type && intake.location_class && marketCheck !== false;

  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Property Details
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Enter the subject property address and classification. These fields drive comp selection and market framework routing.
      </p>

      {/* Address */}
      <div className="mb-5">
        <Label className="text-xs font-medium text-[#1A3226]/60 mb-1.5 block">
          Property Address <span className="text-red-400">*</span>
        </Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
          <Input
            placeholder="123 Ocean Ave, Marblehead, MA 01945"
            value={intake.address}
            onChange={(e) => update({ address: e.target.value })}
            className="pl-10 border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30 bg-white"
          />
        </div>
        {marketCheck === "warn" && (
          <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600">
            <AlertCircle className="w-3.5 h-3.5" />
            Address not confirmed as Eastern Massachusetts — please verify before proceeding.
          </p>
        )}
        {marketCheck === true && intake.address.length > 10 && (
          <p className="mt-1.5 text-xs text-emerald-600">✓ Eastern Massachusetts market confirmed</p>
        )}
        <p className="mt-1 text-[10px] text-[#1A3226]/35">
          Google Places autocomplete will be enabled when the API key is configured.
        </p>
      </div>

      {/* Property Type */}
      <div className="mb-5">
        <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
          Property Type <span className="text-red-400">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {PROPERTY_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => update({ property_type: t.id })}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-all
                ${intake.property_type === t.id
                  ? "border-[#B8982F] bg-[#B8982F]/10 text-[#B8982F]"
                  : "border-[#1A3226]/15 text-[#1A3226]/60 hover:border-[#1A3226]/30 hover:text-[#1A3226]"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Location Class */}
      <div className="mb-8">
        <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
          Location Class <span className="text-red-400">*</span>
        </Label>
        <p className="text-[10px] text-[#1A3226]/40 mb-2">
          Select the market context that best describes this property — not just its physical location.
        </p>
        <div className="space-y-2">
          {LOCATION_CLASSES.map((lc) => (
            <button
              key={lc.id}
              onClick={() => update({ location_class: lc.id })}
              className={`w-full text-left px-4 py-3 rounded-xl border-2 flex items-center justify-between transition-all
                ${intake.location_class === lc.id
                  ? "border-[#B8982F] bg-[#B8982F]/5"
                  : "border-[#1A3226]/10 hover:border-[#1A3226]/20"}`}
            >
              <div>
                <span className="text-sm font-medium text-[#1A3226]">{lc.label}</span>
                <span className="text-xs text-[#1A3226]/45 ml-2">{lc.desc}</span>
              </div>
              <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0
                ${intake.location_class === lc.id ? "border-[#B8982F] bg-[#B8982F]" : "border-[#1A3226]/20"}`} />
            </button>
          ))}
        </div>
      </div>

      <WizardNav step={4} onNext={onNext} onBack={onBack} canNext={!!canNext} />
    </div>
  );
}