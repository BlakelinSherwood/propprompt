import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell } from "lucide-react";
import AlertCard from "./AlertCard";
import { Button } from "@/components/ui/button";

export default function AlertsTab({ user }) {
  const [alerts, setAlerts] = useState([]);
  const [territories, setTerritories] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("unread");

  useEffect(() => {
    async function load() {
      try {
        const alertList = await base44.entities.TerritoryIntelligenceAlerts.filter({
          user_id: user.id
        }, '-created_at', 100);

        setAlerts(alertList || []);

        // Load territories
        if (alertList?.length > 0) {
          const terrIds = [...new Set(alertList.map(a => a.territory_id))];
          const terrs = await Promise.all(
            terrIds.map(id => base44.entities.Territory.filter({ id }, '', 1))
          );
          const terrMap = {};
          terrs.forEach(t => {
            if (t?.[0]) terrMap[t[0].id] = t[0];
          });
          setTerritories(terrMap);
        }
      } catch (err) {
        console.error("Failed to load alerts:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.id]);

  const filteredAlerts = filter === "unread" 
    ? alerts.filter(a => !a.read_at)
    : filter === "actioned"
    ? alerts.filter(a => a.action_taken)
    : alerts;

  const handleDismiss = async (alertId) => {
    try {
      await base44.entities.TerritoryIntelligenceAlerts.update(alertId, {
        read_at: new Date().toISOString(),
        action_taken: "dismissed"
      });
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, read_at: new Date().toISOString() } : a));
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleAction = async (alertId, action) => {
    try {
      await base44.entities.TerritoryIntelligenceAlerts.update(alertId, {
        action_taken: action,
        actioned_at: new Date().toISOString()
      });
      setAlerts(alerts.map(a => a.id === alertId ? { ...a, action_taken: action, actioned_at: new Date().toISOString() } : a));
    } catch (err) {
      console.error("Failed to update alert action:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#B8982F]" />
          <h2 className="text-lg font-semibold text-[#1A3226]">Market Shift Alerts</h2>
          <span className="text-xs bg-[#1A3226]/10 text-[#1A3226] px-2 py-1 rounded-full">
            {filteredAlerts.length}
          </span>
        </div>
        <a href="/account/alert-settings" className="text-sm text-[#B8982F] hover:text-[#B8982F]/80">
          Settings →
        </a>
      </div>

      {alerts.length === 0 ? (
        <div className="rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4] p-12 text-center">
          <Bell className="w-12 h-12 text-[#1A3226]/20 mx-auto mb-3" />
          <p className="text-[#1A3226]/60 text-sm">No market shift alerts yet.</p>
          <p className="text-[#1A3226]/40 text-xs mt-1">The Territory Intelligence Agent monitors your markets daily at 6 AM.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4">
            {[
              { key: "all", label: "All" },
              { key: "unread", label: "Unread" },
              { key: "actioned", label: "Actioned" },
            ].map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            {filteredAlerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                territory={territories[alert.territory_id]}
                onDismiss={handleDismiss}
                onAction={handleAction}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}