import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Pencil } from "lucide-react";

export default function PricingField({ configKey, value, valueType, label, onSave, disabled }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const formatDisplay = (v) => {
    if (valueType === "currency") return `$${Number(v).toFixed(2)}`;
    if (valueType === "percentage") return `${v}%`;
    if (valueType === "days") return `${v} days`;
    return String(v);
  };

  const handleEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setDraft("");
  };

  const handleSave = async () => {
    const parsed = parseFloat(draft);
    if (isNaN(parsed)) return;
    setSaving(true);
    await onSave(configKey, parsed);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="h-8 w-32 text-sm"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={handleSave} disabled={saving}>
          <Check className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={handleCancel}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      <span className="text-sm font-semibold text-[#1A3226]">{formatDisplay(value)}</span>
      {!disabled && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-[#1A3226]/40 hover:text-[#1A3226]"
          onClick={handleEdit}
        >
          <Pencil className="w-3 h-3" />
        </Button>
      )}
    </div>
  );
}