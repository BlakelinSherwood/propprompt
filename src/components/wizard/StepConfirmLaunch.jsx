import { useState } from "react";
import { Zap, User, AlertTriangle, ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABELS = {
  ai_platform: { claude: "Claude (Anthropic)", chatgpt: "ChatGPT (OpenAI)", gemini: "Gemini (Google)", perplexity: "Perplexity AI", grok: "Grok (xAI)" },
  assessment_type: { listing_pricing: "Listing Pricing", buyer_intelligence: "Buyer Intelligence", investment_analysis: "Investment Analysis", cma: "CMA", rental_analysis: "Rental Analysis", listing_strategy: "Listing Strategy" },
  client_relationship: { seller: "Seller Client", buyer: "Buyer Client", investor: "Investor Client", internal: "Internal / Team Use" },
  property_type: { single_family: "Single-Family", condo: "Condo / Co-op", multi_family: "Multi-Family (2–4 units)", land: "Land / Lot", commercial: "Commercial" },
  location_class: { urban_core: "Urban Core", inner_suburb: "Inner Suburb", outer_suburb: "Outer Suburb", coastal: "Coastal", rural: "Rural / Estate" },
  output_format: { narrative: "Narrative", structured: "Structured", bullets: "Bullet Points" },
};

const ROWS = [
  { key: "ai_platform", label: "AI Platform" },
  { key: "assessment_type", label: "Assessment Type" },
  { key: "client_relationship", label: "Client Relationship" },
  { key: "address", label: "Property Address", raw: true },
  { key: "property_type", label: "Property Type" },
  { key: "location_class", label: "Location Class" },
  { key: "output_format", label: "Output Format" },
];

export default function StepConfirmLaunch({ form, update, user, orgMembers, onLaunch, submitting, back }) {
  const isAssistant = user?.role === "assistant";
  const canPrepareFor = isAssistant || user?.role === "team_lead" || user?.role === "brokerage_admin";

  const analysesUsed = user?.analyses_run_this_month || 0;
  const analysesLimit = user?.analyses_limit || 10;
  const pct = Math.min((analysesUsed / analysesLimit) * 100, 100);
  const remaining = analysesLimit - analysesUsed;
  const overLimit = remaining <= 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-[#B8982F] mb-1">Step 6 of 6</p>
        <h2 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Confirm & Launch
        </h2>
        <p className="text-sm text-[#1A3226]/50 mt-1">Review your intake selections before assembling the prompt.</p>
      </div>

      {/* Summary Table */}
      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <div className="px-4 py-2.5 bg-[#1A3226]/[0.03] border-b border-[#1A3226]/8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1A3226]/50">Intake Summary</p>
        </div>
        <div className="divide-y divide-[#1A3226]/5">
          {ROWS.map((row) => {
            const val = row.raw ? form[row.key] : (LABELS[row.key]?.[form[row.key]] || form[row.key] || "—");
            return (
              <div key={row.key} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-[#1A3226]/50 text-xs font-medium">{row.label}</span>
                <span className="text-[#1A3226] font-medium text-right max-w-[60%] truncate">{val || "—"}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quota Meter */}
      <div className={`rounded-xl border p-4 ${overLimit ? "border-red-200 bg-red-50" : "border-[#1A3226]/10 bg-[#FAF8F4]"}`}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#1A3226]/50">Monthly Analysis Quota</p>
          <span className={`text-xs font-semibold ${overLimit ? "text-red-600" : "text-[#1A3226]"}`}>
            {analysesUsed} / {analysesLimit}
          </span>
        </div>
        <div className="w-full h-2 bg-[#1A3226]/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#B8982F]"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className={`text-xs mt-1.5 ${overLimit ? "text-red-600 font-medium" : "text-[#1A3226]/40"}`}>
          {overLimit
            ? "Monthly limit reached. Upgrade your plan to continue."
            : `${remaining} analysis${remaining !== 1 ? "es" : ""} remaining this month.`}
        </p>
      </div>

      {/* Preparing Agent selector (assistants & leads) */}
      {canPrepareFor && orgMembers.length > 0 && (
        <div>
          <Label className="text-xs font-medium text-[#1A3226]/60 mb-1.5 block uppercase tracking-wider">
            Preparing On Behalf Of
          </Label>
          <div className="flex items-center gap-2 p-3 rounded-lg bg-[#B8982F]/5 border border-[#B8982F]/20 mb-2">
            <User className="w-3.5 h-3.5 text-[#B8982F] flex-shrink-0" />
            <p className="text-[11px] text-[#B8982F]">
              As {user?.role === "assistant" ? "an assistant" : "a team lead"}, you can run this analysis on behalf of an agent on your team.
            </p>
          </div>
          <Select
            value={form.preparing_agent_email}
            onValueChange={(v) => update({ preparing_agent_email: v === "self" ? "" : v })}
          >
            <SelectTrigger className="border-[#1A3226]/15 focus:ring-[#B8982F]/30">
              <SelectValue placeholder="Select agent (leave blank to assign to yourself)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Myself — {user?.email}</SelectItem>
              {orgMembers.map((m) => (
                <SelectItem key={m.email} value={m.email}>
                  {m.full_name || m.email} ({m.role})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API Billing Mode Indicator */}
      <div className="flex items-start gap-3 p-3 rounded-lg border border-[#1A3226]/8 bg-white">
        <Zap className="w-4 h-4 text-[#1A3226]/40 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-semibold text-[#1A3226]/60 mb-0.5">API Billing Mode</p>
          <p className="text-[11px] text-[#1A3226]/40 leading-relaxed">
            This analysis will be assembled as a prompt for <strong className="text-[#1A3226]/60">{LABELS.ai_platform[form.ai_platform]}</strong>.
            In the current version, the prompt is prepared for manual use. Direct API execution will be available in a future release.
          </p>
        </div>
      </div>

      {/* Nav buttons */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={back}
          className="px-5 py-2.5 rounded-xl border border-[#1A3226]/15 text-sm font-medium text-[#1A3226]/60 hover:text-[#1A3226] hover:border-[#1A3226]/30 transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onLaunch}
          disabled={submitting || overLimit}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1A3226] text-white text-sm font-semibold hover:bg-[#1A3226]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
        >
          <Zap className="w-4 h-4" />
          {submitting ? "Creating Analysis..." : "Assemble & Launch"}
        </button>
      </div>
    </div>
  );
}