export default function BrandingPreview({ branding = {} }) {
  const {
    org_name = 'Your Organization',
    primary_color = '#333333',
    accent_color = '#666666',
    background_color = '#FFFFFF',
    org_phone = '',
    org_website = '',
    org_logo_url = null,
    agent_name = 'Agent Name',
    agent_title = 'Real Estate Advisor',
  } = branding;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm select-none" style={{ fontFamily: 'Calibri, Arial, sans-serif', fontSize: 11 }}>
      {/* Header */}
      <div style={{ background: primary_color, padding: '8px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 40 }}>
        {org_logo_url
          ? <img src={org_logo_url} alt="Logo" style={{ maxHeight: 26, maxWidth: 90, objectFit: 'contain' }} />
          : <span style={{ color: 'transparent' }}>·</span>
        }
        <span style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 11 }}>{org_name}</span>
      </div>
      <div style={{ background: accent_color, height: 3 }} />

      {/* Content sample */}
      <div style={{ background: background_color, padding: '14px 16px' }}>
        <div style={{ color: primary_color, fontWeight: 'bold', fontSize: 12, marginBottom: 8 }}>
          Analysis Section Heading
        </div>
        <div style={{ borderLeft: `4px solid ${accent_color}`, paddingLeft: 10, background: accent_color + '18', padding: '6px 10px', marginBottom: 10, borderRadius: '0 4px 4px 0' }}>
          <span style={{ color: '#1A1A1A', fontSize: 10.5 }}>Key finding — recommended price range and market positioning.</span>
        </div>
        <div style={{ color: '#444', fontSize: 10, lineHeight: 1.6, marginBottom: 10 }}>
          Body text content. Market analysis data, comparable sales, and valuation methodology appear here in the full document.
        </div>
        {/* Table sample */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9.5 }}>
          <thead>
            <tr style={{ background: primary_color }}>
              <th style={{ color: '#FFFFFF', padding: '4px 8px', textAlign: 'left' }}>Address</th>
              <th style={{ color: '#FFFFFF', padding: '4px 8px', textAlign: 'left' }}>Sq Ft</th>
              <th style={{ color: '#FFFFFF', padding: '4px 8px', textAlign: 'left' }}>Sale Price</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: background_color }}>
              <td style={{ padding: '3px 8px', color: '#333' }}>123 Sample St</td>
              <td style={{ padding: '3px 8px', color: '#333' }}>2,100</td>
              <td style={{ padding: '3px 8px', color: '#333' }}>$640,000</td>
            </tr>
            <tr style={{ background: primary_color + '14' }}>
              <td style={{ padding: '3px 8px', color: '#333' }}>456 Example Ave</td>
              <td style={{ padding: '3px 8px', color: '#333' }}>1,850</td>
              <td style={{ padding: '3px 8px', color: '#333' }}>$598,000</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Signature block */}
      <div style={{ borderTop: `2px solid ${accent_color}`, padding: '10px 16px', background: background_color }}>
        <div style={{ fontWeight: 'bold', fontSize: 10.5, color: '#1A1A1A' }}>{agent_name}</div>
        <div style={{ fontSize: 9.5, color: '#666', marginTop: 2 }}>{agent_title}</div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${accent_color}`, padding: '6px 14px', background: background_color, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#666', fontSize: 8.5 }}>
          {[org_name, org_phone, org_website].filter(Boolean).join(' | ') || 'Organization info'}
        </span>
        <span style={{ color: '#999', fontSize: 8.5 }}>Page 1 of 4</span>
        <span style={{ color: '#BBB', fontSize: 8.5 }}>Prepared by PropPrompt™</span>
      </div>
    </div>
  );
}