import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import TerritoryStatsBar from "../components/territories/TerritoryStatsBar";
import TerritoryFilterBar from "../components/territories/TerritoryFilterBar";
import TerritoryMap from "../components/territories/TerritoryMap";
import TerritorySidebar from "../components/territories/TerritorySidebar";
import PoolBuilderButton from "../components/territories/PoolBuilderButton";

export default function Territories() {
  const [territories, setTerritories] = useState([]);
  const [states, setStates] = useState([]);
  const [counties, setCounties] = useState([]);
  const [pricing, setPricing] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedTerritory, setSelectedTerritory] = useState(null);

  const [filters, setFilters] = useState({
    state: "all",
    status: "all",
    seatType: "all",
    search: "",
    availableOnly: false,
  });

  const [sidebarSort, setSidebarSort] = useState("alpha");

  useEffect(() => {
    async function load() {
      try {
        const [terrs, sts, cnts, pricingRes] = await Promise.all([
          base44.entities.Territory.list(),
          base44.entities.State.list(),
          base44.entities.County.list(),
          base44.functions.invoke("getPricingConfig", {}),
        ]);
        setTerritories(terrs);
        setStates(sts);
        setCounties(cnts);
        setPricing(pricingRes.data || {});
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
    <div className="h-screen flex flex-col overflow-hidden bg-[#FAF8F4]">
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
  );
}