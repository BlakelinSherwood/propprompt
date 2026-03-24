import { AlertTriangle } from "lucide-react";

function getLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const lin = c => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrastRatio(hex1, hex2) {
  const l1 = getLuminance(hex1), l2 = getLuminance(hex2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function isValidHex(hex) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function getTextColor(hex) {
  if (!isValidHex(hex)) return "#FFFFFF";
  return getLuminance(hex) > 0.179 ? "#1A1A1A" : "#FFFFFF";
}

export default function CustomColors({ primary, accent, orgName, onPrimaryChange, onAccentChange, primaryError, accentError }) {
  const primaryValid = isValidHex(primary);
  const accentValid = isValidHex(accent);
  const showContrastWarning = accentValid && contrastRatio(accent, "#FFFFFF") < 4.5;

  function handleHexInput(val, setter) {
    let v = val.trim();
    if (!v.startsWith("#")) v = "#" + v;
    setter(v.toUpperCase());
  }

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium text-[#1A3226]">Or enter custom hex codes</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Primary Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A3226]/70 uppercase tracking-wide">Primary Color</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={primaryValid ? primary : "#1A3226"}
              onChange={e => onPrimaryChange(e.target.value.toUpperCase())}
              className="w-10 h-9 rounded border border-[#1A3226]/15 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={primary}
              onChange={e => handleHexInput(e.target.value, onPrimaryChange)}
              placeholder="#1A3226"
              maxLength={7}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                primaryError ? "border-red-400 focus:ring-red-300" : "border-[#1A3226]/15 focus:ring-[#1A3226]/30"
              }`}
            />
          </div>
          <p className="text-[11px] text-[#1A3226]/45">Used for headers, table backgrounds, and dark accents</p>
          {primaryError && <p className="text-[11px] text-red-500">{primaryError}</p>}
        </div>

        {/* Accent Color */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[#1A3226]/70 uppercase tracking-wide">Accent Color</label>
          <div className="flex gap-2 items-center">
            <input
              type="color"
              value={accentValid ? accent : "#B8982F"}
              onChange={e => onAccentChange(e.target.value.toUpperCase())}
              className="w-10 h-9 rounded border border-[#1A3226]/15 cursor-pointer p-0.5"
            />
            <input
              type="text"
              value={accent}
              onChange={e => handleHexInput(e.target.value, onAccentChange)}
              placeholder="#B8982F"
              maxLength={7}
              className={`flex-1 border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 ${
                accentError ? "border-red-400 focus:ring-red-300" : "border-[#1A3226]/15 focus:ring-[#1A3226]/30"
              }`}
            />
          </div>
          <p className="text-[11px] text-[#1A3226]/45">Used for labels, badges, borders, and highlights</p>
          {accentError && <p className="text-[11px] text-red-500">{accentError}</p>}
        </div>
      </div>

      {/* Live Preview Strip */}
      {primaryValid && accentValid && (
        <div
          className="flex w-full overflow-hidden rounded-md"
          style={{ height: 56 }}
        >
          <div
            className="flex items-center justify-center px-5"
            style={{ width: "70%", backgroundColor: primary }}
          >
            <span
              className="text-white text-base font-semibold truncate"
              style={{ fontFamily: "Georgia, serif" }}
            >
              {orgName || "Your Organization"}
            </span>
          </div>
          <div
            className="flex items-center justify-center px-4"
            style={{ width: "30%", backgroundColor: accent }}
          >
            <span
              className="text-xs font-semibold rounded-full px-2 py-0.5"
              style={{ color: getTextColor(accent), backgroundColor: accent + "33" }}
            >
              Sample
            </span>
          </div>
        </div>
      )}

      {/* Contrast Warning */}
      {showContrastWarning && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 text-yellow-800 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <p>This accent color may be hard to read as text on light backgrounds. Reports will automatically darken it for readability, but consider choosing a darker shade for best results.</p>
        </div>
      )}
    </div>
  );
}