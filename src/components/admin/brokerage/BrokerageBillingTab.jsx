import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CreditCard, Users, FileText, TrendingUp, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import moment from "moment";

export default function BrokerageBillingTab({ org, user }) {
  const [quota, setQuota] = useState(null);
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      base44.entities.SeatQuota.filter({ org_id: org.id }),
      base44.entities.Analysis.filter({ org_id: org.id }),
    ]).then(([quotas, ana]) => {
      setQuota(quotas[0] || null);
      setAnalyses(ana);
      setLoading(false);
    });
  }, [org.id]);

  const completedThisMonth = analyses.filter((a) => {
    return a.status === "complete" && moment(a.created_date).isSame(moment(), "month");
  }).length;

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading billing…</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Plan", value: org.subscription_plan || "—", icon: CreditCard, color: "text-[#B8982F]" },
          { label: "Active Seats", value: org.seat_count ?? 0, icon: Users, color: "text-[#1A3226]" },
          { label: "Analyses This Month", value: completedThisMonth, icon: FileText, color: "text-emerald-600" },
          { label: "Total Analyses", value: analyses.length, icon: TrendingUp, color: "text-blue-600" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[#1A3226]/10 bg-white p-4">
            <div className={`${kpi.color} mb-2`}><kpi.icon className="w-5 h-5" /></div>
            <p className="text-2xl font-bold text-[#1A3226] capitalize">{kpi.value}</p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Quota Details */}
      {quota && (
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-4">
          <h3 className="font-semibold text-[#1A3226]">Seat & Analysis Quota</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ["Agent Seats Included", quota.agent_seats_included],
              ["Agent Seats Used", quota.agent_seats_used],
              ["Analyses / Seat / Month", quota.analyses_included_per_seat_monthly],
              ["Overage Price", `$${((quota.analyses_overage_price_cents || 150) / 100).toFixed(2)}/analysis`],
              ["Period Start", quota.billing_period_start || "—"],
              ["Period End", quota.billing_period_end || "—"],
            ].map(([label, val]) => (
              <div key={label}>
                <p className="text-xs text-[#1A3226]/50">{label}</p>
                <p className="font-medium text-[#1A3226] mt-0.5">{val ?? "—"}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stripe Info */}
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5 space-y-3">
        <h3 className="font-semibold text-[#1A3226]">Stripe Subscription</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-[#1A3226]/50">Customer ID</p>
            <p className="font-mono text-xs text-[#1A3226]/70 mt-0.5">{org.stripe_customer_id || "Not linked"}</p>
          </div>
          <div>
            <p className="text-xs text-[#1A3226]/50">Subscription ID</p>
            <p className="font-mono text-xs text-[#1A3226]/70 mt-0.5">{org.stripe_subscription_id || "—"}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <Button
            variant="outline" size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => navigate("/Billing")}
          >
            <CreditCard className="w-3.5 h-3.5" /> Manage Billing
          </Button>
        </div>
      </div>
    </div>
  );
}