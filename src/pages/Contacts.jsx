import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Plus, Search, Star, MapPin, Mail, Phone, MoreVertical, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import PullToRefresh from "../components/PullToRefresh";
import ContactForm from "../components/ContactForm";
import CrmImportModal from "../components/CrmImportModal";

export default function Contacts() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [orgId, setOrgId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showCrmImport, setShowCrmImport] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user) return;

      const memberships = await base44.entities.OrgMembership.filter({
        user_email: user.email,
        status: "active",
      });

      if (memberships.length > 0) {
        const org = memberships[0];
        setOrgId(org.org_id);
        const data = await base44.entities.Contact.filter(
          { org_id: org.org_id },
          "-created_date"
        );
        setContacts(data);
      }

      setLoading(false);
    }
    load();
  }, [user]);

  const handleRefresh = useCallback(async () => {
    if (!orgId) return;
    const data = await base44.entities.Contact.filter(
      { org_id: orgId },
      "-created_date"
    );
    setContacts(data);
  }, [orgId]);

  const handleSaveContact = async () => {
    await handleRefresh();
    setShowForm(false);
    setEditingContact(null);
  };

  const handleToggleFavorite = async (contact) => {
    await base44.entities.Contact.update(contact.id, {
      is_favorite: !contact.is_favorite,
    });
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id ? { ...c, is_favorite: !c.is_favorite } : c
      )
    );
  };

  const handleDeleteContact = async (contactId) => {
    if (!confirm("Delete this contact?")) return;
    await base44.entities.Contact.delete(contactId);
    setContacts((prev) => prev.filter((c) => c.id !== contactId));
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-[#1A3226]/20 border-t-[#1A3226] rounded-full animate-spin" />
      </div>
    );
  }

  if (!orgId) {
    return (
      <div className="text-center py-16">
        <p className="text-[#1A3226]/50 mb-4">Organization not found.</p>
      </div>
    );
  }

  // Filter contacts by search
  const filtered = contacts.filter((c) =>
    [c.first_name, c.last_name, c.property_address, c.email]
      .filter(Boolean)
      .some((field) => field.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Separate favorites
  const favorites = filtered.filter((c) => c.is_favorite);
  const others = filtered.filter((c) => !c.is_favorite);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-6">
        {/* Header */}
         <div className="flex items-center justify-between">
           <div>
             <h1 className="text-xl font-semibold text-[#1A3226]" style={{ fontFamily: "Georgia, serif" }}>
               Contacts
             </h1>
             <p className="text-sm text-[#1A3226]/50 mt-0.5">{filtered.length} contact{filtered.length !== 1 ? "s" : ""}</p>
           </div>
           <div className="flex gap-2">
             <Button
               onClick={() => setShowCrmImport(true)}
               variant="outline"
               className="gap-2"
             >
               <Download className="w-4 h-4" />
               Import from CRM
             </Button>
             <Button
               onClick={() => {
                 setEditingContact(null);
                 setShowForm(true);
               }}
               className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2"
             >
               <Plus className="w-4 h-4" />
               New Contact
             </Button>
           </div>
         </div>

        {/* Form Modal */}
        {showForm && (
          <ContactForm
            orgId={orgId}
            contact={editingContact}
            onSave={handleSaveContact}
            onCancel={() => {
              setShowForm(false);
              setEditingContact(null);
            }}
          />
        )}

        {/* CRM Import Modal */}
        {showCrmImport && (
          <CrmImportModal
            orgId={orgId}
            onClose={() => setShowCrmImport(false)}
            onSuccess={() => {
              setShowCrmImport(false);
              handleRefresh();
            }}
          />
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#1A3226]/40" />
          <input
            type="text"
            placeholder="Search by name, address, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#1A3226]/10 focus:outline-none focus:border-[#1A3226] transition-colors text-sm"
          />
        </div>

        {/* Contacts List */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#1A3226]/15 bg-white p-16 flex flex-col items-center text-center">
            <MapPin className="w-12 h-12 text-[#1A3226]/15 mb-4" />
            <p className="text-sm font-medium text-[#1A3226]/50 mb-1">No contacts yet</p>
            <p className="text-xs text-[#1A3226]/30 mb-5">
              Add contacts manually or import from your CRM.
            </p>
            <Button
              onClick={() => setShowForm(true)}
              className="bg-[#1A3226] hover:bg-[#1A3226]/90 text-white gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              New Contact
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Favorites Section */}
            {favorites.length > 0 && (
              <div>
                <h2 className="text-xs uppercase tracking-wider text-[#1A3226]/40 font-semibold mb-2 px-1">
                  Favorites
                </h2>
                <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden divide-y divide-[#1A3226]/5">
                  {favorites.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onFavorite={handleToggleFavorite}
                      onEdit={() => {
                        setEditingContact(contact);
                        setShowForm(true);
                      }}
                      onDelete={handleDeleteContact}
                      onStartAnalysis={() =>
                        navigate(`/AnalysisWizard?contactId=${contact.id}&orgId=${orgId}`)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Others Section */}
            {others.length > 0 && (
              <div>
                {favorites.length > 0 && (
                  <h2 className="text-xs uppercase tracking-wider text-[#1A3226]/40 font-semibold mb-2 px-1">
                    All Contacts
                  </h2>
                )}
                <div className="rounded-2xl border border-[#1A3226]/10 bg-white overflow-hidden divide-y divide-[#1A3226]/5">
                  {others.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onFavorite={handleToggleFavorite}
                      onEdit={() => {
                        setEditingContact(contact);
                        setShowForm(true);
                      }}
                      onDelete={handleDeleteContact}
                      onStartAnalysis={() =>
                        navigate(`/AnalysisWizard?contactId=${contact.id}&orgId=${orgId}`)
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

function ContactRow({ contact, onFavorite, onEdit, onDelete, onStartAnalysis }) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      onClick={onEdit}
      className="px-5 py-4 hover:bg-[#FAF8F4]/70 transition-colors cursor-pointer group flex items-start justify-between gap-4"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#1A3226] truncate">
            {contact.first_name} {contact.last_name}
          </p>
          {contact.is_favorite && (
            <Star className="w-3.5 h-3.5 fill-[#B8982F] text-[#B8982F] flex-shrink-0" />
          )}
        </div>

        {contact.property_address && (
          <p className="text-xs text-[#1A3226]/40 mt-1 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {contact.property_address}
          </p>
        )}

        <div className="flex flex-wrap gap-2 mt-2">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-[#1A3226]/50 hover:text-[#1A3226] flex items-center gap-0.5"
            >
              <Mail className="w-2.5 h-2.5" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="text-[10px] text-[#1A3226]/50 hover:text-[#1A3226] flex items-center gap-0.5"
            >
              <Phone className="w-2.5 h-2.5" />
              {contact.phone}
            </a>
          )}
        </div>
      </div>

      {contact.analyses_count > 0 && (
        <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-[#1A3226]/5 text-[#1A3226] flex-shrink-0">
          {contact.analyses_count} analyses
        </span>
      )}

      <div className="relative flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          className="p-2 hover:bg-[#1A3226]/10 rounded-lg transition-colors text-[#1A3226]/60"
        >
          <MoreVertical className="w-4 h-4" />
        </button>

        {showMenu && (
          <div className="absolute right-0 top-full mt-1 bg-white border border-[#1A3226]/10 rounded-lg shadow-lg z-10 min-w-[140px]">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onFavorite(contact);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[#1A3226] hover:bg-[#1A3226]/5 flex items-center gap-2 border-b border-[#1A3226]/5"
            >
              <Star className="w-3.5 h-3.5" />
              {contact.is_favorite ? "Unfavorite" : "Favorite"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartAnalysis();
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-[#1A3226] hover:bg-[#1A3226]/5 border-b border-[#1A3226]/5"
            >
              Start Analysis
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(contact.id);
                setShowMenu(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}