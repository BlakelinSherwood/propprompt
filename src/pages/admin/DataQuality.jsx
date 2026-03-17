import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { AlertCircle, CheckCircle2, AlertTriangle, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function DataQualityPanel() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [territories, setTerritories] = useState([]);
  const [stats, setStats] = useState({});
  const [selectedTerritory, setSelectedTerritory] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      if (currentUser?.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }
      setUser(currentUser);

      // Load territory data quality metrics
      const qualityData = await base44.entities.TerritoryDataQuality.list('-created_date', 100);
      
      // Group by territory and get latest
      const latestByTerritory = {};
      for (const record of qualityData) {
        if (!latestByTerritory[record.territory_id] || 
            new Date(record.created_date) > new Date(latestByTerritory[record.territory_id].created_date)) {
          latestByTerritory[record.territory_id] = record;
        }
      }

      // Load territories
      const allTerritories = await base44.entities.Territory.list('-created_date', 500);
      const enriched = allTerritories.map(t => ({
        ...t,
        quality: latestByTerritory[t.id]
      }));

      setTerritories(enriched);

      // Calculate aggregate stats
      const avgScore = enriched.length > 0
        ? Math.round(enriched.reduce((sum, t) => sum + (t.quality?.average_confidence_score || 0), 0) / enriched.length)
        : 0;
      const totalBlocked = enriched.reduce((sum, t) => sum + (t.quality?.red_state_count || 0), 0);
      const totalWarnings = enriched.reduce((sum, t) => sum + (t.quality?.yellow_state_count || 0), 0);

      setStats({
        avg_score: avgScore,
        blocked_this_month: totalBlocked,
        warnings_this_month: totalWarnings,
        flagged_territories: enriched.filter(t => t.quality?.red_rate > 40).length
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading data quality:', error);
      setLoading(false);
    }
  };

  const getStatusBadge = (quality) => {
    if (!quality) return <span className="text-xs text-gray-500">No data</span>;
    
    const red_rate = quality.red_rate || 0;
    if (red_rate > 60) {
      return <span className="text-xs font-semibold text-red-600 bg-red-50 px-2 py-1 rounded">Auto-paused</span>;
    } else if (red_rate > 40) {
      return <span className="text-xs font-semibold text-yellow-600 bg-yellow-50 px-2 py-1 rounded">Review Required</span>;
    } else if (red_rate > 20) {
      return <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-1 rounded">Monitor</span>;
    } else {
      return <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded">Healthy</span>;
    }
  };

  const handlePauseTerritory = async (territoryId) => {
    if (!confirm('Pause portfolio analysis for this territory?')) return;
    try {
      await base44.entities.Territory.update(territoryId, { status: 'data_quality_paused' });
      loadData();
    } catch (error) {
      console.error('Error pausing territory:', error);
    }
  };

  const handleResumeTerritory = async (territoryId) => {
    if (!confirm('Resume portfolio analysis for this territory?')) return;
    try {
      await base44.entities.Territory.update(territoryId, { status: 'active' });
      loadData();
    } catch (error) {
      console.error('Error resuming territory:', error);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-[#1A3226] mb-2">Data Quality Dashboard</h1>
        <p className="text-[#1A3226]/60">Monitor public records reliability across all territories</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="border rounded-lg p-4">
          <p className="text-sm text-[#1A3226]/60 mb-1">Avg Confidence Score</p>
          <p className="text-3xl font-bold text-[#1A3226]">{stats.avg_score || 0}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-[#1A3226]/60 mb-1">Blocked This Month</p>
          <p className="text-3xl font-bold text-red-600">{stats.blocked_this_month}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-[#1A3226]/60 mb-1">Warnings This Month</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.warnings_this_month}</p>
        </div>
        <div className="border rounded-lg p-4">
          <p className="text-sm text-[#1A3226]/60 mb-1">Flagged Territories</p>
          <p className="text-3xl font-bold text-orange-600">{stats.flagged_territories}</p>
        </div>
      </div>

      {/* Territory Data Quality Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#1A3226]/5">
              <TableHead>Territory</TableHead>
              <TableHead>State</TableHead>
              <TableHead className="text-right">Searches (30d)</TableHead>
              <TableHead className="text-right">Green %</TableHead>
              <TableHead className="text-right">Yellow %</TableHead>
              <TableHead className="text-right">Red %</TableHead>
              <TableHead className="text-right">Avg Score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {territories.map(territory => {
              const quality = territory.quality;
              if (!quality) return null;
              
              const total = quality.searches_attempted || 1;
              const greenPct = Math.round((quality.green_state_count / total) * 100);
              const yellowPct = Math.round((quality.yellow_state_count / total) * 100);
              const redPct = Math.round((quality.red_state_count / total) * 100);

              return (
                <TableRow key={territory.id}>
                  <TableCell className="font-semibold">{territory.city_town}</TableCell>
                  <TableCell>{quality.state_code || 'N/A'}</TableCell>
                  <TableCell className="text-right">{quality.searches_attempted}</TableCell>
                  <TableCell className="text-right text-green-600 font-semibold">{greenPct}%</TableCell>
                  <TableCell className="text-right text-yellow-600 font-semibold">{yellowPct}%</TableCell>
                  <TableCell className="text-right text-red-600 font-semibold">{redPct}%</TableCell>
                  <TableCell className="text-right">{quality.average_confidence_score || 0}</TableCell>
                  <TableCell>{getStatusBadge(quality)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedTerritory(territory)}
                        className="text-xs"
                      >
                        Details
                      </Button>
                      {territory.status === 'data_quality_paused' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleResumeTerritory(territory.id)}
                          className="text-xs gap-1"
                        >
                          <Play className="w-3 h-3" /> Resume
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseTerritory(territory.id)}
                          className="text-xs gap-1 text-red-600"
                        >
                          <Pause className="w-3 h-3" /> Pause
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Territory Details Modal */}
      {selectedTerritory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-96 overflow-y-auto">
            <h2 className="text-xl font-bold text-[#1A3226] mb-4">
              {selectedTerritory.city_town}, {selectedTerritory.quality?.state_code}
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3 bg-[#1A3226]/5 rounded">
                <p className="text-xs text-[#1A3226]/60">Avg Confidence</p>
                <p className="text-2xl font-bold text-[#1A3226]">{selectedTerritory.quality?.average_confidence_score}</p>
              </div>
              <div className="p-3 bg-red-50 rounded">
                <p className="text-xs text-red-600">Red Rate</p>
                <p className="text-2xl font-bold text-red-600">{selectedTerritory.quality?.red_rate || 0}%</p>
              </div>
            </div>

            {selectedTerritory.quality?.common_blocking_reasons?.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-semibold text-[#1A3226] mb-2">Common Blocking Reasons:</p>
                <ul className="space-y-1">
                  {selectedTerritory.quality.common_blocking_reasons.map((reason, idx) => (
                    <li key={idx} className="text-sm text-[#1A3226]/70">• {reason}</li>
                  ))}
                </ul>
              </div>
            )}

            <Button
              onClick={() => setSelectedTerritory(null)}
              className="w-full mt-4"
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}