import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Trash2, Edit2 } from "lucide-react";

export default function CollectionManager({ collections, onCollectionsUpdated, orgId }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#1A3226");

  const resetForm = () => {
    setName("");
    setDescription("");
    setColor("#1A3226");
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      if (editingId) {
        await base44.entities.AnalysisCollection.update(editingId, {
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
      } else {
        const user = await base44.auth.me();
        await base44.entities.AnalysisCollection.create({
          org_id: orgId,
          created_by_email: user.email,
          name: name.trim(),
          description: description.trim() || null,
          color,
        });
      }
      resetForm();
      onCollectionsUpdated();
    } catch (err) {
      console.error("Error saving collection:", err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this collection? Analyses will not be deleted.")) return;
    try {
      await base44.entities.AnalysisCollection.delete(id);
      onCollectionsUpdated();
    } catch (err) {
      console.error("Error deleting collection:", err);
    }
  };

  const handleEdit = (col) => {
    setEditingId(col.id);
    setName(col.name);
    setDescription(col.description || "");
    setColor(col.color || "#1A3226");
    setShowForm(true);
  };

  const colors = ["#1A3226", "#B8982F", "#2563eb", "#dc2626", "#059669", "#7c3aed"];

  return (
    <div className="space-y-4 mb-6">
      {/* Collections list */}
      {collections.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1A3226]/10 bg-white hover:bg-[#FAF8F4] group"
            >
              <Folder className="w-4 h-4" style={{ color: col.color || "#1A3226" }} />
              <span className="text-sm text-[#1A3226] font-medium">{col.name}</span>
              <button
                onClick={() => handleEdit(col)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#1A3226]/5 rounded transition-opacity"
              >
                <Edit2 className="w-3 h-3 text-[#1A3226]/50" />
              </button>
              <button
                onClick={() => handleDelete(col.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-opacity"
              >
                <Trash2 className="w-3 h-3 text-red-500" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* New/edit form */}
      {showForm ? (
        <div className="rounded-xl border border-[#1A3226]/10 bg-white p-4 space-y-3">
          <input
            type="text"
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3226]/20"
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#1A3226]/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1A3226]/20 resize-none h-16"
          />
          <div className="flex gap-2 items-center">
            <span className="text-xs text-[#1A3226]/60">Color:</span>
            <div className="flex gap-2">
              {colors.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full border-2 ${color === c ? "border-[#1A3226]" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={resetForm}>Cancel</Button>
            <Button size="sm" onClick={handleSave} className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white">
              {editingId ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(true)}
          className="gap-2 text-[#1A3226] border-[#1A3226]/20 hover:bg-[#1A3226]/5"
        >
          <Plus className="w-4 h-4" /> New Collection
        </Button>
      )}
    </div>
  );
}