import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, X, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import FairHousingReviewModal from "./FairHousingReviewModal";

export default function FairHousingBanner({ user }) {
  const [overdueReview, setOverdueReview] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!user?.email) return;
    const eligibleRoles = ["brokerage_admin", "team_lead"];
    if (!eligibleRoles.includes(user.role)) return;

    base44.entities.FairHousingReview.filter({ reviewer_email: user.email })
      .then((reviews) => {
        const overdue = reviews.find((r) => r.status === "overdue");
        if (overdue) setOverdueReview(overdue);
      })
      .catch(() => {});
  }, [user]);

  if (!overdueReview || dismissed) return null;

  return (
    <>
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700">Fair Housing Review Overdue</p>
          <p className="text-xs text-red-600 mt-0.5">
            Your Fair Housing Compliance Review for <strong>{overdueReview.review_period_month}</strong> requires
            your e-signature. This is required to maintain compliance for your organization.
          </p>
          <Button
            size="sm"
            className="mt-2 bg-red-600 hover:bg-red-700 text-white h-7 text-xs gap-1.5"
            onClick={() => setShowModal(true)}
          >
            <Shield className="w-3.5 h-3.5" />
            Review & Sign Now
          </Button>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-red-400 hover:text-red-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {showModal && (
        <FairHousingReviewModal
          review={overdueReview}
          user={user}
          onClose={() => setShowModal(false)}
          onSigned={() => {
            setOverdueReview(null);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
}