import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { HardDrive, Link2, Link2Off, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DriveConnectedApp() {
  const [driveStatus, setDriveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [settings, setSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("driveOAuth", { action: "get_status" });
      setDriveStatus(res.data);
      if (res.data?.connected) {
        setSettings({
          subfolder_by_property_type: res.data.subfolder_by_property_type || false,
          subfolder_by_assessment_type: res.data.subfolder_by_assessment_type || false,
          auto_sync_pdf: res.data.auto_sync_pdf !== false,
          auto_sync_pptx: res.data.auto_sync_pptx || false,
        });
      }
    } catch (e) {
      setDriveStatus({ connected: false });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    const res = await base44.functions.invoke("driveOAuth", { action: "get_auth_url" });
    if (res.data?.error) {
      alert("Google OAuth not configured: " + res.data.error);
      setConnecting(false);
      return;
    }
    // Open OAuth in popup
    const popup = window.open(res.data.auth_url, "google_oauth", "width=500,height=650");
    // Poll for close or success message
    const timer = setInterval(async () => {
      if (popup?.closed) {
        clearInterval(timer);
        setConnecting(false);
        await load();
      }
    }, 1000);
  };

  const handleDisconnect = async () => {
    await base44.functions.invoke("driveOAuth", { action: "disconnect" });
    await load();
  };

  const saveSettings = async (newSettings) => {
    setSavingSettings(true);
    await base44.functions.invoke("driveOAuth", { action: "update_settings", ...newSettings });
    setSavingSettings(false);
  };

  const updateSetting = (key, val) => {
    const next = { ...settings, [key]: val };
    setSettings(next);
    saveSettings(next);
  };

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-[#1A3226]/40" /></div>;

  return (
    <div className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#4285F4] flex items-center justify-center text-white flex-shrink-0">
            <HardDrive className="w-4 h-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A3226]">Google Drive</p>
            {driveStatus?.connected ? (
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> {driveStatus.google_account_email || "Connected"}
              </p>
            ) : (
              <p className="text-xs text-[#1A3226]/40">Not connected</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {driveStatus?.connected ? (
            <Button variant="outline" size="sm" onClick={handleDisconnect} className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
              <Link2Off className="w-3 h-3 mr-1" /> Disconnect
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleConnect} disabled={connecting} className="h-7 text-xs border-[#1A3226]/15">
              {connecting ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Link2 className="w-3 h-3 mr-1" />}
              Connect
            </Button>
          )}
        </div>
      </div>

      {driveStatus?.connected && (
        <div className="px-4 pb-4 border-t border-[#1A3226]/5 pt-3 space-y-3">
          <p className="text-xs text-[#1A3226]/50 font-medium uppercase tracking-wider mb-2">Folder Settings</p>
          {[
            { key: "auto_sync_pdf", label: "Auto-sync PDF after analysis" },
            { key: "subfolder_by_assessment_type", label: "Organize by analysis type" },
            { key: "subfolder_by_property_type", label: "Organize by property type" },
          ].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label className="text-sm text-[#1A3226]/70">{label}</Label>
              <Switch
                checked={!!settings[key]}
                onCheckedChange={val => updateSetting(key, val)}
                disabled={savingSettings}
              />
            </div>
          ))}
          {driveStatus.root_folder_name && (
            <p className="text-xs text-[#1A3226]/40 mt-1">
              Syncing to: <span className="font-medium text-[#1A3226]/60">{driveStatus.root_folder_name}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}