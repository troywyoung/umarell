import { useState } from 'react';
import SimplifiedDesignEditor from './admin/SimplifiedDesignEditor';
import PodcastIngestionForm from './admin/PodcastIngestionForm';
import NewsBundleForm from './admin/NewsBundleForm';
import PromptsSection from './admin/PromptsSection';
import { API } from './config';

type ActiveTab = 'prompts' | 'design' | 'podcasts' | 'news' | 'tools';

function ToolsSection() {
  const [rescoring, setRescoring] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const pollRef = useState<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef[0]) { clearInterval(pollRef[0]); pollRef[0] = null; }
  };

  const startPolling = (adminKey: string) => {
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${API}/admin/rescore/status?admin_key=${encodeURIComponent(adminKey)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
        });
        const data = await resp.json();
        if (data.done) {
          clearInterval(interval);
          pollRef[0] = null;
          setRescoring(false);
          setStatusMsg('');
          if (data.result?.error) {
            setError(data.result.error);
          } else {
            setResult(data.result);
          }
        } else if (data.running) {
          const prog = data.result?.progress;
          setStatusMsg(prog ? `Scored ${prog.done} of ${prog.total}…` : 'Running…');
        }
      } catch {
        // ignore transient poll errors
      }
    }, 3000);
    pollRef[0] = interval;
  };

  const runRescore = async (dryRun: boolean) => {
    setRescoring(true);
    setResult(null);
    setError('');
    setStatusMsg('Queuing rescore…');
    stopPolling();
    try {
      const adminKey = import.meta.env.VITE_GOOGLE_API_KEY || prompt('Enter admin key:');
      if (!adminKey) { setRescoring(false); setStatusMsg(''); return; }
      const resp = await fetch(`${API}/admin/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('sm_token') || ''}` },
        body: JSON.stringify({ admin_key: adminKey, dry_run: dryRun }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setError(data.detail || 'Failed to start rescore');
        setRescoring(false);
        setStatusMsg('');
        return;
      }
      if (data.queued !== undefined) {
        setStatusMsg(`Queued ${data.queued} observations — scoring in background…`);
        startPolling(adminKey);
      } else {
        // Synchronous result (dry_run or already done)
        setResult(data);
        setRescoring(false);
        setStatusMsg('');
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
      setRescoring(false);
      setStatusMsg('');
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px', color: '#1A1A1A' }}>Rescore All Takes</h2>
      <p style={{ fontSize: 13, color: '#888', margin: '0 0 20px', lineHeight: 1.5 }}>
        Re-runs the scoring prompt on every complete observation in the database using the current prompt. Does not touch thesis, summary, or sources.
      </p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button
          onClick={() => runRescore(true)}
          disabled={rescoring}
          style={{ padding: '10px 20px', background: '#F5F5F2', border: '1px solid #DDD', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rescoring ? 'not-allowed' : 'pointer', color: '#555', opacity: rescoring ? 0.5 : 1 }}
        >
          {rescoring ? 'Running…' : 'Dry Run (preview only)'}
        </button>
        <button
          onClick={() => runRescore(false)}
          disabled={rescoring}
          style={{ padding: '10px 20px', background: '#FF00AE', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: rescoring ? 'not-allowed' : 'pointer', color: '#FFF', opacity: rescoring ? 0.5 : 1 }}
        >
          {rescoring ? 'Rescoring…' : '↺ Rescore All'}
        </button>
      </div>

      {rescoring && (
        <div style={{ fontSize: 13, color: '#888', padding: '12px 16px', background: '#F5F5F2', borderRadius: 8 }}>
          {statusMsg || 'Running… this may take a few minutes for large databases.'}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: '#E8813A', padding: '12px 16px', background: '#FFF8F0', borderRadius: 8, border: '1px solid #FFDDB8' }}>
          Error: {error}
        </div>
      )}

      {result && (
        <div style={{ fontSize: 13, background: '#F5F5F2', borderRadius: 8, padding: '16px', lineHeight: 1.8 }}>
          <div style={{ fontWeight: 800, marginBottom: 8, color: '#1A1A1A' }}>
            {result.dry_run ? '🔍 Dry Run Results' : '✅ Rescore Complete'}
          </div>
          <div style={{ color: '#555' }}>
            <div>Scored: <strong>{String(result.updated)}</strong> of <strong>{String(result.total)}</strong></div>
            {result.failed ? <div style={{ color: '#E8813A' }}>Failed: {String(result.failed)}</div> : null}
            <div>Range: <strong>{Array.isArray(result.range) ? `${(result.range as number[])[0]}–${(result.range as number[])[1]}` : '—'}</strong></div>
            <div>Mean: <strong>{String(result.mean)}</strong></div>
            <div>Unique scores: <strong>{String(result.unique)}</strong></div>
            {result.hot_takes !== undefined && (
              <div>Hot takes: <strong style={{ color: '#FF00AE' }}>{String(result.hot_takes)}</strong></div>
            )}
            <div style={{ marginTop: 8, fontWeight: 700 }}>Most common:</div>
            {Array.isArray(result.most_common) && (result.most_common as [number, number][]).map(([score, count]) => (
              <div key={score} style={{ paddingLeft: 12 }}>{score}: {count}×</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('prompts');

  const tabBtn = (id: ActiveTab, label: string) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        padding: '8px 16px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === id ? '2px solid #FF00AE' : '2px solid transparent',
        color: activeTab === id ? '#FF00AE' : '#888',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#FAFAF8', display: 'flex', flexDirection: 'column' }}>
      {/* Header + Tabs */}
      <div style={{ background: '#FFF', borderBottom: '1px solid #EEE' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '8px 24px 0', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4, color: '#888', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              <svg width={14} height={14} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M11 4L6 9l5 5" />
              </svg>
              Back
            </button>
            <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
              {tabBtn('prompts', 'LLM Prompts')}
              {tabBtn('design', 'Design Tokens')}
              {tabBtn('podcasts', 'Podcasts')}
              {tabBtn('news', 'News Bundles')}
              {tabBtn('tools', 'Tools')}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', maxWidth: 1200, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {activeTab === 'prompts' ? (
          <PromptsSection />
        ) : activeTab === 'podcasts' ? (
          <div style={{ padding: 24 }}>
            <PodcastIngestionForm />
          </div>
        ) : activeTab === 'news' ? (
          <div style={{ padding: 24 }}>
            <NewsBundleForm />
          </div>
        ) : activeTab === 'tools' ? (
          <ToolsSection />
        ) : (
          <div style={{ padding: 24 }}>
            <SimplifiedDesignEditor onClose={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
