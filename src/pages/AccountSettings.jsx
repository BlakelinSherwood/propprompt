import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, Link2, Key } from "lucide-react";
import ConnectedApps from "../components/ConnectedApps";

export default function AccountSettings() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  if (!user) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Account Settings
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-0.5">{user.email}</p>
      </div>

      <Tabs defaultValue="connected">
        <TabsList className="bg-[#1A3226]/5 border-0">
          <TabsTrigger value="profile" className="gap-1.5"><User className="w-3.5 h-3.5" />Profile</TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5"><Link2 className="w-3.5 h-3.5" />Connected Apps</TabsTrigger>
          <TabsTrigger value="apikeys" className="gap-1.5"><Key className="w-3.5 h-3.5" />AI API Keys</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6 space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1A3226] flex items-center justify-center text-white font-bold text-xl">
                {(user.full_name || user.email)[0].toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-[#1A3226]">{user.full_name || "—"}</p>
                <p className="text-sm text-[#1A3226]/50">{user.email}</p>
                <p className="text-xs text-[#1A3226]/40 mt-0.5 capitalize">{user.role?.replace(/_/g, " ")}</p>
              </div>
            </div>
            <p className="text-xs text-[#1A3226]/40 pt-2 border-t border-[#1A3226]/8">
              Profile editing is managed by your organization administrator or via the Compass login system.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="connected" className="mt-6">
          <ConnectedApps user={user} />
        </TabsContent>

        <TabsContent value="apikeys" className="mt-6">
          <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-6">
            <h3 className="text-sm font-semibold text-[#1A3226] mb-2">Personal AI API Keys</h3>
            <p className="text-xs text-[#1A3226]/60 mb-4">
              Add your own API keys to use instead of the S&C platform keys or your org's keys.
              Keys are encrypted with AES-256-GCM before storage and never returned to the frontend after saving.
            </p>
            <p className="text-xs text-[#1A3226]/40 border border-[#1A3226]/10 rounded-lg p-4 bg-[#FAF8F4]">
              Personal API key management UI coming soon. Contact your brokerage admin to configure org-level keys.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}