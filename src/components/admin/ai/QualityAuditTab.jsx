import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function QualityAuditTab() {
  const [audits, setAudits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [recentScores, setRecentScores] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);

  useEffect(() => {
    loadAudits();
  }, []);

  async function loadAudits() {
    setLoading(true);
    try {
      const records = await base44.entities.QualityAuditLog.list('-audit_date', 100);
      setAudits(records);
      
      // Prepare recent scores for trend chart
      const byDate = records.slice(0, 30).reverse().map(r => ({
        date: new Date(r.audit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        overall: r.score_overall || 0,
        comps: r.score_comps || 0,
        archetypes: r.score_archetypes || 0,
      }));
      setRecentScores(byDate);

      // Build heatmap: assessment_type × section scores
      const heatData = buildHeatmap(records);
      setHeatmapData(heatData);
    } catch (e) {
      console.error('[QualityAuditTab] load error:', e);
      setAudits([]);
    } finally {
      setLoading(false);
    }
  }

  async function manualAudit(analysisId) {
    try {
      const res = await base44.functions.invoke('runQualityAudit', { analysisId });
      alert(`Audit created: Overall score ${res.data.overall_score}`);
      loadAudits();
    } catch (e) {
      alert(`Audit failed: ${e.message}`);
    }
  }

  function buildHeatmap(records) {
    const sections = ['comps', 'valuation', 'migration', 'archetypes', 'language_calibration', 'portfolio_options'];
    const types = ['cma', 'listing_pricing', 'buyer_intelligence', 'investment_analysis', 'client_portfolio'];
    
    const matrix = {};
    types.forEach(type => {
      const typeRecords = records.filter(r => r.assessment_type === type);
      const avgScores = {};
      sections.forEach(section => {
        const scoreKey = `score_${section}`;
        const scores = typeRecords.map(r => r[scoreKey]).filter(s => s);
        avgScores[section] = scores.length ? (scores.reduce((a, b) => a + b) / scores.length).toFixed(1) : '-';
      });
      matrix[type] = avgScores;
    });

    return matrix;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="w-5 h-5 animate-spin text-[#1A3226]" />
      </div>
    );
  }

  const displayAudit = selectedAudit || (audits?.[0] || null);

  return (
    <div className="space-y-6">
      {/* BLOCK 1: Stats Summary */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white border border-[#1A3226]/10 rounded-lg p-4">
          <div className="text-xs uppercase tracking-widest text-[#1A3226]/50 font-semibold">Avg Overall Score</div>
          <div className="text-2xl font-bold text-[#1A3226] mt-1">
            {audits?.length ? (audits.reduce((sum, a) => sum + (a.score_overall || 0), 0) / audits.length).toFixed(1) : '—'}
          </div>
        </div>
        <div className="bg-white border border-[#1A3226]/10 rounded-lg p-4">
          <div className="text-xs uppercase tracking-widest text-[#1A3226]/50 font-semibold">Audits Run</div>
          <div className="text-2xl font-bold text-[#1A3226] mt-1">{audits?.length || 0}</div>
        </div>
        <div className="bg-white border border-[#1A3226]/10 rounded-lg p-4">
          <div className="text-xs uppercase tracking-widest text-[#1A3226]/50 font-semibold">Compliance Pass</div>
          <div className="text-2xl font-bold text-green-600 mt-1">
            {audits?.filter(a => a.compliance_passed).length || 0}/{audits?.length || 0}
          </div>
        </div>
        <div className="bg-white border border-[#1A3226]/10 rounded-lg p-4">
          <div className="text-xs uppercase tracking-widest text-[#1A3226]/50 font-semibold">Critical Issues</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {audits?.reduce((sum, a) => sum + (a.critical_count || 0), 0) || 0}
          </div>
        </div>
      </div>

      {/* BLOCK 2: Score Trends */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Score Trends (Last 30 Audits)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={recentScores}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis domain={[0, 10]} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="overall" stroke="#1A3226" name="Overall" />
            <Line type="monotone" dataKey="comps" stroke="#B8982F" name="Comps" />
            <Line type="monotone" dataKey="archetypes" stroke="#7C3AED" name="Archetypes" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* BLOCK 3: Section Performance Heatmap */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg p-6">
        <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Section Performance by Analysis Type</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#1A3226]/10">
                <th className="text-left py-2 px-3 font-semibold text-[#1A3226]/70">Type</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Comps</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Valuation</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Migration</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Archetypes</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Language</th>
                <th className="text-center py-2 px-3 font-semibold text-[#1A3226]/70">Portfolio</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(heatmapData).map(([type, scores]) => (
                <tr key={type} className="border-b border-[#1A3226]/8 hover:bg-[#1A3226]/[0.02]">
                  <td className="py-2 px-3 font-medium text-[#1A3226] capitalize">{type.replace(/_/g, ' ')}</td>
                  {['comps', 'valuation', 'migration', 'archetypes', 'language_calibration', 'portfolio_options'].map(section => {
                    const score = scores[section];
                    const bgColor = score === '-' ? 'bg-gray-100' : 
                                   parseFloat(score) >= 8 ? 'bg-green-100' :
                                   parseFloat(score) >= 6 ? 'bg-yellow-100' : 'bg-red-100';
                    return (
                      <td key={section} className={`text-center py-2 px-3 ${bgColor}`}>
                        {score}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* BLOCK 4: Recent Audits Table */}
      <div className="bg-white border border-[#1A3226]/10 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1A3226]/10 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#1A3226]">Recent Audits</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAudits}
            className="gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>

        <div className="divide-y divide-[#1A3226]/8 max-h-96 overflow-y-auto">
          {(audits || []).length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-[#1A3226]/40">No audits yet. Analyses will be audited automatically upon completion.</div>
          ) : (
            (audits || []).map(audit => (
              <div
                key={audit.id}
                onClick={() => setSelectedAudit(audit)}
                className={`px-6 py-3 cursor-pointer hover:bg-[#1A3226]/[0.02] transition-colors ${
                  selectedAudit?.id === audit.id ? 'bg-[#1A3226]/[0.05]' : ''
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[#1A3226]">
                      {audit.assessment_type?.replace(/_/g, ' ') || 'Analysis'}
                      <span className="text-xs text-[#1A3226]/50 ml-2">
                        {new Date(audit.audit_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="text-xs text-[#1A3226]/60 mt-0.5">
                      Score: {audit.score_overall} · Issues: {audit.critical_count + audit.major_count + audit.minor_count}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!audit.compliance_passed ? (
                      <AlertTriangle className="w-4 h-4 text-red-600" title="Compliance failed" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 text-green-600" title="Compliance passed" />
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* BLOCK 5: Audit Details */}
      {displayAudit && (
        <div className="bg-white border border-[#1A3226]/10 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-[#1A3226] mb-4">Audit Details</h3>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-[#1A3226]/50 uppercase tracking-wide font-semibold">Assessment Type</div>
              <div className="text-sm font-medium text-[#1A3226] mt-1">{displayAudit.assessment_type?.replace(/_/g, ' ')}</div>
            </div>
            <div>
              <div className="text-xs text-[#1A3226]/50 uppercase tracking-wide font-semibold">Model Used</div>
              <div className="text-sm font-mono text-[#1A3226] mt-1">{displayAudit.model_used}</div>
            </div>
            <div>
              <div className="text-xs text-[#1A3226]/50 uppercase tracking-wide font-semibold">Overall Score</div>
              <div className="text-2xl font-bold text-[#1A3226] mt-1">{displayAudit.score_overall}/10</div>
            </div>
            <div>
              <div className="text-xs text-[#1A3226]/50 uppercase tracking-wide font-semibold">Recommendation</div>
              <div className="text-sm font-medium text-[#B8982F] mt-1 capitalize">{displayAudit.recommended_model_strategy?.replace(/_/g, ' ')}</div>
            </div>
          </div>

          {/* Issues */}
          {displayAudit.issues?.length > 0 && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-[#1A3226]/70 uppercase tracking-wide mb-3">Issues Found</h4>
              <div className="space-y-2">
                {displayAudit.issues.map((issue, idx) => (
                  <div key={idx} className="border-l-4 border-l-red-500 bg-red-50 p-3 rounded-r text-xs">
                    <div className="font-semibold text-red-700">{issue.section} ({issue.severity})</div>
                    <div className="text-red-600 mt-1">{issue.description}</div>
                    <div className="text-red-600/70 mt-1">→ {issue.recommendation}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recommendation */}
          {displayAudit.recommendation_rationale && (
            <div className="bg-[#1A3226]/[0.03] p-4 rounded-lg border border-[#1A3226]/10">
              <div className="text-xs font-semibold text-[#1A3226]/70 uppercase tracking-wide mb-2">Model Recommendation</div>
              <p className="text-sm text-[#1A3226] leading-relaxed">{displayAudit.recommendation_rationale}</p>
              {displayAudit.estimated_token_savings_pct && (
                <div className="text-xs text-[#1A3226]/60 mt-2">
                  Estimated token savings: {displayAudit.estimated_token_savings_pct}%
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}