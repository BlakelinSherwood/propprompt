import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Plug, Palette } from "lucide-react";
import AiApiKeyManager from "../components/AiApiKeyManager";
import CrmConnectedApps from "../components/CrmConnectedApps";
import DriveConnectedApp from "../components/DriveConnectedApp";
import AgentBrandingSettings from "../components/AgentBrandingSettings";

const TABS = [
  { key: "connected", label: "Connected Apps", icon: Plug },
  { key: "branding", label: "My Branding", icon: Palette },
];

export default function AccountSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("connected");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  async function handleDeleteAccount() {
    if (confirmText !== "DELETE") return;
    setDeleteLoading(true);
    await base44.functions.invoke("deleteAccount", {});
    base44.auth.logout("/");
  }

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

      {tab === "branding" && <AgentBrandingSettings />}

      {tab === "connected" && (
        <div className="space-y-6">
          {/* Google Drive */}
          <div>
            <h2 className="text-sm font-semibold text-[#1A3226] mb-3">Google Drive</h2>
            <DriveConnectedApp />
          </div>

          {/* AI API Keys */}
          <div>
            <h2 className="text-sm font-semibold text-[#1A3226] mb-1">AI API Keys</h2>
            <p className="text-xs text-[#1A3226]/40 mb-3">
              Add your own API keys to use ChatGPT for analyses.
            </p>
            <AiApiKeyManager />
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

      {/* Danger Zone */}
      <div className="border border-red-200 rounded-xl p-4 mt-8">
        <h2 className="text-sm font-semibold text-red-600 mb-1 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h2>
        <p className="text-xs text-[#1A3226]/50 mb-3">
          Permanently delete your account and all associated data. This action is irreversible and GDPR-compliant.
        </p>
        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm text-red-600 border border-red-200 rounded-lg px-4 py-2 hover:bg-red-50 transition-colors"
          >
            Delete My Account
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-red-600 font-medium">Type DELETE to confirm:</p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-300"
            />
            <div className="flex gap-2">
              <button
                onClick={handleDeleteAccount}
                disabled={confirmText !== "DELETE" || deleteLoading}
                className="text-sm bg-red-600 text-white rounded-lg px-4 py-2 hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleteLoading ? "Deleting…" : "Permanently Delete Account"}
              </button>
              <button
                onClick={() => { setShowDeleteConfirm(false); setConfirmText(""); }}
                className="text-sm text-[#1A3226]/60 border border-[#1A3226]/10 rounded-lg px-4 py-2 hover:bg-[#1A3226]/5"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}