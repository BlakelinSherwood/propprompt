import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Download, Presentation, Mail, Cloud, ExternalLink, Loader2, CheckCircle, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing Analysis",
  buyer_intelligence: "Buyer Intelligence Report",
  investment_analysis: "Investment Analysis",
  cma: "Comparative Market Analysis",
  rental_analysis: "Rental Analysis",
};

export default function ExportPanel({ analysis, onExported }) {
  const { toast } = useToast();
  const [plan, setPlan] = useState(null);  // null = loading
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      const me = await base44.auth.me().catch(() => null);
      if (!me) return;
      const memberships = await base44.entities.OrgMembership.filter({ user_email: me.email, status: "active" }).catch(() => []);
      if (!memberships.length) { setPlan("none"); return; }
      const orgs = await base44.entities.Organization.filter({ id: memberships[0].org_id }).catch(() => []);
      setPlan(orgs[0]?.subscription_plan || "none");
    }
    loadPlan();
  }, []);

  const isPptxAllowed = ["team", "brokerage", "enterprise"].includes(plan);

  const handlePdf = async () => {
    setPdfLoading(true);
    const res = await base44.functions.invoke("generateDocuments", { analysisId: analysis.id, format: "pdf" });
    setPdfLoading(false);
    const url = res?.data?.url;
    if (url) {
      window.open(url, "_blank");
      toast({ title: "PDF ready — opening now.", description: analysis.drive_url ? "Also saved to your Google Drive." : undefined });
      onExported?.();
    } else {
      toast({ title: "PDF generation failed", variant: "destructive" });
    }
  };

  const handlePptx = async () => {
    if (!isPptxAllowed) return;
    setPptxLoading(true);
    const res = await base44.functions.invoke("generateDocuments", { analysisId: analysis.id, format: "pptx" });
    setPptxLoading(false);
    const url = res?.data?.url;
    if (url) {
      window.open(url, "_blank");
      toast({ title: "Presentation ready — opening now.", description: analysis.drive_url ? "Also saved to your Google Drive." : undefined });
      onExported?.();
    } else {
      toast({ title: "Presentation generation failed", variant: "destructive" });
    }
  };

  return (
    <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
      <h2 className="text-sm font-semibold text-[#1A3226] uppercase tracking-widest mb-4">Export</h2>

      <div className="flex flex-wrap gap-3">
        {/* PDF */}
        <Button
          variant="outline"
          onClick={handlePdf}
          disabled={pdfLoading || analysis.status !== "complete"}
          className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
        >
          {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Download PDF
        </Button>

        {/* PPTX */}
        {isPptxAllowed ? (
          <Button
            variant="outline"
            onClick={handlePptx}
            disabled={pptxLoading || analysis.status !== "complete"}
            className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
          >
            {pptxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
            Download Presentation
          </Button>
        ) : plan !== null ? (
          <div title="Upgrade to Pro to export presentations">
            <Button variant="outline" disabled className="gap-2 opacity-50 cursor-not-allowed border-[#1A3226]/10 text-[#1A3226]/40">
              <Lock className="w-4 h-4" />
              Download Presentation
            </Button>
            <p className="text-[10px] text-[#1A3226]/40 mt-1 text-center">Upgrade to Pro</p>
          </div>
        ) : null}

        {/* Email */}
        <Button
          variant="outline"
          onClick={() => setEmailOpen(true)}
          disabled={analysis.status !== "complete"}
          className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
        >
          <Mail className="w-4 h-4" />
          Email to Client
        </Button>
      </div>

      {/* Last export info */}
      {(analysis.last_exported_at || analysis.drive_url) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-[#1A3226]/40">
          {analysis.last_exported_at && (
            <span>
              Last exported: {new Date(analysis.last_exported_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              {analysis.last_export_format && ` as ${analysis.last_export_format.toUpperCase()}`}
            </span>
          )}
          {analysis.drive_url && (
            <a
              href={analysis.drive_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#1A3226]/60 hover:text-[#1A3226] transition-colors"
            >
              <Cloud className="w-3 h-3" />
              Saved in Google Drive
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Email Modal */}
      {emailOpen && (
        <EmailModal
          analysis={analysis}
          onClose={() => setEmailOpen(false)}
          onSent={() => { setEmailOpen(false); onExported?.(); }}
        />
      )}
    </div>
  );
}

function EmailModal({ analysis, onClose, onSent }) {
  const { toast } = useToast();
  const address = analysis.intake_data?.address || "";
  const assessLabel = ASSESSMENT_LABELS[analysis.assessment_type] || "Analysis";

  const [to, setTo] = useState(analysis.intake_data?.client_email || "");
  const [subject, setSubject] = useState(`Your ${assessLabel} — ${address}`);
  const [attachPdf, setAttachPdf] = useState(true);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState(false);

  const handleSend = async () => {
    if (!to) return;
    setSending(true);
    const res = await base44.functions.invoke("sendAnalysisEmail", {
      analysisId: analysis.id,
      toEmail: to,
      subject,
      includePdf: attachPdf,
    });
    setSending(false);
    if (res?.data?.success) {
      toast({ title: `Email sent to ${to}` });
      onSent();
    } else {
      toast({ title: "Failed to send email", description: res?.data?.error, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl p-7 w-full max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-[#1A3226]">Email to Client</h3>
          <button onClick={onClose} className="text-[#1A3226]/40 hover:text-[#1A3226] text-lg leading-none">×</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-[#1A3226]/60 block mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="client@email.com"
              className="w-full border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#1A3226]/60 block mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#1A3226]/70 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={attachPdf}
              onChange={e => setAttachPdf(e.target.checked)}
              className="rounded"
            />
            Attach PDF
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          <button
            onClick={() => setPreview(!preview)}
            className="text-xs text-[#1A3226]/50 hover:text-[#B8982F] underline"
          >
            {preview ? "Hide preview" : "Preview email"}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="text-sm text-[#1A3226]/50 hover:text-[#1A3226] px-3 py-1.5">
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={!to || sending}
              className="flex items-center gap-2 bg-[#1A3226] text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 hover:bg-[#1A3226]/90 transition-colors"
            >
              {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>

        {preview && (
          <div className="mt-2 rounded-lg border border-[#1A3226]/10 bg-[#FAF8F4] p-4 text-xs text-[#1A3226]/60 space-y-1">
            <p><strong className="text-[#1A3226]/80">To:</strong> {to || "—"}</p>
            <p><strong className="text-[#1A3226]/80">Subject:</strong> {subject}</p>
            <p><strong className="text-[#1A3226]/80">Property:</strong> {address}</p>
            <p><strong className="text-[#1A3226]/80">Type:</strong> {assessLabel}</p>
            {attachPdf && <p>📎 PDF will be referenced in email</p>}
            <p className="text-[#1A3226]/40 italic pt-1">Full branded HTML email sent via your organization's branding.</p>
          </div>
        )}
      </div>
    </div>
  );
}