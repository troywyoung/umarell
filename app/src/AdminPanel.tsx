import { useState } from 'react';
import SimplifiedDesignEditor from './admin/SimplifiedDesignEditor';
import PodcastIngestionForm from './admin/PodcastIngestionForm';
import PromptsSection from './admin/PromptsSection';

type ActiveTab = 'prompts' | 'design' | 'podcasts';

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('prompts');

  const tabBtn = (id: ActiveTab, label: string) => (
    <button
      key={id}
      onClick={() => setActiveTab(id)}
      style={{
        padding: '12px 24px',
        background: 'none',
        border: 'none',
        borderBottom: activeTab === id ? '2px solid #FF00AE' : '2px solid transparent',
        color: activeTab === id ? '#FF00AE' : '#888',
        fontSize: 13,
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
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {/* Back + title row */}
          <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#888' }}
            >
              <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M11 4L6 9l5 5" />
              </svg>
            </button>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#1A1A1A' }}>Admin</h2>
          </div>
          {/* Tabs centered */}
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            {tabBtn('prompts', 'LLM Prompts')}
            {tabBtn('design', 'Design Tokens')}
            {tabBtn('podcasts', 'Podcasts')}
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
        ) : (
          <div style={{ padding: 24 }}>
            <SimplifiedDesignEditor onClose={() => {}} />
          </div>
        )}
      </div>
    </div>
  );
}
