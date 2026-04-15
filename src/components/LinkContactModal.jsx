import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";

export default function LinkContactModal({ analysis, orgId, onSave, onCancel }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(analysis.contact_id || null);

  useEffect(() => {
    async function load() {
      const data = await base44.entities.Contact.filter({ org_id: orgId });
      setContacts(data);
      setLoading(false);
    }
    load();
  }, [orgId]);

  const filtered = contacts.filter((c) =>
    [c.first_name, c.last_name, c.property_address]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleSave = async () => {
    setLoading(true);
    try {
      await base44.entities.Analysis.update(analysis.id, {
        contact_id: selectedId,
      });
      onSave();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1A3226]/10">
          <h2 className="text-lg font-semibold text-[#1A3226]">Link Contact</h2>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-[#1A3226]/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#1A3226]/60" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-[#1A3226]/10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/40" />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-[#1A3226]/10 focus:outline-none focus:border-[#1A3226] text-sm"
            />
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-3 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#1A3226]/40">
              No contacts found
            </div>
          ) : (
            <div className="divide-y divide-[#1A3226]/5">
              {/* None option */}
              <button
                onClick={() => setSelectedId(null)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  selectedId === null
                    ? "bg-[#1A3226] text-white"
                    : "hover:bg-[#1A3226]/5"
                }`}
              >
                <p className="text-sm font-medium">None (Unlink)</p>
              </button>

              {/* Contact options */}
              {filtered.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedId(contact.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    selectedId === contact.id
                      ? "bg-[#1A3226] text-white"
                      : "hover:bg-[#1A3226]/5"
                  }`}
                >
                  <p className="text-sm font-medium">
                    {contact.first_name} {contact.last_name}
                  </p>
                  {contact.property_address && (
                    <p className="text-xs mt-0.5 opacity-70">
                      {contact.property_address}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 border-t border-[#1A3226]/10">
          <Button variant="outline" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 bg-[#1A3226] hover:bg-[#1A3226]/90 text-white"
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}