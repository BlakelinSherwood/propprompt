import { useState } from 'react';
import { X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

export default function CrmImportModal({ orgId, onClose, onSuccess }) {
  const [crmType, setCrmType] = useState(null);
  const [authUrl, setAuthUrl] = useState(null);
  const [accessToken, setAccessToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleAuth = (type) => {
    setCrmType(type);
    if (type === 'salesforce') {
      const clientId = prompt('Enter your Salesforce OAuth Client ID:');
      if (clientId) {
        const redirectUri = `${window.location.origin}/auth/salesforce-callback`;
        const url = `https://login.salesforce.com/services/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=api`;
        window.open(url, 'sf-auth', 'width=500,height=600');
      }
    } else if (type === 'hubspot') {
      const clientId = prompt('Enter your HubSpot OAuth Client ID:');
      if (clientId) {
        const redirectUri = `${window.location.origin}/auth/hubspot-callback`;
        const url = `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=crm.objects.contacts.read`;
        window.open(url, 'hs-auth', 'width=500,height=600');
      }
    }
  };

  const handleSync = async () => {
    if (!crmType || !accessToken) {
      setError('Please complete authentication first');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await base44.functions.invoke('syncCrmContacts', {
        crm_type: crmType,
        access_token: accessToken,
        org_id: orgId,
      });
      setResult(res.data);
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Sync failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#1A3226]">Import from CRM</h2>
          <button onClick={onClose} className="text-[#1A3226]/50 hover:text-[#1A3226]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!result ? (
          <div className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#1A3226]">Select CRM</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'salesforce', label: 'Salesforce', icon: '☁️' },
                  { id: 'hubspot', label: 'HubSpot', icon: '🔗' },
                ].map((crm) => (
                  <button
                    key={crm.id}
                    onClick={() => handleAuth(crm.id)}
                    className={`p-3 rounded-lg border-2 text-center transition-all ${
                      crmType === crm.id
                        ? 'border-[#1A3226] bg-[#1A3226]/5'
                        : 'border-[#1A3226]/10 hover:border-[#1A3226]/20'
                    }`}
                  >
                    <div className="text-xl mb-1">{crm.icon}</div>
                    <p className="text-sm font-medium text-[#1A3226]">{crm.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {crmType && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1A3226]">Access Token</label>
                <input
                  type="password"
                  placeholder="Paste your access token here"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  className="w-full px-3 py-2 border border-[#1A3226]/20 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1A3226]/20"
                />
                <p className="text-xs text-[#1A3226]/50">
                  {crmType === 'salesforce'
                    ? 'Get from Salesforce OAuth flow'
                    : 'Get from HubSpot OAuth flow'}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button
                onClick={handleSync}
                disabled={!crmType || !accessToken || loading}
                className="flex-1 bg-[#1A3226] hover:bg-[#1A3226]/90"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Syncing...
                  </>
                ) : (
                  'Sync Contacts'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mx-auto">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-[#1A3226]">Import Successful</p>
              <p className="text-sm text-[#1A3226]/60">
                {result.imported_count} contacts imported from {result.total_fetched} fetched
              </p>
            </div>
            <Button onClick={onClose} className="w-full bg-[#1A3226] hover:bg-[#1A3226]/90">
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}