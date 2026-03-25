import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Download, ChevronLeft, ChevronRight } from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── state screens ─────────────────────────────────────────────────────────────

function Screen({ heading, body }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <h1 className="text-2xl font-bold text-gray-800 mb-3">{heading}</h1>
        <p className="text-gray-500 text-sm leading-relaxed">{body}</p>
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export default function FlipbookViewer() {
  const { token } = useParams();

  const [status, setStatus] = useState('loading'); // loading | not_found | expired | ready
  const [flipbook, setFlipbook] = useState(null);
  const [branding, setBranding] = useState({ primary_color: '#1A3226', accent_color: '#B8982F', org_logo_url: null, agent_name: '' });
  const [pdfReady, setPdfReady] = useState(false);
  const [useFallback, setUseFallback] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [scriptsLoaded, setScriptsLoaded] = useState(false);

  const flipRef = useRef(null);      // StPageFlip instance
  const containerRef = useRef(null); // flipbook DOM container

  // ── 1. Load flipbook record ─────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      if (!token) { setStatus('not_found'); return; }

      const records = await base44.entities.FlipbookLink.filter({ share_token: token });
      const record = records[0];

      if (!record) { setStatus('not_found'); return; }

      const now = new Date().toISOString();
      const isReallyExpired = record.is_expired || (record.expires_at && record.expires_at <= now);

      if (isReallyExpired) { setStatus('expired'); return; }

      // Increment view_count (best-effort, don't block render)
      base44.entities.FlipbookLink.update(record.id, { view_count: (record.view_count || 0) + 1 }).catch(() => {});

      setFlipbook(record);

      // Resolve branding
      try {
        const res = await base44.functions.invoke('resolveBranding', { analysisId: record.analysis_id });
        if (res?.data?.branding) setBranding(res.data.branding);
      } catch (e) { /* use defaults */ }

      setStatus('ready');
    }
    init();
  }, [token]);

  // ── 2. Load PDF.js + StPageFlip, then render ────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !flipbook?.pdf_public_url) return;

    async function renderFlipbook() {
      try {
        await Promise.all([
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'),
          loadScript('https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js'),
        ]);
        setScriptsLoaded(true);
      } catch (e) {
        console.warn('[FlipbookViewer] CDN scripts failed — using iframe fallback', e);
        setUseFallback(true);
        setPdfReady(true);
      }
    }
    renderFlipbook();
  }, [status, flipbook]);

  // ── 3. Render PDF pages once scripts are ready ──────────────────────────────
  useEffect(() => {
    if (!scriptsLoaded || !flipbook?.pdf_public_url || !containerRef.current) return;

    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if (!pdfjsLib) { setUseFallback(true); setPdfReady(true); return; }

    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

    async function render() {
      try {
        const pdf = await pdfjsLib.getDocument({ url: flipbook.pdf_public_url, withCredentials: false }).promise;
        setTotalPages(pdf.numPages);

        // Clear container
        const container = containerRef.current;
        container.innerHTML = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport }).promise;

          const div = document.createElement('div');
          div.className = 'page-flip-page';
          div.appendChild(canvas);
          container.appendChild(div);
        }

        // Initialize StPageFlip
        const PageFlip = window.St?.PageFlip;
        if (!PageFlip) { setUseFallback(true); setPdfReady(true); return; }

        const pf = new PageFlip(container, {
          width: 550, height: 733,
          showCover: true,
          mobileScrollSupport: true,
          autoSize: true,
        });

        const pages = Array.from(container.querySelectorAll('.page-flip-page'));
        pf.loadFromHTML(pages);

        pf.on('flip', (e) => setCurrentPage(e.data + 1));
        flipRef.current = pf;
        setPdfReady(true);
      } catch (e) {
        console.warn('[FlipbookViewer] StPageFlip render failed — fallback', e);
        setUseFallback(true);
        setPdfReady(true);
      }
    }
    render();
  }, [scriptsLoaded, flipbook]);

  // ── nav handlers ────────────────────────────────────────────────────────────
  function prevPage() {
    if (useFallback) return;
    if (flipRef.current) { flipRef.current.flipPrev(); }
    else setCurrentPage(p => Math.max(1, p - 1));
  }
  function nextPage() {
    if (useFallback) return;
    if (flipRef.current) { flipRef.current.flipNext(); }
    else setCurrentPage(p => Math.min(totalPages, p + 1));
  }

  // ── state screens ────────────────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Loading…</p>
        </div>
      </div>
    );
  }
  if (status === 'not_found') return <Screen heading="Link not found" body="This flipbook link doesn't exist or may have been mistyped." />;
  if (status === 'expired') return <Screen heading="This link has expired" body="Flipbook links are available for 7 days after they are created. Ask your agent to generate a new link." />;

  const primary = branding.primary_color || '#1A3226';
  const accent = branding.accent_color || '#B8982F';

  return (
    <div className="min-h-screen flex flex-col bg-gray-100">
      {/* ── Header ── */}
      <header style={{ backgroundColor: primary }} className="flex items-center justify-between px-6 py-3 shadow-md">
        <div className="flex items-center gap-3">
          {branding.org_logo_url ? (
            <img src={branding.org_logo_url} alt="Logo" style={{ maxHeight: 32, objectFit: 'contain' }} />
          ) : (
            <span style={{ color: accent }} className="text-sm font-bold tracking-wide">
              {branding.agent_name || ''}
            </span>
          )}
          {branding.agent_title && (
            <span className="text-white/60 text-xs hidden sm:inline">· {branding.agent_title}</span>
          )}
        </div>
        <span className="text-white/60 text-xs">
          Available until {fmtDate(flipbook?.expires_at)}
        </span>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 flex flex-col items-center justify-center py-8 px-4">
        {/* Loading overlay */}
        {!pdfReady && (
          <div className="flex flex-col items-center gap-4 my-16">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-gray-500 text-sm">Preparing your presentation…</p>
          </div>
        )}

        {/* Flipbook or fallback iframe */}
        {pdfReady && (
          <>
            {useFallback ? (
              <iframe
                src={flipbook.pdf_public_url}
                className="w-full rounded-xl shadow-2xl border border-gray-200"
                style={{ maxWidth: 900, height: '75vh' }}
                title="Report PDF"
              />
            ) : (
              <div
                ref={containerRef}
                className="shadow-2xl rounded-sm overflow-hidden"
                style={{ maxWidth: 1100, width: '100%' }}
              />
            )}

            {/* ── Page Controls ── */}
            <div className="flex items-center gap-4 mt-6">
              {!useFallback && (
                <>
                  <button
                    onClick={prevPage}
                    disabled={currentPage <= 1}
                    style={{ backgroundColor: accent }}
                    className="p-2.5 rounded-full text-white disabled:opacity-30 hover:opacity-90 transition"
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-gray-600 min-w-[90px] text-center">
                    Page {currentPage} of {totalPages || '…'}
                  </span>
                  <button
                    onClick={nextPage}
                    disabled={currentPage >= totalPages}
                    style={{ backgroundColor: accent }}
                    className="p-2.5 rounded-full text-white disabled:opacity-30 hover:opacity-90 transition"
                    aria-label="Next page"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
              <a
                href={flipbook.pdf_public_url}
                download
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: accent }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition ml-2"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            </div>
          </>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-3 text-center">
        <span className="text-gray-400 text-xs">Powered by PropPrompt</span>
      </footer>
    </div>
  );
}