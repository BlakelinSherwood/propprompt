import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import ApiKeysTab from "../../components/admin/ai/ApiKeysTab";
import EnsembleTab from "../../components/admin/ai/EnsembleTab";
import UsageStatsTab from "../../components/admin/ai/UsageStatsTab";

export default function AiSettings() {
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me()
      .then((me) => {
        if (me?.role !== "admin" && me?.role !== "platform_owner") {
          navigate("/Dashboard");
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/PlatformAdmin")} className="mt-1 text-[#1A3226]/50 hover:text-[#1A3226]">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Platform Owner · AI Infrastructure</p>
          <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
            AI Models & Settings
          </h1>
          <p className="text-sm text-[#1A3226]/50 mt-1">
            Manage API keys, model routing, Ensemble AI, and usage analytics.
          </p>
        </div>
      </div>

      <Tabs defaultValue="keys" className="w-full">
        <TabsList className="bg-[#1A3226]/5 border border-[#1A3226]/10">
          <TabsTrigger value="keys">API Keys & Providers</TabsTrigger>
          <TabsTrigger value="ensemble">Ensemble AI</TabsTrigger>
          <TabsTrigger value="usage">Usage Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="keys" className="mt-6">
          <ApiKeysTab />
        </TabsContent>

        <TabsContent value="ensemble" className="mt-6">
          <EnsembleTab />
        </TabsContent>

        <TabsContent value="usage" className="mt-6">
          <UsageStatsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}