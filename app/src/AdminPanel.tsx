import { useState } from 'react';
import SimplifiedDesignEditor from './admin/SimplifiedDesignEditor';
import PodcastIngestionForm from './admin/PodcastIngestionForm';
import NewsBundleForm from './admin/NewsBundleForm';
import PromptsSection from './admin/PromptsSection';

type ActiveTab = 'prompts' | 'design' | 'podcasts' | 'news';

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
          {/* Back + tabs on one line */}
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
        ) : (
          <div style={{ padding: 24 }}>
            <SimplifiedDesignEditor onClose={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
