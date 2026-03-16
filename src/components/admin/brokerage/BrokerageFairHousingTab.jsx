import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle, Clock, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import FairHousingReviewModal from "../../FairHousingReviewModal";
import moment from "moment";

const STATUS_STYLES = {
  signed:  { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle, color: "text-emerald-500" },
  pending: { bg: "bg-yellow-100 text-yellow-700",   icon: Clock,        color: "text-yellow-500" },
  viewed:  { bg: "bg-blue-100 text-blue-700",        icon: Eye,          color: "text-blue-500" },
  overdue: { bg: "bg-red-100 text-red-700",          icon: AlertTriangle, color: "text-red-500" },
};

export default function BrokerageFairHousingTab({ org, user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openReview, setOpenReview] = useState(null);

  async function loadReviews() {
    const data = await base44.entities.FairHousingReview.filter({ org_id: org.id });
    setReviews(data.sort((a, b) => b.review_period_month.localeCompare(a.review_period_month)));
    setLoading(false);
  }

  useEffect(() => { loadReviews(); }, [org.id]);

  const canSign = (review) =>
    review.reviewer_email === user.email && review.status !== "signed";

  if (loading) return <div className="text-sm text-[#1A3226]/50 py-8 text-center">Loading reviews…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 text-xs text-[#1A3226]/60 bg-[#1A3226]/[0.03] border border-[#1A3226]/10 rounded-xl p-4">
        <Shield className="w-4 h-4 shrink-0 mt-0.5 text-[#B8982F]" />
        <p>Monthly fair housing compliance reviews are generated automatically on the 1st of each month. The designated reviewer must sign each review. Signed reviews are permanent and immutable.</p>
      </div>

      {reviews.length === 0 && (
        <div className="text-center text-sm text-[#1A3226]/40 py-12">
          No reviews yet. Reviews are generated on the 1st of each month.
        </div>
      )}

      <div className="space-y-2">
        {reviews.map((r) => {
          const style = STATUS_STYLES[r.status] || STATUS_STYLES.pending;
          const Icon = style.icon;
          return (
            <div key={r.id} className="rounded-xl border border-[#1A3226]/10 bg-white px-5 py-4 flex items-center gap-4">
              <Icon className={`w-5 h-5 shrink-0 ${style.color}`} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-[#1A3226]">
                  Fair Housing Review — {r.review_period_month}
                </p>
                <p className="text-xs text-[#1A3226]/50 mt-0.5">
                  Reviewer: {r.reviewer_email} ·{" "}
                  {r.signed_at
                    ? `Signed ${moment(r.signed_at).format("MMM D, YYYY [at] h:mma")} by ${r.signature_name}`
                    : `Generated ${moment(r.created_date).format("MMM D, YYYY")}`
                  }
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${style.bg}`}>
                {r.status}
              </span>
              <Button
                variant="outline" size="sm" className="h-7 text-xs shrink-0"
                onClick={() => setOpenReview(r)}
              >
                {canSign(r) ? "Review & Sign" : "View"}
              </Button>
            </div>
          );
        })}
      </div>

      {openReview && (
        <FairHousingReviewModal
          review={openReview}
          onSigned={loadReviews}
          onClose={() => setOpenReview(null)}
        />
      )}
    </div>
  );
}