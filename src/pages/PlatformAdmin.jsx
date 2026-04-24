import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OrgsList from "../components/admin/platform/OrgsList";
import { Sparkles } from "lucide-react";
import PromptLibraryEditor from "../components/admin/platform/PromptLibraryEditor";
import PlatformAIConfig from "../components/admin/platform/PlatformAIConfig";
import PlatformAnalytics from "../components/admin/platform/PlatformAnalytics";
import ActivityLog from "./admin/ActivityLog";
import ApiHealthDashboard from "../components/admin/platform/ApiHealthDashboard";

export default function PlatformAdmin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((me) => {
      if (me.role !== "platform_owner") {
        navigate("/Dashboard");
      } else {
        setUser(me);
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">Loading…</div>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">Platform Owner</p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Platform Administration
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">
          Full access — all orgs, users, prompts, and global configuration.
        </p>
      </div>



      <Tabs defaultValue="orgs" className="w-full">
        <TabsList className="bg-[#1A3226]/5 border border-[#1A3226]/10">
          <TabsTrigger value="orgs">Organizations</TabsTrigger>
          <TabsTrigger value="prompts">Prompt Library</TabsTrigger>
          <TabsTrigger value="ai">AI Config</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="health">API Health</TabsTrigger>
          <TabsTrigger value="logs">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="orgs" className="mt-6">
          <OrgsList />
        </TabsContent>

        <TabsContent value="prompts" className="mt-6">
          <PromptLibraryEditor />
        </TabsContent>

        <TabsContent value="ai" className="mt-6">
          <PlatformAIConfig />
        </TabsContent>

        <TabsContent value="analytics" className="mt-6">
          <PlatformAnalytics />
        </TabsContent>

        <TabsContent value="health" className="mt-6">
          <ApiHealthDashboard />
        </TabsContent>

        <TabsContent value="logs" className="mt-6">
          <ActivityLog />
        </TabsContent>
      </Tabs>
    </div>
  );
}