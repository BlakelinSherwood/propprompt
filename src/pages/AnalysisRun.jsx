import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Download, Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft, Cloud, Database, Presentation, Send } from "lucide-react";
import StreamProgressBar from "../components/StreamProgressBar";

const DISCLAIMER = `**DISCLAIMER:** This AI-generated analysis is provided for informational purposes only and does not constitute legal, financial, or professional real estate advice. All valuations and recommendations should be verified by a licensed real estate professional. PropPrompt™ analyses are tools to augment, not replace, professional judgment. © 2026 Sherwood & Company, Brokered by Compass.`;

const ASSESSMENT_LABELS = {
  listing_pricing: "Listing Pricing Analysis",
  buyer_intelligence: "Buyer Intelligence Report",
  investment_analysis: "Investment Analysis",
  cma: "Comparative Market Analysis",
  rental_analysis: "Rental Analysis",
};

export default function AnalysisRun() {
  const navigate = useNavigate();
  const urlParams = new URLSearchParams(window.location.search);
  const analysisId = urlParams.get("id");
  const orgId = urlParams.get("orgId");

  const [analysis, setAnalysis] = useState(null);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState("loading"); // loading | streaming | complete | error
  const [errorMsg, setErrorMsg] = useState("");
  const [keySource, setKeySource] = useState(null);
  const [copied, setCopied] = useState(false);
  const [crmPushing, setCrmPushing] = useState(false);
  const [crmPushed, setCrmPushed] = useState(false);
  const [driveUploading, setDriveUploading] = useState(false);
  const [driveUploaded, setDriveUploaded] = useState(false);
  const [driveUrl, setDriveUrl] = useState(null);
  const [crmConnections, setCrmConnections] = useState([]);
  const [pptxGenerating, setPptxGenerating] = useState(false);
  const [pptxUrl, setPptxUrl] = useState(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const outputRef = useRef(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!analysisId || hasStarted.current) return;
    hasStarted.current = true;
    const abortController = new AbortController();

    async function loadAndStream() {
      // Load analysis metadata
      const records = await base44.entities.Analysis.filter({ id: analysisId });
      const rec = records[0];
      if (!rec) { setStatus("error"); setErrorMsg("Analysis not found."); return; }
      setAnalysis(rec);

      // If already complete, show stored output
      if (rec.status === "complete" && rec.output_text) {
        setOutput(rec.output_text);
        setStatus("complete");
        return;
      }

      // Load CRM connections for this user
      const me = await base44.auth.me().catch(() => null);
      if (me) {
        base44.entities.CrmConnection.filter({ user_email: me.email, status: "connected" })
          .then(setCrmConnections).catch(() => {});
      }
      // Check if analysis already has drive sync
      if (rec.drive_url) setDriveUrl(rec.drive_url);
      if (rec.crm_push_status === "pushed") setCrmPushed(true);

      setStatus("streaming");

      // Build the function URL from appParams (SSE requires raw fetch, not SDK invoke)
      const baseUrl = appParams.appBaseUrl || "";
      const appId = appParams.appId || "";
      const token = appParams.token || "";

      // Route to correct stream handler based on ai_platform
      const PLATFORM_FUNCTIONS = {
        claude:     "claudeStream",
        chatgpt:    "chatgptStream",
        gemini:     "geminiStream",
        perplexity: "perplexityStream",
        grok:       "grokStream",
      };
      const fnName = PLATFORM_FUNCTIONS[rec.ai_platform] || "claudeStream";
      const fnUrl = `${baseUrl}/api/v1/apps/${appId}/functions/${fnName}`;

      const response = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ analysisId, orgId }),
        signal: abortController.signal
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        setErrorMsg(err.error || "Stream failed");
        setStatus("error");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.slice(6));
              if (payload.token) {
                setOutput(prev => prev + payload.token);
                // Auto-scroll
                if (outputRef.current) {
                  outputRef.current.scrollTop = outputRef.current.scrollHeight;
                }
              }
              if (payload.done) {
                setStatus("complete");
                setKeySource(payload.keySource);
              }
              if (payload.error) {
                setErrorMsg(payload.error);
                setStatus("error");
              }
            } catch (_) {}
          }
        }
      }
    }

    loadAndStream().catch(err => {
      if (err.name === 'AbortError') return; // Ignore abort errors
      setErrorMsg(err.message);
      setStatus("error");
    });

    return () => abortController.abort();
  }, [analysisId]);



  const handleCopy = async () => {
    await navigator.clipboard.writeText(output + "\n\n" + DISCLAIMER.replace(/\*\*/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };



  // Server-side branded PDF (white-label)
  const handleDownloadPdf = async () => {
    try {
      const res = await base44.functions.invoke("generateDocuments", { analysisId, format: "pdf" });
      if (res.data?.url) window.open(res.data.url, "_blank");
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to generate PDF. Please try again.");
    }
  };

  const handleDownloadPptx = async () => {
    setPptxGenerating(true);
    try {
      const res = await base44.functions.invoke("generateDocuments", { analysisId, format: "pptx" });
      if (res.data?.url) { setPptxUrl(res.data.url); window.open(res.data.url, "_blank"); }
    } catch (err) {
      console.error("PPTX generation failed:", err);
      alert("Failed to generate PPTX. Please try again.");
    } finally {
      setPptxGenerating(false);
    }
  };

  const handleDriveUpload = async () => {
    setDriveUploading(true);
    try {
      const res = await base44.functions.invoke("driveSync", { analysisId });
      if (res.data?.driveUrl) { setDriveUploaded(true); setDriveUrl(res.data.driveUrl); }
    } catch (err) {
      console.error("Drive upload failed:", err);
      alert("Failed to upload to Drive. Please try again.");
    } finally {
      setDriveUploading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailTo) return;
    setEmailSending(true);
    try {
      await base44.functions.invoke("sendAnalysisEmail", { analysisId, toEmail: emailTo });
      setEmailSent(true);
      setTimeout(() => { setEmailDialogOpen(false); setEmailSent(false); setEmailTo(""); }, 1500);
    } catch (err) {
      console.error("Email send failed:", err);
      alert("Failed to send email. Please try again.");
    } finally {
      setEmailSending(false);
    }
  };

  const handleCrmPush = async () => {
    if (!crmConnections.length) return;
    setCrmPushing(true);
    try {
      const conn = crmConnections[0];
      const res = await base44.functions.invoke("crmPush", { analysisId, connectionId: conn.id });
      if (res.data?.success) setCrmPushed(true);
    } catch (err) {
      console.error("CRM push failed:", err);
      alert("Failed to push to CRM. Please try again.");
    } finally {
      setCrmPushing(false);
    }
  };

  if (!analysisId) {
    return (
      <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">
        No analysis ID provided.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-[#1A3226]/60 hover:text-[#1A3226]">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-[#1A3226]">
              {ASSESSMENT_LABELS[analysis?.assessment_type] || "Analysis"}
            </h1>
            {analysis?.intake_data?.address && (
              <p className="text-sm text-[#1A3226]/50">{analysis.intake_data.address}</p>
            )}
          </div>
        </div>

        {keySource && (
          <span className="text-[10px] uppercase tracking-wider bg-[#1A3226]/5 text-[#1A3226]/50 px-2 py-1 rounded-full">
            {keySource === "sc_managed" ? "S&C Platform Key" : keySource === "org_managed" ? "Org Key" : "Personal Key"}
          </span>
        )}
      </div>

      {/* Progress Bar */}
      <StreamProgressBar status={status} outputLength={output.length} />

      {/* Error State */}
      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-red-700">Analysis failed</p>
            <p className="text-sm text-red-600 mt-1">{errorMsg}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate(-1)}>
              Go back
            </Button>
          </div>
        </div>
      )}

      {/* Output area */}
      {(status === "streaming" || status === "complete") && (
        <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden">
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/95 backdrop-blur border-b border-[#1A3226]/8">
            <div className="flex items-center gap-2">
              {status === "streaming" && (
                <span className="flex items-center gap-1.5 text-xs text-[#B8982F]">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating…
                </span>
              )}
              {status === "complete" && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Complete
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                onClick={handleCopy}
                disabled={!output}
                className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
              >
                {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleDownloadPdf}
                disabled={status !== "complete"}
                className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleDownloadPptx}
                disabled={status !== "complete" || pptxGenerating}
                className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
              >
                {pptxGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
                PPTX
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => setEmailDialogOpen(true)}
                disabled={status !== "complete"}
                className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
              >
                <Mail className="w-3.5 h-3.5" /> Email
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={handleDriveUpload}
                disabled={status !== "complete" || driveUploading || driveUploaded}
                className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
                title={driveUrl ? "View in Drive" : "Upload to Google Drive"}
              >
                {driveUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : driveUploaded ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Cloud className="w-3.5 h-3.5" />}
                {driveUploaded ? <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600">Drive ↗</a> : "Drive"}
              </Button>
              {crmConnections.length > 0 && (
                <Button
                  variant="outline" size="sm"
                  onClick={handleCrmPush}
                  disabled={status !== "complete" || crmPushing || crmPushed}
                  className="h-7 text-xs gap-1.5 border-[#1A3226]/15"
                >
                  {crmPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : crmPushed ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Database className="w-3.5 h-3.5" />}
                  {crmPushed ? "Pushed" : "CRM"}
                </Button>
              )}
            </div>
          </div>

          {/* Markdown output */}
          <div
            ref={outputRef}
            className="p-6 lg:p-8 max-h-[60vh] overflow-y-auto prose prose-sm max-w-none
              prose-headings:text-[#1A3226] prose-headings:font-semibold
              prose-p:text-[#1A3226]/80 prose-p:leading-relaxed
              prose-strong:text-[#1A3226] prose-li:text-[#1A3226]/80
              prose-hr:border-[#1A3226]/10"
          >
            {output ? (
              <ReactMarkdown>{output}</ReactMarkdown>
            ) : (
              <div className="flex items-center gap-3 text-[#1A3226]/40 py-8">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Waiting for response…</span>
              </div>
            )}
          </div>

          {/* Disclaimer footer — always last, visually distinct */}
          {(status === "complete" || output.length > 100) && (
            <div className="px-6 lg:px-8 py-4 bg-[#1A3226]/[0.03] border-t border-[#1A3226]/8">
              <div className="prose prose-xs max-w-none">
                <ReactMarkdown className="text-xs text-[#1A3226]/40 leading-relaxed">
                  {DISCLAIMER}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Email Dialog */}
      {emailDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-[#1A3226]">Send Analysis Report</h3>
            <p className="text-xs text-[#1A3226]/50">The report will be sent with your brokerage/team branding. A PDF will be attached if available.</p>
            <div>
              <label className="text-xs font-medium text-[#1A3226]/70 block mb-1">Recipient Email</label>
              <input
                type="email"
                value={emailTo}
                onChange={e => setEmailTo(e.target.value)}
                placeholder="client@email.com"
                className="w-full border border-[#1A3226]/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1A3226]/30"
                onKeyDown={e => e.key === "Enter" && handleSendEmail()}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEmailDialogOpen(false)}
                className="text-sm text-[#1A3226]/50 hover:text-[#1A3226] px-3 py-1.5"
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={!emailTo || emailSending || emailSent}
                className="flex items-center gap-2 bg-[#1A3226] text-white text-sm px-5 py-2 rounded-lg disabled:opacity-50 hover:bg-[#1A3226]/90 transition-colors"
              >
                {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <CheckCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
                {emailSent ? "Sent!" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}