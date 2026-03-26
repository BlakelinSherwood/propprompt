import { useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';

function VarianceBadge({ comp }) {
  const { source, perplexity_confirmed, perplexity_variance } = comp;
  if (source === 'perplexity_deep_search') {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">AI Research</span>;
  }
  if (!perplexity_confirmed || perplexity_variance === null) {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Checking…</span>;
  }
  if (perplexity_variance <= 2) {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✓ Confirmed</span>;
  }
  if (perplexity_variance <= 9) {
    return <span className="px-2 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">{perplexity_variance}% variance</span>;
  }
  return <span className="px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">{perplexity_variance}% — verify</span>;
}

export default function ComparableSalesDisplay({ analysis }) {
  const [expanded, setExpanded] = useState(false);

  const comps = analysis?.agent_comps || [];
  const source = analysis?.comps_source || 'none';
  const radius = analysis?.comps_search_radius || null;
  const researcherNote = analysis?.comps_researcher_note;

  if (!comps || comps.length === 0) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-900">No Comparable Sales Used</p>
            <p className="text-xs text-amber-800 mt-1">This report was generated without comparable sales data. Market context and narrative analysis are provided, but no valuation range was estimated.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Researcher Note Banner */}
      {researcherNote && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">{researcherNote}</p>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-[#1A3226]/10 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-[#1A3226]/60 uppercase tracking-widest font-medium">Comparable Sales Used</p>
            <p className="text-sm text-[#1A3226]/70 mt-1">
              <span className="font-medium">{comps.length} property</span>
              {comps.length !== 1 ? 's' : ''} • 
              Source: <span className="font-medium">{source === 'api_verified' ? 'BatchData public records' : source === 'mixed' ? 'BatchData + AI research' : 'Agent-provided'}</span>
              {radius && <span> • <span className="font-medium">{radius} mi radius</span></span>}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-[#1A3226]/60 hover:text-[#1A3226] flex items-center gap-1 transition-colors"
          >
            {expanded ? 'Hide' : 'View'} comps
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expandable Table */}
      {expanded && (
        <div className="overflow-x-auto rounded-lg border border-[#1A3226]/10">
          <table className="w-full text-xs">
            <thead className="bg-[#FAF8F4] border-b border-[#1A3226]/10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-[#1A3226]/60">Address</th>
                <th className="px-3 py-2 text-right font-semibold text-[#1A3226]/60">Sale Price</th>
                <th className="px-3 py-2 text-center font-semibold text-[#1A3226]/60">Date</th>
                <th className="px-3 py-2 text-center font-semibold text-[#1A3226]/60">Bed/Bath/SF</th>
                <th className="px-3 py-2 text-right font-semibold text-[#1A3226]/60">$/SF</th>
                <th className="px-3 py-2 text-center font-semibold text-[#1A3226]/60">Verify</th>
              </tr>
            </thead>
            <tbody>
              {comps.map((comp, idx) => (
                <tr key={comp.address + idx} className="border-b border-[#1A3226]/5 last:border-0">
                  <td className="px-3 py-2 font-medium text-[#1A3226] max-w-[180px] truncate" title={comp.address}>{comp.address}</td>
                  <td className="px-3 py-2 text-right text-[#1A3226]">
                    {comp.sale_price ? '$' + Number(comp.sale_price).toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-[#1A3226]/60">
                    {comp.sale_date ? comp.sale_date.slice(0, 7) : '—'}
                  </td>
                  <td className="px-3 py-2 text-center text-[#1A3226]/60 text-xs">
                    {comp.bedrooms || '—'}/{comp.bathrooms || '—'}/{comp.sqft ? comp.sqft.toLocaleString() : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-[#1A3226]/60">
                    {comp.price_per_sqft ? '$' + comp.price_per_sqft : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <VarianceBadge comp={comp} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}