import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Copy, Download, Mail, CheckCircle, AlertCircle, Loader2, ArrowLeft, Cloud, Database, Presentation, Send, Link, ExternalLink } from "lucide-react";
import ValuationAnomalyModal from "../components/ValuationAnomalyModal";
import StreamProgressBar from "../components/StreamProgressBar";
import AnalysisLoadingScreen from "../components/AnalysisLoadingScreen";

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
  const [branding, setBranding] = useState({ primary: "#1A3226", accent: "#B8982F" });
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
  const [flipbookLink, setFlipbookLink] = useState(null); // existing active link
  const [flipbookGenerating, setFlipbookGenerating] = useState(false);
  const [flipbookCopied, setFlipbookCopied] = useState(false);
  const [anomalyData, setAnomalyData] = useState(null);
  const outputRef = useRef(null);
  const hasStarted = useRef(false);

  // Simulate typing effect from full text
  function simulateTyping(fullText) {
    const chunkSize = 12;
    let pos = 0;
    setOutput("");
    const interval = setInterval(() => {
      if (pos >= fullText.length) {
        clearInterval(interval);
        setStatus("complete");
        return;
      }
      const chunk = fullText.slice(pos, pos + chunkSize);
      pos += chunkSize;
      setOutput(prev => prev + chunk);
      if (outputRef.current) {
        outputRef.current.scrollTop = outputRef.current.scrollHeight;
      }
    }, 16);
  }

  useEffect(() => {
    if (!analysisId || hasStarted.current) return;
    hasStarted.current = true;

    async function loadAndRun() {
      // Load analysis metadata
      const records = await base44.entities.Analysis.filter({ id: analysisId });
      const rec = records[0];
      if (!rec) { setStatus("error"); setErrorMsg("Analysis not found."); return; }
      setAnalysis(rec);

      // Load branding colors
      try {
        const brands = await base44.asServiceRole.entities.BrandingConfig.filter({ org_id: rec.org_id || "default" });
        if (brands[0]) setBranding({ primary: brands[0].primary_color, accent: brands[0].accent_color });
      } catch (e) { /* use defaults */ }

      // If already complete with comps, show stored output with typing effect
      // If complete but no comps, reset and re-run to get proper comp data
      const hasComps = rec.agent_comps && rec.agent_comps.length > 0;
      if (rec.status === "complete" && rec.output_text && hasComps) {
        setStatus("streaming");
        simulateTyping(rec.output_text);
        return;
      }
      // Reset status so generateAnalysis re-runs fresh
      if (rec.status === "complete" && !hasComps) {
        await base44.entities.Analysis.update(rec.id, { status: "draft", output_text: null, output_json: null });
      }

      // Load CRM connections
      const me = await base44.auth.me().catch(() => null);
      if (me) {
        base44.entities.CrmConnection.filter({ user_email: me.email, status: "connected" })
          .then(setCrmConnections).catch(() => {});
      }
      if (rec.drive_url) setDriveUrl(rec.drive_url);
      if (rec.crm_push_status === "pushed") setCrmPushed(true);

      // Load existing flipbook link for this analysis
      try {
        const links = await base44.entities.FlipbookLink.filter({ analysis_id: analysisId });
        const now = new Date().toISOString();
        const active = links.find(l => !l.is_expired && l.expires_at > now);
        if (active) setFlipbookLink(active);
      } catch (e) { /* non-fatal */ }

      setStatus("streaming");

      // Fire generateAnalysis — don't await the full response (may 504 on long analyses)
      // Instead, poll the Analysis entity for completion every 4 seconds
      base44.functions.invoke("generateAnalysis", { analysisId, orgId }).then(res => {
        // If the invoke returns before polling catches it, handle it directly
        if (res.data?.anomaly) {
          setAnomalyData(res.data.anomaly);
          setStatus("complete");
        } else if (res.data?.output) {
          setKeySource(res.data.keySource);
          simulateTyping(res.data.output);
        }
        // If it 504'd, the polling loop below will catch completion
      }).catch(() => {
        // 504 / network error — polling will detect completion
      });

      // Poll the Analysis entity every 4 seconds for up to 5 minutes
      const maxAttempts = 75; // 75 × 4s = 5 min
      let attempts = 0;
      await new Promise((resolve) => {
        const poll = setInterval(async () => {
          attempts++;
          try {
            const records = await base44.entities.Analysis.filter({ id: analysisId });
            const latest = records[0];
            if (!latest) { clearInterval(poll); resolve(); return; }

            if (latest.status === 'anomaly_flagged' && latest.valuation_anomaly) {
              clearInterval(poll);
              setAnomalyData(latest.valuation_anomaly);
              setStatus("complete");
              resolve();
              return;
            }

            if (latest.status === 'complete' && latest.output_text) {
              clearInterval(poll);
              simulateTyping(latest.output_text);
              resolve();
              return;
            }

            if (latest.status === 'error') {
              clearInterval(poll);
              setErrorMsg("Analysis generation failed. Please try again.");
              setStatus("error");
              resolve();
              return;
            }
          } catch (e) { /* poll silently */ }

          if (attempts >= maxAttempts) {
            clearInterval(poll);
            setErrorMsg("Analysis is taking longer than expected. Please check back in a moment — your report may still be generating.");
            setStatus("error");
            resolve();
          }
        }, 4000);
      });
    }

    loadAndRun().catch(err => {
      setErrorMsg(err.message || "Unexpected error");
      setStatus("error");
    });
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

  const handleShareFlipbook = async () => {
    // Reuse existing active link
    const now = new Date().toISOString();
    if (flipbookLink && !flipbookLink.is_expired && flipbookLink.expires_at > now) return;

    setFlipbookGenerating(true);
    try {
      const res = await base44.functions.invoke('createFlipbook', { analysisId });
      if (!res.data?.record) throw new Error(res.data?.error || 'Flipbook creation failed');
      setFlipbookLink(res.data.record);
    } catch (err) {
      console.error('[flipbook] error:', err);
      alert('Couldn\'t generate flipbook link — please try again.');
    } finally {
      setFlipbookGenerating(false);
    }
  };

  function getFlipbookUrl(token) {
    return `${window.location.origin}/flipbook/${token}`;
  }

  function isLinkActive(link) {
    if (!link) return false;
    const now = new Date().toISOString();
    return !link.is_expired && link.expires_at > now;
  }

  const handleCopyFlipbook = async () => {
    await navigator.clipboard.writeText(getFlipbookUrl(flipbookLink.share_token));
    setFlipbookCopied(true);
    setTimeout(() => setFlipbookCopied(false), 2000);
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

  function handleReviewComps() {
    setAnomalyData(null);
    // Navigate back to the wizard on the Comparable Sales step (step 4)
    navigate(`/NewAnalysis?review=${analysisId}`);
  }

  function handleOverrideConfirmed() {
    setAnomalyData(null);
    // Reload analysis to get updated status then trigger PDF
    window.location.reload();
  }

  if (!analysisId) {
    return (
      <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">
        No analysis ID provided.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Show loading screen during generation and initial streaming */}
      {(status === "loading" || status === "streaming") && !output && (
        <AnalysisLoadingScreen
          status={status}
          primaryColor={branding.primary}
          accentColor={branding.accent}
          onComplete={() => {
            // Loading screen will auto-hide when analysis completes
          }}
        />
      )}

      {anomalyData && (
        <ValuationAnomalyModal
          anomalyData={anomalyData}
          analysisId={analysisId}
          onReviewComps={handleReviewComps}
          onOverrideConfirmed={handleOverrideConfirmed}
        />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-[#1A3226]/60 hover:text-[#1A3226] flex-shrink-0">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold text-[#1A3226] truncate">
              {ASSESSMENT_LABELS[analysis?.assessment_type] || "Analysis"}
            </h1>
            {analysis?.intake_data?.address && (
              <p className="text-xs sm:text-sm text-[#1A3226]/50 truncate">{analysis.intake_data.address}</p>
            )}
          </div>
        </div>
        {keySource && (
          <span className="text-[10px] uppercase tracking-wider bg-[#1A3226]/5 text-[#1A3226]/50 px-2 py-1 rounded-full self-start sm:self-auto flex-shrink-0">
            {keySource === "sc_managed" ? "S&C Key" : keySource === "org_managed" ? "Org Key" : "Personal Key"}
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
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-[#1A3226]/8 px-3 sm:px-5 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {status === "streaming" && (
                  <span className="flex items-center gap-1 text-xs text-[#B8982F]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="hidden sm:inline">Generating…</span>
                  </span>
                )}
                {status === "complete" && (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Complete</span>
                  </span>
                )}
              </div>
              {/* Scrollable button row on mobile */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide flex-1 justify-end">
                <Button variant="outline" size="sm" onClick={handleCopy} disabled={!output}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  {copied ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={status !== "complete"}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">PDF</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPptx} disabled={status !== "complete" || pptxGenerating}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  {pptxGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Presentation className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">PPTX</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)} disabled={status !== "complete"}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  <Mail className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Email</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDriveUpload}
                  disabled={status !== "complete" || driveUploading || driveUploaded}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  {driveUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : driveUploaded ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Cloud className="w-3.5 h-3.5" />}
                  {driveUploaded
                    ? <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-600 hidden sm:inline">Drive ↗</a>
                    : <span className="hidden sm:inline">Drive</span>}
                </Button>
                <Button variant="outline" size="sm"
                  onClick={handleShareFlipbook}
                  disabled={status !== "complete" || flipbookGenerating || isLinkActive(flipbookLink)}
                  className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                  {flipbookGenerating
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span className="hidden sm:inline">Generating…</span></>
                    : isLinkActive(flipbookLink)
                    ? <><Link className="w-3.5 h-3.5 text-emerald-500" /><span className="hidden sm:inline">Link active</span></>
                    : <><Link className="w-3.5 h-3.5" /><span className="hidden sm:inline">Flipbook</span></>}
                </Button>
                {crmConnections.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleCrmPush}
                    disabled={status !== "complete" || crmPushing || crmPushed}
                    className="h-7 text-xs gap-1 border-[#1A3226]/15 flex-shrink-0">
                    {crmPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : crmPushed ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> : <Database className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{crmPushed ? "Pushed" : "CRM"}</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Markdown output */}
          <div
            ref={outputRef}
            className="p-4 sm:p-6 lg:p-8 max-h-[65vh] overflow-y-auto overflow-x-hidden prose prose-sm max-w-none
              prose-headings:text-[#1A3226] prose-headings:font-semibold prose-headings:break-words
              prose-p:text-[#1A3226]/80 prose-p:leading-relaxed prose-p:break-words
              prose-strong:text-[#1A3226] prose-li:text-[#1A3226]/80 prose-li:break-words
              prose-table:w-full prose-table:text-xs
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

          {/* Flipbook success panel */}
          {isLinkActive(flipbookLink) && (
            <div className="px-4 sm:px-6 py-4 border-t border-[#1A3226]/8 bg-emerald-50">
              <p className="text-xs font-semibold text-emerald-700 mb-1">
                Flipbook link ready — expires {new Date(flipbookLink.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {flipbookLink.view_count > 0 && <span className="ml-2 font-normal text-emerald-600">· {flipbookLink.view_count} view{flipbookLink.view_count !== 1 ? 's' : ''} so far</span>}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <input
                  readOnly
                  value={getFlipbookUrl(flipbookLink.share_token)}
                  className="flex-1 text-xs border border-emerald-200 rounded-lg px-3 py-1.5 bg-white text-[#1A3226]/70 focus:outline-none min-w-0"
                />
                <button
                  onClick={handleCopyFlipbook}
                  className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg bg-[#1A3226] text-white hover:bg-[#1A3226]/90 transition"
                >
                  {flipbookCopied ? 'Copied!' : 'Copy link'}
                </button>
                <a
                  href={getFlipbookUrl(flipbookLink.share_token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[#1A3226]/20 text-[#1A3226] hover:bg-[#1A3226]/5 transition"
                >
                  <ExternalLink className="w-3 h-3" /> Open preview
                </a>
              </div>
            </div>
          )}

          {/* Disclaimer footer — always last, visually distinct */}
          {(status === "complete" || output.length > 100) && (
            <div className="px-4 sm:px-6 lg:px-8 py-4 bg-[#1A3226]/[0.03] border-t border-[#1A3226]/8">
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