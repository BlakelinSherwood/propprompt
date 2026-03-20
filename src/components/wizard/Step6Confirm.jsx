import { Zap, User, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LABELS = {
  ai_platform: { claude: "Claude (Anthropic)", chatgpt: "ChatGPT (OpenAI)", gemini: "Gemini (Google)", perplexity: "Perplexity", grok: "Grok (xAI)" },
  assessment_type: { listing_pricing: "Listing Pricing Analysis", buyer_intelligence: "Buyer Intelligence Report", investment_analysis: "Investment Analysis", cma: "CMA", rental_analysis: "Rental Market Analysis", client_portfolio: "Client Portfolio Analysis", custom: "Custom Analysis" },
  client_relationship: { listing_agent: "Listing Agent", buyer_agent: "Buyer's Agent", dual_agent: "Dual Agent / Facilitator", investor_advisor: "Investor Advisor" },
  property_type: { single_family: "Single-Family", condo: "Condo / TH", multi_family: "Multi-Family", land: "Land" },
  location_class: { urban_core: "Urban Core", inner_suburb: "Inner Suburb", outer_suburb: "Outer Suburb", coastal: "Coastal", rural: "Rural / Estate" },
  output_format: { narrative: "Narrative", structured: "Structured", bullets: "Bullets" },
};

const ROWS = [
  { key: "ai_platform", label: "AI Platform" },
  { key: "assessment_type", label: "Assessment" },
  { key: "client_relationship", label: "Client Role" },
  { key: "address", label: "Property Address", raw: true },
  { key: "property_type", label: "Property Type" },
  { key: "location_class", label: "Location Class" },
  { key: "output_format", label: "Output Format" },
];

function QuotaMeter({ user }) {
  const isOwner = user?.role === "platform_owner" || user?.role === "admin" || user?.analyses_limit === null || user?.analyses_limit === Infinity;
  
  if (isOwner) {
    return (
      <div className="rounded-xl border border-[#1A3226]/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[#1A3226]/60">Monthly Analysis Quota</span>
          <span className="text-xs font-semibold text-emerald-600">Unlimited</span>
        </div>
        <div className="h-2 bg-emerald-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: "100%" }} />
        </div>
      </div>
    );
  }

  const used = user?.analyses_run_this_month ?? 0;
  const limit = user?.analyses_limit ?? 30;
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-[#B8982F]";

  return (
    <div className="rounded-xl border border-[#1A3226]/10 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#1A3226]/60">Monthly Analysis Quota</span>
        <span className={`text-xs font-semibold tabular-nums ${pct >= 90 ? "text-red-500" : "text-[#1A3226]"}`}>
          {used} / {limit}
        </span>
      </div>
      <div className="h-2 bg-[#1A3226]/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {pct >= 90 && (
        <p className="text-[10px] text-red-500 mt-1.5">Approaching limit — contact your admin to upgrade.</p>
      )}
    </div>
  );
}

export default function Step6Confirm({ intake, update, user, orgMembers, submitting, onBack, onSubmit }) {
  const isAssistantOrLead = user?.role === "assistant" || user?.role === "team_lead";

  return (
    <div className="p-6 lg:p-8">
      <h2 className="text-lg font-semibold text-[#1A3226] mb-1" style={{ fontFamily: "Georgia, serif" }}>
        Confirm & Launch
      </h2>
      <p className="text-sm text-[#1A3226]/50 mb-6">
        Review your selections, then launch the analysis. The AI will ask follow-up questions before generating the report.
      </p>

      {/* Summary Table */}
      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden mb-5">
        {ROWS.map((row, i) => {
           let displayValue = row.raw
             ? intake[row.key]
             : LABELS[row.key]?.[intake[row.key]];
          return (
            <div
              key={row.key}
              className={`flex items-start gap-4 px-4 py-3 ${i % 2 === 0 ? "bg-[#FAF8F4]/60" : "bg-white"}`}
            >
              <span className="text-xs text-[#1A3226]/45 w-32 flex-shrink-0 pt-0.5">{row.label}</span>
              <span className="text-sm text-[#1A3226] font-medium">
                {displayValue || <span className="text-[#1A3226]/30 font-normal">—</span>}
              </span>
            </div>
          );
          })}
          <div className={`flex items-center gap-4 px-4 py-3 ${ROWS.length % 2 === 0 ? "bg-[#FAF8F4]/60" : "bg-white"}`}>
          <span className="text-xs text-[#1A3226]/45 w-32 flex-shrink-0">Drive Sync</span>
          <span className={`text-sm font-medium ${intake.drive_sync ? "text-emerald-600" : "text-[#1A3226]/40"}`}>
            {intake.drive_sync ? "Enabled" : "Disabled"}
          </span>
        </div>
      </div>

      {/* Quota Meter */}
      <div className="mb-5">
        <QuotaMeter user={user} />
      </div>

      {/* Preparing Agent — for assistants and team leads */}
      {isAssistantOrLead && orgMembers.length > 0 && (
        <div className="rounded-xl border border-[#1A3226]/10 p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-[#1A3226]/40" />
            <p className="text-sm font-medium text-[#1A3226]">Preparing on behalf of</p>
          </div>
          <p className="text-xs text-[#1A3226]/50 mb-3">
            If you're running this analysis for another agent, select them below. Leave blank to run as yourself.
          </p>
          <Select
            value={intake.on_behalf_of_email || ""}
            onValueChange={(v) => update({ on_behalf_of_email: v === "self" ? "" : v })}
          >
            <SelectTrigger className="border-[#1A3226]/15 focus:ring-[#B8982F]/30 text-sm">
              <SelectValue placeholder="Running as myself" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="self">Running as myself</SelectItem>
              {orgMembers.map((m) => (
                <SelectItem key={m.email} value={m.email}>
                  {m.full_name || m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API Mode Indicator */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-8 flex items-start gap-3">
        <Zap className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-xs font-medium text-emerald-900">Direct API Integration</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Your prompts are secured server-side. All analysis runs through encrypted backend APIs — you never see or touch the actual prompts.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={onBack}
          disabled={submitting}
          className="text-[#1A3226]/60 hover:text-[#1A3226] hover:bg-[#1A3226]/5"
        >
          ← Back
        </Button>
        <Button
          onClick={onSubmit}
          disabled={submitting}
          className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2 px-8"
        >
          <Zap className="w-4 h-4" />
          {submitting ? "Launching..." : "Launch Analysis"}
        </Button>
      </div>
    </div>
  );
}