import { useState } from "react";
import { DollarSign, Search, CheckCircle2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import WizardShell from "./WizardShell";
import { base44 } from "@/api/base44Client";

const CLIENT_INTERESTS = [
  "Considering a HELOC",
  "Thinking about improvements",
  "May sell in 2-3 years",
  "Interested in rental property",
  "Considering an ADU",
  "Thinking about downsizing",
  "Exploring refinance options",
  "No specific plans",
];

export default function StepClientFinancial({ intake, update, onNext, onBack }) {
  const [mortgageSource, setMortgageSource] = useState(intake.mortgage_source || "approximate");
  const [fetchStatus, setFetchStatus] = useState("idle"); // idle | loading | found | error
  const [fetchNote, setFetchNote] = useState(null);

  const canNext = true; // All fields optional for portfolio analysis

  async function fetchMortgageData() {
    if (!intake.address) return;
    setFetchStatus("loading");
    setFetchNote(null);
    try {
      const res = await base44.functions.invoke("fetchMortgageData", { address: intake.address });
      const d = res.data;

      if (!d?.success) {
        setFetchStatus("error");
        setFetchNote(d?.message || "Could not retrieve mortgage data for this address.");
        return;
      }

      const updates = {};

      // Pre-fill estimated payoff as mortgage balance (only if blank)
      if (d.estimated_payoff && !intake.mortgage_balance) {
        updates.mortgage_balance = d.estimated_payoff;
        updates.mortgage_source = "approximate";
        setMortgageSource("approximate");
      }

      // Pre-fill mortgage rate if we have an assumed rate and field is blank
      if (d.assumed_rate_pct && !intake.mortgage_rate) {
        updates.mortgage_rate = d.assumed_rate_pct;
      }
      if (d.loan_amount) updates.mortgage_loan_amount = d.loan_amount;
      if (d.lender_name) updates.mortgage_lender = d.lender_name;
      if (d.loan_date) updates.mortgage_loan_date = d.loan_date;

      // Pre-fill HELOC if found and field is blank
      if (d.heloc_amount && !intake.heloc_info) {
        const helocLine = `HELOC $${Number(d.heloc_amount).toLocaleString()}${d.heloc_lender ? ` with ${d.heloc_lender}` : ""}${d.heloc_date ? ` (${d.heloc_date.slice(0, 7)})` : ""}`;
        updates.heloc_info = helocLine;
      }

      if (Object.keys(updates).length > 0) update(updates);

      setFetchStatus("found");
      setFetchNote(d.notes || "Mortgage data loaded from ATTOM public property records.");
    } catch (err) {
      setFetchStatus("error");
      setFetchNote("Unable to search mortgage records. Enter values manually.");
    }
  }

  const handleInterestToggle = (interest) => {
    const current = intake.client_interests || [];
    const updated = current.includes(interest)
      ? current.filter(i => i !== interest)
      : [...current, interest];
    update({ client_interests: updated });
  };

  return (
    <WizardShell
      step={5}
      title="Client Financial Context"
      subtitle="This information improves the accuracy of the equity analysis. Estimates from public records are used for any fields left blank."
      onNext={onNext}
      onBack={onBack}
      canProceed={canNext}
    >
      <div className="space-y-6">

        {/* Fetch mortgage data button */}
        {intake.address && (
          <div className="bg-[#FAF8F4] border border-[#1A3226]/10 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1A3226]">Auto-fill from Public Mortgage Records</p>
                <p className="text-xs text-[#1A3226]/50 mt-0.5">Search registry of deeds for recorded mortgages, refinances, and HELOCs.</p>
              </div>
              <Button
                onClick={fetchMortgageData}
                disabled={fetchStatus === "loading"}
                size="sm"
                className="flex-shrink-0 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-1.5"
              >
                <Search className="w-3.5 h-3.5" />
                {fetchStatus === "loading" ? "Searching…" : "Find Mortgage Data"}
              </Button>
            </div>
            {fetchStatus === "found" && (
              <div className="flex items-start gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{fetchNote}</span>
              </div>
            )}
            {fetchStatus === "error" && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{fetchNote}</span>
              </div>
            )}
          </div>
        )}

        {/* Mortgage Balance */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Mortgage Balance
          </Label>
          <div className="relative mb-2">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
            <Input
              type="number"
              placeholder="250000"
              value={intake.mortgage_balance || ""}
              onChange={(e) => update({ mortgage_balance: e.target.value ? parseFloat(e.target.value) : null })}
              className="pl-10 border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mb-2">If known. Otherwise we estimate from public records.</p>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={mortgageSource === "exact"}
                onCheckedChange={() => {
                  setMortgageSource("exact");
                  update({ mortgage_source: "exact" });
                }}
              />
              <span className="text-[#1A3226]/70">Exact (client provided)</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={mortgageSource === "approximate"}
                onCheckedChange={() => {
                  setMortgageSource("approximate");
                  update({ mortgage_source: "approximate" });
                }}
              />
              <span className="text-[#1A3226]/70">Approximate</span>
            </label>
          </div>
        </div>

        {/* Mortgage Rate */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Mortgage Rate
          </Label>
          <div className="relative">
            <Input
              type="number"
              step="0.01"
              placeholder="3.25"
              value={intake.mortgage_rate || ""}
              onChange={(e) => update({ mortgage_rate: e.target.value ? parseFloat(e.target.value) : null })}
              className="pl-3 border-[#1A3226]/15 focus-visible:ring-[#B8982F]/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#1A3226]/40">%</span>
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-1">The client's current mortgage interest rate.</p>
        </div>

        {/* Known Improvements */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            Known Improvements
          </Label>
          <textarea
            placeholder="e.g., Kitchen renovation ~$45K (2022), New roof ~$18K (2023)"
            value={intake.known_improvements || ""}
            onChange={(e) => update({ known_improvements: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/15 rounded-lg focus-visible:ring-1 focus-visible:ring-[#B8982F]/30 resize-none bg-white"
            rows={3}
          />
          <p className="text-[10px] text-[#1A3226]/40 mt-1">
            List renovations, additions, or major systems replacements with approximate cost and year. Write 'None' if unknown.
          </p>
        </div>

        {/* HELOC or Other Liens */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-2 block">
            HELOC or Other Liens
          </Label>
          <textarea
            placeholder="e.g., HELOC $50K at 7.5%, or write 'None'"
            value={intake.heloc_info || ""}
            onChange={(e) => update({ heloc_info: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/15 rounded-lg focus-visible:ring-1 focus-visible:ring-[#B8982F]/30 resize-none bg-white"
            rows={2}
          />
          <p className="text-[10px] text-[#1A3226]/40 mt-1">
            Any active HELOC, second mortgage, or other liens. Write 'None' if unknown — we check public records.
          </p>
        </div>

        {/* Client Interests */}
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-3 block">
            Client Interests
          </Label>
          <div className="space-y-2">
            {CLIENT_INTERESTS.map((interest) => (
              <label key={interest} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={(intake.client_interests || []).includes(interest)}
                  onCheckedChange={() => handleInterestToggle(interest)}
                />
                <span className="text-sm text-[#1A3226]/70">{interest}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-[#1A3226]/40 mt-3">
            Select any that apply. This tailors which options are emphasized in the report.
          </p>
        </div>
      </div>
    </WizardShell>
  );
}