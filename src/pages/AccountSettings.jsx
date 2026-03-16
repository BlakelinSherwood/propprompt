import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Settings, User, Key, Plug } from "lucide-react";
import CrmConnectedApps from "../components/CrmConnectedApps";
import DriveConnectedApp from "../components/DriveConnectedApp";

const TABS = [
  { key: "connected", label: "Connected Apps", icon: Plug },
];

export default function AccountSettings() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("connected");

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Account Settings
        </h1>
        {user && (
          <p className="text-sm text-[#1A3226]/50 mt-0.5">
            {user.full_name || user.email} · {user.role}
          </p>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-[#1A3226]/5 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? "bg-white text-[#1A3226] shadow-sm" : "text-[#1A3226]/60 hover:text-[#1A3226]"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "connected" && (
        <div className="space-y-6">
          {/* Google Drive */}
          <div>
            <h2 className="text-sm font-semibold text-[#1A3226] mb-3">Google Drive</h2>
            <DriveConnectedApp />
          </div>

          {/* CRM Integrations */}
          <div>
            <h2 className="text-sm font-semibold text-[#1A3226] mb-1">CRM Integrations</h2>
            <p className="text-xs text-[#1A3226]/40 mb-3">
              Connect your CRM to push analysis summaries directly to contact records. Full output text is never pushed — only a formatted key-findings summary.
            </p>
            <CrmConnectedApps />
          </div>
        </div>
      )}
    </div>
  );
}