import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Save, Trash2, Lock, Eye, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const PLATFORMS = ["claude", "chatgpt", "gemini", "perplexity", "grok", "generic"];
const ASSESSMENT_TYPES = ["listing_pricing", "buyer_intelligence", "investment_analysis", "cma", "rental_analysis"];
const PROPERTY_TYPES = ["single_family", "condo", "multi_family", "land", "commercial", "all"];
const SECTIONS = [
  "system_instructions", "intake_template", "followup_protocol", "valuation_module",
  "migration_module", "archetype_module", "avm_module", "listing_strategy_module",
  "disclaimer_footer", "full_assembled"
];

const BLANK = {
  version: "3.0", ai_platform: "claude", assessment_type: "listing_pricing",
  property_type: "all", prompt_section: "system_instructions", prompt_text: "", notes: "", is_active: true,
};

export default function PromptLibraryEditor() {
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // null | "new" | prompt id
  const [form, setForm] = useState(BLANK);
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterAssessment, setFilterAssessment] = useState("all");

  async function loadPrompts() {
    setLoading(true);
    const res = await base44.functions.invoke("platformAdminPrompts", { action: "list" });
    setPrompts(res.data.prompts || []);
    setLoading(false);
  }

  useEffect(() => { loadPrompts(); }, []);

  function startEdit(prompt) {
    setEditing(prompt.id);
    setForm({ ...prompt });
  }

  function startNew() {
    setEditing("new");
    setForm({ ...BLANK });
  }

  async function handleSave() {
    setSaving(true);
    await base44.functions.invoke("platformAdminPrompts", {
      action: "save",
      id: editing === "new" ? null : editing,
      data: form,
    });
    await loadPrompts();
    setEditing(null);
    setSaving(false);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this prompt permanently?")) return;
    await base44.functions.invoke("platformAdminPrompts", { action: "delete", id });
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    if (editing === id) setEditing(null);
  }

  const filtered = prompts.filter((p) =>
    (filterPlatform === "all" || p.ai_platform === filterPlatform) &&
    (filterAssessment === "all" || p.assessment_type === filterAssessment)
  );

  if (loading) return (
    <div className="flex items-center justify-center py-16 text-[#1A3226]/50">
      <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading prompt library…
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-3 py-1.5 rounded-lg">
          <Lock className="w-3.5 h-3.5" />
          Prompt text is AES-256 encrypted at rest. Visible only here.
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <Select value={filterPlatform} onValueChange={setFilterPlatform}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All platforms</SelectItem>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterAssessment} onValueChange={setFilterAssessment}>
            <SelectTrigger className="h-8 text-xs w-44">
              <SelectValue placeholder="Assessment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assessments</SelectItem>
              {ASSESSMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-1.5" onClick={startNew}>
            <Plus className="w-3.5 h-3.5" /> New Prompt
          </Button>
        </div>
      </div>

      {/* New/Edit form */}
      {editing && (
        <div className="rounded-xl border border-[#B8982F]/30 bg-[#B8982F]/5 p-5 space-y-4">
          <p className="text-sm font-semibold text-[#1A3226]">{editing === "new" ? "New Prompt" : "Edit Prompt"}</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">Platform</label>
              <Select value={form.ai_platform} onValueChange={(v) => setForm({ ...form, ai_platform: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">Assessment Type</label>
              <Select value={form.assessment_type} onValueChange={(v) => setForm({ ...form, assessment_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ASSESSMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">Property Type</label>
              <Select value={form.property_type} onValueChange={(v) => setForm({ ...form, property_type: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{PROPERTY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">Section</label>
              <Select value={form.prompt_section} onValueChange={(v) => setForm({ ...form, prompt_section: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{SECTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-[#1A3226]/60 mb-1 block">Version</label>
              <Input className="h-8 text-xs" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#1A3226]/60 mb-1 flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" /> Prompt Text (decrypted for editing — will be re-encrypted on save)
            </label>
            <textarea
              className="w-full h-64 rounded-lg border border-[#1A3226]/15 bg-white p-3 text-xs font-mono text-[#1A3226]/80 resize-y focus:outline-none focus:ring-2 focus:ring-[#1A3226]/20"
              value={form.prompt_text}
              onChange={(e) => setForm({ ...form, prompt_text: e.target.value })}
              placeholder="Enter prompt text with [PLACEHOLDER] tokens…"
            />
          </div>
          <div>
            <label className="text-xs text-[#1A3226]/60 mb-1 block">Notes (internal)</label>
            <Input className="h-8 text-xs" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Editorial notes…" />
          </div>
          <div className="flex items-center gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditing(null)}>Cancel</Button>
            <Button size="sm" className="bg-[#1A3226] text-white hover:bg-[#1A3226]/90 gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save & Encrypt
            </Button>
          </div>
        </div>
      )}

      {/* Prompt list */}
      <div className="space-y-2">
        {filtered.map((p) => (
          <div key={p.id} className="rounded-xl border border-[#1A3226]/10 bg-white overflow-hidden">
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#1A3226]/[0.02]"
              onClick={() => setExpanded(expanded === p.id ? null : p.id)}
            >
              <Badge variant="outline" className="text-[10px] shrink-0">{p.ai_platform}</Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">{p.assessment_type?.replace(/_/g, " ")}</Badge>
              <Badge variant="outline" className="text-[10px] shrink-0">{p.prompt_section?.replace(/_/g, " ")}</Badge>
              <span className="text-xs text-[#1A3226]/50 ml-1">{p.property_type} · v{p.version}</span>
              {!p.is_active && <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full ml-1">inactive</span>}
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={(e) => { e.stopPropagation(); startEdit(p); }}>Edit</Button>
                <Button variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
                {expanded === p.id ? <ChevronUp className="w-4 h-4 text-[#1A3226]/40" /> : <ChevronDown className="w-4 h-4 text-[#1A3226]/40" />}
              </div>
            </div>
            {expanded === p.id && (
              <div className="border-t border-[#1A3226]/8 px-4 py-3 bg-[#1A3226]/[0.02]">
                <pre className="text-xs font-mono text-[#1A3226]/70 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {p.prompt_text || "(empty)"}
                </pre>
                {p.notes && <p className="text-xs text-[#1A3226]/40 mt-2 italic">Note: {p.notes}</p>}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-sm text-[#1A3226]/40 py-12">
            No prompts found. Create your first prompt above.
          </div>
        )}
      </div>
    </div>
  );
}