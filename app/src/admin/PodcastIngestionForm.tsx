import { useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

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
  const [result, setResult] = useState<IngestionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const token = localStorage.getItem('sm_token');
      if (!token) {
        setError('Not authenticated. Please sign in.');
        return;
      }

      const res = await fetch(`${API_BASE}/podcasts/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
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

      // Clear form on success
      setUrl('');
      setEpisodeTitle('');
      setPodcastName('');
      setEpisodeTag('');
      setCount(5);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>
          Podcast Ingestion
        </h2>
        <p style={{ fontSize: 13, color: '#666', lineHeight: 1.5 }}>
          Extract compelling takes from podcast transcripts. Paste a YouTube URL, and the system
          will fetch the transcript, identify high-quality claims, and create observations for
          steel man processing.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            YouTube URL *
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            required
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Video must have captions/subtitles enabled
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Episode Title *
          </label>
          <input
            type="text"
            value={episodeTitle}
            onChange={(e) => setEpisodeTitle(e.target.value)}
            placeholder="The Future of Media"
            required
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 6,
            }}
          />
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Podcast Name
          </label>
          <input
            type="text"
            value={podcastName}
            onChange={(e) => setPodcastName(e.target.value)}
            placeholder="People vs Algorithms"
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Optional - defaults to "Podcast"
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Episode Tag
          </label>
          <input
            type="text"
            value={episodeTag}
            onChange={(e) => setEpisodeTag(e.target.value)}
            placeholder="pva-2026-04-05"
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Auto-generated from title if not provided (slug format)
          </div>
        </div>

        <div>
          <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>
            Number of Takes
          </label>
          <input
            type="number"
            value={count}
            onChange={(e) => setCount(parseInt(e.target.value, 10))}
            min={1}
            max={20}
            style={{
              width: '100%',
              padding: 10,
              fontSize: 14,
              border: '1px solid #CCC',
              borderRadius: 6,
            }}
          />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            Maximum takes to extract (only high-quality takes are returned)
          </div>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: '#FEE',
              border: '1px solid #F88',
              borderRadius: 6,
              color: '#C00',
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div
            style={{
              padding: 16,
              background: '#EFE',
              border: '1px solid #8C8',
              borderRadius: 6,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 14, color: '#060' }}>
              ✓ Successfully ingested podcast
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <strong>Episode:</strong> {result.episode_title}
              </div>
              <div>
                <strong>Tag:</strong> <code>{result.episode_tag}</code>
              </div>
              <div>
                <strong>Podcast:</strong> {result.podcast_name}
              </div>
              <div>
                <strong>Takes extracted:</strong> {result.count}
              </div>
              <div>
                <strong>Transcript length:</strong> {result.transcript_length.toLocaleString()}{' '}
                characters
              </div>
              <div style={{ marginTop: 8 }}>
                <strong>Observations created:</strong>
                <div
                  style={{
                    marginTop: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    fontSize: 12,
                    fontFamily: 'monospace',
                  }}
                >
                  {result.observations.map((id) => (
                    <a
                      key={id}
                      href={`/observations/${id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#0066CC',
                        textDecoration: 'none',
                        padding: 6,
                        background: '#FFF',
                        border: '1px solid #DDD',
                        borderRadius: 4,
                      }}
                    >
                      {id}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={processing || !url.trim() || !episodeTitle.trim()}
          style={{
            padding: '12px 24px',
            fontSize: 15,
            fontWeight: 700,
            background: processing ? '#CCC' : '#FF00AE',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            cursor: processing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
          }}
        >
          {processing ? 'Processing...' : 'Extract Takes'}
        </button>
      </form>

      <div
        style={{
          marginTop: 32,
          padding: 16,
          background: '#F5F5F5',
          borderRadius: 8,
          fontSize: 12,
          color: '#666',
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>How it works:</div>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>Fetches YouTube transcript (requires captions/subtitles)</li>
          <li>Extracts compelling claims using LLM analysis (quality threshold: 70/100)</li>
          <li>Creates observations preserving speaker voice (no thesis reformatting)</li>
          <li>Processes each take through steel man pipeline asynchronously</li>
        </ol>
      </div>
    </div>
  );
}
