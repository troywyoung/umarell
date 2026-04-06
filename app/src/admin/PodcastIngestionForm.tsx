import { useState, useEffect, useRef } from 'react';
import { API as API_BASE } from '../config';

interface IngestionResult {
  episode_tag: string;
  episode_title: string;
  podcast_name: string;
  observations: string[];
  count: number;
  transcript_length: number;
}

export default function PodcastIngestionForm() {
  const [url, setUrl] = useState('');
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [episodeTag, setEpisodeTag] = useState('');
  const [count, setCount] = useState(5);
  const [processing, setProcessing] = useState(false);
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const metaTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-fetch YouTube metadata when URL changes
  useEffect(() => {
    if (metaTimeout.current) clearTimeout(metaTimeout.current);
    if (!url.trim() || !url.includes('youtube')) return;

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
      } catch {
        // silently fail — user can fill manually
      } finally {
        setFetchingMeta(false);
      }
    }, 600);

    return () => { if (metaTimeout.current) clearTimeout(metaTimeout.current); };
  }, [url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('sm_token');
      if (!token) { setError('Not authenticated. Please sign in.'); return; }

      const res = await fetch(`${API_BASE}/podcasts/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          url: url.trim(),
          episode_title: episodeTitle.trim(),
          podcast_name: podcastName.trim() || undefined,
          episode_tag: episodeTag.trim() || undefined,
          count,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to ingest podcast');
      }

      const data = await res.json();
      setResult(data);
      setUrl(''); setEpisodeTitle(''); setPodcastName(''); setEpisodeTag(''); setCount(5);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #DDD', borderRadius: 6, boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none',
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };
  const hintStyle: React.CSSProperties = { fontSize: 11, color: '#AAA', marginTop: 4 };

  return (
    <div style={{ maxWidth: 640 }}>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24, lineHeight: 1.6 }}>
        Paste a YouTube URL — title, podcast name, and episode tag are fetched automatically.
        The system extracts the best claims and runs them through the steel man pipeline.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* URL */}
        <div>
          <label style={labelStyle}>YouTube URL *</label>
          <div style={{ position: 'relative' }}>
            <input
              type="url" value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              required style={inputStyle}
            />
            {fetchingMeta && (
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#AAA' }}>
                fetching…
              </span>
            )}
          </div>
          <p style={hintStyle}>Title and podcast name will auto-fill from YouTube</p>
        </div>

        {/* Title + Podcast in 2 cols */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Episode Title *</label>
            <input type="text" value={episodeTitle} onChange={(e) => setEpisodeTitle(e.target.value)}
              placeholder="Auto-filled from YouTube" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Podcast Name</label>
            <input type="text" value={podcastName} onChange={(e) => setPodcastName(e.target.value)}
              placeholder="Auto-filled from channel" style={inputStyle} />
          </div>
        </div>

        {/* Tag + Count in 2 cols */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <label style={labelStyle}>Episode Tag</label>
            <input type="text" value={episodeTag} onChange={(e) => setEpisodeTag(e.target.value)}
              placeholder="auto-generated-slug" style={{ ...inputStyle, fontFamily: 'monospace', fontSize: 13 }} />
            <p style={hintStyle}>Auto-generated from title if blank</p>
          </div>
          <div>
            <label style={labelStyle}>Number of Takes</label>
            <input type="number" value={count} onChange={(e) => setCount(parseInt(e.target.value, 10))}
              min={1} max={20} style={inputStyle} />
            <p style={hintStyle}>Only high-quality takes (score ≥ 70) are kept</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ padding: 12, background: '#FEE', border: '1px solid #F88', borderRadius: 6, color: '#C00', fontSize: 13 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div style={{ padding: 16, background: '#E6FFED', border: '1px solid #8C8', borderRadius: 6, fontSize: 13 }}>
            <div style={{ fontWeight: 700, marginBottom: 10, color: '#060' }}>✓ {result.count} takes extracted from "{result.episode_title}"</div>
            <div style={{ color: '#444', marginBottom: 8 }}>
              Tag: <code style={{ background: '#FFF', padding: '2px 6px', borderRadius: 4 }}>{result.episode_tag}</code>
              &nbsp;·&nbsp; {result.transcript_length.toLocaleString()} chars transcribed
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: 'monospace', fontSize: 11 }}>
              {result.observations.map((id) => (
                <span key={id} style={{ color: '#0066CC' }}>{id}</span>
              ))}
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={processing || !url.trim() || !episodeTitle.trim()}
          style={{
            padding: '11px 0', fontSize: 14, fontWeight: 700,
            background: processing ? '#CCC' : '#FF00AE', color: '#FFF',
            border: 'none', borderRadius: 8,
            cursor: processing ? 'not-allowed' : 'pointer',
          }}
        >
          {processing ? 'Extracting takes…' : 'Extract Takes'}
        </button>
      </form>
    </div>
  );
}
