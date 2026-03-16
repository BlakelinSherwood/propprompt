import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Lock, CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PrivacyNoticeModal({ user, onAccepted }) {
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleAccept() {
    setLoading(true);
    try {
      // Mark privacy notice accepted on user profile
      await base44.auth.updateMe({ privacy_notice_accepted_at: new Date().toISOString() });

      // Log to PrivacyLog
      await base44.functions.invoke("logPrivacyEvent", {
        event_type: "privacy_notice_accepted",
        metadata: { version: "v2.1", accepted_at: new Date().toISOString() },
      });

      onAccepted();
    } catch (e) {
      console.error("Privacy notice error:", e);
      // Don't block the user if logging fails
      onAccepted();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-[#1A3226]/10">
          <div className="w-10 h-10 rounded-xl bg-[#1A3226]/5 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#1A3226]" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-[#1A3226]">Privacy Notice</h2>
            <p className="text-xs text-[#1A3226]/50">PropPrompt™ v2.1 — Please read before continuing</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 text-sm text-[#1A3226]/70 max-h-80 overflow-y-auto">
          <p><strong className="text-[#1A3226]">What we collect and why:</strong></p>
          <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed">
            <li>Property analysis inputs you enter (address, intake data) — used to generate AI analysis</li>
            <li>AI-generated analysis outputs — stored encrypted, accessible only to you and authorized org members</li>
            <li>Usage metadata (analysis types, platform, timestamps) — used for platform analytics in aggregate form only</li>
            <li>Audit logs of key actions (signing, exporting, sharing) — for compliance and security</li>
          </ul>

          <p><strong className="text-[#1A3226]">Your privacy rights:</strong></p>
          <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed">
            <li>You may mark any analysis as <em>Private</em> (if enabled by your org) — private analyses are excluded from all admin and platform analytics views</li>
            <li>Platform owners see only aggregate counts — never individual analysis content, addresses, or outputs</li>
            <li>You may request a full data export or account deletion at any time</li>
            <li>AI analysis outputs are never used to train AI models</li>
          </ul>

          <p><strong className="text-[#1A3226]">Important limitations:</strong></p>
          <ul className="space-y-2 list-disc list-inside text-xs leading-relaxed">
            <li>AI-generated analyses are not appraisals, BPOs, or legal advice</li>
            <li>Brokerage and team administrators can see non-private analyses run within their org</li>
            <li>Do not enter sensitive personal client data (SSN, DOB, financial account numbers) into analysis fields</li>
          </ul>
        </div>

        <div className="px-6 pb-6 pt-4 border-t border-[#1A3226]/10 space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
            />
            <span className="text-xs text-[#1A3226]/70 leading-relaxed">
              I have read and understood the PropPrompt™ Privacy Notice. I agree to use the platform
              in accordance with fair housing laws and the terms described above.
            </span>
          </label>

          <Button
            className="w-full bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
            disabled={!accepted || loading}
            onClick={handleAccept}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            I Understand — Continue to PropPrompt™
          </Button>
        </div>
      </div>
    </div>
  );
}