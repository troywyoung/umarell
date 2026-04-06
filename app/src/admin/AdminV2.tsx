import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DesignSystemSection from './DesignSystemSection';
import PromptsSection from './PromptsSection';

type Section = 'design' | 'prompts';

export default function AdminV2() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<Section>('design');

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F5F5F5',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: 18,
          maxWidth: 1400,
          margin: '0 auto',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 'calc(100vh - 40px)',
        }}
      >
        {/* Header with Navigation */}
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setActiveSection('design')}
              style={{
                padding: '10px 20px',
                background: activeSection === 'design' ? '#FF00AE' : '#F0F0ED',
                color: activeSection === 'design' ? '#FFF' : '#1A1A1A',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Design System
            </button>
            <button
              onClick={() => setActiveSection('prompts')}
              style={{
                padding: '10px 20px',
                background: activeSection === 'prompts' ? '#FF00AE' : '#F0F0ED',
                color: activeSection === 'prompts' ? '#FFF' : '#1A1A1A',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Prompts & LLM
            </button>
          </div>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '10px 20px',
              background: '#F0F0ED',
              color: '#1A1A1A',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Back to Home
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {activeSection === 'design' && <DesignSystemSection />}
          {activeSection === 'prompts' && <PromptsSection />}
        </div>
      </div>
    </div>
  );
}
