import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface InstanceConfig {
  instance: {
    id: string;
    key: string;
    display_name: string;
    subdirectory: string | null;
    is_active: boolean;
  };
  prompts: Record<string, any>;
  design_tokens: any;
  ui_copy: any;
}

interface InstanceEditorProps {
  instanceKey: string;
  onClose: () => void;
}

export default function InstanceEditor({ instanceKey, onClose }: InstanceEditorProps) {
  const [config, setConfig] = useState<InstanceConfig | null>(null);
  const [activeTab, setActiveTab] = useState<'ui_copy' | 'design_tokens' | 'prompts'>('ui_copy');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedConfig, setEditedConfig] = useState<any>(null);

  useEffect(() => {
    loadConfig();
  }, [instanceKey]);

  const loadConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/instances/${instanceKey}/config`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load config');
      const data = await res.json();
      setConfig(data);
      setEditedConfig({
        ui_copy: data.ui_copy,
        design_tokens: data.design_tokens,
        prompts: data.prompts,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!editedConfig) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/instances/${instanceKey}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedConfig),
      });
      if (!res.ok) throw new Error('Failed to save config');
      await loadConfig();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const updateUICopy = (path: string[], value: any) => {
    const newConfig = { ...editedConfig };
    let current = newConfig.ui_copy;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setEditedConfig(newConfig);
  };

  const updateDesignToken = (path: string[], value: string) => {
    const newConfig = { ...editedConfig };
    let current = newConfig.design_tokens;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    setEditedConfig(newConfig);
  };

  const updatePrompt = (key: string, field: string, value: any) => {
    const newConfig = { ...editedConfig };
    if (!newConfig.prompts[key]) {
      newConfig.prompts[key] = {};
    }
    newConfig.prompts[key][field] = value;
    setEditedConfig(newConfig);
  };

  const renderUICopyEditor = () => {
    if (!editedConfig?.ui_copy) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Page Title
          </label>
          <input
            type="text"
            value={editedConfig.ui_copy.page_title || ''}
            onChange={(e) => updateUICopy(['page_title'], e.target.value)}
            style={{
              width: '100%',
              padding: 8,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 4,
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Placeholder Prompts (one per line)
          </label>
          <textarea
            value={(editedConfig.ui_copy.placeholder_prompts || []).join('\n')}
            onChange={(e) => updateUICopy(['placeholder_prompts'], e.target.value.split('\n'))}
            rows={8}
            style={{
              width: '100%',
              padding: 8,
              fontSize: 13,
              border: '1px solid #CCC',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Response Placeholders (one per line)
          </label>
          <textarea
            value={(editedConfig.ui_copy.response_placeholders || []).join('\n')}
            onChange={(e) => updateUICopy(['response_placeholders'], e.target.value.split('\n'))}
            rows={8}
            style={{
              width: '100%',
              padding: 8,
              fontSize: 13,
              border: '1px solid #CCC',
              borderRadius: 4,
              fontFamily: 'monospace',
            }}
          />
        </div>

        {editedConfig.ui_copy.labels && (
          <div>
            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Labels</h4>
            {Object.entries(editedConfig.ui_copy.labels).map(([key, value]) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  {key.replace(/_/g, ' ')}
                </label>
                <input
                  type="text"
                  value={value as string}
                  onChange={(e) => updateUICopy(['labels', key], e.target.value)}
                  style={{
                    width: '100%',
                    padding: 6,
                    fontSize: 13,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDesignTokensEditor = () => {
    if (!editedConfig?.design_tokens?.colors) return null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>Colors</h4>
        {Object.entries(editedConfig.design_tokens.colors).map(([key, value]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, minWidth: 120 }}>
              {key.replace(/_/g, ' ')}
            </label>
            <input
              type="color"
              value={value as string}
              onChange={(e) => updateDesignToken(['colors', key], e.target.value)}
              style={{ width: 50, height: 32, border: '1px solid #CCC', borderRadius: 4 }}
            />
            <input
              type="text"
              value={value as string}
              onChange={(e) => updateDesignToken(['colors', key], e.target.value)}
              style={{
                flex: 1,
                padding: 6,
                fontSize: 13,
                fontFamily: 'monospace',
                border: '1px solid #CCC',
                borderRadius: 4,
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderPromptsEditor = () => {
    if (!editedConfig?.prompts) return null;

    const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

    const promptKeys = Object.keys(editedConfig.prompts);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {promptKeys.map((key) => (
            <div
              key={key}
              onClick={() => setSelectedPrompt(key)}
              style={{
                padding: 12,
                background: selectedPrompt === key ? '#FF00AE' : '#F0F0ED',
                color: selectedPrompt === key ? '#FFF' : '#1A1A1A',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {editedConfig.prompts[key].name || key}
              </div>
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
                {editedConfig.prompts[key].description}
              </div>
            </div>
          ))}
        </div>
        <div>
          {selectedPrompt && editedConfig.prompts[selectedPrompt] ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  System Prompt
                </label>
                <textarea
                  value={editedConfig.prompts[selectedPrompt].system || ''}
                  onChange={(e) => updatePrompt(selectedPrompt, 'system', e.target.value)}
                  rows={12}
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    border: '1px solid #CCC',
                    borderRadius: 4,
                    lineHeight: 1.5,
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={editedConfig.prompts[selectedPrompt].max_tokens || 1000}
                  onChange={(e) => updatePrompt(selectedPrompt, 'max_tokens', parseInt(e.target.value))}
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              Select a prompt to edit
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ color: '#FFF', fontSize: 18 }}>Loading...</div>
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
        zIndex: 1000,
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
          maxWidth: 1200,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Edit Instance: {config?.instance.display_name}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 32,
              height: 32,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #EEE' }}>
          <button
            onClick={() => setActiveTab('ui_copy')}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'ui_copy' ? '#FF00AE' : 'transparent',
              color: activeTab === 'ui_copy' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            UI Copy
          </button>
          <button
            onClick={() => setActiveTab('design_tokens')}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'design_tokens' ? '#FF00AE' : 'transparent',
              color: activeTab === 'design_tokens' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Design Tokens
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'prompts' ? '#FF00AE' : 'transparent',
              color: activeTab === 'prompts' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Prompts
          </button>
        </div>

        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: '#FFE5E5',
                color: '#D00',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {activeTab === 'ui_copy' && renderUICopyEditor()}
          {activeTab === 'design_tokens' && renderDesignTokensEditor()}
          {activeTab === 'prompts' && renderPromptsEditor()}
        </div>

        <div
          style={{
            padding: 20,
            borderTop: '1px solid #EEE',
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
          }}
        >
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
            Cancel
          </button>
          <button
            onClick={saveConfig}
            disabled={saving}
            style={{
              padding: 12,
              background: saving ? '#CCC' : '#FF00AE',
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
