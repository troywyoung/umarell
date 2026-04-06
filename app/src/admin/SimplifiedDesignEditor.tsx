import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface SimplifiedTokensData {
  tokens: Record<string, string>;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}

interface SimplifiedDesignEditorProps {
  onClose: () => void;
}

export default function SimplifiedDesignEditor({ onClose }: SimplifiedDesignEditorProps) {
  const [data, setData] = useState<SimplifiedTokensData | null>(null);
  const [editedTokens, setEditedTokens] = useState<Record<string, string>>({});
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deploymentTriggered, setDeploymentTriggered] = useState(false);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to load design tokens');
      const result = await res.json();
      setData(result);
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (key: string, value: string) => {
    setEditedTokens((prev) => ({
      ...prev,
      [key]: value,
    }));
    setSaveStatus('idle');
  };

  const saveTokens = async () => {
    setSaving(true);
    setError(null);
    setSaveStatus('idle');
    setDeploymentTriggered(false);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ tokens: editedTokens }),
      });
      if (!res.ok) throw new Error('Failed to save design tokens');
      const result = await res.json();
      setSaveStatus('saved');
      setSavedTokens(editedTokens);
      setDeploymentTriggered(result.deployment_triggered);
      // Clear save status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const revertToDefaults = async () => {
    if (!confirm('Are you sure you want to revert all design tokens to defaults?')) {
      return;
    }

    setSaving(true);
    setError(null);
    setSaveStatus('idle');
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens/revert`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error('Failed to revert design tokens');
      const result = await res.json();
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
      setSaveStatus('saved');
      // Clear save status after 3 seconds
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const isColorToken = (key: string) => {
    return key.includes('color') || key.includes('background') || key.includes('text') || key === 'primary_accent';
  };

  const hasUnsavedChanges = () => {
    return Object.keys(editedTokens).some(key => editedTokens[key] !== savedTokens[key]);
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#888' }}>Loading design tokens...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#E53E3E' }}>Failed to load design tokens</div>
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: 18,
          maxWidth: 800,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Design Tokens</h2>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
                14 high-leverage controls for visual customization
              </p>
            </div>
            {hasUnsavedChanges() && (
              <div
                style={{
                  padding: '4px 10px',
                  background: '#FFF4E6',
                  color: '#D97706',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  border: '1px solid #FDB94E',
                }}
              >
                Unsaved changes
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#888',
              padding: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: '#FEE',
                color: '#E53E3E',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {saveStatus === 'saved' && (
            <div
              style={{
                padding: 12,
                background: '#E6FFED',
                color: '#22863A',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>✓</span>
              <div>
                <div style={{ fontWeight: 600 }}>Design tokens saved successfully</div>
                {deploymentTriggered && (
                  <div style={{ fontSize: 12, marginTop: 4 }}>
                    Staging deployment has been triggered
                  </div>
                )}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Colors Section */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                Colors
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {['primary_color', 'secondary_color', 'background_color', 'text_color']
                  .filter(key => data.tokens[key] !== undefined)
                  .map((key) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#1A1A1A',
                        }}
                      >
                        {data.labels[key]}
                      </label>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                        {data.descriptions[key]}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isColorToken(key) && (
                          <input
                            type="color"
                            value={editedTokens[key]}
                            onChange={(e) => handleTokenChange(key, e.target.value)}
                            style={{
                              width: 40,
                              height: 32,
                              border: '1px solid #CCC',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                        )}
                        <input
                          type="text"
                          value={editedTokens[key]}
                          onChange={(e) => handleTokenChange(key, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: 13,
                            fontFamily: 'monospace',
                            border: '1px solid #CCC',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Typography Section */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                Typography
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {['font_family_sans', 'font_family_serif', 'font_size_base', 'line_height_base']
                  .filter(key => data.tokens[key] !== undefined)
                  .map((key) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#1A1A1A',
                        }}
                      >
                        {data.labels[key]}
                      </label>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                        {data.descriptions[key]}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isColorToken(key) && (
                          <input
                            type="color"
                            value={editedTokens[key]}
                            onChange={(e) => handleTokenChange(key, e.target.value)}
                            style={{
                              width: 40,
                              height: 32,
                              border: '1px solid #CCC',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                        )}
                        <input
                          type="text"
                          value={editedTokens[key]}
                          onChange={(e) => handleTokenChange(key, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: 13,
                            fontFamily: 'monospace',
                            border: '1px solid #CCC',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Layout Section */}
            <div>
              <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>
                Layout
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {['spacing_unit', 'container_max_width', 'border_radius_base', 'shadow_base', 'transition_duration', 'button_padding']
                  .filter(key => data.tokens[key] !== undefined)
                  .map((key) => (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: '#1A1A1A',
                        }}
                      >
                        {data.labels[key]}
                      </label>
                      <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>
                        {data.descriptions[key]}
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {isColorToken(key) && (
                          <input
                            type="color"
                            value={editedTokens[key]}
                            onChange={(e) => handleTokenChange(key, e.target.value)}
                            style={{
                              width: 40,
                              height: 32,
                              border: '1px solid #CCC',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                          />
                        )}
                        <input
                          type="text"
                          value={editedTokens[key]}
                          onChange={(e) => handleTokenChange(key, e.target.value)}
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: 13,
                            fontFamily: 'monospace',
                            border: '1px solid #CCC',
                            borderRadius: 4,
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: 20,
            borderTop: '1px solid #EEE',
            display: 'flex',
            gap: 8,
          }}
        >
          <button
            onClick={saveTokens}
            disabled={saving}
            style={{
              flex: 1,
              padding: 12,
              background: '#FF00AE',
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save & Deploy to Staging'}
          </button>
          <button
            onClick={revertToDefaults}
            disabled={saving}
            style={{
              padding: 12,
              background: '#F0F0ED',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            Revert to Defaults
          </button>
          <button
            onClick={onClose}
            style={{
              padding: 12,
              background: '#F0F0ED',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
