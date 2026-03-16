import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { appParams } from "@/lib/app-params";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Download, Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft, Cloud, Database } from "lucide-react";
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
  const outputRef = useRef(null);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!analysisId || hasStarted.current) return;
    hasStarted.current = true;

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
        body: JSON.stringify({ analysisId, orgId })
      });

      if (!response.ok) {
        const err = await response.json();
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
      setErrorMsg(err.message);
      setStatus("error");
    });
  }, [analysisId]);



  const handleCopy = async () => {
    await navigator.clipboard.writeText(output + "\n\n" + DISCLAIMER.replace(/\*\*/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(`PropPrompt™ ${ASSESSMENT_LABELS[analysis?.assessment_type] || "Analysis"}`);
    const body = encodeURIComponent(output.substring(0, 2000) + "\n\n[Full analysis attached]");
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  function buildPdfDoc() {
    return import("jspdf").then(({ jsPDF }) => {
      const doc = new jsPDF();
      doc.setFontSize(14);
      doc.text(`PropPrompt™ — ${ASSESSMENT_LABELS[analysis?.assessment_type] || "Analysis"}`, 20, 20);
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(output, 170);
      doc.text(lines, 20, 35);
      doc.setFontSize(8);
      doc.setTextColor(100);
      const discLines = doc.splitTextToSize(DISCLAIMER.replace(/\*\*/g, ""), 170);
      doc.text(discLines, 20, doc.internal.pageSize.height - 30);
      return doc;
    });
  }

  const handleDownloadPdf = async () => {
    const doc = await buildPdfDoc();
    doc.save(`PropPrompt-Analysis-${analysisId}.pdf`);
    await base44.functions.invoke("logPrivacyEvent", {
      event_type: "data_export_delivered",
      entity_type: "Analysis", entity_id: analysisId,
      metadata: { export_type: "pdf" },
    }).catch(() => {});
  };

  const handleDriveUpload = async () => {
    setDriveUploading(true);
    const doc = await buildPdfDoc();
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    const fileName = `PropPrompt-${analysis?.intake_data?.address || analysisId}.pdf`;
    const res = await base44.functions.invoke("driveUpload", { analysisId, pdfBase64, fileName });
    if (res.data?.success) {
      setDriveUploaded(true);
      setDriveUrl(res.data.driveUrl);
    }
    setDriveUploading(false);
  };

  const handleCrmPush = async () => {
    if (!crmConnections.length) return;
    setCrmPushing(true);
    // Push to first active connection (user can expand this later)
    const conn = crmConnections[0];
    const res = await base44.functions.invoke("crmPush", { analysisId, connectionId: conn.id });
    if (res.data?.success) setCrmPushed(true);
    setCrmPushing(false);
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
                onClick={handleEmail}
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
    </div>
  );
}