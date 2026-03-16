import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Search, Lock, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import moment from "moment";

const STATUS_COLORS = {
  complete: "bg-emerald-100 text-emerald-700",
  in_progress: "bg-blue-100 text-blue-700",
  draft: "bg-gray-100 text-gray-600",
  failed: "bg-red-100 text-red-700",
  archived: "bg-gray-100 text-gray-400",
};

const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing",
  buyer_intelligence: "Buyer Intelligence",
  investment_analysis: "Investment",
  cma: "CMA",
  rental_analysis: "Rental",
};

export default function BrokerageAnalysesTab({ org, user }) {
  const [analyses, setAnalyses] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isPlatformOwner = user.role === "platform_owner";

  useEffect(() => {
    base44.entities.Analysis.filter({ org_id: org.id }, "-created_date", 100).then((data) => {
      setAnalyses(data);
      setLoading(false);
    });
  }, [org.id]);

  const filtered = analyses.filter((a) => {
    const addr = a.intake_data?.address || "";
    return addr.toLowerCase().includes(search.toLowerCase()) ||
      a.run_by_email?.toLowerCase().includes(search.toLowerCase());
  });

  // Privacy redaction: non-platform-owners cannot see output of private analyses
  function redact(analysis) {
    if (!analysis.is_private || isPlatformOwner) return analysis;
    return { ...analysis, output_text: "[PRIVATE — Not visible to brokerage admin]" };
  }

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading analyses…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/30" />
          <Input className="pl-9 h-9 text-sm" placeholder="Search by address or agent…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-sm text-[#1A3226]/50">{filtered.length} analyses</span>
        {!isPlatformOwner && (
          <span className="text-xs flex items-center gap-1 text-[#1A3226]/40">
            <Lock className="w-3 h-3" /> Private analyses redacted
          </span>
        )}
      </div>

      <div className="rounded-xl border border-[#1A3226]/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#1A3226]/[0.03] border-b border-[#1A3226]/10">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Address</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Type</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Agent</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Date</th>
              <th className="text-left px-4 py-3 font-medium text-[#1A3226]/60">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1A3226]/5">
            {filtered.map((a) => {
              const r = redact(a);
              return (
                <tr key={a.id} className="hover:bg-[#1A3226]/[0.02]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {a.is_private && <Lock className="w-3.5 h-3.5 text-[#1A3226]/40 shrink-0" />}
                      <span className="text-[#1A3226]">{a.intake_data?.address || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-[#1A3226]/60">{ASSESSMENT_LABELS[a.assessment_type] || a.assessment_type}</td>
                  <td className="px-4 py-3 text-xs text-[#1A3226]/60">{a.run_by_email}</td>
                  <td className="px-4 py-3 text-xs text-[#1A3226]/60">{moment(a.created_date).format("MMM D, YYYY")}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-500"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!a.is_private || isPlatformOwner ? (
                      <button
                        className="text-[#1A3226]/40 hover:text-[#1A3226] transition-colors"
                        onClick={() => navigate(`/Analysis/${a.id}`)}
                        title="View analysis"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    ) : (
                      <Lock className="w-4 h-4 text-[#1A3226]/20 mx-auto" />
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-12 text-center text-[#1A3226]/40">No analyses found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}