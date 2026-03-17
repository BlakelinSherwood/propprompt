import { Link } from "react-router-dom";
import { CheckCircle, MapPin, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePricing } from "@/components/pricing/usePricing";

const TYPE_LABELS = {
  single: "Single Territory",
  pool: "Population Pool",
  bundle: "Town Bundle",
  buyout: "Full City Buyout",
};

export default function ClaimSubmitted() {
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get("type") || "single";
  const tier = urlParams.get("tier") || "starter";
  const territory = urlParams.get("territory");
  const city = urlParams.get("city");
  const towns = urlParams.get("towns");
  const price = urlParams.get("price");

  const { pricing } = usePricing();
  const autoApproveHours = parseInt(pricing?.auto_approve_hours || 48);

  const displayName = territory || city || (towns ? `${towns} towns` : "your territory");
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  return (
    <div className="max-w-lg mx-auto py-8">
      <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-8 text-center space-y-6">
        {/* Success icon */}
        <div className="flex items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-emerald-500" />
          </div>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-[#1A3226]">Claim Submitted!</h1>
          <p className="text-sm text-[#1A3226]/60 mt-2">
            We'll review your claim within <strong>{autoApproveHours} hours</strong>. You'll hear from us by email.
          </p>
        </div>

        {/* Claim summary */}
        <div className="rounded-xl bg-[#1A3226]/[0.03] border border-[#1A3226]/8 p-5 text-left space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/50">Claim Type</span>
            <span className="font-medium text-[#1A3226]">{TYPE_LABELS[type] || type}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/50">Territory</span>
            <span className="font-medium text-[#1A3226] text-right max-w-[60%]">{displayName}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/50">Tier</span>
            <span className="font-medium text-[#1A3226]">{tierLabel}</span>
          </div>
          {price && (
            <div className="flex justify-between text-sm">
              <span className="text-[#1A3226]/50">Monthly Price</span>
              <span className="font-medium text-[#1A3226]">${price}/mo</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-[#1A3226]/50">Status</span>
            <span className="text-amber-600 font-medium">Pending Review</span>
          </div>
        </div>

        <p className="text-xs text-[#1A3226]/40">
          Your card will not be charged until your claim is approved. 
          If not reviewed within {autoApproveHours} hours, it will be automatically approved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" className="flex-1 gap-2" asChild>
            <Link to="/territories">
              <Map className="w-4 h-4" /> View Territory Map
            </Link>
          </Button>
          <Button className="flex-1 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2" asChild>
            <Link to="/Dashboard">
              Go to Dashboard →
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}