import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, Trash2, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

const WATCH_TYPE_LABELS = {
  manual: 'Manually watched',
  auto_adjacent: 'Auto-watched — near your territory',
  auto_county: 'Auto-watched — same county',
};

const STATUS_COLORS = {
  available: 'bg-green-50 border-green-200',
  claimed_by_other: 'bg-red-50 border-red-200',
  active: 'bg-blue-50 border-blue-200',
};

const STATUS_LABELS = {
  available: '🟢 Available',
  claimed_by_other: '🔴 Claimed',
  active: '🟡 Pending',
};

export default function TerritoryWatchListTab({ userId }) {
  const [watchList, setWatchList] = useState([]);
  const [territories, setTerritories] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('all');

  useEffect(() => {
    loadWatchList();
  }, [userId]);

  async function loadWatchList() {
    setLoading(true);
    try {
      const watches = await base44.asServiceRole.entities.TerritoryWatchList.filter({
        user_id: userId,
        status: { $in: ['active', 'claimed_by_other'] },
      }, '-added_at', 100);

      setWatchList(watches || []);

      // Load territory details
      const terrs = {};
      for (const watch of watches || []) {
        const terr = await base44.asServiceRole.entities.Territory.get(watch.territory_id);
        terrs[watch.territory_id] = terr;
      }
      setTerritories(terrs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function removeFromWatchList(watchId) {
    try {
      await base44.asServiceRole.entities.TerritoryWatchList.update(watchId, {
        status: 'dismissed',
      });
      loadWatchList();
    } catch (err) {
      console.error(err);
    }
  }

  const filtered =
    filterState === 'all'
      ? watchList
      : watchList.filter(w => territories[w.territory_id]?.status === filterState);

  if (loading) {
    return <div className="text-center py-8">Loading watch list...</div>;
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-[#1A3226]/60">
        <Eye className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>You're not watching any territories yet.</p>
        <p className="text-sm mt-2">Add territories from the map to get immediate alerts when they become available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2">
        {[
          { key: 'all', label: 'All' },
          { key: 'available', label: 'Available Now' },
          { key: 'claimed_by_other', label: 'Claimed' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterState(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              filterState === f.key
                ? 'bg-[#1A3226] text-white'
                : 'bg-[#1A3226]/5 text-[#1A3226] hover:bg-[#1A3226]/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Watch List */}
      <div className="space-y-3">
        {filtered.map(watch => {
          const terr = territories[watch.territory_id];
          if (!terr) return null;

          const statusColor = STATUS_COLORS[terr.status] || STATUS_COLORS.active;
          const statusLabel = STATUS_LABELS[terr.status] || 'Unknown';

          return (
            <div
              key={watch.id}
              className={`rounded-lg border-2 p-4 ${statusColor} transition`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-[#1A3226]">
                    {terr.city_town}, {terr.state}
                  </h3>
                  <p className="text-sm text-[#1A3226]/70 mt-1">
                    {WATCH_TYPE_LABELS[watch.watch_type]}
                  </p>
                  <div className="flex gap-4 mt-3 text-xs text-[#1A3226]/60">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {terr.population.toLocaleString()} pop
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {terr.seats_total} seats
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-right">
                  <span className="text-sm font-medium">{statusLabel}</span>

                  {terr.status === 'available' && (
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        window.location.href = `/claim?type=single&territory_id=${terr.id}&source=territory_watch`;
                      }}
                    >
                      Claim Now
                    </Button>
                  )}

                  <button
                    onClick={() => removeFromWatchList(watch.id)}
                    className="text-xs text-[#1A3226]/50 hover:text-[#1A3226] flex items-center justify-end gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}