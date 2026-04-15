import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { X, FileText } from "lucide-react";

export default function ContactForm({ orgId, contact, onSave, onCancel }) {
  const [loading, setLoading] = useState(false);
  const [analyses, setAnalyses] = useState([]);
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    property_address: "",
    property_city: "",
    property_state: "",
    property_zip: "",
    contact_type: "prospect",
    notes: "",
  });

  useEffect(() => {
    if (contact) {
      setFormData({
        first_name: contact.first_name || "",
        last_name: contact.last_name || "",
        email: contact.email || "",
        phone: contact.phone || "",
        property_address: contact.property_address || "",
        property_city: contact.property_city || "",
        property_state: contact.property_state || "",
        property_zip: contact.property_zip || "",
        contact_type: contact.contact_type || "prospect",
        notes: contact.notes || "",
      });

      // Load analyses linked to this contact
      const loadAnalyses = async () => {
        const data = await base44.entities.Analysis.filter(
          { contact_id: contact.id },
          "-created_date"
        );
        setAnalyses(data);
      };
      loadAnalyses();
    }
  }, [contact]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) return;

    setLoading(true);
    try {
      const me = await base44.auth.me();

      if (contact) {
        // Update
        await base44.entities.Contact.update(contact.id, formData);
      } else {
        // Create
        await base44.entities.Contact.create({
          ...formData,
          org_id: orgId,
          created_by_email: me.email,
        });
      }

      onSave();
    } catch (err) {
      console.error("Failed to save contact:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-50">
      <div className="w-full bg-white rounded-t-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1A3226]">
            {contact ? "Edit Contact" : "New Contact"}
          </h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-[#1A3226]/10 rounded-lg transition-colors text-[#1A3226]/60"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                First Name *
              </label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                Last Name *
              </label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
            />
          </div>

          <div className="border-t border-[#1A3226]/10 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-[#1A3226] mb-3">Property Address</h3>

            <div>
              <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                Address
              </label>
              <input
                type="text"
                value={formData.property_address}
                onChange={(e) =>
                  setFormData({ ...formData, property_address: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                  City
                </label>
                <input
                  type="text"
                  value={formData.property_city}
                  onChange={(e) =>
                    setFormData({ ...formData, property_city: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                  State
                </label>
                <input
                  type="text"
                  maxLength="2"
                  value={formData.property_state}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      property_state: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
                  ZIP
                </label>
                <input
                  type="text"
                  value={formData.property_zip}
                  onChange={(e) =>
                    setFormData({ ...formData, property_zip: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
              Contact Type
            </label>
            <select
              value={formData.contact_type}
              onChange={(e) =>
                setFormData({ ...formData, contact_type: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="prospect">Prospect</option>
              <option value="past_client">Past Client</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wider text-[#1A3226]/60 font-semibold block mb-1.5">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-[#1A3226]/15 focus:outline-none focus:border-[#1A3226] transition-colors text-sm resize-none h-20"
            />
          </div>

          {/* Linked Analyses */}
          {contact && analyses.length > 0 && (
            <div className="border-t border-[#1A3226]/10 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-[#1A3226] mb-3">
                Linked Analyses ({analyses.length})
              </h3>
              <div className="space-y-2">
                {analyses.map((analysis) => (
                  <a
                    key={analysis.id}
                    href={`/Analysis/${analysis.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-3 rounded-lg border border-[#1A3226]/10 hover:bg-[#1A3226]/5 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-[#1A3226]/40 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1A3226] truncate">
                          {analysis.intake_data?.address || "Untitled"}
                        </p>
                        <p className="text-xs text-[#1A3226]/50 mt-0.5">
                          {new Date(analysis.created_date).toLocaleDateString()} at{" "}
                          {new Date(analysis.created_date).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-[#1A3226]/10">
            <Button
              type="button"
              onClick={onCancel}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                !formData.first_name.trim() ||
                !formData.last_name.trim()
              }
              className="flex-1 bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
            >
              {loading ? "Saving..." : contact ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}