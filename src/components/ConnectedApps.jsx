import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link2, CheckCircle, AlertCircle, Loader2, ExternalLink, Trash2, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";

const CRM_PROVIDERS = [
  {
    id: "follow_up_boss",
    name: "Follow Up Boss",
    description: "API key authentication. Posts to /v1/events.",
    fields: [{ key: "encrypted_api_key", label: "API Key", type: "password" }],
  },
  {
    id: "kvcore",
    name: "kvCORE",
    description: "API token + instance URL.",
    fields: [
      { key: "encrypted_api_key", label: "API Token", type: "password" },
      { key: "crm_account_name", label: "Instance URL", type: "text", placeholder: "https://api.kvcore.com" },
    ],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Requires OAuth 2.0. Store access token + Salesforce instance URL.",
    fields: [
      { key: "oauth_access_token", label: "OAuth Access Token", type: "password" },
      { key: "oauth_refresh_token", label: "Refresh Token", type: "password" },
      { key: "crm_account_name", label: "Instance URL", type: "text", placeholder: "https://yourorg.salesforce.com" },
    ],
  },
  {
    id: "lofty",
    name: "Lofty",
    description: "API key authentication. Posts to /api/v1/contacts/{id}/notes.",
    fields: [
      { key: "encrypted_api_key", label: "API Key", type: "password" },
      { key: "crm_user_id", label: "Default Contact ID", type: "text", placeholder: "Optional default contact" },
    ],
  },
];

function CrmProviderCard({ provider, existingConn, onSaved, onDeleted }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const isConnected = existingConn?.status === "connected";

  async function handleSave() {
    setSaving(true);
    try {
      const data = {
        ...form,
        user_email: undefined, // set by backend
        crm_provider: provider.id,
        status: "connected",
      };

      if (existingConn) {
        await base44.entities.CrmConnection.update(existingConn.id, data);
      } else {
        const me = await base44.auth.me();
        await base44.entities.CrmConnection.create({ ...data, user_email: me.email });
        await base44.functions.invoke("logPrivacyEvent", {
          event_type: "crm_connected",
          metadata: { provider: provider.id },
        });
      }

      toast({ title: `${provider.name} connected` });
      onSaved();
      setExpanded(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleDisconnect() {
    if (!existingConn) return;
    await base44.entities.CrmConnection.update(existingConn.id, { status: "disconnected" });
    await base44.functions.invoke("logPrivacyEvent", {
      event_type: "crm_disconnected",
      metadata: { provider: provider.id },
    });
    toast({ title: `${provider.name} disconnected` });
    onDeleted();
  }

  return (
    <div className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isConnected ? "bg-emerald-50" : "bg-[#1A3226]/5"}`}>
            <Link2 className={`w-4 h-4 ${isConnected ? "text-emerald-600" : "text-[#1A3226]/40"}`} />
          </div>
          <div>
            <p className="text-sm font-medium text-[#1A3226]">{provider.name}</p>
            <p className="text-xs text-[#1A3226]/50">{provider.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle className="w-3.5 h-3.5" /> Connected</span>}
          <Button
            variant="outline" size="sm"
            className="h-7 text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {isConnected ? "Edit" : "Connect"}
          </Button>
          {isConnected && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-600" onClick={handleDisconnect}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 pt-2 border-t border-[#1A3226]/5 space-y-2.5 bg-[#FAF8F4]">
          {provider.fields.map((field) => (
            <div key={field.key}>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">{field.label}</label>
              <Input
                type={field.type}
                placeholder={field.placeholder || ""}
                defaultValue={field.type !== "password" ? existingConn?.[field.key] || "" : ""}
                onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                className="text-sm h-8"
              />
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" className="h-7 bg-[#1A3226] text-white text-xs gap-1.5" onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setExpanded(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConnectedApps({ user }) {
  const [crmConns, setCrmConns] = useState([]);
  const [driveConn, setDriveConn] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const { toast } = useToast();

  async function load() {
    const [crm, drive] = await Promise.all([
      base44.entities.CrmConnection.filter({ user_email: user.email }),
      base44.entities.DriveConnection.filter({ user_email: user.email }),
    ]);
    setCrmConns(crm);
    setDriveConn(drive[0] || null);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user.email]);

  async function handleConnectDrive() {
    setConnectingDrive(true);
    const res = await base44.functions.invoke("driveOauthStart", {});
    if (res.data?.authUrl) {
      window.open(res.data.authUrl, "_blank", "width=600,height=700");
      toast({ title: "Opened Google authorization window", description: "Complete the sign-in in the popup, then refresh this page." });
    } else {
      toast({ title: "Drive not configured", description: res.data?.error || "Contact your admin.", variant: "destructive" });
    }
    setConnectingDrive(false);
  }

  async function handleDisconnectDrive() {
    if (!driveConn) return;
    await base44.entities.DriveConnection.update(driveConn.id, { status: "disconnected" });
    await base44.functions.invoke("logPrivacyEvent", { event_type: "drive_disconnected" });
    setDriveConn((d) => ({ ...d, status: "disconnected" }));
    toast({ title: "Google Drive disconnected" });
  }

  if (loading) return <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-[#1A3226]/40" /></div>;

  const driveConnected = driveConn?.status === "connected";

  return (
    <div className="space-y-8">
      {/* Google Drive */}
      <div>
        <h3 className="text-sm font-semibold text-[#1A3226] mb-1">Google Drive</h3>
        <p className="text-xs text-[#1A3226]/50 mb-3">Auto-sync completed analyses as PDFs to your Drive. Uses drive.file scope only.</p>
        <div className="rounded-xl border border-[#1A3226]/10 bg-white px-4 py-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${driveConnected ? "bg-emerald-50" : "bg-[#1A3226]/5"}`}>
            <HardDrive className={`w-5 h-5 ${driveConnected ? "text-emerald-600" : "text-[#1A3226]/30"}`} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#1A3226]">
              {driveConnected ? "Google Drive Connected" : "Connect Google Drive"}
            </p>
            <p className="text-xs text-[#1A3226]/50 mt-0.5">
              {driveConnected
                ? `Signed in as ${driveConn.google_account_email || "Google account"} · Last sync: ${driveConn.last_sync_at ? new Date(driveConn.last_sync_at).toLocaleDateString() : "Never"}`
                : "Sign in with Google to enable automatic PDF uploads after each analysis."}
            </p>
          </div>
          {driveConnected ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <Button variant="ghost" size="sm" className="h-7 text-xs text-red-400 hover:text-red-600" onClick={handleDisconnectDrive}>
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              className="bg-[#1A3226] text-white text-xs h-8 gap-1.5"
              onClick={handleConnectDrive}
              disabled={connectingDrive}
            >
              {connectingDrive ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
              Connect
            </Button>
          )}
        </div>
      </div>

      {/* CRM Integrations */}
      <div>
        <h3 className="text-sm font-semibold text-[#1A3226] mb-1">CRM Integrations</h3>
        <p className="text-xs text-[#1A3226]/50 mb-3">Connect your CRM to automatically push analysis summaries on completion.</p>
        <div className="space-y-2">
          {CRM_PROVIDERS.map((provider) => (
            <CrmProviderCard
              key={provider.id}
              provider={provider}
              existingConn={crmConns.find((c) => c.crm_provider === provider.id) || null}
              onSaved={load}
              onDeleted={load}
            />
          ))}
        </div>
      </div>
    </div>
  );
}