import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Shield, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import ReactMarkdown from "react-markdown";

export default function FairHousingReviewModal({ review, user, onClose, onSigned }) {
  const [step, setStep] = useState("read"); // read → confirm → done
  const [signatureName, setSignatureName] = useState(user?.full_name || "");
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);

  function handleScroll(e) {
    const el = e.target;
    if (el.scrollHeight - el.scrollTop <= el.clientHeight + 40) {
      setScrolledToBottom(true);
    }
  }

  async function handleSign() {
    if (!signatureName.trim()) {
      setError("Please type your full name to sign.");
      return;
    }
    if (!liabilityAccepted) {
      setError("You must accept the liability disclosure.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke("signFairHousingReview", {
        reviewId: review.id,
        signatureName: signatureName.trim(),
        liabilityAccepted: true,
      });
      if (res.data?.success) {
        setStep("done");
      } else {
        setError(res.data?.error || "Signing failed. Please try again.");
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1A3226]/10">
          <div className="w-9 h-9 rounded-lg bg-[#1A3226]/5 flex items-center justify-center">
            <Shield className="w-5 h-5 text-[#1A3226]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1A3226]">Fair Housing Compliance Review</h2>
            <p className="text-xs text-[#1A3226]/50">Period: {review.review_period_month}</p>
          </div>
        </div>

        {step === "done" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-semibold text-[#1A3226]">Review Signed</h3>
            <p className="text-sm text-[#1A3226]/60 max-w-sm">
              Your Fair Housing Compliance Review for {review.review_period_month} has been signed and recorded.
              A secure audit log with timestamp and content hash has been saved.
            </p>
            <Button className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white" onClick={() => { onSigned(); onClose(); }}>
              Done
            </Button>
          </div>
        ) : (
          <>
            {/* Review content */}
            <div
              className="flex-1 overflow-y-auto px-6 py-4 prose prose-sm max-w-none text-[#1A3226]/80"
              style={{ minHeight: 0 }}
              onScroll={handleScroll}
            >
              <ReactMarkdown>{review.review_text || "Loading review…"}</ReactMarkdown>
              <div className="h-4" />
            </div>

            {/* Signature section */}
            <div className="border-t border-[#1A3226]/10 px-6 py-4 bg-[#FAF8F4] rounded-b-2xl space-y-4">
              {!scrolledToBottom && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Please scroll through the entire review before signing.
                </p>
              )}

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={liabilityAccepted}
                  onChange={(e) => setLiabilityAccepted(e.target.checked)}
                />
                <span className="text-xs text-[#1A3226]/70 leading-relaxed">
                  I acknowledge that I have read this Fair Housing Compliance Review in its entirety.
                  I understand this review is AI-generated for educational purposes and does not constitute
                  legal advice. I accept responsibility for my organization's fair housing compliance.
                </span>
              </label>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#1A3226]/70">Type your full legal name to sign:</label>
                <Input
                  placeholder="Full name"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="max-w-xs"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
                  disabled={!scrolledToBottom || !liabilityAccepted || !signatureName.trim() || loading}
                  onClick={handleSign}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Sign & Acknowledge
                </Button>
                <button onClick={onClose} className="text-sm text-[#1A3226]/40 hover:text-[#1A3226]/70 transition-colors">
                  Remind me later
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}