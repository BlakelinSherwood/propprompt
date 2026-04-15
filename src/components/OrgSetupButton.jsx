import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";

export default function OrgSetupButton() {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSetup = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("setupPlatformOwnerOrg", {});
      if (res.data.success) {
        setDone(true);
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (err) {
      console.error("Setup failed:", err);
      alert("Setup failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-700 text-sm">
        ✓ Organization created! Reloading...
      </div>
    );
  }

  return (
    <Button
      onClick={handleSetup}
      disabled={loading}
      className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
    >
      {loading ? "Setting up..." : "Create My Organization"}
    </Button>
  );
}