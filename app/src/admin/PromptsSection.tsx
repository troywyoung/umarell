import { useState, useEffect } from 'react';
import { API as API_BASE } from '../config';

interface Prompt {
  name: string;
  description: string;
  system: string;
  max_tokens: number;
  model?: string;
}

interface Sample {
  id: string;
  label: string;
  text: string;
  thesis: string;
}

type CompareMode = 'prompt' | 'model';

const MODELS = [
  { value: '', label: 'Default active model' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-opus-4-5-20251101', label: 'Claude Opus 4.5' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash (Exp)' },
];

export default function PromptsSection() {
  const [prompts, setPrompts] = useState<Record<string, Prompt>>({});
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingSamples, setLoadingSamples] = useState(false);

  const [compareMode, setCompareMode] = useState<CompareMode>('prompt');
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);

  useEffect(() => { loadPrompts(); }, []);

  const token = () => localStorage.getItem('sm_token') || '';

  const loadPrompts = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/prompts`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error('Failed to load prompts');
      setPrompts(await res.json());
    } catch (e: any) {
      setSaveMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const selectPrompt = (key: string) => {
    setSelectedKey(key);
    setEditingPrompt({ ...prompts[key] });
    setResults(null);
    setCompareError(null);
  };

  const savePrompt = async () => {
    if (!selectedKey || !editingPrompt) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE}/admin/prompts/${selectedKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(editingPrompt),
      });
      if (!res.ok) throw new Error('Failed to save');
      await loadPrompts();
      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e: any) {
      setSaveMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetPrompt = async () => {
    if (!selectedKey || !confirm('Reset this prompt to its built-in default?')) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`${API_BASE}/admin/prompts/${selectedKey}/reset`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) throw new Error('Failed to reset');
      const data = await res.json();
      await loadPrompts();
      setEditingPrompt({ ...data.prompt });
      setSaveMsg('Reset to default');
      setTimeout(() => setSaveMsg(null), 2500);
    } catch (e: any) {
      setSaveMsg(e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadSamples = async () => {
    setLoadingSamples(true);
    try {
      const res = await fetch(`${API_BASE}/admin/prompt-samples?limit=3`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      const data: Sample[] = await res.json();
      setSamples(data);
      setSelectedIds(new Set(data.map(s => s.id)));
    } catch (e: any) {
      setCompareError(e.message);
    } finally {
      setLoadingSamples(false);
    }
  };

  const toggleSample = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const runComparison = async () => {
    if (!selectedKey || !editingPrompt || selectedIds.size === 0) return;
    const saved = prompts[selectedKey];
    const queries = samples.filter(s => selectedIds.has(s.id)).map(s => s.text);

    setComparing(true);
    setCompareError(null);
    setResults(null);

    const body: any = {
      saved_prompt_key: selectedKey,
      draft_system: compareMode === 'prompt' ? editingPrompt.system : saved.system,
      draft_max_tokens: compareMode === 'prompt' ? editingPrompt.max_tokens : saved.max_tokens,
      queries,
    };

    if (compareMode === 'model') {
      // Model diff: hold prompt constant, vary model
      body.draft_model = editingPrompt.model || '';
    } else {
      // Prompt diff: hold model constant at saved model
      body.preview_model = saved.model || '';
    }

    try {
      const res = await fetch(`${API_BASE}/admin/prompts/compare-samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setResults(await res.json());
    } catch (e: any) {
      setCompareError(e.message);
    } finally {
      setComparing(false);
    }
  };

  const parseOutput = (raw: string): any | null => {
    if (!raw) return null;
    // Strip markdown code fences (```json ... ``` or ``` ... ```)
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    try { return JSON.parse(stripped); } catch { return null; }
  };

  const renderOutput = (raw: string): React.ReactNode => {
    if (!raw) return <span style={{ color: '#CCC' }}>—</span>;
    const parsed = parseOutput(raw);
    if (!parsed) return <span style={{ fontSize: 12, color: '#555', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{raw}</span>;
    return renderStructured(parsed);
  };

  const renderStructured = (obj: any): React.ReactNode => {
    if (typeof obj !== 'object' || Array.isArray(obj)) {
      return <span style={{ fontSize: 12 }}>{JSON.stringify(obj)}</span>;
    }

    const {
      bottom_line, tldr, bullets, hard_facts, sources,
      verdict, strength, voice, body, ...rest
    } = obj;

    const strengthColor: Record<string, string> = {
      weak: '#AAA', moderate: '#F5A623', strong: '#4CAF50', devastating: '#C00',
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Bottom line / TL;DR */}
        {(bottom_line || tldr) && (
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1A1A1A', lineHeight: 1.4 }}>
            {bottom_line || tldr}
          </div>
        )}

        {/* Bullets */}
        {Array.isArray(bullets) && bullets.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {bullets.map((b: string, i: number) => (
              <li key={i} style={{ fontSize: 12, color: '#333', lineHeight: 1.5 }}>{b}</li>
            ))}
          </ul>
        )}

        {/* Hard facts */}
        {Array.isArray(hard_facts) && hard_facts.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Hard Facts</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {hard_facts.map((f: any, i: number) => (
                <li key={i} style={{ fontSize: 11, color: '#555', lineHeight: 1.4 }}>
                  {typeof f === 'string' ? f : `${f.fact}${f.source ? ` — ${f.source}` : ''}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Verdict + strength */}
        {verdict && (
          <div style={{ padding: '6px 10px', borderRadius: 5, background: '#F7F7F5', fontSize: 12, color: '#333', lineHeight: 1.4, borderLeft: `3px solid ${strengthColor[strength] || '#DDD'}` }}>
            {strength && (
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: strengthColor[strength] || '#AAA', marginRight: 6, letterSpacing: '0.04em' }}>
                {strength}
              </span>
            )}
            {verdict}
          </div>
        )}

        {/* Voice / body */}
        {(voice || body) && (
          <div style={{ fontSize: 12, color: '#333', lineHeight: 1.5, fontStyle: 'italic' }}>
            {voice || body}
          </div>
        )}

        {/* Sources */}
        {Array.isArray(sources) && sources.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Sources</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sources.map((s: any, i: number) => (
                <div key={i} style={{ fontSize: 10, color: '#888', lineHeight: 1.4 }}>
                  {typeof s === 'string' ? s : s.url
                    ? <a href={s.url} target="_blank" rel="noreferrer" style={{ color: '#888' }}>{s.title || s.url}</a>
                    : s.title || JSON.stringify(s)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Any remaining keys */}
        {Object.keys(rest).length > 0 && Object.entries(rest).map(([k, v]) => (
          <div key={k}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#AAA', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{k.replace(/_/g, ' ')}</div>
            <div style={{ fontSize: 12, color: '#333' }}>{typeof v === 'string' ? v : JSON.stringify(v)}</div>
          </div>
        ))}
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading prompts…</div>;

  const saved = selectedKey ? prompts[selectedKey] : null;
  const promptChanged = saved && editingPrompt && editingPrompt.system !== saved.system;
  const modelChanged = saved && editingPrompt && (editingPrompt.model || '') !== (saved.model || '');

  const canRun = !!selectedKey && selectedIds.size > 0 && !comparing;

  // ─── Styles ────────────────────────────────────────────────────────────────
  const panelBase: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
  };
  const label: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.05em', marginBottom: 5, display: 'block',
  };
  const fieldset: React.CSSProperties = { marginBottom: 16 };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 9px', fontSize: 13, border: '1px solid #DDD',
    borderRadius: 5, boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* ── 1. Prompt list ─────────────────────────────────────────────────── */}
      <div style={{ ...panelBase, width: 210, borderRight: '1px solid #EEE', flexShrink: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #EEE', fontSize: 13, fontWeight: 700 }}>
          Prompts
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {Object.entries(prompts).map(([key, p]) => (
            <div
              key={key}
              onClick={() => selectPrompt(key)}
              style={{
                padding: '9px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
                background: selectedKey === key ? '#FF00AE' : 'transparent',
                color: selectedKey === key ? '#FFF' : '#1A1A1A',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{p.name}</div>
              {p.model && (
                <div style={{ fontSize: 10, opacity: 0.65, marginTop: 2, fontFamily: 'monospace' }}>{p.model}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── 2. Editor ──────────────────────────────────────────────────────── */}
      <div style={{ ...panelBase, width: 360, borderRight: '1px solid #EEE', flexShrink: 0 }}>
        {!editingPrompt || !saved ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#AAA', fontSize: 13 }}>
            Select a prompt
          </div>
        ) : (
          <>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #EEE', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{saved.name}</span>
              {(promptChanged || modelChanged) && (
                <span style={{ fontSize: 11, color: '#FF00AE', fontWeight: 600 }}>● draft</span>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

              <div style={fieldset}>
                <label style={label}>
                  System Prompt
                  {compareMode === 'model' && (
                    <span style={{ color: '#AAA', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 6 }}>held constant in model diff</span>
                  )}
                </label>
                <textarea
                  value={editingPrompt.system}
                  onChange={e => setEditingPrompt({ ...editingPrompt, system: e.target.value })}
                  rows={14}
                  style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={label}>Max Tokens</label>
                  <input
                    type="number"
                    value={editingPrompt.max_tokens}
                    onChange={e => setEditingPrompt({ ...editingPrompt, max_tokens: parseInt(e.target.value) || 0 })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={label}>
                    Model
                    {compareMode === 'prompt' && (
                      <span style={{ color: '#AAA', fontWeight: 400, textTransform: 'none', letterSpacing: 0, marginLeft: 4 }}>held constant</span>
                    )}
                  </label>
                  <select
                    value={editingPrompt.model || ''}
                    onChange={e => setEditingPrompt({ ...editingPrompt, model: e.target.value || undefined })}
                    style={{ ...inputStyle, background: '#FFF' }}
                  >
                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
              </div>

              {saveMsg && (
                <div style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12,
                  background: saveMsg === 'Saved' ? '#E6FFED' : '#FEE',
                  color: saveMsg === 'Saved' ? '#22863A' : '#C00',
                }}>
                  {saveMsg}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={savePrompt}
                  disabled={saving}
                  style={{
                    flex: 1, padding: '9px 0', background: '#FF00AE', color: '#FFF',
                    border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13,
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                  }}
                >
                  {saving ? 'Saving…' : 'Save Prompt'}
                </button>
                <button
                  onClick={resetPrompt}
                  disabled={saving}
                  style={{
                    padding: '9px 14px', background: '#F0F0ED', color: '#888',
                    border: 'none', borderRadius: 7, fontWeight: 600, fontSize: 12,
                    cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── 3. Compare ─────────────────────────────────────────────────────── */}
      <div style={{ ...panelBase, flex: 1, minWidth: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #EEE', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, marginRight: 8 }}>Compare</span>
          {/* Mode toggle */}
          {(['prompt', 'model'] as CompareMode[]).map(m => (
            <button
              key={m}
              onClick={() => { setCompareMode(m); setResults(null); setCompareError(null); }}
              style={{
                padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 20,
                border: '1px solid #DDD', cursor: 'pointer',
                background: compareMode === m ? '#1A1A1A' : '#FFF',
                color: compareMode === m ? '#FFF' : '#555',
              }}
            >
              {m === 'prompt' ? 'Prompt diff' : 'Model diff'}
            </button>
          ))}
          <span style={{ fontSize: 11, color: '#AAA', marginLeft: 4 }}>
            {compareMode === 'prompt'
              ? '— same model, vary prompt text'
              : '— same prompt, vary model'}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* Samples */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ ...label, marginBottom: 0 }}>
                Test samples &nbsp;
                <span style={{ fontWeight: 400, color: '#AAA', textTransform: 'none', letterSpacing: 0 }}>
                  {selectedIds.size} of {samples.length} selected
                </span>
              </span>
              <button
                onClick={loadSamples}
                disabled={loadingSamples}
                style={{
                  padding: '4px 10px', fontSize: 11, fontWeight: 600, border: '1px solid #DDD',
                  borderRadius: 4, background: '#FFF', cursor: 'pointer',
                  opacity: loadingSamples ? 0.5 : 1,
                }}
              >
                {loadingSamples ? 'Loading…' : samples.length ? 'Refresh' : 'Load Samples'}
              </button>
            </div>

            {samples.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {samples.map(s => (
                  <label key={s.id} style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    padding: '6px 9px', borderRadius: 5, cursor: 'pointer',
                    background: selectedIds.has(s.id) ? '#FFF0FB' : '#F9F9F9',
                    border: `1px solid ${selectedIds.has(s.id) ? '#FF00AE33' : '#EEE'}`,
                    fontSize: 12,
                  }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleSample(s.id)}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1A1A1A' }}>{s.label}</div>
                      {s.thesis && <div style={{ fontSize: 11, color: '#AAA', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>→ {s.thesis}</div>}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Run button */}
          {selectedKey && (
            <button
              onClick={runComparison}
              disabled={!canRun || selectedIds.size === 0 || samples.length === 0}
              style={{
                width: '100%', padding: '9px 0', marginBottom: 16,
                background: canRun && selectedIds.size > 0 && samples.length > 0 ? '#FF00AE' : '#CCC',
                color: '#FFF', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13,
                cursor: canRun && selectedIds.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              {comparing
                ? 'Running…'
                : samples.length === 0
                  ? 'Load samples first'
                  : `Run ${compareMode === 'prompt' ? 'Prompt' : 'Model'} Compare (${selectedIds.size} sample${selectedIds.size !== 1 ? 's' : ''})`}
            </button>
          )}

          {compareError && (
            <div style={{ padding: 12, background: '#FEE', color: '#C00', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
              {compareError}
            </div>
          )}

          {/* Results */}
          {results && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 12, color: '#555' }}>
                <span style={{ color: '#4CAF50' }}>{results.saved_label}</span>
                {' → '}
                <span style={{ color: '#FF00AE' }}>{results.draft_label}</span>
              </div>

              {results.results.map((r: any, i: number) => (
                <div key={i} style={{ marginBottom: 20, border: '1px solid #EEE', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '8px 12px', background: '#F7F7F5', borderBottom: '1px solid #EEE', fontSize: 11, fontWeight: 600, color: '#555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Sample {i + 1}: {r.query_text.slice(0, 120)}{r.query_text.length > 120 ? '…' : ''}
                  </div>

                  {(r.saved_error || r.draft_error) ? (
                    <div style={{ padding: 12, color: '#C00', fontSize: 12 }}>
                      {r.saved_error && <div><strong>Before:</strong> {r.saved_error}</div>}
                      {r.draft_error && <div><strong>After:</strong> {r.draft_error}</div>}
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: 'none' }}>
                      <div style={{ padding: 12, borderRight: '1px solid #EEE' }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#4CAF50', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          Before · {r.saved_latency_ms}ms
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: '#1A1A1A' }}>
                          {renderOutput(r.saved_output || '')}
                        </div>
                      </div>
                      <div style={{ padding: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#FF00AE', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
                          After · {r.draft_latency_ms}ms
                        </div>
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: '#1A1A1A' }}>
                          {renderOutput(r.draft_output || '')}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
