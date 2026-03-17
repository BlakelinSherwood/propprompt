import { useFounderProfile } from "@/lib/useFounderProfile";
import { Shield } from "lucide-react";

export default function PaymentTrustBlock() {
  const { founder, loading } = useFounderProfile();

  if (loading || !founder) return null;

  return (
    <div className="rounded-xl border border-[#1A3226]/20 bg-[#1A3226]/5 p-5 mb-6">
      <div className="flex gap-3 mb-4">
        <Shield className="w-5 h-5 text-[#B8982F] flex-shrink-0 mt-0.5" />
        <h3 className="font-semibold text-[#1A3226]">Why agents trust PropPrompt</h3>
      </div>
      <p className="text-sm text-[#1A3226]/80 leading-relaxed mb-3">
        <span className="italic">
          "PropPrompt was built by {founder.founder_name}, a licensed real estate broker and team lead with{" "}
          {founder.years_experience} years in New England real estate. Every feature was designed around how real
          agents actually work."
        </span>
      </p>
      <p className="text-xs text-[#1A3226]/60 space-x-3">
        <span>🔒 Secure payment</span>
        <span>·</span>
        <span>Cancel anytime</span>
        <span>·</span>
        <span>Approval required before charge</span>
      </p>
    </div>
  );
}