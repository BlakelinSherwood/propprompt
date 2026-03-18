import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import TerritoryStatsBar from "../components/territories/TerritoryStatsBar";
import TerritoryFilterBar from "../components/territories/TerritoryFilterBar";
import TerritoryMap from "../components/territories/TerritoryMap";
import TerritorySidebar from "../components/territories/TerritorySidebar";
import PoolBuilderButton from "../components/territories/PoolBuilderButton";

export default function TerritoriesPublic() {
  const [territories, setTerritories] = useState([]);
  const [states, setStates] = useState([]);
  const [counties, setCounties] = useState([]);
  const [pricing, setPricing] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTerritory, setSelectedTerritory] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const [filters, setFilters] = useState({
    state: "all",
    status: "all",
    seatType: "all",
    search: "",
    availableOnly: false,
  });

  const [sidebarSort, setSidebarSort] = useState("alpha");

  useEffect(() => {
    // Check if user is authenticated
    base44.auth.me().then(() => {
      setIsAuthenticated(true);
    }).catch(() => {
      setIsAuthenticated(false);
    });
  }, []);

  useEffect(() => {
    async function load() {
      try {
        const [terrs, sts, cnts] = await Promise.all([
          base44.entities.Territory.list('', 5000),
          base44.entities.State.list('', 100),
          base44.entities.County.list('', 500),
        ]);
        setTerritories(terrs);
        setStates(sts);
        setCounties(cnts);
        
        // Load pricing separately with error handling
        try {
          const pricingRes = await base44.functions.invoke("getPricingConfig", {});
          setPricing(pricingRes.data || {});
        } catch (pricingError) {
          console.warn("Could not load pricing config:", pricingError);
          setPricing({});
        }
      } catch (error) {
        console.error("Failed to load territories data:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const stateMap = Object.fromEntries(states.map((s) => [s.id, s]));
  const countyMap = Object.fromEntries(counties.map((c) => [c.id, c]));

  const filtered = territories.filter((t) => {
    if (filters.availableOnly && t.status !== "available") return false;
    if (filters.state !== "all") {
      const st = stateMap[t.state_id];
      if (!st || st.code !== filters.state) return false;
    }
    if (filters.status !== "all") {
      if (filters.status === "available" && t.status !== "available") return false;
      if (filters.status === "partial") {
        if (!(t.status === "active" && t.seats_claimed < t.seats_total)) return false;
      }
      if (filters.status === "claimed") {
        if (!(t.status === "active" && t.seats_claimed >= t.seats_total)) return false;
      }
      if (filters.status === "pool" && t.status !== "pool_member") return false;
    }
    if (filters.seatType === "single" && (t.seats_total || 1) > 1) return false;
    if (filters.seatType === "multi" && (t.seats_total || 1) <= 1) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!t.city_town?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4]">
      {/* Public Header (no sidebar) */}
      {!isAuthenticated && (
        <header className="sticky top-0 z-50 bg-[#1A3226] text-white">
          <div className="flex items-center justify-between h-16 px-6">
            <a href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#B8982F] flex items-center justify-center text-[#1A3226] font-bold text-sm">PP</div>
              <span className="text-base font-semibold tracking-tight">PropPrompt™</span>
            </a>
            <button onClick={() => base44.auth.redirectToLogin()} className="text-sm bg-[#B8982F] hover:bg-[#B8982F]/90 text-[#1A3226] font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer">
              Sign In
            </button>
          </div>
        </header>
      )}

      {/* Territories Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TerritoryStatsBar territories={territories} states={states} />
        <TerritoryFilterBar filters={filters} setFilters={setFilters} states={states} />

        <div className="flex-1 flex overflow-hidden relative">
          {/* Map */}
          <div className="flex-1 relative">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
              </div>
            ) : (
              <TerritoryMap
                territories={filtered}
                stateMap={stateMap}
                countyMap={countyMap}
                pricing={pricing}
                selectedTerritory={selectedTerritory}
                onSelectTerritory={setSelectedTerritory}
              />
            )}
            <PoolBuilderButton territories={territories} pricing={pricing} stateMap={stateMap} />
          </div>

          {/* Sidebar */}
          <TerritorySidebar
            territories={filtered}
            stateMap={stateMap}
            countyMap={countyMap}
            pricing={pricing}
            sort={sidebarSort}
            onSortChange={setSidebarSort}
            onSelectTerritory={setSelectedTerritory}
            selectedTerritory={selectedTerritory}
          />
        </div>
      </div>
    </div>
  );
}