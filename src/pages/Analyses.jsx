import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import PullToRefresh from "../components/PullToRefresh";
import { Link, useNavigate } from "react-router-dom";
import { Plus, FileText, Lock, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STATUS_STYLES } from "@/lib/constants";
import PrivateToggle from "../components/PrivateToggle";
import CollectionManager from "../components/CollectionManager";
import { base44 } from "@/api/base44Client";

const TYPE_LABELS = {
  listing_pricing: "Listing Pricing",
  buyer_intelligence: "Buyer Intelligence",
  investment_analysis: "Investment Analysis",
  cma: "CMA",
  rental_analysis: "Rental Analysis",
  listing_strategy: "Listing Strategy",
};

export default function Analyses() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orgAllowsPrivate, setOrgAllowsPrivate] = useState(false);
  const [orgId, setOrgId] = useState(null);
  const [rerunning, setRerunning] = useState(null);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const [data, memberships] = await Promise.all([
        base44.entities.Analysis.filter({ run_by_email: user.email }, "-created_date", 30),
        base44.entities.OrgMembership.filter({ user_email: user.email, status: "active" }),
      ]);
      setAnalyses(data);

      if (memberships.length > 0) {
        const org = memberships[0];
        setOrgId(org.org_id);
        const orgs = await base44.entities.Organization.filter({ id: org.org_id });
        if (orgs[0]?.allow_agent_private_toggle) setOrgAllowsPrivate(true);

        // Load collections for this org
        const cols = await base44.entities.AnalysisCollection.filter({ org_id: org.org_id }, "sort_order");
        setCollections(cols);
      }

      setLoading(false);
    }
    load();
  }, [user]);

  const handleRefresh = useCallback(async () => {
    if (!user) return;
    const [data, cols] = await Promise.all([
      base44.entities.Analysis.filter({ run_by_email: user.email }, "-created_date", 30),
      orgId ? base44.entities.AnalysisCollection.filter({ org_id: orgId }, "sort_order") : Promise.resolve([]),
    ]);
    setAnalyses(data);
    setCollections(cols);
  }, [user, orgId]);

  const handleRerun = useCallback(async (e, analysis) => {
    e.preventDefault();
    e.stopPropagation();
    setRerunning(analysis.id);
    try {
      const res = await base44.functions.invoke("rerunnAnalysis", { analysis_id: analysis.id });
      if (res.data.success) {
        navigate(`/AnalysisRun?id=${analysis.id}&orgId=${analysis.org_id}`);
      }
    } catch (err) {
      console.error("Rerun failed:", err);
    } finally {
      setRerunning(null);
    }
  }, [navigate]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  // Filter analyses by selected collection
  const displayedAnalyses = selectedCollection
    ? analyses.filter((a) => a.collection_id === selectedCollection)
    : analyses;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            Analyses
          </h1>
          <p className="text-sm text-[#1A3226]/50 mt-0.5">{displayedAnalyses.length} {selectedCollection ? "in this collection" : "total"}</p>
        </div>
        <Link to="/NewAnalysis">
          <Button className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
            <Plus className="w-4 h-4" />
            New Analysis
          </Button>
        </Link>
      </div>

      {/* Collections */}
      {orgId && (
        <CollectionManager
          collections={collections}
          orgId={orgId}
          onCollectionsUpdated={handleRefresh}
        />
      )}

      {/* Collection filter pills */}
      {collections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedCollection(null)}
            className={`text-sm px-3 py-1.5 rounded-full transition-all ${
              !selectedCollection
                ? "bg-[#1A3226] text-white"
                : "bg-[#1A3226]/5 text-[#1A3226] hover:bg-[#1A3226]/10"
            }`}
          >
            All
          </button>
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => setSelectedCollection(col.id)}
              className={`text-sm px-3 py-1.5 rounded-full transition-all ${
                selectedCollection === col.id
                  ? "text-white"
                  : "bg-[#1A3226]/5 text-[#1A3226] hover:bg-[#1A3226]/10"
              }`}
              style={selectedCollection === col.id ? { backgroundColor: col.color || "#1A3226" } : {}}
            >
              {col.name}
            </button>
          ))}
        </div>
      )}

      {displayedAnalyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#1A3226]/15 bg-white p-16 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#1A3226]/5 flex items-center justify-center mb-4">
            <FileText className="w-7 h-7 text-[#1A3226]/25" />
          </div>
          <p className="text-sm font-medium text-[#1A3226]/50 mb-1">{selectedCollection ? "No analyses in this collection" : "No analyses yet"}</p>
          <p className="text-xs text-[#1A3226]/30 mb-5">{!selectedCollection && "Run your first PropPrompt analysis to get started."}</p>
          {!selectedCollection && (
            <Link to="/NewAnalysis">
              <Button className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2 text-sm">
                <Plus className="w-4 h-4" />
                New Analysis
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
          {displayedAnalyses.map((a, i) => (
            <Link
              key={a.id}
              to={`/Analysis/${a.id}`}
              className={`flex items-center gap-4 px-5 py-4 hover:bg-[#FAF8F4]/70 transition-colors ${
                i !== displayedAnalyses.length - 1 ? "border-b border-[#1A3226]/5" : ""
              }`}
            >
              <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center flex-shrink-0">
                {a.is_private ? (
                  <Lock className="w-4 h-4 text-[#1A3226]/60" />
                ) : (
                  <FileText className="w-4 h-4 text-[#1A3226]/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#1A3226] truncate">
                    {a.intake_data?.address || "Untitled Analysis"}
                  </p>
                  {a.is_private && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[#1A3226] text-white flex-shrink-0">
                      Private
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#1A3226]/40 mt-0.5">
                   {TYPE_LABELS[a.assessment_type] || a.assessment_type} · {a.ensemble_mode_used ? "Ensemble" : a.ai_platform} ·{" "}
                   {new Date(a.created_date).toLocaleDateString()}
                 </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                 {a.status === "complete" && (
                   <Button
                     variant="ghost"
                     size="sm"
                     onClick={(e) => handleRerun(e, a)}
                     disabled={rerunning === a.id}
                     className="text-[#1A3226]/60 hover:text-[#1A3226] px-2"
                     title="Re-run analysis (uses 1 token)"
                   >
                     <RotateCw className={`w-4 h-4 ${rerunning === a.id ? "animate-spin" : ""}`} />
                   </Button>
                 )}
                 <PrivateToggle
                   analysis={a}
                   orgAllowsPrivate={orgAllowsPrivate}
                   onToggled={(newVal) =>
                     setAnalyses((prev) =>
                       prev.map((x) => (x.id === a.id ? { ...x, is_private: newVal } : x))
                     )
                   }
                 />
                 <span
                   className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full font-semibold ${
                     STATUS_STYLES[a.status] || STATUS_STYLES.draft
                   }`}
                 >
                   {a.status}
                 </span>
               </div>
            </Link>
          ))}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}