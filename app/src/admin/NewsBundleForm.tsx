import { useState } from 'react';
import { API as API_BASE } from '../config';

interface NewsTake {
  headline: string;
  context: string;
  author: string;
  source_title: string;
  source_url: string;
  quality_score: number;
}

type Step = 'form' | 'previewing' | 'preview' | 'posting' | 'done';

const SOURCES = [
  { value: 'nyt-opinion', label: 'NYT Opinion' },
  { value: 'wsj-opinion', label: 'WSJ Opinion' },
  { value: 'bloomberg-opinion', label: 'Bloomberg Opinion' },
];

export default function NewsBundleForm() {
  const [source, setSource]           = useState('nyt-opinion');
  const [count, setCount]             = useState(5);
  const [step, setStep]               = useState<Step>('form');
  const [takes, setTakes]             = useState<NewsTake[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [bundleTag, setBundleTag]     = useState('');
  const [bundleTitle, setBundleTitle] = useState('');
  const [storyCount, setStoryCount]   = useState(0);
  const [error, setError]             = useState<string | null>(null);
  const [result, setResult]           = useState<any | null>(null);

  const token = () => localStorage.getItem('sm_token') || '';

  const generatePreview = async () => {
    setError(null);
    setStep('previewing');
    try {
      const res = await fetch(`${API_BASE}/news-bundles/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ source, count }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to generate bundle');
      }
      const data = await res.json();
      setTakes(data.takes);
      setBundleTag(data.bundle_tag);
      setBundleTitle(data.bundle_title);
      setStoryCount(data.story_count);
      setSelectedIndices(new Set(data.takes.map((_: any, i: number) => i)));
      setStep('preview');
    } catch (e: any) {
      setError(e.message);
      setStep('form');
    }
  };

  const postTakes = async () => {
    setError(null);
    setStep('posting');
    const selected = takes.filter((_, i) => selectedIndices.has(i));
    try {
      const res = await fetch(`${API_BASE}/news-bundles/post-takes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ source, bundle_tag: bundleTag, bundle_title: bundleTitle, takes: selected }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to post takes');
      }
      const data = await res.json();
      setResult(data);
      setStep('done');
    } catch (e: any) {
      setError(e.message);
      setStep('preview');
    }
  };

  const reset = () => {
    setStep('form');
    setTakes([]); setSelectedIndices(new Set()); setResult(null); setError(null);
    setBundleTag(''); setBundleTitle('');
  };

  const toggleTake = (i: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #DDD', borderRadius: 6, boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: '#555', display: 'block',
    marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em',
  };

  // ── Done ─────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ padding: 20, background: '#E6FFED', border: '1px solid #8C8', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#060', marginBottom: 6 }}>
            ✓ {result.count} take{result.count !== 1 ? 's' : ''} posted
          </div>
          <div style={{ fontSize: 13, color: '#444' }}>
            Bundle: <strong>{result.bundle_title}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Tag: <code style={{ background: '#FFF', padding: '2px 6px', borderRadius: 4 }}>{result.bundle_tag}</code>
          </div>
        </div>
        <button onClick={reset} style={{ padding: '10px 20px', background: '#FF00AE', color: '#FFF', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Generate Another Bundle
        </button>
      </div>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (step === 'preview' || step === 'posting') {
    return (
      <div style={{ maxWidth: 720 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{bundleTitle}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {storyCount} pieces in feed · {takes.length} takes extracted · {selectedIndices.size} selected
            </div>
          </div>
          <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', fontWeight: 600 }}>
            ← Edit
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Bundle Label</label>
          <input type="text" value={bundleTitle} onChange={e => setBundleTitle(e.target.value)} style={inputStyle} />
        </div>

        {error && (
          <div style={{ padding: 12, background: '#FEE', border: '1px solid #F88', borderRadius: 6, color: '#C00', fontSize: 13, marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {takes.map((take, i) => (
            <label
              key={i}
              style={{
                display: 'flex', gap: 12, padding: 14, borderRadius: 8, cursor: 'pointer',
                background: selectedIndices.has(i) ? '#FFF' : '#F7F7F5',
                border: `1px solid ${selectedIndices.has(i) ? '#FF00AE33' : '#EEE'}`,
                opacity: selectedIndices.has(i) ? 1 : 0.5,
                transition: 'all 0.15s',
              }}
            >
              <input type="checkbox" checked={selectedIndices.has(i)} onChange={() => toggleTake(i)} style={{ marginTop: 3, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 3, lineHeight: 1.3 }}>
                  {take.headline}
                </div>
                {take.author && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#FF00AE', marginBottom: 4 }}>
                    {take.author}
                  </div>
                )}
                {take.context && (
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5, marginBottom: 4 }}>{take.context}</div>
                )}
                {take.source_title && (
                  <a
                    href={take.source_url} target="_blank" rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{ fontSize: 11, color: '#AAA', textDecoration: 'none', borderBottom: '1px solid #EEE' }}
                  >
                    {take.source_title}
                  </a>
                )}
                <div style={{ marginTop: 6, fontSize: 11, color: '#AAA' }}>
                  <span style={{ background: '#F0F0ED', padding: '1px 6px', borderRadius: 10, color: '#666' }}>
                    {take.quality_score}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={postTakes}
            disabled={step === 'posting' || selectedIndices.size === 0}
            style={{
              flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 700,
              background: selectedIndices.size === 0 ? '#CCC' : '#FF00AE',
              color: '#FFF', border: 'none', borderRadius: 8,
              cursor: (step === 'posting' || selectedIndices.size === 0) ? 'not-allowed' : 'pointer',
            }}
          >
            {step === 'posting' ? 'Posting…' : `Post ${selectedIndices.size} Take${selectedIndices.size !== 1 ? 's' : ''}`}
          </button>
          <button onClick={() => setSelectedIndices(new Set(takes.map((_, i) => i)))} style={{ padding: '11px 16px', fontSize: 13, background: '#F0F0ED', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>All</button>
          <button onClick={() => setSelectedIndices(new Set())} style={{ padding: '11px 16px', fontSize: 13, background: '#F0F0ED', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>None</button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 540 }}>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
        Pulls today's opinion pieces from NYT or WSJ, distills each author's argument into a sharp take, and lets you review before posting as a bundle.
      </p>

      <form onSubmit={e => { e.preventDefault(); generatePreview(); }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Source</label>
            <select value={source} onChange={e => setSource(e.target.value)} style={{ ...inputStyle, background: '#FFF' }}>
              {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Number of Takes</label>
            <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value, 10))} min={3} max={8} style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ padding: 12, background: '#FEE', border: '1px solid #F88', borderRadius: 6, color: '#C00', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={step === 'previewing'}
          style={{
            padding: '11px 0', fontSize: 14, fontWeight: 700,
            background: step === 'previewing' ? '#CCC' : '#FF00AE',
            color: '#FFF', border: 'none', borderRadius: 8,
            cursor: step === 'previewing' ? 'not-allowed' : 'pointer',
          }}
        >
          {step === 'previewing' ? 'Fetching & extracting takes…' : 'Generate Preview'}
        </button>
      </form>
    </div>
  );
}
