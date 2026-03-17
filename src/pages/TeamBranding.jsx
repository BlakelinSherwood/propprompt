import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, Loader2, X, ArrowLeft, Info, AlertTriangle, RotateCcw } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// WCAG contrast helpers
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relativeLuminance([r, g, b]) {
  return [r, g, b].reduce((acc, v, i) => {
    const s = v / 255;
    const c = s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    return acc + c * [0.2126, 0.7152, 0.0722][i];
  }, 0);
}
function contrastWithWhite(hex) {
  try { return 1.05 / (relativeLuminance(hexToRgb(hex)) + 0.05); } catch { return 21; }
}

const FIELD_KEYS = ["logo", "primary_color", "accent_color", "background_color", "org_name", "address", "phone", "website", "tagline"];

// Resolved value: team override or brokerage fallback
function resolved(key, overrides, brokerage) {
  if (key === "logo") {
    return overrides.logo_url || brokerage.logo_url || "";
  }
  const map = {
    primary_color: "primary_color", accent_color: "accent_color",
    background_color: "background_color", org_name: "org_name",
    address: "address", phone: "phone", website: "website", tagline: "tagline",
  };
  return overrides[map[key]] ?? brokerage[map[key]] ?? "";
}

function ColorField({ label, hint, value, onChange, disabled, inherited }) {
  const inputRef = useRef(null);
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(value || "");
  return (
    <div>
      <label className="text-xs font-medium text-[#1A3226]/70 block mb-0.5">{label}</label>
      {hint && <p className="text-[10px] text-[#1A3226]/40 mb-1.5">{hint}</p>}
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-md border-2 flex-shrink-0 shadow-sm"
          style={{ background: isValid ? value : "#e5e7eb", borderColor: "#d1d5db", opacity: disabled ? 0.5 : 1 }}
        />
        {!disabled && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="w-6 h-6 rounded border border-gray-300 cursor-pointer bg-white text-[10px] text-gray-500 flex items-center justify-center"
              title="Pick color"
            >🎨</button>
            <input ref={inputRef} type="color" value={isValid ? value : "#333333"}
              onChange={e => onChange(e.target.value.toUpperCase())} className="sr-only" />
          </>
        )}
        <Input
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={inherited || "#333333"}
          disabled={disabled}
          className={`text-sm font-mono w-36 ${disabled ? "bg-gray-50 text-gray-400" : ""}`}
          maxLength={7}
        />
        {disabled && inherited && (
          <span className="text-[10px] text-gray-400 italic truncate max-w-[120px]">{inherited}</span>
        )}
      </div>
    </div>
  );
}

function LivePreview({ primary, accent, bg, logo, orgName, phone, website }) {
  const pc = /^#[0-9A-Fa-f]{6}$/.test(primary) ? primary : "#333333";
  const ac = /^#[0-9A-Fa-f]{6}$/.test(accent) ? accent : "#666666";
  const bc = /^#[0-9A-Fa-f]{6}$/.test(bg) ? bg : "#FFFFFF";
  return (
    <div className="sticky top-24 space-y-2">
      <p className="text-xs text-[#1A3226]/50 leading-relaxed">
        Live document preview — updates as you type. Save to apply to all exported documents.
      </p>
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ background: bc }}>
        <div className="flex items-center justify-between px-4" style={{ background: pc, minHeight: 48 }}>
          {logo
            ? <img src={logo} alt="Logo" style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain" }} />
            : <div style={{ width: 80, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />}
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 11, fontFamily: "Georgia, serif" }}>
            {orgName || "Your Organization"}
          </span>
        </div>
        <div style={{ height: 3, background: ac }} />
        <div className="px-4 py-4 space-y-3">
          <div style={{ height: 8, borderRadius: 4, background: pc, opacity: 0.15, width: "60%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "90%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "75%" }} />
          <div className="mt-2 overflow-hidden rounded" style={{ border: `1px solid ${ac}40` }}>
            <div style={{ background: pc, padding: "4px 8px" }}>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.5)", width: "40%" }} />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: "3px 8px", background: i % 2 === 0 ? `${pc}12` : bc, borderTop: `1px solid ${ac}20` }}>
                <div style={{ height: 5, borderRadius: 3, background: "#e5e7eb", width: `${50 + i * 10}%` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="px-4 py-2" style={{ borderTop: `1px solid ${ac}` }}>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "#888", fontFamily: "Calibri, sans-serif" }}>
              {[orgName, phone, website].filter(Boolean).join("  |  ") || "Org Name  |  Phone  |  Website"}
            </span>
            <span style={{ fontSize: 9, color: "#888" }}>Page 1 of 4</span>
            <span style={{ fontSize: 9, color: "#bbb" }}>Prepared by PropPrompt™</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function OverrideRow({ label, fieldKey, overrides, setOverrides, brokerageName }) {
  const isOverriding = overrides._overriding.has(fieldKey);
  const toggle = () => {
    setOverrides(prev => {
      const next = { ...prev, _overriding: new Set(prev._overriding) };
      if (isOverriding) {
        next._overriding.delete(fieldKey);
        delete next[fieldKey];
      } else {
        next._overriding.add(fieldKey);
      }
      return next;
    });
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-[#1A3226]">{label}</span>
      <button
        type="button"
        onClick={toggle}
        className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border transition-all font-medium ${
          isOverriding
            ? "bg-[#1A3226] text-white border-[#1A3226]"
            : "bg-gray-100 text-gray-500 border-gray-200 hover:border-[#1A3226]/30"
        }`}
      >
        {isOverriding ? "Override" : `Inherited from ${brokerageName || "brokerage"}`}
      </button>
    </div>
  );
}

export default function TeamBranding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [org, setOrg] = useState(null);
  const [parentBrokerage, setParentBrokerage] = useState(null);
  const [brokerageB, setBrokerageB] = useState({});
  const [existingId, setExistingId] = useState(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // overrides: contains only explicitly overridden fields + _overriding Set
  const [overrides, setOverrides] = useState({ _overriding: new Set() });

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      const memberships = await base44.entities.OrgMembership.filter({ user_email: me.email, org_id: id });
      const mem = memberships[0];
      if (!mem || mem.role_in_org !== "team_lead") { setUnauthorized(true); return; }

      const orgs = await base44.entities.Organization.filter({ id });
      const teamOrg = orgs[0];
      setOrg(teamOrg);

      // Load parent brokerage + its branding
      if (teamOrg?.parent_org_id) {
        const parentOrgs = await base44.entities.Organization.filter({ id: teamOrg.parent_org_id });
        const parent = parentOrgs[0];
        setParentBrokerage(parent);
        if (parent) {
          const pBrandings = await base44.entities.OrgBranding.filter({ org_id: parent.id });
          setBrokerageB(pBrandings[0] || { org_name: parent.name });
        }
      }

      // Load existing team branding
      const teamBrandings = await base44.entities.OrgBranding.filter({ org_id: id });
      if (teamBrandings[0]) {
        const b = teamBrandings[0];
        setExistingId(b.id);
        const overriding = new Set();
        const init = { _overriding: overriding };
        const KEYS = ["logo_url", "primary_color", "accent_color", "background_color", "org_name", "address", "phone", "website", "tagline"];
        KEYS.forEach(k => {
          if (b[k]) { overriding.add(k === "logo_url" ? "logo" : k); init[k === "logo_url" ? "logo_url" : k] = b[k]; }
        });
        setOverrides(init);
      }
    }
    load().catch(() => {});
  }, [id]);

  const handleLogoUpload = async (file) => {
    if (!file) return;
    if (!file.type.match(/image\/(png|jpeg|svg\+xml)/)) return toast({ title: "Only PNG, JPG, or SVG accepted", variant: "destructive" });
    if (file.size > 2 * 1024 * 1024) return toast({ title: "Logo must be under 2MB", variant: "destructive" });
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setOverrides(prev => ({ ...prev, logo_url: file_url, _overriding: new Set([...prev._overriding, "logo"]) }));
    setUploading(false);
  };

  const handleSave = async () => {
    const me = await base44.auth.me();
    setSaving(true);
    const payload = { org_id: id, updated_by: me.email };
    if (overrides._overriding.has("logo")) payload.logo_url = overrides.logo_url || "";
    ["primary_color", "accent_color", "background_color", "org_name", "address", "phone", "website", "tagline"].forEach(k => {
      if (overrides._overriding.has(k)) payload[k] = overrides[k] || "";
    });
    if (existingId) {
      await base44.entities.OrgBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.OrgBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false);
    toast({ title: "Branding saved." });
  };

  const handleReset = () => {
    setOverrides({ _overriding: new Set() });
    setConfirmReset(false);
    toast({ title: "Reset to brokerage defaults." });
  };

  const setField = (key) => (val) => setOverrides(prev => ({ ...prev, [key]: val }));

  const isOverriding = (key) => overrides._overriding.has(key);

  // Resolved values for live preview
  const rv = {
    primary_color: isOverriding("primary_color") ? (overrides.primary_color || "") : (brokerageB.primary_color || "#333333"),
    accent_color: isOverriding("accent_color") ? (overrides.accent_color || "") : (brokerageB.accent_color || "#666666"),
    background_color: isOverriding("background_color") ? (overrides.background_color || "") : (brokerageB.background_color || "#FFFFFF"),
    org_name: isOverriding("org_name") ? overrides.org_name : (brokerageB.org_name || parentBrokerage?.name || ""),
    phone: isOverriding("phone") ? overrides.phone : (brokerageB.phone || ""),
    website: isOverriding("website") ? overrides.website : (brokerageB.website || ""),
    logo: isOverriding("logo") ? overrides.logo_url : (brokerageB.logo_url || ""),
  };

  const brokerageName = parentBrokerage?.name || "brokerage";
  const lowContrast = (() => { try { return contrastWithWhite(rv.primary_color) < 4.5; } catch { return false; } })();

  if (unauthorized) {
    return <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">Access restricted to team leads.</div>;
  }

  const TEXT_FIELDS = [
    { key: "org_name", label: "Team Name" },
    { key: "address", label: "Address" },
    { key: "phone", label: "Phone" },
    { key: "website", label: "Website" },
    { key: "tagline", label: "Tagline (optional)" },
  ];

  const COLOR_FIELDS = [
    { key: "primary_color", label: "Primary Color", hint: "Headers, dividers, table headers" },
    { key: "accent_color", label: "Accent Color", hint: "Highlights, callouts, borders" },
    { key: "background_color", label: "Background Color", hint: "Document background — usually white" },
  ];

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
        <p className="text-sm text-[#1A3226]/50 mt-0.5">Team document branding — overrides brokerage defaults where set</p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          Team branding overrides your brokerage defaults on exported PDFs, presentations, and emailed reports. Fields left as "Inherited" will use the brokerage value at document generation time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LEFT: Form */}
        <div className="space-y-8">

          {/* Section A: Logo */}
          <div className="space-y-3">
            <OverrideRow label="Logo" fieldKey="logo" overrides={overrides} setOverrides={setOverrides} brokerageName={brokerageName} />
            {!isOverriding("logo") ? (
              <div className="border-2 border-dashed border-[#1A3226]/10 rounded-xl p-5 flex flex-col items-center gap-2 bg-gray-50">
                {brokerageB.logo_url ? (
                  <>
                    <div className="border border-gray-200 rounded-lg p-3 bg-white">
                      <img src={brokerageB.logo_url} alt="Brokerage Logo" style={{ maxWidth: 200, maxHeight: 60, objectFit: "contain" }} />
                    </div>
                    <span className="text-xs text-gray-400 italic">Using brokerage logo</span>
                  </>
                ) : (
                  <span className="text-xs text-gray-400 italic">No brokerage logo set</span>
                )}
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
                      <img src={overrides.logo_url} alt="Team Logo" style={{ maxWidth: 200, maxHeight: 80, objectFit: "contain" }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                        {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                        Replace
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600"
                        onClick={e => { e.stopPropagation(); setField("logo_url")(""); }}>
                        <X className="w-3.5 h-3.5 mr-1" /> Remove
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-xl bg-[#1A3226]/10 flex items-center justify-center">
                      {uploading ? <Loader2 className="w-6 h-6 text-[#1A3226]/40 animate-spin" /> : <Upload className="w-6 h-6 text-[#1A3226]/30" />}
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-[#1A3226]">Click or drag to upload team logo</p>
                      <p className="text-xs text-[#1A3226]/40 mt-0.5">PNG, JPG, or SVG — max 2MB</p>
                    </div>
                  </>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
              onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
          </div>

          {/* Section B: Colors */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Colors</h2>
            {COLOR_FIELDS.map(({ key, label, hint }) => (
              <div key={key} className="space-y-1.5">
                <OverrideRow label={label} fieldKey={key} overrides={overrides} setOverrides={setOverrides} brokerageName={brokerageName} />
                <ColorField
                  label=""
                  hint={hint}
                  value={isOverriding(key) ? (overrides[key] || "") : (brokerageB[key] || "")}
                  onChange={isOverriding(key) ? setField(key) : () => {}}
                  disabled={!isOverriding(key)}
                  inherited={brokerageB[key]}
                />
                {key === "primary_color" && lowContrast && isOverriding(key) && (
                  <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    White text on this color may be hard to read on documents. Consider a darker shade.
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Section C: Text fields */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Organization Details</h2>
            {TEXT_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <OverrideRow label={label} fieldKey={key} overrides={overrides} setOverrides={setOverrides} brokerageName={brokerageName} />
                <Input
                  value={isOverriding(key) ? (overrides[key] || "") : ""}
                  onChange={e => setField(key)(e.target.value)}
                  placeholder={brokerageB[key] || (key === "org_name" ? parentBrokerage?.name : "") || ""}
                  disabled={!isOverriding(key)}
                  className={`text-sm ${!isOverriding(key) ? "bg-gray-50 text-gray-400 placeholder:text-gray-400 placeholder:italic" : ""}`}
                />
                {!isOverriding(key) && brokerageB[key] && (
                  <p className="text-[10px] text-gray-400 italic pl-1">
                    Inherited from {brokerageName}: {brokerageB[key]}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Section D: Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Branding"}
            </Button>
            <Button
              variant="outline" onClick={() => setConfirmReset(true)}
              className="gap-2 text-red-600 border-red-200 hover:bg-red-50"
            >
              <RotateCcw className="w-4 h-4" />
              Reset all to brokerage defaults
            </Button>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div>
          <LivePreview
            primary={rv.primary_color}
            accent={rv.accent_color}
            bg={rv.background_color}
            logo={rv.logo}
            orgName={rv.org_name}
            phone={rv.phone}
            website={rv.website}
          />
        </div>
      </div>

      {/* Confirm Reset Dialog */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl p-7 w-full max-w-sm space-y-4">
            <h3 className="text-base font-semibold text-[#1A3226]">Reset to Brokerage Defaults?</h3>
            <p className="text-sm text-[#1A3226]/60">
              All team-level overrides will be cleared. Your team will inherit all branding from {brokerageName}.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmReset(false)}>Cancel</Button>
              <Button onClick={handleReset} className="bg-red-600 hover:bg-red-700 text-white">Reset</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}