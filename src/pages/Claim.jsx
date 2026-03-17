import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { usePricing } from "@/components/pricing/usePricing";
import { Loader2 } from "lucide-react";
import ClaimTypeSelector from "../components/claim/ClaimTypeSelector";
import SingleFlow from "../components/claim/SingleFlow";
import PoolFlow from "../components/claim/PoolFlow";
import BundleFlow from "../components/claim/BundleFlow";
import BuyoutFlow from "../components/claim/BuyoutFlow";

export default function Claim() {
  const navigate = useNavigate();
  const { pricing, loading: pricingLoading } = usePricing();
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const urlParams = new URLSearchParams(window.location.search);
  const typeParam = urlParams.get("type"); // single | pool | bundle | buyout
  const territoryId = urlParams.get("territory_id");

  const [claimType, setClaimType] = useState(typeParam || null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {}).finally(() => setUserLoading(false));
  }, []);

  const handleSelectType = (type) => {
    setClaimType(type);
    navigate(`/claim?type=${type}${territoryId ? `&territory_id=${territoryId}` : ""}`, { replace: true });
  };

  if (pricingLoading || userLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <Loader2 className="w-7 h-7 animate-spin text-[#1A3226]/40" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-4">
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 lg:p-8">
        {!claimType && (
          <ClaimTypeSelector pricing={pricing} onSelect={handleSelectType} />
        )}

        {claimType === "single" && (
          <SingleFlow pricing={pricing} territoryId={territoryId} user={user} />
        )}

        {claimType === "pool" && (
          <PoolFlow pricing={pricing} user={user} />
        )}

        {claimType === "bundle" && (
          <BundleFlow pricing={pricing} user={user} />
        )}

        {claimType === "buyout" && (
          <BuyoutFlow pricing={pricing} territoryId={territoryId} user={user} />
        )}
      </div>
    </div>
  );
}