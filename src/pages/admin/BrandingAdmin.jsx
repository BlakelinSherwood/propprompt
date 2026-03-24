import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import PresetPicker from "@/components/branding/PresetPicker";
import CustomColors from "@/components/branding/CustomColors";
import LogoUpload from "@/components/branding/LogoUpload";

const BRANDING_ROLES = ["team_lead", "brokerage_owner", "platform_owner"];

function normalizeHex(val) {
  let v = (val || "").trim();
  if (!v.startsWith("#")) v = "#" + v;
  return v.toUpperCase();
}

function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

export default function BrandingAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const [existingRecord, setExistingRecord] = useState(null);
  const [primary, setPrimary] = useState("#1A3226");
  const [accent, setAccent] = useState("#B8982F");
  const [presetName, setPresetName] = useState("Sherwood & Company");
  const [logoUrl, setLogoUrl] = useState(null);
  const [headshotUrl, setHeadshotUrl] = useState(null);
  const [primaryError, setPrimaryError] = useState(null);
  const [accentError, setAccentError] = useState(null);

  useEffect(() => {
    base44.auth.me().then(me => {
      if (!BRANDING_ROLES.includes(me?.role)) {
        navigate("/Dashboard", { replace: true });
        return;
      }
      setUser(me);
      loadBranding(me);
    }).catch(() => navigate("/Dashboard", { replace: true }));
  }, []);

  async function loadBranding(me) {
    const orgId = me?.org_id || me?.id;
    if (!orgId) { setLoading(false); return; }
    const records = await base44.entities.BrandingConfig.filter({ org_id: orgId });
    const rec = records[0];
    if (rec) {
      setExistingRecord(rec);
      setPrimary(rec.primary_color || "#1A3226");
      setAccent(rec.accent_color || "#B8982F");
      setPresetName(rec.preset_name || "Custom");
      setLogoUrl(rec.org_logo_url || null);
      setHeadshotUrl(rec.agent_headshot_url || null);
    }
    setLoading(false);
  }

  function handlePresetSelect(preset) {
    setPrimary(preset.primary.toUpperCase());
    setAccent(preset.accent.toUpperCase());
    setPresetName(preset.name);
    setPrimaryError(null);
    setAccentError(null);
  }

  function handlePrimaryChange(val) {
    setPrimary(val);
    // If colors no longer match any preset, set to Custom
    setPresetName("Custom");
    setPrimaryError(null);
  }

  function handleAccentChange(val) {
    setAccent(val);
    setPresetName("Custom");
    setAccentError(null);
  }

  async function handleSave() {
    let valid = true;
    const normPrimary = normalizeHex(primary);
    const normAccent = normalizeHex(accent);

    if (!isValidHex(normPrimary)) { setPrimaryError("Invalid hex color (e.g. #1A3226)"); valid = false; }
    if (!isValidHex(normAccent)) { setAccentError("Invalid hex color (e.g. #B8982F)"); valid = false; }
    if (!valid) return;

    setSaving(true);
    setSaveError(null);

    const orgId = user?.org_id || user?.id;
    const payload = {
      org_id: orgId,
      primary_color: normPrimary,
      accent_color: normAccent,
      background_color: "#FFFFFF",
      preset_name: presetName,
      org_logo_url: logoUrl,
      agent_headshot_url: headshotUrl,
      updated_by: user?.id || user?.email,
      updated_at: new Date().toISOString(),
    };

    if (existingRecord?.id) {
      await base44.entities.BrandingConfig.update(existingRecord.id, payload);
    } else {
      const created = await base44.entities.BrandingConfig.create(payload);
      setExistingRecord(created);
    }

    setSaving(false);
    toast({ description: "Brand settings saved. New reports will use these colors." });
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-[#1A3226]/40">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  );

  const orgName = user?.org_name || user?.full_name || "Your Organization";

  const lastSaved = existingRecord?.updated_at ? (() => {
    const d = new Date(existingRecord.updated_at);
    return `Last saved by ${existingRecord.updated_by || "—"} on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
  })() : null;

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <p className="text-[#B8982F] text-xs font-medium uppercase tracking-widest mb-1">
          Platform Owner · Branding
        </p>
        <h1 className="text-2xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          Brand & Color Settings
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-1">
          Customize how your reports look. Changes apply to all new reports generated under your organization.
        </p>
      </div>

      {/* Section 1 — Preset Picker */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-[#1A3226] uppercase tracking-wide">Choose a Preset</h2>
        <PresetPicker selectedPreset={presetName} onSelect={handlePresetSelect} />
      </div>

      {/* Section 2 — Custom Colors */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl p-6">
        <CustomColors
          primary={primary}
          accent={accent}
          orgName={orgName}
          onPrimaryChange={handlePrimaryChange}
          onAccentChange={handleAccentChange}
          primaryError={primaryError}
          accentError={accentError}
        />
      </div>

      {/* Section 3 — Logo Upload */}
      <div className="bg-white border border-[#1A3226]/10 rounded-xl p-6 space-y-3">
        <h2 className="text-sm font-semibold text-[#1A3226] uppercase tracking-wide">Logos & Headshot</h2>
        <LogoUpload
          logoUrl={logoUrl}
          headshotUrl={headshotUrl}
          onLogoChange={setLogoUrl}
          onHeadshotChange={setHeadshotUrl}
        />
      </div>

      {/* Section 4 — Save */}
      <div className="space-y-3">
        {lastSaved && (
          <p className="text-xs text-[#1A3226]/40 text-right">{lastSaved}</p>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-2 h-11 text-sm font-medium"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save Brand Settings"}
        </Button>
        {saveError && (
          <p className="text-sm text-red-500 text-center">{saveError}</p>
        )}
      </div>
    </div>
  );
}