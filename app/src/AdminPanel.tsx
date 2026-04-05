import { useState, useEffect } from 'react';
import InstanceList from './admin/InstanceList';
import CreateInstanceWizard from './admin/CreateInstanceWizard';
import InstanceEditor from './admin/InstanceEditor';
import SimplifiedDesignEditor from './admin/SimplifiedDesignEditor';
import PodcastIngestionForm from './admin/PodcastIngestionForm';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface Prompt {
  name: string;
  description: string;
  system: string;
  max_tokens: number;
}

interface DesignTokens {
  colors: Record<string, any>;
  typography: Record<string, any>;
  spacing: Record<string, any>;
  borders: Record<string, any>;
  shadows: Record<string, any>;
  layout: Record<string, any>;
  animations: Record<string, any>;
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'instances' | 'prompts' | 'design' | 'podcast'>('instances');
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [editingInstance, setEditingInstance] = useState<string | null>(null);
  const [showDesignEditor, setShowDesignEditor] = useState(false);
  const [prompts, setPrompts] = useState<Record<string, Prompt>>({});
  const [designTokens, setDesignTokens] = useState<DesignTokens | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      if (activeTab === 'prompts') {
        const res = await fetch(`${API_BASE}/admin/prompts`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load prompts');
        const data = await res.json();
        setPrompts(data);
      } else {
        const res = await fetch(`${API_BASE}/admin/design-tokens`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load design tokens');
        const data = await res.json();
        setDesignTokens(data);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const savePrompt = async () => {
    if (!selectedPrompt || !editingPrompt) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/prompts/${selectedPrompt}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editingPrompt),
      });
      if (!res.ok) throw new Error('Failed to save prompt');
      await loadData();
      setSelectedPrompt(null);
      setEditingPrompt(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDesignToken = async (path: string[], value: string) => {
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/design-tokens`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ path, value }),
      });
      if (!res.ok) throw new Error('Failed to save design token');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const runComparison = async () => {
    if (!selectedPrompt || !editingPrompt || !testQuery.trim()) {
      setError('Please provide a test query');
      return;
    }
    setComparing(true);
    setError(null);
    setComparisonResult(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/prompts/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          saved_prompt_key: selectedPrompt,
          draft_system: editingPrompt.system,
          draft_max_tokens: editingPrompt.max_tokens,
          test_query: testQuery,
        }),
      });
      if (!res.ok) throw new Error('Failed to run comparison');
      const result = await res.json();
      setComparisonResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setComparing(false);
    }
  };

  const renderPromptList = () => {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Object.entries(prompts).map(([key, prompt]) => (
          <div
            key={key}
            onClick={() => {
              setSelectedPrompt(key);
              setEditingPrompt({ ...prompt });
            }}
            style={{
              padding: 12,
              background: selectedPrompt === key ? '#FF00AE' : '#F0F0ED',
              color: selectedPrompt === key ? '#FFF' : '#1A1A1A',
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14 }}>{prompt.name}</div>
            <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
              {prompt.description}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderPromptEditor = () => {
    if (!editingPrompt || !selectedPrompt) return null;

    const savedPrompt = prompts[selectedPrompt];
    const hasChanges = savedPrompt && (
      editingPrompt.system !== savedPrompt.system ||
      editingPrompt.max_tokens !== savedPrompt.max_tokens
    );

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Name
          </label>
          <input
            type="text"
            value={editingPrompt.name}
            onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
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
            Description
          </label>
          <input
            type="text"
            value={editingPrompt.description}
            onChange={(e) =>
              setEditingPrompt({ ...editingPrompt, description: e.target.value })
            }
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
            System Prompt {hasChanges && <span style={{ color: '#FF00AE' }}>(Draft)</span>}
          </label>
          <textarea
            value={editingPrompt.system}
            onChange={(e) => setEditingPrompt({ ...editingPrompt, system: e.target.value })}
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
            value={editingPrompt.max_tokens}
            onChange={(e) =>
              setEditingPrompt({ ...editingPrompt, max_tokens: parseInt(e.target.value) })
            }
            style={{
              width: '100%',
              padding: 8,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 4,
            }}
          />
        </div>

        {hasChanges && (
          <div style={{ padding: 16, background: '#FFF8E5', borderRadius: 8, border: '1px solid #FFE5A0' }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
              Test Comparison (Saved vs Draft)
            </div>
            <div style={{ fontSize: 12, marginBottom: 8, color: '#666' }}>
              Run both versions against the same test query to compare outputs before saving.
            </div>
            <textarea
              placeholder="Enter test query..."
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              rows={2}
              style={{
                width: '100%',
                padding: 8,
                fontSize: 13,
                border: '1px solid #CCC',
                borderRadius: 4,
                marginBottom: 8,
              }}
            />
            <button
              onClick={runComparison}
              disabled={comparing || !testQuery.trim()}
              style={{
                padding: 8,
                background: '#FF00AE',
                color: '#FFF',
                border: 'none',
                borderRadius: 4,
                fontWeight: 600,
                fontSize: 13,
                cursor: comparing || !testQuery.trim() ? 'not-allowed' : 'pointer',
                opacity: comparing || !testQuery.trim() ? 0.6 : 1,
              }}
            >
              {comparing ? 'Running...' : 'Run Comparison'}
            </button>
          </div>
        )}

        {comparisonResult && (
          <div style={{ padding: 16, background: '#F5F5F5', borderRadius: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              Comparison Results
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#666' }}>
                  Saved Prompt Output
                </div>
                <div
                  style={{
                    padding: 12,
                    background: '#FFF',
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                    border: '2px solid #4CAF50',
                  }}
                >
                  {comparisonResult.saved.output}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: '#666' }}>
                  Draft Prompt Output
                </div>
                <div
                  style={{
                    padding: 12,
                    background: '#FFF',
                    borderRadius: 4,
                    fontSize: 13,
                    fontFamily: 'monospace',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 300,
                    overflow: 'auto',
                    border: '2px solid #FF00AE',
                  }}
                >
                  {comparisonResult.draft.output}
                </div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={savePrompt}
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
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={() => {
              setSelectedPrompt(null);
              setEditingPrompt(null);
              setComparisonResult(null);
              setTestQuery('');
            }}
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
        </div>
      </div>
    );
  };

  const renderDesignTokenEditor = (obj: any, path: string[] = []) => {
    if (typeof obj === 'string') {
      return (
        <input
          type="text"
          value={obj}
          onChange={(e) => saveDesignToken(path, e.target.value)}
          style={{
            width: '100%',
            padding: 6,
            fontSize: 13,
            fontFamily: 'monospace',
            border: '1px solid #CCC',
            borderRadius: 4,
          }}
        />
      );
    }

    if (typeof obj === 'number') {
      return (
        <input
          type="number"
          value={obj}
          onChange={(e) => saveDesignToken(path, e.target.value)}
          style={{
            width: '100%',
            padding: 6,
            fontSize: 13,
            fontFamily: 'monospace',
            border: '1px solid #CCC',
            borderRadius: 4,
          }}
        />
      );
    }

    return (
      <div style={{ marginLeft: path.length > 0 ? 16 : 0 }}>
        {Object.entries(obj).map(([key, value]) => (
          <div key={key} style={{ marginBottom: 12 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                marginBottom: 4,
                color: '#555',
                textTransform: 'capitalize',
              }}
            >
              {key.replace(/_/g, ' ')}
            </div>
            {renderDesignTokenEditor(value, [...path, key])}
          </div>
        ))}
      </div>
    );
  };

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
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Meta Admin</h2>
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
            onClick={() => setActiveTab('instances')}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'instances' ? '#FF00AE' : 'transparent',
              color: activeTab === 'instances' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Instances
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
            LLM Prompts
          </button>
          <button
            onClick={() => {
              setActiveTab('design');
              setShowDesignEditor(true);
            }}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'design' ? '#FF00AE' : 'transparent',
              color: activeTab === 'design' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Design Tokens
          </button>
          <button
            onClick={() => setActiveTab('podcast')}
            style={{
              flex: 1,
              padding: '12px 20px',
              background: activeTab === 'podcast' ? '#FF00AE' : 'transparent',
              color: activeTab === 'podcast' ? '#FFF' : '#888',
              border: 'none',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Podcast Ingest
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

          {loading && activeTab !== 'instances' ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
          ) : activeTab === 'instances' ? (
            <InstanceList
              onCreateNew={() => setShowCreateWizard(true)}
              onEdit={(key) => setEditingInstance(key)}
            />
          ) : activeTab === 'prompts' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
              <div>{renderPromptList()}</div>
              <div>
                {selectedPrompt ? (
                  renderPromptEditor()
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
                    Select a prompt to edit
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'design' ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
              Click "Design Tokens" to edit visual customization
            </div>
          ) : activeTab === 'podcast' ? (
            <PodcastIngestionForm />
          ) : null}
        </div>
      </div>

      {showCreateWizard && (
        <CreateInstanceWizard
          onClose={() => setShowCreateWizard(false)}
          onCreated={() => {
            setShowCreateWizard(false);
            setActiveTab('instances');
          }}
        />
      )}

      {editingInstance && (
        <InstanceEditor
          instanceKey={editingInstance}
          onClose={() => setEditingInstance(null)}
        />
      )}

      {showDesignEditor && (
        <SimplifiedDesignEditor
          onClose={() => setShowDesignEditor(false)}
        />
      )}
    </div>
  );
}
