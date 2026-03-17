import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Check, AlertCircle } from "lucide-react";

const STATES = ["MA", "NH", "ME", "VT", "CT", "RI", "NY", "NJ", "PA"];

export default function FounderProfileSettings() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const me = await base44.auth.me();
        if (me?.role !== "platform_owner") {
          return;
        }
        setUser(me);

        const profiles = await base44.entities.FounderProfile.list();
        setProfile(
          profiles?.[0] || {
            founder_name: "[FOUNDER_NAME]",
            credentials_line: "Licensed Real Estate Broker · Team Lead",
            years_experience: 0,
            licensed_states: [],
            detail_1: "",
            detail_2: "",
            founder_statement: "",
            headshot_url: "",
          }
        );
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleStateToggle = (state) => {
    setProfile((prev) => {
      const states = prev.licensed_states || [];
      return {
        ...prev,
        licensed_states: states.includes(state)
          ? states.filter((s) => s !== state)
          : [...states, state],
      };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      await base44.entities.FounderProfile.update(profile.id, {
        founder_name: profile.founder_name,
        credentials_line: profile.credentials_line,
        years_experience: profile.years_experience,
        licensed_states: profile.licensed_states,
        detail_1: profile.detail_1,
        detail_2: profile.detail_2,
        founder_statement: profile.founder_statement,
        headshot_url: profile.headshot_url,
        updated_by: user?.email,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      const created = await base44.entities.FounderProfile.create({
        founder_name: profile.founder_name,
        credentials_line: profile.credentials_line,
        years_experience: profile.years_experience,
        licensed_states: profile.licensed_states,
        detail_1: profile.detail_1,
        detail_2: profile.detail_2,
        founder_statement: profile.founder_statement,
        headshot_url: profile.headshot_url,
        updated_by: user?.email,
      });
      setProfile(created);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user || user.role !== "platform_owner") {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-red-900">Admin Access Required</p>
          <p className="text-sm text-red-700 mt-1">Only platform owners can edit founder profile settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-[#1A3226] mb-2">Founder Profile Settings</h2>
        <p className="text-sm text-[#1A3226]/60">Configure founder credentials and messaging used throughout the app.</p>
      </div>

      <Card className="p-6 space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="font-semibold text-[#1A3226]">Founder Information</h3>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Founder Name</label>
            <Input
              value={profile?.founder_name || ""}
              onChange={(e) => handleChange("founder_name", e.target.value)}
              placeholder="[FOUNDER_NAME]"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Credentials Line</label>
            <Input
              value={profile?.credentials_line || ""}
              onChange={(e) => handleChange("credentials_line", e.target.value)}
              placeholder="e.g., Licensed Real Estate Broker · Team Lead"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Years Experience</label>
            <Input
              type="number"
              value={profile?.years_experience || 0}
              onChange={(e) => handleChange("years_experience", parseInt(e.target.value) || 0)}
              min="0"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-3">Licensed States</label>
            <div className="grid grid-cols-3 gap-2">
              {STATES.map((state) => (
                <button
                  key={state}
                  onClick={() => handleStateToggle(state)}
                  className={`py-2 px-3 rounded-lg border text-sm font-medium transition-colors ${
                    profile?.licensed_states?.includes(state)
                      ? "bg-[#1A3226] text-white border-[#1A3226]"
                      : "bg-white border-[#1A3226]/20 text-[#1A3226] hover:border-[#1A3226]/40"
                  }`}
                >
                  {state}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Credential/Stat 1 (e.g., "500+ Transactions")</label>
            <Input
              value={profile?.detail_1 || ""}
              onChange={(e) => handleChange("detail_1", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Credential/Stat 2 (e.g., "GRI Designate")</label>
            <Input
              value={profile?.detail_2 || ""}
              onChange={(e) => handleChange("detail_2", e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1A3226] block mb-2">Headshot URL</label>
            <Input
              value={profile?.headshot_url || ""}
              onChange={(e) => handleChange("headshot_url", e.target.value)}
              placeholder="https://..."
            />
            {profile?.headshot_url && (
              <img src={profile.headshot_url} alt="Headshot preview" className="w-32 h-32 rounded-lg mt-3 object-cover" />
            )}
          </div>
        </div>

        {/* Statement */}
        <div className="space-y-4 border-t pt-6">
          <h3 className="font-semibold text-[#1A3226]">Founder Statement</h3>
          <p className="text-xs text-[#1A3226]/60">Used on landing page and onboarding welcome.</p>

          <Textarea
            value={profile?.founder_statement || ""}
            onChange={(e) => handleChange("founder_statement", e.target.value)}
            placeholder="For [YEARS_EXPERIENCE] years I've sat across from sellers..."
            rows={12}
            className="font-mono text-sm"
          />
        </div>

        {/* Save */}
        <div className="border-t pt-6 flex items-center justify-between">
          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <Check className="w-4 h-4" />
              Saved successfully
            </div>
          )}
          <Button
            onClick={profile?.id ? handleSave : handleCreate}
            disabled={saving}
            className="ml-auto"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </Card>
    </div>
  );
}