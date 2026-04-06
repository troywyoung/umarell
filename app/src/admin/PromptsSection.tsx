import { useState, useEffect } from 'react';
import { diffWords } from 'diff';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface Prompt {
  name: string;
  description: string;
  system: string;
  max_tokens: number;
}

interface TestQuery {
  id?: string;
  query_text: string;
  order_index: number;
}

interface TestSuite {
  id: string;
  name: string;
  description?: string;
  query_count?: number;
  queries?: TestQuery[];
  created_at?: string;
}

export default function PromptsSection() {
  const [prompts, setPrompts] = useState<Record<string, Prompt>>({});
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testQuery, setTestQuery] = useState<string>('');
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [comparing, setComparing] = useState(false);
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch(`${API_BASE}/admin/prompts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load prompts');
      const data = await res.json();
      setPrompts(data);

      // Load test suites
      const suitesRes = await fetch(`${API_BASE}/admin/prompts/test-suites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (suitesRes.ok) {
        const suitesData = await suitesRes.json();
        setTestSuites(suitesData);
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
      setComparisonResult(null);
      setBatchResults(null);
      setTestQuery('');
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
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to run comparison: ${errorText}`);
      }
      const result = await res.json();
      setComparisonResult(result);
    } catch (err: any) {
      setError(err.message || 'Network error. Check your connection and retry.');
    } finally {
      setComparing(false);
    }
  };

  const runSuiteComparison = async () => {
    if (!selectedPrompt || !editingPrompt || !selectedSuite) {
      setError('Please select a test suite');
      return;
    }
    setComparing(true);
    setError(null);
    setBatchResults(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/prompts/compare-suite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          saved_prompt_key: selectedPrompt,
          draft_system: editingPrompt.system,
          draft_max_tokens: editingPrompt.max_tokens,
          suite_id: selectedSuite,
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Failed to run suite comparison: ${errorText}`);
      }
      const result = await res.json();
      setBatchResults(result);
    } catch (err: any) {
      setError(err.message || 'Network error. Check your connection and retry.');
    } finally {
      setComparing(false);
    }
  };

  const renderDiff = (oldText: string, newText: string) => {
    const changes = diffWords(oldText, newText);
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {changes.map((part, index) => {
          let backgroundColor = 'transparent';
          let color = '#1A1A1A';
          let textDecoration = 'none';

          if (part.added) {
            backgroundColor = '#D4EDDA';
            color = '#155724';
          } else if (part.removed) {
            backgroundColor = '#F8D7DA';
            color = '#721C24';
            textDecoration = 'line-through';
          }

          return (
            <span
              key={index}
              style={{
                backgroundColor,
                color,
                textDecoration,
                padding: part.added || part.removed ? '0 2px' : 0,
              }}
            >
              {part.value}
            </span>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <div style={{ fontSize: 14, color: '#888' }}>Loading prompts...</div>
      </div>
    );
  }

  const savedPrompt = selectedPrompt ? prompts[selectedPrompt] : null;
  const hasChanges = savedPrompt && editingPrompt && (
    editingPrompt.system !== savedPrompt.system ||
    editingPrompt.max_tokens !== savedPrompt.max_tokens
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left Panel: Prompt List */}
      <div
        style={{
          width: '300px',
          borderRight: '1px solid #EEE',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: 20, borderBottom: '1px solid #EEE' }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Prompts</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>
            {Object.keys(prompts).length} available
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.entries(prompts).map(([key, prompt]) => (
              <div
                key={key}
                onClick={() => {
                  setSelectedPrompt(key);
                  setEditingPrompt({ ...prompt });
                  setComparisonResult(null);
                  setBatchResults(null);
                  setTestQuery('');
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
        </div>
      </div>

      {/* Right Panel: Editor */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!editingPrompt || !selectedPrompt ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
            Select a prompt to edit
          </div>
        ) : (
          <>
            {/* Editor Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
              {error && (
                <div style={{ padding: 12, background: '#FEE', color: '#C00', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
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

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Description
                </label>
                <input
                  type="text"
                  value={editingPrompt.description}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
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

              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={editingPrompt.max_tokens}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, max_tokens: parseInt(e.target.value) })}
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              </div>

              {/* Test Comparison Section */}
              {hasChanges && (
                <div style={{ padding: 16, background: '#FFF8E5', borderRadius: 8, border: '1px solid #FFE5A0', marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>
                    Test Comparison (Saved vs Draft)
                  </div>
                  <div style={{ fontSize: 12, marginBottom: 12, color: '#666' }}>
                    Run both versions against the same test query to compare outputs before saving.
                  </div>

                  {/* Test Suite Selector */}
                  {testSuites.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <select
                        value={selectedSuite || ''}
                        onChange={(e) => setSelectedSuite(e.target.value || null)}
                        style={{
                          width: '100%',
                          padding: 8,
                          fontSize: 13,
                          border: '1px solid #CCC',
                          borderRadius: 4,
                          marginBottom: 8,
                        }}
                      >
                        <option value="">Select test suite (optional)</option>
                        {testSuites.map((suite) => (
                          <option key={suite.id} value={suite.id}>
                            {suite.name} ({suite.query_count} queries)
                          </option>
                        ))}
                      </select>
                      {selectedSuite && (
                        <button
                          onClick={runSuiteComparison}
                          disabled={comparing}
                          style={{
                            width: '100%',
                            padding: 8,
                            background: '#4CAF50',
                            color: '#FFF',
                            border: 'none',
                            borderRadius: 4,
                            fontWeight: 600,
                            fontSize: 13,
                            cursor: comparing ? 'not-allowed' : 'pointer',
                            opacity: comparing ? 0.6 : 1,
                            marginBottom: 8,
                          }}
                        >
                          {comparing ? 'Running suite...' : 'Run Suite Comparison'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Single Query Comparison */}
                  <div style={{ borderTop: '1px solid #DDD', paddingTop: 12 }}>
                    <div style={{ fontSize: 12, marginBottom: 4, color: '#666', fontWeight: 600 }}>
                      {testSuites.length > 0 ? 'Or test a single query:' : 'Test a single query:'}
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
                      {comparing ? 'Running prompts...' : 'Run Comparison'}
                    </button>
                  </div>
                </div>
              )}

              {/* Comparison Results */}
              {comparisonResult && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Comparison Results
                  </div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#666' }}>
                        Saved Prompt Output
                      </div>
                      <div style={{ padding: 12, background: '#F8F8F8', borderRadius: 4, fontSize: 13, lineHeight: 1.6 }}>
                        {comparisonResult.saved_output}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: '#FF00AE' }}>
                        Draft Prompt Output
                      </div>
                      <div style={{ padding: 12, background: '#F8F8F8', borderRadius: 4, fontSize: 13, lineHeight: 1.6 }}>
                        {comparisonResult.draft_output}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                      Diff View
                    </div>
                    <div style={{ padding: 12, background: '#F8F8F8', borderRadius: 4 }}>
                      {renderDiff(comparisonResult.saved_output, comparisonResult.draft_output)}
                    </div>
                  </div>
                </div>
              )}

              {/* Batch Results */}
              {batchResults && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
                    Suite Results ({batchResults.results.length} queries)
                  </div>
                  {batchResults.results.map((result: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 16, padding: 12, background: '#F8F8F8', borderRadius: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                        Query: {result.query}
                      </div>
                      <div style={{ fontSize: 12 }}>
                        {renderDiff(result.saved_output, result.draft_output)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ padding: 20, borderTop: '1px solid #EEE', display: 'flex', gap: 8 }}>
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
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                onClick={() => {
                  setSelectedPrompt(null);
                  setEditingPrompt(null);
                  setComparisonResult(null);
                  setBatchResults(null);
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
          </>
        )}
      </div>
    </div>
  );
}
