import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Bell, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AlertSettings() {
  const [user, setUser] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        setUser(me);

        // Load all territories user has access to
        const terrs = await base44.entities.Territory.list('', 500);
        setTerritories(terrs || []);

        // Load alert settings for this user
        const settingsList = await base44.entities.TerritoryAlertSettings.filter({
          user_id: me.id
        }, '', 500);

        const settingsMap = {};
        settingsList.forEach(s => {
          settingsMap[s.territory_id] = s;
        });
        setSettings(settingsMap);
      } catch (err) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load alert settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSettingChange = (territoryId, key, value) => {
    setSettings(prev => ({
      ...prev,
      [territoryId]: {
        ...prev[territoryId],
        [key]: value,
        territory_id: territoryId,
        user_id: user.id
      }
    }));
  };

  const handleSave = async (territoryId) => {
    try {
      const setting = settings[territoryId];
      const existing = (await base44.entities.TerritoryAlertSettings.filter({
        user_id: user.id,
        territory_id: territoryId
      }))?.[0];

      if (existing) {
        await base44.entities.TerritoryAlertSettings.update(existing.id, setting);
      } else {
        await base44.entities.TerritoryAlertSettings.create(setting);
      }
      toast.success("Settings saved");
    } catch (err) {
      console.error("Failed to save settings:", err);
      toast.error("Failed to save settings");
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-[#B8982F]" />
        <h1 className="text-2xl font-bold text-[#1A3226]">Alert Settings</h1>
      </div>

      <p className="text-sm text-[#1A3226]/60">
        Customize how and when you receive market shift alerts for each territory.
      </p>

      <div className="space-y-6">
        {territories.length === 0 ? (
          <div className="rounded-xl border border-[#1A3226]/10 bg-[#FAF8F4] p-8 text-center">
            <p className="text-[#1A3226]/60">No territories available yet.</p>
          </div>
        ) : (
          territories.map(territory => {
            const s = settings[territory.id] || {
              dom_threshold_days: 21,
              price_change_pct_threshold: 5.0,
              inventory_months_threshold: 1.5,
              email_alerts_enabled: true,
              in_app_alerts_enabled: true,
              alert_frequency: "immediate"
            };

            return (
              <div key={territory.id} className="rounded-xl border border-[#1A3226]/10 bg-white p-6">
                <h3 className="font-semibold text-[#1A3226] mb-4">
                  {territory.city_town}, {territory.state_id}
                </h3>

                <div className="grid sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-[#1A3226] mb-1">
                      Days on Market Threshold
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="90"
                      value={s.dom_threshold_days}
                      onChange={(e) => handleSettingChange(territory.id, "dom_threshold_days", parseInt(e.target.value))}
                      className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:border-[#B8982F]"
                    />
                    <p className="text-xs text-[#1A3226]/50 mt-1">Alert if DOM drops below this</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1A3226] mb-1">
                      Price Change Threshold (%)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      step="0.5"
                      value={s.price_change_pct_threshold}
                      onChange={(e) => handleSettingChange(territory.id, "price_change_pct_threshold", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:border-[#B8982F]"
                    />
                    <p className="text-xs text-[#1A3226]/50 mt-1">Alert on price changes above this %</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1A3226] mb-1">
                      Inventory Threshold (months)
                    </label>
                    <input
                      type="number"
                      min="0.5"
                      max="6"
                      step="0.5"
                      value={s.inventory_months_threshold}
                      onChange={(e) => handleSettingChange(territory.id, "inventory_months_threshold", parseFloat(e.target.value))}
                      className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:border-[#B8982F]"
                    />
                    <p className="text-xs text-[#1A3226]/50 mt-1">Alert if inventory drops below this</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[#1A3226] mb-1">
                      Alert Frequency
                    </label>
                    <select
                      value={s.alert_frequency}
                      onChange={(e) => handleSettingChange(territory.id, "alert_frequency", e.target.value)}
                      className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:border-[#B8982F]"
                    >
                      <option value="immediate">Immediate</option>
                      <option value="daily_digest">Daily Digest</option>
                      <option value="weekly_digest">Weekly Digest</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3 mb-6 border-t border-[#1A3226]/10 pt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.email_alerts_enabled}
                      onChange={(e) => handleSettingChange(territory.id, "email_alerts_enabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-[#1A3226]">Email alerts enabled</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.in_app_alerts_enabled}
                      onChange={(e) => handleSettingChange(territory.id, "in_app_alerts_enabled", e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm text-[#1A3226]">In-app alerts enabled</span>
                  </label>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleSave(territory.id)}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" /> Save Settings
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}