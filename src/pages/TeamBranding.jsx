import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, Loader2, X, ArrowLeft, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// ─── WCAG helpers ───────────────────────────────────────────────────────────
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relativeLuminance([r, g, b]) {
  return [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }).reduce((acc, c, i) => acc + c * [0.2126, 0.7152, 0.0722][i], 0);
}
function contrastWithWhite(hex) {
  try { return 1.05 / (relativeLuminance(hexToRgb(hex)) + 0.05); }
  catch { return 21; }
}

// ─── Resolved value helper ───────────────────────────────────────────────────
function resolved(overrides, inherited, key, fallback) {
  return overrides[key] !== undefined ? overrides[key] : (inherited[key] || fallback || "");
}

// ─── Color field ─────────────────────────────────────────────────────────────
function ColorField({ label, hint, value, onChange, disabled, placeholder }) {
  const inputRef = useRef(null);
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(value || "");
  const displayColor = isValid ? value : (/^#[0-9A-Fa-f]{6}$/.test(placeholder || "") ? placeholder : "#e5e7eb");
  return (
    <div>
      <label className="text-xs font-medium text-[#1A3226]/70 block mb-0.5">{label}</label>
      {hint && <p className="text-[10px] text-[#1A3226]/40 mb-1.5">{hint}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !disabled && inputRef.current?.click()}
          className="w-8 h-8 rounded-md border-2 border-gray-300 flex-shrink-0 shadow-sm"
          style={{ background: displayColor, opacity: disabled ? 0.5 : 1, cursor: disabled ? "default" : "pointer" }}
        />
        <input ref={inputRef} type="color" value={isValid ? value : "#333333"}
          onChange={e => onChange(e.target.value.toUpperCase())} className="sr-only" />
        <Input value={value || ""} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || "#333333"} disabled={disabled}
          className={`text-sm font-mono w-36 ${disabled ? "opacity-50 bg-gray-50" : ""}`} maxLength={7} />
      </div>
    </div>
  );
}

// ─── Override toggle row ──────────────────────────────────────────────────────
function OverrideRow({ label, isOverriding, onToggle, brokerageName, children }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#1A3226]">{label}</span>
        <button
          type="button"
          onClick={onToggle}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
            isOverriding
              ? "bg-[#1A3226] text-white border-[#1A3226]"
              : "bg-white text-[#1A3226]/60 border-[#1A3226]/20 hover:border-[#1A3226]/40"
          }`}
        >
          {isOverriding ? "Override" : "Use brokerage default"}
        </button>
      </div>
      {!isOverriding && (
        <p className="text-[10px] text-[#1A3226]/40 italic">Inherited from {brokerageName || "Brokerage"}</p>
      )}
      {children}
    </div>
  );
}

// ─── Live Preview ─────────────────────────────────────────────────────────────
function LivePreview({ resolvedForm }) {
  const primary = /^#[0-9A-Fa-f]{6}$/.test(resolvedForm.primary_color) ? resolvedForm.primary_color : "#333333";
  const accent = /^#[0-9A-Fa-f]{6}$/.test(resolvedForm.accent_color) ? resolvedForm.accent_color : "#666666";
  const bg = /^#[0-9A-Fa-f]{6}$/.test(resolvedForm.background_color) ? resolvedForm.background_color : "#FFFFFF";
  return (
    <div className="sticky top-24 space-y-2">
      <p className="text-xs text-[#1A3226]/50 leading-relaxed">
        Live document preview — updates as you type. Save to apply to all exported documents.
      </p>
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ background: bg }}>
        <div className="flex items-center justify-between px-4" style={{ background: primary, minHeight: 48 }}>
          {resolvedForm.logo_url
            ? <img src={resolvedForm.logo_url} alt="Logo" style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain" }} />
            : <div style={{ width: 80, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />
          }
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 11, fontFamily: "Georgia, serif" }}>
            {resolvedForm.org_name || "Your Team"}
          </span>
        </div>
        <div style={{ height: 3, background: accent }} />
        <div className="px-4 py-4 space-y-3">
          <div style={{ height: 8, borderRadius: 4, background: primary, opacity: 0.15, width: "60%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "90%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "75%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "83%" }} />
          <div className="overflow-hidden rounded" style={{ border: `1px solid ${accent}40` }}>
            <div style={{ background: primary, padding: "4px 8px" }}>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.5)", width: "40%" }} />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: "3px 8px", background: i % 2 === 0 ? `${primary}12` : bg, borderTop: `1px solid ${accent}20` }}>
                <div style={{ height: 5, borderRadius: 3, background: "#e5e7eb", width: `${50 + i * 10}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-2" style={{ borderTop: `1px solid ${accent}` }}>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "#888", fontFamily: "Calibri, sans-serif" }}>
              {[resolvedForm.org_name, resolvedForm.phone, resolvedForm.website].filter(Boolean).join("  |  ") || "Team Name  |  Phone  |  Website"}
            </span>
            <span style={{ fontSize: 9, color: "#888" }}>Page 1 of 4</span>
            <span style={{ fontSize: 9, color: "#bbb" }}>Prepared by PropPrompt™</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── KEYS that can be overridden ──────────────────────────────────────────────
const OVERRIDE_KEYS = ["logo_url", "primary_color", "accent_color", "background_color", "org_name", "address", "phone", "website", "tagline"];

export default function TeamBranding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [org, setOrg] = useState(null);
  const [brokerageBranding, setBrokerageBranding] = useState({});
  const [brokerageName, setBrokerageName] = useState("");

  // overrides = only the fields the team has chosen to override (key → value)
  const [overrides, setOverrides] = useState({});
  // which keys are currently toggled to "override"
  const [overridingKeys, setOverridingKeys] = useState(new Set());

  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      const memberships = await base44.entities.OrgMembership.filter({ user_email: me.email, org_id: id });
      const mem = memberships[0];
      if (!mem || mem.role_in_org !== "team_lead") { setUnauthorized(true); return; }

      const orgs = await base44.entities.Organization.filter({ id });
      const team = orgs[0];
      setOrg(team);

      // Load parent brokerage branding
      if (team?.parent_org_id) {
        const parentOrgs = await base44.entities.Organization.filter({ id: team.parent_org_id });
        setBrokerageName(parentOrgs[0]?.name || "Brokerage");
        const parentBranding = await base44.entities.OrgBranding.filter({ org_id: team.parent_org_id });
        if (parentBranding[0]) setBrokerageBranding(parentBranding[0]);
      }

      // Load team's own branding overrides
      const teamBranding = await base44.entities.OrgBranding.filter({ org_id: id });
      if (teamBranding[0]) {
        const b = teamBranding[0];
        setExistingId(b.id);
        const savedOverrides = {};
        const savedOverridingKeys = new Set();
        OVERRIDE_KEYS.forEach(k => {
          if (b[k] !== undefined && b[k] !== null && b[k] !== "") {
            savedOverrides[k] = b[k];
            savedOverridingKeys.add(k);
          }
        });
        setOverrides(savedOverrides);
        setOverridingKeys(savedOverridingKeys);
      }
    }
    load().catch(() => {});
  }, [id]);

  // Resolved = team override OR brokerage fallback
  const resolvedForm = {
    logo_url: resolved(overrides, brokerageBranding, "logo_url", ""),
    primary_color: resolved(overrides, brokerageBranding, "primary_color", "#333333"),
    accent_color: resolved(overrides, brokerageBranding, "accent_color", "#666666"),
    background_color: resolved(overrides, brokerageBranding, "background_color", "#FFFFFF"),
    org_name: resolved(overrides, brokerageBranding, "org_name", org?.name || ""),
    address: resolved(overrides, brokerageBranding, "address", ""),
    phone: resolved(overrides, brokerageBranding, "phone", ""),
    website: resolved(overrides, brokerageBranding, "website", ""),
    tagline: resolved(overrides, brokerageBranding, "tagline", ""),
  };

  const isOverriding = (key) => overridingKeys.has(key);

  const toggleOverride = (key) => {
    setOverridingKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        // Clear override value
        setOverrides(o => { const n = { ...o }; delete n[key]; return n; });
      } else {
        next.add(key);
        // Seed with inherited value so user sees it
        setOverrides(o => ({ ...o, [key]: brokerageBranding[key] || "" }));
      }
      return next;
    });
  };

  const setOverride = (key) => (value) => {
    setOverrides(o => ({ ...o, [key]: value }));
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    if (!file.type.match(/image\/(png|jpeg|svg\+xml)/)) return toast({ title: "Only PNG, JPG, or SVG accepted", variant: "destructive" });
    if (file.size > 2 * 1024 * 1024) return toast({ title: "Logo must be under 2MB", variant: "destructive" });
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setOverrides(o => ({ ...o, logo_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    const me = await base44.auth.me();
    setSaving(true);
    // Only save overriding keys
    const payload = { org_id: id, updated_by: me.email };
    overridingKeys.forEach(k => { payload[k] = overrides[k]; });
    if (existingId) {
      await base44.entities.OrgBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.OrgBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false);
    toast({ title: "Branding saved." });
  };

  const handleResetAll = async () => {
    setOverrides({});
    setOverridingKeys(new Set());
    setShowResetConfirm(false);
    if (existingId) {
      // Wipe all override fields
      const blank = {};
      OVERRIDE_KEYS.forEach(k => { blank[k] = null; });
      await base44.entities.OrgBranding.update(existingId, blank);
    }
    toast({ title: "Reset to brokerage defaults." });
  };

  const lowContrast = (() => {
    const color = isOverriding("primary_color") ? overrides.primary_color : brokerageBranding.primary_color;
    try { return contrastWithWhite(color) < 4.5; } catch { return false; }
  })();

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">
        Access restricted to team leads.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/team/${id}/admin`)} className="text-[#1A3226]/60 hover:text-[#1A3226]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Team Admin
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          {org?.name ? `${org.name} — Branding` : "Team Branding"}
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-0.5">Override brokerage branding for this team's documents</p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          Brokerage branding is applied to all exported PDFs, presentations, and emailed reports. It does not affect the app interface.
          Fields left as "Use brokerage default" automatically inherit from <strong>{brokerageName || "the parent brokerage"}</strong>.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LEFT: Form */}
        <div className="space-y-8">

          {/* Section A: Logo */}
          <div className="space-y-3">
            <OverrideRow label="Logo" isOverriding={isOverriding("logo_url")}
              onToggle={() => toggleOverride("logo_url")} brokerageName={brokerageName}>
              {!isOverriding("logo_url") ? (
                <div className="border border-dashed border-[#1A3226]/15 rounded-xl p-4 flex flex-col items-center gap-2 bg-gray-50">
                  {brokerageBranding.logo_url
                    ? <>
                        <img src={brokerageBranding.logo_url} alt="Brokerage Logo"
                          style={{ maxWidth: 200, maxHeight: 80, objectFit: "contain", opacity: 0.6 }} />
                        <p className="text-xs text-[#1A3226]/40 italic">Using brokerage logo</p>
                      </>
                    : <p className="text-xs text-[#1A3226]/30 italic">No brokerage logo set</p>
                  }
                </div>
              ) : (
                <div
                  className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                    dragOver ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/20 hover:border-[#1A3226]/40"
                  }`}
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
                >
                  {overrides.logo_url ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="border border-gray-200 rounded-lg p-3 bg-white">
                        <img src={overrides.logo_url} alt="Team Logo"
                          style={{ maxWidth: 200, maxHeight: 80, objectFit: "contain" }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          Replace
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600"
                          onClick={e => { e.stopPropagation(); setOverride("logo_url")(""); }}>
                          <X className="w-3.5 h-3.5 mr-1" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="w-14 h-14 rounded-xl bg-[#1A3226]/10 flex items-center justify-center">
                        {uploading ? <Loader2 className="w-6 h-6 text-[#1A3226]/40 animate-spin" />
                          : <Upload className="w-6 h-6 text-[#1A3226]/30" />}
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium text-[#1A3226]">Click or drag to upload team logo</p>
                        <p className="text-xs text-[#1A3226]/40 mt-0.5">PNG, JPG, or SVG — max 2MB</p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </OverrideRow>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
              onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
          </div>

          {/* Section B: Colors */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Colors</h2>
            <OverrideRow label="Primary Color" isOverriding={isOverriding("primary_color")}
              onToggle={() => toggleOverride("primary_color")} brokerageName={brokerageName}>
              <ColorField label="" hint="Headers, dividers, table headers"
                value={isOverriding("primary_color") ? (overrides.primary_color || "") : (brokerageBranding.primary_color || "#333333")}
                onChange={setOverride("primary_color")}
                disabled={!isOverriding("primary_color")}
                placeholder={brokerageBranding.primary_color || "#333333"} />
            </OverrideRow>
            {lowContrast && (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                White text on this color may be hard to read on documents. Consider a darker shade.
              </div>
            )}
            <OverrideRow label="Accent Color" isOverriding={isOverriding("accent_color")}
              onToggle={() => toggleOverride("accent_color")} brokerageName={brokerageName}>
              <ColorField label="" hint="Highlights, callouts, borders"
                value={isOverriding("accent_color") ? (overrides.accent_color || "") : (brokerageBranding.accent_color || "#666666")}
                onChange={setOverride("accent_color")}
                disabled={!isOverriding("accent_color")}
                placeholder={brokerageBranding.accent_color || "#666666"} />
            </OverrideRow>
            <OverrideRow label="Background Color" isOverriding={isOverriding("background_color")}
              onToggle={() => toggleOverride("background_color")} brokerageName={brokerageName}>
              <ColorField label="" hint="Document background — usually white"
                value={isOverriding("background_color") ? (overrides.background_color || "") : (brokerageBranding.background_color || "#FFFFFF")}
                onChange={setOverride("background_color")}
                disabled={!isOverriding("background_color")}
                placeholder={brokerageBranding.background_color || "#FFFFFF"} />
            </OverrideRow>
          </div>

          {/* Section C: Org Details */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Organization Details</h2>
            {[
              { key: "org_name", label: "Organization Name", placeholder: "Your Team Name" },
              { key: "address", label: "Address", placeholder: "123 Main St, Boston, MA" },
              { key: "phone", label: "Phone", placeholder: "(617) 555-0100" },
              { key: "website", label: "Website", placeholder: "https://yourteam.com" },
              { key: "tagline", label: "Tagline (optional)", placeholder: "Serving Greater Boston" },
            ].map(({ key, label, placeholder }) => (
              <OverrideRow key={key} label={label} isOverriding={isOverriding(key)}
                onToggle={() => toggleOverride(key)} brokerageName={brokerageName}>
                <Input
                  value={isOverriding(key) ? (overrides[key] || "") : (brokerageBranding[key] || "")}
                  onChange={e => setOverride(key)(e.target.value)}
                  placeholder={brokerageBranding[key] || placeholder}
                  disabled={!isOverriding(key)}
                  className={`text-sm ${!isOverriding(key) ? "opacity-50 bg-gray-50" : ""}`}
                />
              </OverrideRow>
            ))}
          </div>

          {/* Section D: Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Branding"}
            </Button>
            <Button variant="outline" onClick={() => setShowResetConfirm(true)}
              className="gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300">
              <RotateCcw className="w-4 h-4" />
              Reset all to brokerage defaults
            </Button>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div>
          <LivePreview resolvedForm={resolvedForm} />
        </div>
      </div>

      {/* Reset Confirm Dialog */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-[#1A3226]">Reset to brokerage defaults?</h3>
            <p className="text-sm text-[#1A3226]/60">
              All team-level overrides will be cleared. Your documents will use {brokerageName || "the parent brokerage"}'s branding settings going forward.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowResetConfirm(false)}
                className="text-sm text-[#1A3226]/50 hover:text-[#1A3226] px-3 py-1.5">
                Cancel
              </button>
              <button onClick={handleResetAll}
                className="bg-red-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-red-700 transition-colors">
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}