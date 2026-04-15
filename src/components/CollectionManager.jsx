import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, X } from "lucide-react";

export default function CollectionManager({ collections, orgId, onCollectionsUpdated }) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", color: "#1A3226" });
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData({ name: "", description: "", color: "#1A3226" });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (col) => {
    setFormData({
      name: col.name,
      description: col.description || "",
      color: col.color || "#1A3226",
    });
    setEditingId(col.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setLoading(true);
    try {
      if (editingId) {
        // Update
        await base44.entities.AnalysisCollection.update(editingId, {
          name: formData.name,
          description: formData.description,
          color: formData.color,
        });
      } else {
        // Create
        await base44.entities.AnalysisCollection.create({
          org_id: orgId,
          created_by_email: (await base44.auth.me()).email,
          name: formData.name,
          description: formData.description,
          color: formData.color,
          sort_order: collections.length,
        });
      }
      resetForm();
      onCollectionsUpdated();
    } catch (err) {
      console.error("Failed to save collection:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (colId) => {
    if (!confirm("Delete this collection?")) return;
    try {
      await base44.entities.AnalysisCollection.delete(colId);
      onCollectionsUpdated();
    } catch (err) {
      console.error("Failed to delete collection:", err);
    }
  };

  return (
    <div className="rounded-2xl border border-[#1A3226]/10 bg-white p-5">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-[#1A3226] hover:text-[#1A3226]/80 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Collection
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-[#1A3226]">
              {editingId ? "Edit Collection" : "New Collection"}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="text-[#1A3226]/40 hover:text-[#1A3226]/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <input
            type="text"
            placeholder="Collection name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="w-full text-sm px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors"
          />

          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full text-sm px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors resize-none h-16"
          />

          <div className="flex items-center gap-2">
            <label className="text-xs text-[#1A3226]/60">Color:</label>
            <input
              type="color"
              value={formData.color}
              onChange={(e) => setFormData({ ...formData, color: e.target.value })}
              className="w-10 h-8 rounded cursor-pointer"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={loading || !formData.name.trim()}
              className="flex-1 bg-[#1A3226] hover:bg-[#1A3226]/90 text-white text-sm h-8"
            >
              {editingId ? "Update" : "Create"}
            </Button>
            <Button
              type="button"
              onClick={resetForm}
              variant="outline"
              className="flex-1 text-sm h-8"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {collections.length > 0 && (
        <div className="mt-4 space-y-2">
          {collections.map((col) => (
            <div
              key={col.id}
              className="flex items-center justify-between p-2 rounded-lg bg-[#1A3226]/5 hover:bg-[#1A3226]/10 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: col.color || "#1A3226" }}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#1A3226] truncate">{col.name}</p>
                  {col.description && (
                    <p className="text-xs text-[#1A3226]/50 truncate">{col.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => handleEdit(col)}
                  className="p-1 text-[#1A3226]/60 hover:text-[#1A3226] transition-colors"
                  title="Edit"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(col.id)}
                  className="p-1 text-[#1A3226]/60 hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}