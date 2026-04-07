import { useState, useEffect, useRef } from 'react';
import { API as API_BASE } from '../config';

interface Take {
  headline: string;
  context: string;
  speaker: string;
  start: number;
  end: number;
  quality_score: number;
}

type Step = 'form' | 'previewing' | 'preview' | 'posting' | 'done';

export default function PodcastIngestionForm() {
  const [url, setUrl] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [episodeTag, setEpisodeTag] = useState('');
  const [count, setCount] = useState(5);
  const [extractionModel, setExtractionModel] = useState('');
  const [fetchingMeta, setFetchingMeta] = useState(false);

  const [step, setStep] = useState<Step>('form');
  const [takes, setTakes] = useState<Take[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [transcriptLength, setTranscriptLength] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  const metaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (metaTimeout.current) clearTimeout(metaTimeout.current);
    if (!url.trim() || (!url.includes('youtube') && !url.includes('podcasts.apple.com'))) return;
    metaTimeout.current = setTimeout(async () => {
      setFetchingMeta(true);
      try {
        const res = await fetch(`${API_BASE}/podcasts/metadata?url=${encodeURIComponent(url.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.title) setEpisodeTitle(data.title);
          if (data.channel) setPodcastName(data.channel);
          if (data.episode_tag) setEpisodeTag(data.episode_tag);
        }
      } catch { /* silent */ } finally {
        setFetchingMeta(false);
      }
    }, 600);
    return () => { if (metaTimeout.current) clearTimeout(metaTimeout.current); };
  }, [url]);

  const token = () => localStorage.getItem('sm_token') || '';

  const extractTakes = async () => {
    setError(null);
    setStep('previewing');
    try {
      const res = await fetch(`${API_BASE}/podcasts/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          url: url.trim(),
          episode_title: episodeTitle.trim(),
          podcast_name: podcastName.trim() || undefined,
          episode_tag: episodeTag.trim() || undefined,
          count,
          model: extractionModel || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to extract takes');
      }
      const data = await res.json();
      setTakes(data.takes);
      setTranscriptLength(data.transcript_length);
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
      const res = await fetch(`${API_BASE}/podcasts/post-takes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          url: url.trim(),
          episode_title: episodeTitle.trim(),
          podcast_name: podcastName.trim() || undefined,
          episode_tag: episodeTag.trim() || undefined,
          takes: selected,
        }),
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
    setUrl(''); setEpisodeTitle(''); setPodcastName(''); setEpisodeTag(''); setCount(5); setExtractionModel('');
    setTakes([]); setSelectedIndices(new Set()); setResult(null); setError(null);
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

  // ── Done ──────────────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    return (
      <div style={{ maxWidth: 640 }}>
        <div style={{ padding: 20, background: '#E6FFED', border: '1px solid #8C8', borderRadius: 8, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: '#060', marginBottom: 6 }}>
            ✓ {result.count} take{result.count !== 1 ? 's' : ''} posted from "{result.episode_title}"
          </div>
          <div style={{ fontSize: 13, color: '#444' }}>
            Tag: <code style={{ background: '#FFF', padding: '2px 6px', borderRadius: 4 }}>{result.episode_tag}</code>
          </div>
        </div>
        <button onClick={reset} style={{ padding: '10px 20px', background: '#FF00AE', color: '#FFF', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          Add Another Episode
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
            <div style={{ fontWeight: 700, fontSize: 16 }}>{episodeTitle}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
              {takes.length} takes extracted · {transcriptLength.toLocaleString()} chars · {selectedIndices.size} selected
            </div>
          </div>
          <button onClick={() => setStep('form')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#888', fontWeight: 600 }}>
            ← Edit
          </button>
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
              <input
                type="checkbox"
                checked={selectedIndices.has(i)}
                onChange={() => toggleTake(i)}
                style={{ marginTop: 3, flexShrink: 0 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A', marginBottom: 4, lineHeight: 1.3 }}>
                  {take.headline}
                </div>
                {take.context && (
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.5 }}>{take.context}</div>
                )}
                <div style={{ marginTop: 6, display: 'flex', gap: 12, fontSize: 11, color: '#AAA' }}>
                  <span>{take.speaker}</span>
                  <span>{Math.floor(take.start / 60)}:{String(Math.floor(take.start % 60)).padStart(2, '0')}</span>
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
          <button
            onClick={() => setSelectedIndices(new Set(takes.map((_, i) => i)))}
            style={{ padding: '11px 16px', fontSize: 13, background: '#F0F0ED', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            All
          </button>
          <button
            onClick={() => setSelectedIndices(new Set())}
            style={{ padding: '11px 16px', fontSize: 13, background: '#F0F0ED', color: '#555', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
          >
            None
          </button>
        </div>
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
        Paste a YouTube or Apple Podcasts episode URL — title and podcast name auto-fill. Extract takes to preview and select before posting.
      </p>

      <form onSubmit={e => { e.preventDefault(); extractTakes(); }} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        <div>
          <label style={labelStyle}>Episode URL *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="url" value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=… or https://podcasts.apple.com/…"
              required style={inputStyle}
            />
            {fetchingMeta && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#AAA' }}>
                fetching…
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Episode Title *</label>
            <input type="text" value={episodeTitle} onChange={e => setEpisodeTitle(e.target.value)}
              placeholder="Auto-filled from URL" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Podcast Name</label>
            <input type="text" value={podcastName} onChange={e => setPodcastName(e.target.value)}
              placeholder="Auto-filled from URL" style={inputStyle} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Episode Tag</label>
            <input type="text" value={episodeTag} onChange={e => setEpisodeTag(e.target.value)}
              placeholder="auto-generated-slug" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }} />
          </div>
          <div>
            <label style={labelStyle}>Number of Takes</label>
            <input type="number" value={count} onChange={e => setCount(parseInt(e.target.value, 10))}
              min={1} max={20} style={inputStyle} />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Extraction Model</label>
          <select
            value={extractionModel}
            onChange={e => setExtractionModel(e.target.value)}
            style={{ ...inputStyle, background: '#FFF' }}
          >
            <option value="">Default (from prompt config)</option>
            <option value="gemini-2.5-flash">Gemini 2.5 Flash — fast &amp; cheap</option>
            <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Exp)</option>
            <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet — balanced</option>
            <option value="claude-opus-4-5-20251101">Claude Opus 4.5 — highest quality</option>
          </select>
          <div style={{ fontSize: 11, color: '#AAA', marginTop: 4 }}>
            Extraction reads the full transcript — Flash is 10× cheaper with minimal quality loss.
          </div>
        </div>

        {error && (
          <div style={{ padding: 12, background: '#FEE', border: '1px solid #F88', borderRadius: 6, color: '#C00', fontSize: 13 }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={step === 'previewing' || !url.trim() || !episodeTitle.trim()}
          style={{
            padding: '11px 0', fontSize: 14, fontWeight: 700,
            background: step === 'previewing' ? '#CCC' : '#FF00AE',
            color: '#FFF', border: 'none', borderRadius: 8,
            cursor: (step === 'previewing' || !url.trim() || !episodeTitle.trim()) ? 'not-allowed' : 'pointer',
          }}
        >
          {step === 'previewing' ? 'Extracting takes… (may take up to 30s)' : 'Extract Takes'}
        </button>
      </form>
    </div>
  );
}
