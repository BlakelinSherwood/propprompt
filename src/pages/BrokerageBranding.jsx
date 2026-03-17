import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, Loader2, X, ArrowLeft, Info, AlertTriangle, Eye } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// WCAG contrast ratio between a hex color and white
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function relativeLuminance([r, g, b]) {
  const c = [r, g, b].map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrastWithWhite(hex) {
  try {
    const rgb = hexToRgb(hex);
    const lum = relativeLuminance(rgb);
    return (1.05) / (lum + 0.05);
  } catch { return 21; }
}

function ColorField({ label, hint, value, onChange }) {
  const inputRef = useRef(null);
  const isValid = /^#[0-9A-Fa-f]{6}$/.test(value);
  return (
    <div>
      <label className="text-xs font-medium text-[#1A3226]/70 block mb-0.5">{label}</label>
      {hint && <p className="text-[10px] text-[#1A3226]/40 mb-1.5">{hint}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-8 h-8 rounded-md border-2 border-gray-300 flex-shrink-0 cursor-pointer shadow-sm"
          style={{ background: isValid ? value : "#e5e7eb" }}
          title="Open color picker"
        />
        <input
          ref={inputRef}
          type="color"
          value={isValid ? value : "#333333"}
          onChange={e => onChange(e.target.value.toUpperCase())}
          className="sr-only"
        />
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="#333333"
          className="text-sm font-mono w-36"
          maxLength={7}
        />
      </div>
    </div>
  );
}

function LivePreview({ form }) {
  const primary = /^#[0-9A-Fa-f]{6}$/.test(form.primary_color) ? form.primary_color : "#333333";
  const accent = /^#[0-9A-Fa-f]{6}$/.test(form.accent_color) ? form.accent_color : "#666666";
  const bg = /^#[0-9A-Fa-f]{6}$/.test(form.background_color) ? form.background_color : "#FFFFFF";

  return (
    <div className="sticky top-24 space-y-2">
      <p className="text-xs text-[#1A3226]/50 leading-relaxed">
        Live document preview — updates as you type. Save to apply to all exported documents.
      </p>
      <div className="rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ background: bg }}>
        {/* Header bar */}
        <div className="flex items-center justify-between px-4" style={{ background: primary, minHeight: 48 }}>
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" style={{ maxHeight: 32, maxWidth: 120, objectFit: "contain" }} />
          ) : (
            <div style={{ width: 80, height: 28, borderRadius: 4, background: "rgba(255,255,255,0.2)" }} />
          )}
          <span style={{ color: "#fff", fontWeight: "bold", fontSize: 11, fontFamily: "Georgia, serif" }}>
            {form.org_name || "Your Organization"}
          </span>
        </div>
        {/* Accent bar */}
        <div style={{ height: 3, background: accent }} />

        {/* Mini content area */}
        <div className="px-4 py-4 space-y-3">
          <div style={{ height: 8, borderRadius: 4, background: primary, opacity: 0.15, width: "60%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "90%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "75%" }} />
          <div style={{ height: 6, borderRadius: 4, background: "#e5e7eb", width: "83%" }} />
          {/* Table mockup */}
          <div className="mt-2 overflow-hidden rounded" style={{ border: `1px solid ${accent}40` }}>
            <div style={{ background: primary, padding: "4px 8px" }}>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.5)", width: "40%" }} />
            </div>
            {[1,2,3].map(i => (
              <div key={i} style={{ padding: "3px 8px", background: i % 2 === 0 ? `${primary}12` : bg, borderTop: `1px solid ${accent}20` }}>
                <div style={{ height: 5, borderRadius: 3, background: "#e5e7eb", width: `${50 + i * 10}%` }} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2" style={{ borderTop: `1px solid ${accent}` }}>
          <div className="flex justify-between items-center">
            <span style={{ fontSize: 9, color: "#888", fontFamily: "Calibri, sans-serif" }}>
              {[form.org_name, form.phone, form.website].filter(Boolean).join("  |  ") || "Org Name  |  Phone  |  Website"}
            </span>
            <span style={{ fontSize: 9, color: "#888" }}>Page 1 of 4</span>
            <span style={{ fontSize: 9, color: "#bbb" }}>Prepared by PropPrompt™</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BrokerageBranding() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);

  const [org, setOrg] = useState(null);
  const [form, setForm] = useState({
    org_name: "", logo_url: "", logo_storage_path: "",
    primary_color: "#333333", accent_color: "#666666", background_color: "#FFFFFF",
    address: "", phone: "", website: "", tagline: "",
  });
  const [existingId, setExistingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    async function load() {
      const me = await base44.auth.me();
      // Auth check
      const memberships = await base44.entities.OrgMembership.filter({ user_email: me.email, org_id: id });
      const mem = memberships[0];
      if (!mem || mem.role_in_org !== "brokerage_admin") {
        setUnauthorized(true);
        return;
      }
      // Load org
      const orgs = await base44.entities.Organization.filter({ id });
      if (orgs[0]) setOrg(orgs[0]);

      // Load existing branding
      const brandings = await base44.entities.OrgBranding.filter({ org_id: id });
      if (brandings[0]) {
        const b = brandings[0];
        setExistingId(b.id);
        setForm({
          org_name: b.org_name || orgs[0]?.name || "",
          logo_url: b.logo_url || "",
          logo_storage_path: b.logo_storage_path || "",
          primary_color: b.primary_color || "#333333",
          accent_color: b.accent_color || "#666666",
          background_color: b.background_color || "#FFFFFF",
          address: b.address || "",
          phone: b.phone || "",
          website: b.website || "",
          tagline: b.tagline || "",
        });
      } else if (orgs[0]) {
        setForm(f => ({ ...f, org_name: orgs[0].name || "" }));
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
    setForm(f => ({ ...f, logo_url: file_url, logo_storage_path: "" }));
    setUploading(false);
  };

  const handleSave = async () => {
    const me = await base44.auth.me();
    setSaving(true);
    const payload = { org_id: id, updated_by: me.email, ...form };
    if (existingId) {
      await base44.entities.OrgBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.OrgBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false);
    toast({ title: "Branding saved." });
  };

  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }));

  const lowContrast = (() => {
    try { return contrastWithWhite(form.primary_color) < 4.5; } catch { return false; }
  })();

  if (unauthorized) {
    return (
      <div className="flex items-center justify-center min-h-64 text-[#1A3226]/50">
        Access restricted to brokerage administrators.
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/brokerage/${id}/admin`)} className="text-[#1A3226]/60 hover:text-[#1A3226]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Brokerage Admin
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          {org?.name ? `${org.name} — Branding` : "Brokerage Branding"}
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-0.5">Document branding settings</p>
      </div>

      {/* Notice */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          Brokerage branding is applied to all exported PDFs, presentations, and emailed reports. It does not affect the app interface.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* LEFT: Form */}
        <div className="space-y-8">

          {/* Section A: Logo */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-[#1A3226]">Logo</h2>
            <div
              className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
                dragOver ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/20 hover:border-[#1A3226]/40"
              }`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleLogoUpload(f); }}
            >
              {form.logo_url ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="border border-gray-200 rounded-lg p-3 bg-white">
                    <img src={form.logo_url} alt="Logo" style={{ maxWidth: 200, maxHeight: 80, objectFit: "contain" }} />
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                      {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      Replace
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600"
                      onClick={e => { e.stopPropagation(); set("logo_url")(""); set("logo_storage_path")(""); }}
                    >
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
                    <p className="text-sm font-medium text-[#1A3226]">Click or drag to upload logo</p>
                    <p className="text-xs text-[#1A3226]/40 mt-0.5">PNG, JPG, or SVG — max 2MB</p>
                  </div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
              onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
          </div>

          {/* Section B: Colors */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Colors</h2>
            <ColorField
              label="Primary Color"
              hint="Headers, dividers, table headers"
              value={form.primary_color}
              onChange={set("primary_color")}
            />
            {lowContrast && (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                White text on this color may be hard to read on documents. Consider a darker shade.
              </div>
            )}
            <ColorField
              label="Accent Color"
              hint="Highlights, callouts, borders"
              value={form.accent_color}
              onChange={set("accent_color")}
            />
            <ColorField
              label="Background Color"
              hint="Document background — usually white"
              value={form.background_color}
              onChange={set("background_color")}
            />
          </div>

          {/* Section C: Org Details */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-[#1A3226]">Organization Details</h2>
            {[
              { key: "org_name", label: "Organization Name", placeholder: "Your Brokerage Name" },
              { key: "address", label: "Address", placeholder: "123 Main St, Boston, MA 02110" },
              { key: "phone", label: "Phone", placeholder: "(617) 555-0100" },
              { key: "website", label: "Website", placeholder: "https://yourbrokerage.com" },
              { key: "tagline", label: "Tagline (optional)", placeholder: "Serving Greater Boston since 1998" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="text-xs font-medium text-[#1A3226]/70 block mb-1">{label}</label>
                <Input value={form[key] || ""} onChange={e => set(key)(e.target.value)} placeholder={placeholder} className="text-sm" />
              </div>
            ))}
          </div>

          {/* Section D: Actions */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Saving…" : "Save Branding"}
            </Button>
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div>
          <LivePreview form={form} />
        </div>
      </div>
    </div>
  );
}