import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, Presentation, Mail, Loader2, CheckCircle, ExternalLink, Cloud } from "lucide-react";

const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing Analysis",
  buyer_intelligence: "Buyer Intelligence Report",
  investment_analysis: "Investment Analysis",
  cma: "Comparative Market Analysis",
  rental_analysis: "Rental Analysis",
};

export default function ExportPanel({ analysis, orgPlan }) {
  const { toast } = useToast();
  const [pdfLoading, setPdfLoading] = useState(false);
  const [abridgedLoading, setAbridgedLoading] = useState(false);
  const [pptxLoading, setPptxLoading] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailTo, setEmailTo] = useState(analysis?.intake_data?.contact_email || "");
  const [emailSubject, setEmailSubject] = useState(
    `Your ${ASSESSMENT_LABELS[analysis?.assessment_type] || "Analysis"} — ${analysis?.intake_data?.address || ""}`
  );
  const [attachPdf, setAttachPdf] = useState(true);
  const [emailSending, setEmailSending] = useState(false);

  const isPro = ["team", "brokerage", "enterprise"].includes(orgPlan);

  const handlePdf = async () => {
    setPdfLoading(true);
    const res = await base44.functions.invoke("generateDocuments", { analysisId: analysis.id, format: "pdf" });
    setPdfLoading(false);
    const url = res.data?.url;
    if (url) {
      window.open(url, "_blank");
      toast({ title: "PDF ready — opening now.", description: res.data?.driveUrl ? "Also saved to your Google Drive." : undefined });
    }
  };

  const handleAbridgedPdf = async () => {
    setAbridgedLoading(true);
    const res = await base44.functions.invoke("generateDocuments", { analysisId: analysis.id, format: "pdf", subFormat: "abridged" });
    setAbridgedLoading(false);
    const url = res.data?.url;
    if (url) {
      window.open(url, "_blank");
      toast({ title: "Abridged PDF ready — opening now." });
    }
  };

  const handlePptx = async () => {
    setPptxLoading(true);
    const res = await base44.functions.invoke("generateDocuments", { analysisId: analysis.id, format: "pptx" });
    setPptxLoading(false);
    const url = res.data?.url;
    if (url) {
      window.open(url, "_blank");
      toast({ title: "Presentation ready — opening now.", description: res.data?.driveUrl ? "Also saved to your Google Drive." : undefined });
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) return;
    setEmailSending(true);
    await base44.functions.invoke("sendAnalysisEmail", {
      analysisId: analysis.id,
      toEmail: emailTo,
      subject: emailSubject,
      includePdf: attachPdf,
      contactName: analysis?.intake_data?.contact_name || "",
    });
    setEmailSending(false);
    setEmailOpen(false);
    toast({ title: `Email sent to ${emailTo}` });
  };

  const lastExported = analysis?.last_exported_at
    ? new Date(analysis.last_exported_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <>
      <div className="rounded-xl border border-[#1A3226]/10 bg-white p-5">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4 uppercase tracking-wider">Export</h3>

        <div className="flex flex-wrap gap-2">
          {/* PDF */}
          <Button
            variant="outline"
            size="sm"
            onClick={handlePdf}
            disabled={pdfLoading}
            className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>

          {/* Abridged PDF — portfolio only */}
          {analysis?.assessment_type === "client_portfolio" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAbridgedPdf}
              disabled={abridgedLoading}
              className="gap-2 border-[#B8982F]/40 text-[#B8982F] hover:bg-[#B8982F]/5"
            >
              {abridgedLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Abridged PDF (2–3 pg)
            </Button>
          )}

          {/* PPTX */}
          {isPro ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handlePptx}
              disabled={pptxLoading}
              className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
            >
              {pptxLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Presentation className="w-4 h-4" />}
              Download Presentation
            </Button>
          ) : (
            <div className="relative group">
              <Button
                variant="outline"
                size="sm"
                disabled
                className="gap-2 border-[#1A3226]/10 text-[#1A3226]/30 cursor-not-allowed"
              >
                <Presentation className="w-4 h-4" />
                Download Presentation
              </Button>
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 text-center bg-[#1A3226] text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
                Upgrade to Pro to export presentations
              </div>
            </div>
          )}

          {/* Email */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEmailOpen(true)}
            className="gap-2 border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5"
          >
            <Mail className="w-4 h-4" />
            Email to Client
          </Button>
        </div>

        {/* Last exported / Drive link */}
        {(lastExported || analysis?.drive_url) && (
          <div className="mt-3 flex items-center gap-3 flex-wrap">
            {lastExported && (
              <span className="text-xs text-[#1A3226]/40">
                Last exported: {lastExported} as {analysis.last_export_format}
              </span>
            )}
            {analysis?.drive_url && (
              <a
                href={analysis.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
              >
                <Cloud className="w-3.5 h-3.5" />
                Saved in Google Drive
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Email Modal */}
      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-[#1A3226]/10">
              <h3 className="text-base font-semibold text-[#1A3226]">Email to Client</h3>
              <p className="text-xs text-[#1A3226]/50 mt-1">
                Sends a branded report with key findings to your client.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#1A3226]/70 mb-1">To</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="client@email.com"
                  className="w-full border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#1A3226]/70 mb-1">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  className="w-full border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={attachPdf}
                  onChange={e => setAttachPdf(e.target.checked)}
                  className="rounded border-[#1A3226]/20"
                />
                <span className="text-sm text-[#1A3226]/70">Attach PDF report</span>
              </label>
            </div>

            <div className="px-6 pb-6 flex justify-end gap-3">
              <button
                onClick={() => setEmailOpen(false)}
                className="text-sm text-[#1A3226]/50 hover:text-[#1A3226] px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailTo || emailSending}
                className="flex items-center gap-2 bg-[#1A3226] text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 hover:bg-[#1A3226]/90 transition-colors"
              >
                {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {emailSending ? "Sending…" : "Send Email"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}