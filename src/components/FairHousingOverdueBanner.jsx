import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Shield, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import FairHousingReviewModal from "./FairHousingReviewModal";

export default function FairHousingOverdueBanner({ user }) {
  const [overdueReview, setOverdueReview] = useState(null);
  const [pendingReview, setPendingReview] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isReviewer = ["brokerage_admin", "team_lead", "platform_owner"].includes(user?.role);

  useEffect(() => {
    if (!isReviewer || !user) return;

    async function loadReviews() {
      const reviews = await base44.entities.FairHousingReview.filter({
        reviewer_email: user.email,
      });

      const overdue = reviews.find((r) => r.status === "overdue");
      const pending = reviews.find((r) => r.status === "pending" || r.status === "viewed");

      setOverdueReview(overdue || null);
      setPendingReview(pending || null);
    }
    loadReviews();
  }, [user?.email, isReviewer]);

  if (!isReviewer || dismissed) return null;
  if (!overdueReview && !pendingReview) return null;

  const review = overdueReview || pendingReview;
  const isOverdue = !!overdueReview;

  return (
    <>
      <div className={`rounded-xl border px-4 py-3 flex items-start gap-3 mb-4
        ${isOverdue
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
        }`}
      >
        <AlertTriangle className={`w-5 h-5 shrink-0 mt-0.5 ${isOverdue ? "text-red-500" : "text-amber-500"}`} />
        <div className="flex-1 min-w-0">
          <p className={`font-medium text-sm ${isOverdue ? "text-red-700" : "text-amber-700"}`}>
            {isOverdue
              ? `⚠️ Fair Housing Review Overdue — ${review.review_period_month}`
              : `Fair Housing Review Ready to Sign — ${review.review_period_month}`
            }
          </p>
          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-600" : "text-amber-600"}`}>
            {isOverdue
              ? "Your monthly fair housing compliance review is overdue. Please sign it immediately to maintain compliance."
              : "Your monthly fair housing compliance review is ready. Please read and sign at your earliest convenience."
            }
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className={`h-7 text-xs gap-1.5 ${isOverdue
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-amber-600 text-white hover:bg-amber-700"
            }`}
            onClick={() => setShowModal(true)}
          >
            <Shield className="w-3.5 h-3.5" />
            {isOverdue ? "Sign Now" : "Review & Sign"}
          </Button>
          {!isOverdue && (
            <button
              className="text-amber-400 hover:text-amber-600"
              onClick={() => setDismissed(true)}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <FairHousingReviewModal
          review={review}
          onSigned={() => { setOverdueReview(null); setPendingReview(null); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}