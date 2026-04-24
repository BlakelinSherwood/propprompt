import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Download } from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

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

  const containerRef = useRef(null); // unused but kept for safety

  // ── 1. Load flipbook record via public backend function (no auth required) ────
  useEffect(() => {
    async function init() {
      if (!token) { setStatus('not_found'); return; }

      const res = await base44.functions.invoke('getFlipbook', { token });
      const { status: s, record } = res.data || {};

      if (s === 'not_found' || !record) { setStatus('not_found'); return; }
      if (s === 'expired') { setStatus('expired'); return; }

      setFlipbook(record);
      setStatus('ready');
    }
    init();
  }, [token]);

  // ── 2. Set ready immediately ─────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'ready' || !flipbook?.pdf_public_url) return;
    setPdfReady(true);
  }, [status, flipbook]);

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

        {/* PDF Viewer — uses Google Docs viewer to bypass iframe restrictions */}
        {pdfReady && (
          <>
            <iframe
              src={`https://docs.google.com/viewer?url=${encodeURIComponent(flipbook.pdf_public_url)}&embedded=true`}
              className="w-full rounded-xl shadow-2xl border border-gray-200"
              style={{ maxWidth: 960, height: '80vh' }}
              title="Report PDF"
            />
            <div className="flex items-center gap-4 mt-4">
              <a
                href={flipbook.pdf_public_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: accent }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium hover:opacity-90 transition"
              >
                <Download className="w-4 h-4" />
                Download / Open PDF
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