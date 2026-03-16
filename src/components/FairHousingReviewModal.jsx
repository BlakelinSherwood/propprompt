import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, CheckCircle, Loader2, AlertTriangle, Lock } from "lucide-react";
import ReactMarkdown from "react-markdown";

export default function FairHousingReviewModal({ review, onSigned, onClose }) {
  const [signatureName, setSignatureName] = useState("");
  const [liabilityAccepted, setLiabilityAccepted] = useState(false);
  const [fullRead, setFullRead] = useState(false);
  const [signing, setSigning] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    // Mark as viewed when opened
    if (review?.status === "pending") {
      base44.entities.FairHousingReview.update(review.id, { status: "viewed" }).catch(() => {});
    }
  }, [review?.id]);

  async function handleSign() {
    setSigning(true);
    setError("");
    const res = await base44.functions.invoke("signFairHousingReview", {
      reviewId: review.id,
      signatureName,
      liabilityAccepted: true,
    });
    if (res.data?.success) {
      setSuccess(true);
      setTimeout(() => { onSigned?.(); onClose?.(); }, 2000);
    } else {
      setError(res.data?.error || "Signing failed. Please try again.");
    }
    setSigning(false);
  }

  const canSign = signatureName.trim().length >= 3 && liabilityAccepted && fullRead;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#1A3226]">
            <Shield className="w-5 h-5 text-[#B8982F]" />
            Fair Housing Compliance Review — {review?.review_period_month}
          </DialogTitle>
        </DialogHeader>

        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <CheckCircle className="w-12 h-12 text-emerald-500" />
            <p className="font-semibold text-[#1A3226]">Review signed successfully</p>
            <p className="text-sm text-[#1A3226]/50">Your signature and timestamp have been recorded.</p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Read the full review before signing. Your electronic signature constitutes a legal attestation.
                This document is immutable after signing.
              </span>
            </div>

            <ScrollArea
              className="flex-1 border border-[#1A3226]/10 rounded-xl p-5 bg-[#FAF8F4] text-sm"
              onScroll={(e) => {
                const el = e.currentTarget.querySelector("[data-radix-scroll-area-viewport]") || e.target;
                const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
                if (atBottom) setFullRead(true);
              }}
            >
              <div className="prose prose-sm max-w-none prose-headings:text-[#1A3226] prose-p:text-[#1A3226]/80">
                <ReactMarkdown>{review?.review_text || ""}</ReactMarkdown>
              </div>
            </ScrollArea>

            {!fullRead && (
              <p className="text-xs text-center text-[#1A3226]/40 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Scroll to the bottom to unlock signing
              </p>
            )}

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs text-[#1A3226]/60 mb-1 block">Full Legal Name (as it will appear on the signature record)</label>
                <Input
                  placeholder="e.g. Blake Sherwood"
                  value={signatureName}
                  onChange={(e) => setSignatureName(e.target.value)}
                  className="text-sm"
                  disabled={!fullRead}
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="liability"
                  checked={liabilityAccepted}
                  onCheckedChange={setLiabilityAccepted}
                  disabled={!fullRead}
                />
                <label htmlFor="liability" className="text-xs text-[#1A3226]/70 leading-relaxed cursor-pointer">
                  I have read this fair housing compliance review in full. I acknowledge that this electronic signature
                  constitutes my legal attestation that the information is accurate and complete per Addendum A4.5.
                  I understand this record is permanent and cannot be altered.
                </label>
              </div>

              {error && (
                <p className="text-xs text-red-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {error}
                </p>
              )}

              <div className="flex items-center gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                <Button
                  size="sm"
                  className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2"
                  onClick={handleSign}
                  disabled={!canSign || signing}
                >
                  {signing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                  Sign & Attest
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}