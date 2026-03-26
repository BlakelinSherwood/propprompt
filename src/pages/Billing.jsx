import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { Check, Zap, Building2, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

const PLANS = [
  {
    id: "brokerage_license",
    name: "Brokerage License",
    price: 199,
    interval: "month",
    priceId: "price_1TBhejF8FK2SYLZUHUHlr95S",
    icon: Building2,
    description: "Full brokerage platform access",
    features: ["Unlimited agents", "Fair housing compliance", "CRM integrations", "White-label branding"],
  },
  {
    id: "team_license",
    name: "Standalone Team License",
    price: 99,
    interval: "month",
    priceId: "price_1TBhejF8FK2SYLZUU7nYtlWJ",
    icon: Users,
    description: "For independent teams",
    features: ["Up to 10 agents", "Team dashboard", "Analyses history", "Drive sync"],
  },
];

const SEATS = [
  { id: "brokerage_admin_seat", name: "Brokerage Admin Seat", price: 99, priceId: "price_1TBhejF8FK2SYLZURefHB3TX", quota: 60 },
  { id: "team_lead_seat",       name: "Team Lead Seat",       price: 79, priceId: "price_1TBhejF8FK2SYLZUplITgfKk", quota: 40 },
  { id: "agent_seat",           name: "Agent Seat",           price: 49, priceId: "price_1TBhejF8FK2SYLZUE4imcOoB", quota: 20 },
  { id: "assistant_seat",       name: "Assistant Seat",       price: 29, priceId: "price_1TBhejF8FK2SYLZUSE3t8zz6", quota: null },
];

const OVERAGE_PACKS = [
  { name: "10 Analyses",  price: 29,  priceId: "price_1TBhejF8FK2SYLZUMEp2wWPz", analyses: 10 },
  { name: "25 Analyses",  price: 59,  priceId: "price_1TBhejF8FK2SYLZUID3SdPfo", analyses: 25, popular: true },
  { name: "50 Analyses",  price: 99,  priceId: "price_1TBhejF8FK2SYLZUAb1MfMbK", analyses: 50 },
];

export default function Billing() {
  const { user, isLoading: authLoading } = useAuth();
  const [org, setOrg] = useState(null);
  const [quota, setQuota] = useState(null);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(null);
  const [message, setMessage] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success")) setMessage({ type: "success", text: "Payment successful! Your plan has been activated." });
    if (params.get("canceled")) setMessage({ type: "info", text: "Checkout canceled — no charge was made." });

    async function load() {
      if (!user) { setLoading(false); return; }
      try {
        const memberships = await base44.entities.OrgMembership.filter({ user_email: user.email, status: "active" });
        if (memberships.length > 0) {
          const orgId = memberships[0].org_id;
          const orgs = await base44.entities.Organization.filter({ id: orgId });
          if (orgs.length > 0) setOrg(orgs[0]);
          const quotas = await base44.entities.SeatQuota.filter({ org_id: orgId });
          if (quotas.length > 0) setQuota(quotas[0]);
        }
      } catch (e) {
        console.warn("Billing load error:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  async function checkout(priceId) {
    // Block if running in iframe (Base44 preview)
    if (window.self !== window.top) {
      alert("Checkout is only available from the published app. Please open the app in a new tab.");
      return;
    }
    setCheckingOut(priceId);
    const res = await base44.functions.invoke("stripeCheckout", {
      price_id: priceId,
      org_id: org?.id || "",
    });
    if (res.data?.url) {
      window.location.href = res.data.url;
    } else {
      alert(res.data?.error || "Checkout failed. Please try again.");
      setCheckingOut(null);
    }
  }

  if (authLoading || loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  const isUnlimited = ["platform_owner", "team_agent"].includes(user?.role);
  const isAdmin = ["platform_owner", "brokerage_admin", "team_lead"].includes(user?.role);

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Billing</p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Plans & Billing
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">Manage your PropPrompt™ subscription and analysis quota.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm ${
          message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800"
        }`}>
          {message.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {/* Current Status */}
      {org && (
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
          <h2 className="text-sm font-semibold text-[#1A3226] mb-4">Current Plan</h2>
          <div className="flex flex-wrap gap-4">
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 mb-1">Organization</p>
              <p className="text-sm font-medium text-[#1A3226]">{org.name}</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 mb-1">Plan</p>
              <p className="text-sm font-medium text-[#1A3226] capitalize">{org.subscription_plan?.replace("_", " ") || "No active plan"}</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 mb-1">Status</p>
              <span className={`text-sm font-medium capitalize ${org.status === "active" ? "text-green-700" : "text-amber-700"}`}>
                {org.status}
              </span>
            </div>
            {quota && !isUnlimited && (
              <div className="rounded-xl bg-[#FAF8F4] px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-[#1A3226]/40 mb-1">Analyses This Month</p>
                <p className="text-sm font-medium text-[#1A3226]">
                  {quota.agent_seats_used ?? 0} / {quota.analyses_included_per_seat_monthly ?? 0} used
                </p>
              </div>
            )}
            {isUnlimited && (
              <div className="rounded-xl bg-[#B8982F]/10 px-4 py-3">
                <p className="text-[10px] uppercase tracking-wider text-[#B8982F]/70 mb-1">Quota</p>
                <p className="text-sm font-medium text-[#B8982F]">Unlimited</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* License Plans — admin only */}
      {isAdmin && (
        <div>
          <h2 className="text-base font-semibold text-[#1A3226] mb-4">License Plans</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {PLANS.map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1A3226]/5 flex items-center justify-center">
                    <plan.icon className="w-5 h-5 text-[#1A3226]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#1A3226]">{plan.name}</p>
                    <p className="text-xs text-[#1A3226]/50">{plan.description}</p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-[#1A3226]">
                  ${plan.price}<span className="text-sm font-normal text-[#1A3226]/40">/{plan.interval}</span>
                </p>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-[#1A3226]/70">
                      <Check className="w-3.5 h-3.5 text-[#B8982F]" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => checkout(plan.priceId)}
                  disabled={!!checkingOut}
                  className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
                >
                  {checkingOut === plan.priceId ? "Redirecting…" : "Subscribe"}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seat Add-ons */}
      <div>
        <h2 className="text-base font-semibold text-[#1A3226] mb-4">Seat Add-ons</h2>
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1A3226]/8 bg-[#FAF8F4]">
                <th className="text-left px-6 py-3 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Seat Type</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Quota</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-[#1A3226]/50 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {SEATS.map((seat, i) => (
                <tr key={seat.id} className={i < SEATS.length - 1 ? "border-b border-[#1A3226]/5" : ""}>
                  <td className="px-6 py-4 font-medium text-[#1A3226]">{seat.name}</td>
                  <td className="px-6 py-4 text-[#1A3226]/60">
                    {seat.quota !== null ? `${seat.quota} analyses/mo` : "No personal quota"}
                  </td>
                  <td className="px-6 py-4 text-right font-semibold text-[#1A3226]">${seat.price}/mo</td>
                  <td className="px-6 py-4 text-right">
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => checkout(seat.priceId)}
                        disabled={!!checkingOut}
                        className="border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
                      >
                        {checkingOut === seat.priceId ? "…" : "Add Seat"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overage Packs */}
      <div>
        <h2 className="text-base font-semibold text-[#1A3226] mb-1">Analysis Overage Packs</h2>
        <p className="text-xs text-[#1A3226]/50 mb-4">One-time purchase — credited to your org immediately on payment.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          {OVERAGE_PACKS.map((pack) => (
            <div
              key={pack.priceId}
              className={`relative rounded-2xl border bg-white p-5 flex flex-col gap-3 ${
                pack.popular ? "border-[#B8982F]/50 shadow-sm" : "border-[#1A3226]/10"
              }`}
            >
              {pack.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#B8982F] text-white text-[10px] font-semibold px-3 py-0.5 rounded-full uppercase tracking-wider">
                  Best Value
                </span>
              )}
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#B8982F]" />
                <p className="font-semibold text-[#1A3226]">{pack.name}</p>
              </div>
              <p className="text-2xl font-bold text-[#1A3226]">${pack.price}</p>
              <p className="text-xs text-[#1A3226]/50">${(pack.price / pack.analyses).toFixed(2)} per analysis</p>
              <Button
                onClick={() => checkout(pack.priceId)}
                disabled={!!checkingOut}
                className={pack.popular ? "bg-[#B8982F] hover:bg-[#B8982F]/90 text-white" : "bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"}
              >
                {checkingOut === pack.priceId ? "Redirecting…" : "Buy Pack"}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}