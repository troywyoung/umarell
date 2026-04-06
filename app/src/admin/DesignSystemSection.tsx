import { useState, useEffect } from 'react';
import PreviewPane from './PreviewPane';
import type { Observation } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface SimplifiedTokensData {
  tokens: Record<string, string>;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}

export default function DesignSystemSection() {
  const [data, setData] = useState<SimplifiedTokensData | null>(null);
  const [editedTokens, setEditedTokens] = useState<Record<string, string>>({});
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'draft' | 'comparison'>('draft');
  const [previewObservations, setPreviewObservations] = useState<Observation[]>([]);
  const [loadingObservations, setLoadingObservations] = useState(false);

  // Debounced preview tokens - update preview 300ms after user stops typing
  const [debouncedPreviewTokens, setDebouncedPreviewTokens] = useState(editedTokens);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedPreviewTokens(editedTokens);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [editedTokens]);

  useEffect(() => {
    loadTokens();
    loadPreviewObservations();
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

  const loadPreviewObservations = async () => {
    setLoadingObservations(true);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/observations?limit=3`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const observations = await res.json();
        const complete = observations.filter((o: Observation) =>
          o.status === 'complete' && o.thesis
        );
        setPreviewObservations(complete.length > 0 ? complete : []);
      }
    } catch (err) {
      console.warn('Failed to load preview observations:', err);
    } finally {
      setLoadingObservations(false);
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
      await res.json();
      setSaveStatus('saved');
      setSavedTokens(editedTokens);
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
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
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
      }}
    >
      {/* Left Panel: Token Editor */}
      <div
        style={{
          width: '500px',
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #EEE',
          flexShrink: 0,
        }}
      >
        {/* Token Editor Header */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Design Tokens</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
              14 high-leverage controls
            </p>
          </div>
        </div>

        {/* Token List */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 20,
          }}
        >
          {Object.entries(data.tokens).map(([key, _value]) => (
            <div key={key} style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  fontWeight: 600,
                  marginBottom: 6,
                  color: '#1A1A1A',
                }}
              >
                {data.labels[key]}
              </label>
              <p style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                {data.descriptions[key]}
              </p>
              {isColorToken(key) ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={editedTokens[key]}
                    onChange={(e) => handleTokenChange(key, e.target.value)}
                    style={{
                      width: 50,
                      height: 40,
                      border: '1px solid #CCC',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  />
                  <input
                    type="text"
                    value={editedTokens[key]}
                    onChange={(e) => handleTokenChange(key, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      fontSize: 14,
                      fontFamily: 'monospace',
                      border: '1px solid #CCC',
                      borderRadius: 4,
                    }}
                  />
                </div>
              ) : (
                <input
                  type="text"
                  value={editedTokens[key]}
                  onChange={(e) => handleTokenChange(key, e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: 14,
                    fontFamily: 'monospace',
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div
          style={{
            padding: 20,
            borderTop: '1px solid #EEE',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {error && (
            <div style={{ padding: 10, background: '#FEE', color: '#C00', borderRadius: 4, fontSize: 13 }}>
              {error}
            </div>
          )}
          {saveStatus === 'saved' && (
            <div style={{ padding: 10, background: '#E8F5E9', color: '#2E7D32', borderRadius: 4, fontSize: 13 }}>
              Draft saved successfully. Deploy to staging via Railway dashboard.
              <div style={{ marginTop: 8 }}>
                <a
                  href="https://umarell-staging.up.railway.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#2E7D32', fontWeight: 600 }}
                >
                  Open Staging →
                </a>
              </div>
            </div>
          )}
          <button
            onClick={saveTokens}
            disabled={saving || !hasUnsavedChanges()}
            style={{
              padding: 12,
              background: hasUnsavedChanges() ? '#FF00AE' : '#CCC',
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: hasUnsavedChanges() && !saving ? 'pointer' : 'not-allowed',
              opacity: saving || !hasUnsavedChanges() ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving...' : 'Save Draft'}
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
        </div>
      </div>

      {/* Right Panel: Live Preview */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          background: '#F8F8F8',
          overflow: 'hidden',
        }}
      >
        {/* Preview Mode Toggle */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
            background: '#FFF',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <button
              onClick={() => setPreviewMode('draft')}
              style={{
                padding: '8px 16px',
                background: previewMode === 'draft' ? '#FF00AE' : '#F0F0ED',
                color: previewMode === 'draft' ? '#FFF' : '#1A1A1A',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Draft Preview
            </button>
            <button
              onClick={() => setPreviewMode('comparison')}
              style={{
                padding: '8px 16px',
                background: previewMode === 'comparison' ? '#FF00AE' : '#F0F0ED',
                color: previewMode === 'comparison' ? '#FFF' : '#1A1A1A',
                border: 'none',
                borderRadius: 6,
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Before / After
            </button>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
            See your changes in real-time
          </p>
        </div>

        {/* Preview Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {loadingObservations ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              Loading preview content...
            </div>
          ) : previewMode === 'draft' ? (
            <PreviewPane
              tokens={debouncedPreviewTokens}
              observations={previewObservations}
              mode="draft"
            />
          ) : (
            <div style={{ display: 'flex', gap: 20 }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>
                  Current (Saved)
                </h3>
                <PreviewPane
                  tokens={savedTokens}
                  observations={previewObservations}
                  mode="comparison"
                  productionTokens={savedTokens}
                />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700 }}>
                  Draft (Editing)
                </h3>
                <PreviewPane
                  tokens={debouncedPreviewTokens}
                  observations={previewObservations}
                  mode="comparison"
                  productionTokens={savedTokens}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
