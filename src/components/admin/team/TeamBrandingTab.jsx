import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, AlertTriangle, Save, CheckCircle, Loader2, X, RotateCcw } from "lucide-react";
import BrandingPreview from "../../BrandingPreview";

function contrastWithWhite(hex) {
  if (!hex || hex.length < 7) return 21;
  try {
    const toLinear = v => { const s = parseInt(v, 16) / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
    const r = toLinear(hex.slice(1, 3)), g = toLinear(hex.slice(3, 5)), b = toLinear(hex.slice(5, 7));
    return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
  } catch { return 21; }
}

function InheritableField({ label, value, inheritedValue, overrideEnabled, onToggle, onChange, type = 'text', children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#1A3226]/70">{label}</label>
        <button
          onClick={onToggle}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            overrideEnabled
              ? 'bg-[#1A3226] text-white border-[#1A3226]'
              : 'text-[#1A3226]/50 border-[#1A3226]/20 hover:border-[#1A3226]/40'
          }`}
        >
          {overrideEnabled ? 'Override on' : 'Using brokerage default'}
        </button>
      </div>
      {children ? children({ disabled: !overrideEnabled }) : (
        <Input
          value={overrideEnabled ? (value || '') : ''}
          onChange={e => onChange(e.target.value)}
          disabled={!overrideEnabled}
          placeholder={overrideEnabled ? '' : (inheritedValue || 'Inherited from brokerage')}
          className="text-sm disabled:bg-[#1A3226]/5 disabled:text-[#1A3226]/40"
        />
      )}
    </div>
  );
}

function ColorField({ label, value, inherited, overrideEnabled, onToggle, onChange }) {
  const contrast = contrastWithWhite(overrideEnabled ? value : inherited);
  const low = contrast < 4.5;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-[#1A3226]/70">{label}</label>
        <button
          onClick={onToggle}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            overrideEnabled ? 'bg-[#1A3226] text-white border-[#1A3226]' : 'text-[#1A3226]/50 border-[#1A3226]/20 hover:border-[#1A3226]/40'
          }`}
        >
          {overrideEnabled ? 'Override on' : 'Using brokerage default'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={overrideEnabled ? (value || '#333333') : (inherited || '#333333')}
          onChange={e => overrideEnabled && onChange(e.target.value)}
          disabled={!overrideEnabled}
          className="w-9 h-9 rounded-md border border-[#1A3226]/20 cursor-pointer p-0.5 disabled:opacity-40"
        />
        <Input
          value={overrideEnabled ? (value || '') : ''}
          onChange={e => onChange(e.target.value)}
          disabled={!overrideEnabled}
          placeholder={inherited || '#333333'}
          className="font-mono text-sm w-32 disabled:bg-[#1A3226]/5 disabled:text-[#1A3226]/40"
          maxLength={7}
        />
        {low && overrideEnabled && (
          <span className="flex items-center gap-1 text-amber-600 text-xs">
            <AlertTriangle className="w-3.5 h-3.5" />
            Low contrast
          </span>
        )}
      </div>
    </div>
  );
}

export default function TeamBrandingTab({ org, parentOrg }) {
  const [inherited, setInherited] = useState({});
  const [overrides, setOverrides] = useState({});
  const [overrideFlags, setOverrideFlags] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);
  const [existingId, setExistingId] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!org?.id) return;
    const loadBranding = async () => {
      // Load brokerage (inherited) branding
      if (parentOrg?.id) {
        const bb = await base44.entities.OrgBranding.filter({ org_id: parentOrg.id });
        if (bb[0]) setInherited(bb[0]);
      }
      // Load team overrides
      const tb = await base44.entities.OrgBranding.filter({ org_id: org.id });
      if (tb[0]) {
        setExistingId(tb[0].id);
        setOverrides(tb[0]);
        // Infer which fields are overridden
        const flags = {};
        const fields = ['org_name','logo_url','primary_color','accent_color','background_color','address','phone','website','tagline'];
        for (const f of fields) {
          if (tb[0][f]) flags[f] = true;
        }
        setOverrideFlags(flags);
      }
    };
    loadBranding().catch(() => {});
  }, [org?.id, parentOrg?.id]);

  const toggleOverride = (key) => setOverrideFlags(f => ({ ...f, [key]: !f[key] }));
  const setOverride = (key) => (val) => setOverrides(o => ({ ...o, [key]: val }));

  const effectiveBranding = {
    org_name:         (overrideFlags.org_name         && overrides.org_name)         || inherited.org_name         || org?.name || '',
    logo_url:         (overrideFlags.logo_url          && overrides.logo_url)          || inherited.logo_url          || '',
    primary_color:    (overrideFlags.primary_color     && overrides.primary_color)     || inherited.primary_color     || '#333333',
    accent_color:     (overrideFlags.accent_color      && overrides.accent_color)      || inherited.accent_color      || '#666666',
    background_color: (overrideFlags.background_color  && overrides.background_color)  || inherited.background_color  || '#FFFFFF',
    address:          (overrideFlags.address           && overrides.address)           || inherited.address           || '',
    phone:            (overrideFlags.phone             && overrides.phone)             || inherited.phone             || '',
    website:          (overrideFlags.website           && overrides.website)           || inherited.website           || '',
    tagline:          (overrideFlags.tagline           && overrides.tagline)           || inherited.tagline           || '',
  };

  const handleLogoUpload = async (file) => {
    if (!file || file.size > 2 * 1024 * 1024) return alert('Logo must be under 2MB');
    setLogoUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setOverrides(o => ({ ...o, logo_url: file_url }));
    setOverrideFlags(f => ({ ...f, logo_url: true }));
    setLogoUploading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { org_id: org.id };
    const fields = ['org_name','logo_url','primary_color','accent_color','background_color','address','phone','website','tagline'];
    for (const f of fields) {
      payload[f] = overrideFlags[f] ? (overrides[f] || null) : null;
    }
    if (existingId) {
      await base44.entities.OrgBranding.update(existingId, payload);
    } else {
      const rec = await base44.entities.OrgBranding.create(payload);
      setExistingId(rec.id);
    }
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const resetAll = () => {
    setOverrideFlags({});
    setOverrides({});
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
      <div className="space-y-7">
        <div className="bg-[#1A3226]/5 rounded-xl px-4 py-3 text-xs text-[#1A3226]/60">
          Each field shows the brokerage default. Toggle "Override" to set a team-specific value.
          {parentOrg && <span className="font-medium"> Inheriting from: {parentOrg.name}</span>}
        </div>

        {/* Logo */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-[#1A3226]">Logo</h3>
            <button onClick={() => toggleOverride('logo_url')} className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${overrideFlags.logo_url ? 'bg-[#1A3226] text-white border-[#1A3226]' : 'text-[#1A3226]/50 border-[#1A3226]/20'}`}>
              {overrideFlags.logo_url ? 'Override on' : 'Using brokerage default'}
            </button>
          </div>
          {overrideFlags.logo_url ? (
            overrides.logo_url ? (
              <div className="flex items-center gap-3">
                <img src={overrides.logo_url} alt="Logo" className="h-12 max-w-[120px] object-contain rounded border border-[#1A3226]/10 p-1" />
                <Button variant="outline" size="sm" className="text-xs" onClick={() => fileRef.current?.click()}>Replace</Button>
                <Button variant="outline" size="sm" className="text-xs text-red-600" onClick={() => setOverrides(o => ({ ...o, logo_url: '' }))}>
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-[#1A3226]/20 rounded-xl p-6 text-center hover:border-[#1A3226]/40">
                {logoUploading ? <Loader2 className="w-5 h-5 animate-spin mx-auto text-[#1A3226]/40" /> : <><Upload className="w-5 h-5 mx-auto mb-1 text-[#1A3226]/40" /><p className="text-xs text-[#1A3226]/50">Upload team logo</p></>}
              </button>
            )
          ) : (
            inherited.logo_url
              ? <img src={inherited.logo_url} alt="Inherited" className="h-10 object-contain opacity-40" />
              : <p className="text-xs text-[#1A3226]/40 italic">No brokerage logo set</p>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden"
            onChange={e => e.target.files[0] && handleLogoUpload(e.target.files[0])} />
        </div>

        {/* Colors */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1A3226]">Colors</h3>
          <ColorField label="Primary Color" value={overrides.primary_color} inherited={inherited.primary_color}
            overrideEnabled={!!overrideFlags.primary_color} onToggle={() => toggleOverride('primary_color')} onChange={setOverride('primary_color')} />
          <ColorField label="Accent Color" value={overrides.accent_color} inherited={inherited.accent_color}
            overrideEnabled={!!overrideFlags.accent_color} onToggle={() => toggleOverride('accent_color')} onChange={setOverride('accent_color')} />
          <ColorField label="Background Color" value={overrides.background_color} inherited={inherited.background_color}
            overrideEnabled={!!overrideFlags.background_color} onToggle={() => toggleOverride('background_color')} onChange={setOverride('background_color')} />
        </div>

        {/* Text fields */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-[#1A3226]">Team Info</h3>
          {[
            { key: 'org_name', label: 'Team Name' },
            { key: 'address', label: 'Address' },
            { key: 'phone', label: 'Phone' },
            { key: 'website', label: 'Website' },
            { key: 'tagline', label: 'Tagline (optional)' },
          ].map(({ key, label }) => (
            <InheritableField key={key} label={label} value={overrides[key]} inheritedValue={inherited[key]}
              overrideEnabled={!!overrideFlags[key]} onToggle={() => toggleOverride(key)} onChange={setOverride(key)} />
          ))}
        </div>

        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={saving} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Team Branding'}
          </Button>
          <Button variant="outline" onClick={resetAll} className="gap-2 text-[#1A3226]/60">
            <RotateCcw className="w-4 h-4" /> Reset to brokerage defaults
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1A3226] mb-1">Live Document Preview</h3>
          <p className="text-xs text-[#1A3226]/50 mb-4">Shows how output documents will appear with current team settings.</p>
        </div>
        <BrandingPreview branding={effectiveBranding} />
      </div>
    </div>
  );
}