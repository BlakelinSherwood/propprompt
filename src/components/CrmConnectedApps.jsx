import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link2, Link2Off, RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CRM_CONFIGS = [
  {
    key: "follow_up_boss",
    label: "Follow Up Boss",
    logo: "FUB",
    color: "bg-blue-600",
    fields: [{ name: "api_key", label: "API Key", placeholder: "Your FUB API key" }],
  },
  {
    key: "kvcore",
    label: "kvCORE",
    logo: "kv",
    color: "bg-green-600",
    fields: [
      { name: "api_key", label: "API Token", placeholder: "Your kvCORE API token" },
      { name: "instance_url", label: "Instance URL", placeholder: "https://yourdomain.kvcore.com" },
    ],
  },
  {
    key: "lofty",
    label: "Lofty (Chime)",
    logo: "LF",
    color: "bg-purple-600",
    fields: [{ name: "api_key", label: "API Key", placeholder: "Your Lofty API key" }],
  },
  {
    key: "salesforce",
    label: "Salesforce",
    logo: "SF",
    color: "bg-sky-500",
    fields: [
      { name: "instance_url", label: "Instance URL", placeholder: "https://yourdomain.salesforce.com" },
      { name: "api_key", label: "Access Token", placeholder: "OAuth access token" },
    ],
    note: "Salesforce requires OAuth 2.0. Paste a valid access token and your instance URL.",
  },
];

export default function CrmConnectedApps() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null); // crm key being connected
  const [forms, setForms] = useState({});
  const [status, setStatus] = useState({}); // { [key]: "success"|"error"|"msg" }
  const [expanded, setExpanded] = useState(null);

  const load = async () => {
    setLoading(true);
    const res = await base44.functions.invoke("crmConnect", { action: "list" });
    setConnections(res.data?.connections || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getConn = (key) => connections.find(c => c.crm_provider === key && c.status === "connected");

  const handleConnect = async (crmKey) => {
    const cfg = CRM_CONFIGS.find(c => c.key === crmKey);
    const form = forms[crmKey] || {};
    setConnecting(crmKey);
    const res = await base44.functions.invoke("crmConnect", {
      action: "connect",
      crm_provider: crmKey,
      api_key: form.api_key || "",
      instance_url: form.instance_url || "",
      crm_account_name: form.instance_url || cfg.label,
    });
    if (res.data?.success) {
      setStatus(s => ({ ...s, [crmKey]: "connected" }));
      setExpanded(null);
      await load();
    } else {
      setStatus(s => ({ ...s, [crmKey]: "error:" + (res.data?.error || "Failed") }));
    }
    setConnecting(null);
  };

  const handleDisconnect = async (conn) => {
    await base44.functions.invoke("crmConnect", { action: "disconnect", connection_id: conn.id });
    await load();
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-[#1A3226]/40" /></div>;

  return (
    <div className="space-y-3">
      {CRM_CONFIGS.map((cfg) => {
        const conn = getConn(cfg.key);
        const isExpanded = expanded === cfg.key;
        const form = forms[cfg.key] || {};
        const st = status[cfg.key] || "";

        return (
          <div key={cfg.key} className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${cfg.color} text-white text-xs font-bold flex items-center justify-center flex-shrink-0`}>
                  {cfg.logo}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1A3226]">{cfg.label}</p>
                  {conn ? (
                    <p className="text-xs text-emerald-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Connected
                    </p>
                  ) : (
                    <p className="text-xs text-[#1A3226]/40">Not connected</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conn ? (
                  <Button variant="outline" size="sm" onClick={() => handleDisconnect(conn)} className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                    <Link2Off className="w-3 h-3 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setExpanded(isExpanded ? null : cfg.key)} className="h-7 text-xs border-[#1A3226]/15">
                    <Link2 className="w-3 h-3 mr-1" /> Connect
                  </Button>
                )}
              </div>
            </div>

            {/* Expand connect form */}
            {!conn && isExpanded && (
              <div className="px-4 pb-4 border-t border-[#1A3226]/5 pt-3 space-y-3">
                {cfg.note && (
                  <p className="text-xs text-[#1A3226]/50 bg-[#FAF8F4] rounded-lg px-3 py-2">{cfg.note}</p>
                )}
                {cfg.fields.map(f => (
                  <div key={f.name}>
                    <Label className="text-xs text-[#1A3226]/60 mb-1 block">{f.label}</Label>
                    <Input
                      type={f.name === "api_key" ? "password" : "text"}
                      placeholder={f.placeholder}
                      value={form[f.name] || ""}
                      onChange={e => setForms(prev => ({ ...prev, [cfg.key]: { ...prev[cfg.key], [f.name]: e.target.value } }))}
                      className="border-[#1A3226]/15 focus:ring-[#B8982F]/30 text-sm h-8"
                    />
                  </div>
                ))}
                {st.startsWith("error:") && (
                  <p className="text-xs text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {st.replace("error:", "")}
                  </p>
                )}
                <Button
                  size="sm"
                  onClick={() => handleConnect(cfg.key)}
                  disabled={connecting === cfg.key}
                  className="w-full bg-[#1A3226] hover:bg-[#1A3226]/90 text-white h-8 text-xs"
                >
                  {connecting === cfg.key ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                  Save & Connect
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}