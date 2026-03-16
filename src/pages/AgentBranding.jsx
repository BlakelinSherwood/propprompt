import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Save, CheckCircle, Loader2, X, User, Eye, ArrowLeft, Info } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

const SIGNATURE_STYLES = [
  {
    key: "name_only",
    label: "Name Only",
    preview: (b) => (
      <div style={{ fontFamily: "Calibri, sans-serif", fontSize: 11 }}>
        <div style={{ fontWeight: "bold", color: "#1A1A1A" }}>{b.display_name || "Agent Name"}</div>
      </div>
    ),
  },
  {
    key: "name_title",
    label: "Name + Title",
    preview: (b) => (
      <div style={{ fontFamily: "Calibri, sans-serif", fontSize: 11 }}>
        <div style={{ fontWeight: "bold", color: "#1A1A1A" }}>{b.display_name || "Agent Name"}</div>
        <div style={{ color: "#666", fontSize: 10 }}>{b.title || "Real Estate Advisor"}</div>
      </div>
    ),
  },
  {
    key: "name_title_contact",
    label: "Name, Title & Contact",
    isDefault: true,
    preview: (b) => (
      <div style={{ fontFamily: "Calibri, sans-serif", fontSize: 11 }}>
        <div style={{ fontWeight: "bold", color: "#1A1A1A" }}>
          {b.display_name || "Agent Name"}&nbsp;&nbsp;|&nbsp;&nbsp;{b.title || "Real Estate Advisor"}
        </div>
        <div style={{ color: "#666", fontSize: 10 }}>
          {b.direct_phone || "(617) 555-0100"}&nbsp;&nbsp;|&nbsp;&nbsp;{b.direct_email || "agent@email.com"}
        </div>
        {b.license_number && (
          <div style={{ color: "#888", fontSize: 10 }}>License: {b.license_number}</div>
        )}
      </div>
    ),
  },
  {
    key: "full_with_headshot",
    label: "Full with Headshot",
    preview: (b) => (
      <div style={{ fontFamily: "Calibri, sans-serif", fontSize: 11, display: "flex", gap: 10 }}>
        {b.headshot_url ? (
          <img src={b.headshot_url} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: "#9ca3af" }}>👤</span>
          </div>
        )}
        <div>
          <div style={{ fontWeight: "bold", color: "#1A1A1A" }}>{b.display_name || "Agent Name"}</div>
          <div style={{ color: "#666", fontSize: 10 }}>{b.title || "Real Estate Advisor"}</div>
          <div style={{ color: "#666", fontSize: 10 }}>
            {b.direct_phone || "(617) 555-0100"}&nbsp;|&nbsp;{b.direct_email || "agent@email.com"}
          </div>
          {b.personal_tagline && (
            <div style={{ color: "#999", fontSize: 10, fontStyle: "italic" }}>{b.personal_tagline}</div>
          )}
        </div>
      </div>
    ),
  },
];

function SignaturePreviewPanel({ form }) {
  const style = SIGNATURE_STYLES.find((s) => s.key === form.signature_style) || SIGNATURE_STYLES[2];
  return (
    <div className="rounded-xl border border-[#1A3226]/15 bg-white p-5">
      <p className="text-xs font-semibold text-[#1A3226]/50 uppercase tracking-wider mb-4">Signature Preview</p>
      <div className="border-t-2 border-[#1A3226]/30 pt-3">
        {style.preview(form)}
        {form.personal_tagline && form.signature_style !== "full_with_headshot" && (
          <div style={{ fontFamily: "Calibri, sans-serif", fontSize: 10, color: "#999", fontStyle: "italic", marginTop: 2 }}>
            {form.personal_tagline}
          </div>
        )}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100">
        <p style={{ fontFamily: "Calibri, sans-serif", fontSize: 9, color: "#999" }}>
          DISCLAIMER: This AI-generated analysis is for informational purposes only…
        </p>
      </div>
    </div>
  );
}

export default function AgentBranding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef(null);
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    display_name: "", title: "", headshot_url: "",
    direct_phone: "", direct_email: "", license_number: "",
    personal_tagline: "", signature_style: "name_title_contact",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    base44.auth.me().then((me) => {
      setUser(me);
      return base44.entities.AgentBranding.filter({ user_email: me.email });
    }).then((res) => {
      if (res[0]) {
        setExistingId(res[0].id);
        setForm({
          display_name: res[0].display_name || "",
          title: res[0].title || "",
          headshot_url: res[0].headshot_url || "",
          direct_phone: res[0].direct_phone || "",
          direct_email: res[0].direct_email || "",
          license_number: res[0].license_number || "",
          personal_tagline: res[0].personal_tagline || "",
          signature_style: res[0].signature_style || "name_title_contact",
        });
      }
    }).catch(() => {});
  }, []);

  const handleHeadshotUpload = async (file) => {
    if (!file) return;
    if (!file.type.match(/image\/(png|jpeg)/)) return toast({ title: "Only PNG or JPG accepted", variant: "destructive" });
    if (file.size > 2 * 1024 * 1024) return toast({ title: "Image must be under 2MB", variant: "destructive" });
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm((f) => ({ ...f, headshot_url: file_url }));
    setUploading(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = { user_email: user.email, ...form };
    if (existingId) {
      await base44.entities.AgentBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.AgentBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false);
    toast({ title: "Branding saved." });
  };

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const FIELDS = [
    { key: "display_name", label: "Name on documents", placeholder: user?.full_name || "Your full name" },
    { key: "title", label: "Title", placeholder: "Senior Real Estate Advisor" },
    { key: "direct_phone", label: "Direct Phone", placeholder: "(617) 555-0100" },
    { key: "direct_email", label: "Direct Email", placeholder: user?.email || "you@example.com" },
    { key: "license_number", label: "License # (optional)", placeholder: "RE12345" },
    { key: "personal_tagline", label: "Personal Tagline (optional)", placeholder: "Serving Boston for 15+ years" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/AccountSettings")} className="text-[#1A3226]/60 hover:text-[#1A3226]">
          <ArrowLeft className="w-4 h-4 mr-1" /> Account Settings
        </Button>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
          My Branding
        </h1>
        <p className="text-sm text-[#1A3226]/50 mt-0.5">Document branding settings</p>
      </div>

      {/* Notice banner */}
      <div className="flex items-start gap-3 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-800">
          These settings control how you appear on exported documents. Your PropPrompt account name and contact info are unchanged.
        </p>
      </div>

      {/* Section A: Headshot */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#1A3226]">Headshot or Personal Logo</h2>
        <div
          className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-3 transition-colors cursor-pointer ${
            dragOver ? "border-[#1A3226] bg-[#1A3226]/5" : "border-[#1A3226]/20 hover:border-[#1A3226]/40"
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleHeadshotUpload(f); }}
        >
          {form.headshot_url ? (
            <div className="flex flex-col items-center gap-3">
              <img src={form.headshot_url} alt="Headshot" className="w-16 h-16 rounded-full object-cover border-2 border-[#1A3226]/20" />
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs gap-1.5 pointer-events-none">
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  Replace
                </Button>
                <Button
                  variant="ghost" size="sm" className="text-xs text-red-500 hover:text-red-600"
                  onClick={(e) => { e.stopPropagation(); set("headshot_url")(""); }}
                >
                  <X className="w-3.5 h-3.5 mr-1" /> Remove
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full bg-[#1A3226]/10 flex items-center justify-center">
                {uploading ? <Loader2 className="w-6 h-6 text-[#1A3226]/40 animate-spin" /> : <User className="w-6 h-6 text-[#1A3226]/30" />}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-[#1A3226]">Click or drag to upload</p>
                <p className="text-xs text-[#1A3226]/40 mt-0.5">PNG or JPG, square, max 2MB</p>
              </div>
            </>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg" className="hidden"
          onChange={(e) => e.target.files[0] && handleHeadshotUpload(e.target.files[0])} />
      </div>

      {/* Section B: Your Information */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#1A3226]">Your Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <label className="text-xs font-medium text-[#1A3226]/70 block mb-1">{label}</label>
              <Input
                value={form[key] || ""}
                onChange={(e) => set(key)(e.target.value)}
                placeholder={placeholder}
                className="text-sm"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Section C: Signature Style */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-[#1A3226]">How your signature appears on documents</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SIGNATURE_STYLES.map((style) => (
            <button
              key={style.key}
              onClick={() => set("signature_style")(style.key)}
              className={`border-2 rounded-xl p-4 text-left transition-all ${
                form.signature_style === style.key
                  ? "border-[#1A3226] bg-[#1A3226]/5 shadow-sm"
                  : "border-[#1A3226]/15 hover:border-[#1A3226]/30"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#1A3226]">{style.label}</span>
                {style.isDefault && (
                  <span className="text-[10px] bg-[#B8982F]/15 text-[#B8982F] px-1.5 py-0.5 rounded-full font-medium">Default</span>
                )}
                {form.signature_style === style.key && (
                  <CheckCircle className="w-4 h-4 text-[#1A3226]" />
                )}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-3 min-h-[56px]">
                <div className="border-t-2 border-gray-300 pt-2 mb-2" />
                {style.preview(form)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Section D: Preview + Save */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="gap-2 border-[#1A3226]/20 text-[#1A3226]"
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "Hide Preview" : "Preview Signature"}
          </Button>
        </div>

        {showPreview && <SignaturePreviewPanel form={form} />}

        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Saving…" : "Save My Branding"}
        </Button>
      </div>
    </div>
  );
}