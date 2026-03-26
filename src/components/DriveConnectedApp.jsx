import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { HardDrive, Link2, Link2Off, Loader2, CheckCircle, AlertTriangle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function DriveConnectedApp() {
  const [driveStatus, setDriveStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [settings, setSettings] = useState({});
  const [savingSettings, setSavingSettings] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

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
      if (e.message?.includes('not configured') || e.message?.includes('GOOGLE_')) {
        setNotConfigured(true);
      }
      setDriveStatus({ connected: false });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleConnect = async () => {
    setConnecting(true);
    const res = await base44.functions.invoke("driveOAuth", { action: "get_auth_url" });
    if (res.data?.error) {
      setNotConfigured(true);
      setShowSetupGuide(true);
      setConnecting(false);
      return;
    }
    // Open OAuth in popup
    const popup = window.open(res.data.auth_url, "google_oauth", "width=500,height=650");
    if (!popup) {
      alert("Popup was blocked. Please allow popups for this site and try again.");
      setConnecting(false);
      return;
    }
    const maxWait = Date.now() + 5 * 60 * 1000; // 5 minutes max
    const timer = setInterval(async () => {
      if (popup.closed || Date.now() > maxWait) {
        clearInterval(timer);
        if (Date.now() > maxWait && !popup.closed) popup.close();
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

  if (notConfigured) return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="flex items-start gap-3 px-4 py-4">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">Google Drive setup required</p>
          <p className="text-xs text-amber-700 mt-0.5">A one-time Google Cloud setup is needed to enable per-user Drive connections. Once set up, agents get a simple one-click sign-in.</p>
          <button
            onClick={() => setShowSetupGuide(!showSetupGuide)}
            className="flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900 mt-2 transition-colors"
          >
            {showSetupGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showSetupGuide ? 'Hide' : 'Show'} setup instructions
          </button>
        </div>
      </div>

      {showSetupGuide && (
        <div className="border-t border-amber-200 px-4 py-4 bg-white space-y-4">
          <p className="text-xs font-bold text-[#1A3226] uppercase tracking-wider">Setup Steps (5–10 min, one-time)</p>
          
          <ol className="space-y-3">
            {[
              { n: 1, title: 'Go to Google Cloud Console', desc: 'Visit console.cloud.google.com and sign in with your Google account.', link: 'https://console.cloud.google.com', linkLabel: 'Open Google Cloud Console' },
              { n: 2, title: 'Create a project', desc: 'Click the project dropdown at the top → "New Project" → give it a name like "PropPrompt" → Create.' },
              { n: 3, title: 'Enable Google Drive API', desc: 'Go to APIs & Services → Library → search "Google Drive API" → click Enable.' },
              { n: 4, title: 'Configure OAuth consent screen', desc: 'Go to APIs & Services → OAuth consent screen → choose "External" → fill in App name (e.g. PropPrompt), your email, and save. Add the scope: .../auth/drive.file' },
              { n: 5, title: 'Create OAuth credentials', desc: 'Go to APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID → Application type: "Web application".' },
              { n: 6, title: 'Set the Redirect URI', desc: 'In the Authorized Redirect URIs field, add your driveOauthCallback function URL. Find it in Dashboard → Code → Functions → driveOauthCallback.' },
              { n: 7, title: 'Copy your credentials', desc: 'Copy the Client ID and Client Secret shown after creation.' },
              { n: 8, title: 'Add secrets to the app', desc: 'Go to Dashboard → Settings → Environment Variables and add: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI (the callback URL from step 6).' },
            ].map(step => (
              <li key={step.n} className="flex gap-3">
                <span className="w-5 h-5 rounded-full bg-[#1A3226] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</span>
                <div>
                  <p className="text-xs font-semibold text-[#1A3226]">{step.title}</p>
                  <p className="text-xs text-[#1A3226]/60 mt-0.5">{step.desc}</p>
                  {step.link && (
                    <a href={step.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1">
                      {step.linkLabel} <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>

          <div className="rounded-lg bg-[#1A3226]/5 px-3 py-2.5">
            <p className="text-xs text-[#1A3226]/70"><span className="font-semibold">After setup:</span> Each agent will see a single "Connect Google Drive" button that opens a Google sign-in popup — just like connecting Drive in any other app.</p>
          </div>
        </div>
      )}
    </div>
  );

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

      {!driveStatus?.connected && (
        <div className="px-4 pb-4 border-t border-[#1A3226]/5 pt-3 space-y-2">
          <p className="text-xs font-semibold text-[#1A3226]/60 uppercase tracking-wider mb-1">What happens when you connect</p>
          {[
            'Click "Connect" — a Google sign-in popup will open.',
            'Sign in with the Google account where you want reports saved.',
            'Grant permission for PropPrompt to create files in your Drive.',
            'A "PropPrompt Reports" folder will be created automatically.',
            'After any analysis, click Export → PDF to sync it to that folder.',
          ].map((step, i) => (
            <div key={i} className="flex gap-2.5 items-start">
              <span className="w-4 h-4 rounded-full bg-[#1A3226]/10 text-[#1A3226] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
              <p className="text-xs text-[#1A3226]/60">{step}</p>
            </div>
          ))}
        </div>
      )}

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