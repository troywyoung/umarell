import { useState, useEffect } from 'react';
import { API as API_BASE } from '../config';

interface SimplifiedTokensData {
  tokens: Record<string, string>;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}

interface SimplifiedDesignEditorProps {
  onClose: () => void;
}

export default function SimplifiedDesignEditor({ onClose: _onClose }: SimplifiedDesignEditorProps) {
  const [data, setData] = useState<SimplifiedTokensData | null>(null);
  const [editedTokens, setEditedTokens] = useState<Record<string, string>>({});
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deploymentTriggered, setDeploymentTriggered] = useState(false);
  const [saveType, setSaveType] = useState<'draft' | 'deploy' | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    const endpoint = `${API_BASE}/admin/simplified-tokens`;
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
      const result = await res.json();
      setData(result);
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
    } catch (err: any) {
      setError(`${err.message} (target: ${endpoint})`);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (key: string, value: string) => {
    setEditedTokens((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  const saveTokens = async (deploy: boolean) => {
    setSaving(true);
    setError(null);
    setSaveStatus('idle');
    setDeploymentTriggered(false);
    setSaveType(deploy ? 'deploy' : 'draft');
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens?deploy=${deploy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tokens: editedTokens }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setSaveStatus('saved');
      setSavedTokens(editedTokens);
      setDeploymentTriggered(result.deployment_triggered);
      setTimeout(() => { setSaveStatus('idle'); setSaveType(null); }, 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const revertToDefaults = async () => {
    if (!confirm('Revert all design tokens to defaults?')) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens/revert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to revert design tokens');
      const result = await res.json();
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const isColorToken = (key: string) =>
    ['primary_accent', 'button_color', 'dark_background', 'light_background',
     'secondary_background', 'card_background', 'dark_text', 'secondary_text'].includes(key);

  const hasUnsavedChanges = () =>
    Object.keys(editedTokens).some(key => editedTokens[key] !== savedTokens[key]);

  const renderTokenField = (key: string) => (
    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
        {data!.labels[key]}
      </label>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{data!.descriptions[key]}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {isColorToken(key) && (
          <input
            type="color"
            value={editedTokens[key]}
            onChange={(e) => handleTokenChange(key, e.target.value)}
            style={{ width: 36, height: 30, border: '1px solid #CCC', borderRadius: 4, cursor: 'pointer', padding: 2 }}
          />
        )}
        <input
          type="text"
          value={editedTokens[key]}
          onChange={(e) => handleTokenChange(key, e.target.value)}
          style={{ flex: 1, padding: '6px 8px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #CCC', borderRadius: 4 }}
        />
      </div>
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading design tokens...</div>;
  if (!data) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#E53E3E' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Failed to load design tokens</div>
      {error && <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', marginBottom: 12 }}>{error}</div>}
      <button onClick={loadTokens} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #DDD', borderRadius: 5, cursor: 'pointer', background: '#FFF' }}>Retry</button>
    </div>
  );

  const sectionStyle = { marginBottom: 32 };
  const headingStyle: React.CSSProperties = { margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 };

  return (
    <div>
      {/* Status banners */}
      {error && (
        <div style={{ padding: 12, background: '#FEE', color: '#E53E3E', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}
      {saveStatus === 'saved' && (
        <div style={{ padding: 12, background: '#E6FFED', color: '#22863A', borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>✓</span>
          <div>
            <div style={{ fontWeight: 600 }}>
              {deploymentTriggered ? 'Saved and deployed to staging' : 'Draft saved'}
            </div>
            {deploymentTriggered && (
              <div style={{ fontSize: 12, marginTop: 2 }}>
                May take 1–2 minutes to reflect.{' '}
                <a href="https://umarell-staging.up.railway.app" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#22863A', textDecoration: 'underline', fontWeight: 600 }}>
                  Verify on staging ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unsaved indicator */}
      {hasUnsavedChanges() && (
        <div style={{ display: 'inline-block', padding: '4px 10px', background: '#FFF4E6', color: '#D97706', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #FDB94E', marginBottom: 20 }}>
          Unsaved changes
        </div>
      )}

      {/* Colors */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Colors</h3>
        <div style={gridStyle}>
          {['primary_accent', 'button_color', 'dark_background', 'light_background', 'secondary_background', 'card_background', 'dark_text', 'secondary_text']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Typography */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Typography</h3>
        <div style={gridStyle}>
          {['base_font_size', 'bold_font_weight']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Layout */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Layout</h3>
        <div style={gridStyle}>
          {['border_radius', 'base_padding', 'max_content_width', 'card_shadow']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, paddingTop: 8, borderTop: '1px solid #EEE' }}>
        <button
          onClick={() => saveTokens(false)}
          disabled={saving}
          style={{ flex: 1, padding: '10px 0', background: '#FF00AE', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving && saveType === 'draft' ? 'Saving...' : 'Save Draft'}
        </button>
        <button
          onClick={() => saveTokens(true)}
          disabled={saving}
          style={{ flex: 1, padding: '10px 0', background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          {saving && saveType === 'deploy' ? 'Deploying...' : 'Deploy to Staging'}
        </button>
        <button
          onClick={revertToDefaults}
          disabled={saving}
          style={{ padding: '10px 16px', background: '#F0F0ED', color: '#888', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
        >
          Revert
        </button>
      </div>
    </div>
  );
}
