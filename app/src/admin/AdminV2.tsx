import { useState } from 'react';
import DesignSystemSection from './DesignSystemSection';
import PromptsSection from './PromptsSection';

type Section = 'design' | 'prompts';

interface AdminV2Props {
  onClose: () => void;
}

export default function AdminV2({ onClose }: AdminV2Props) {
  const [activeSection, setActiveSection] = useState<Section>('design');

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#FFF',
          borderRadius: 18,
          maxWidth: 1400,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
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
            onClick={onClose}
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
            Close
          </button>
        </div>

        {/* Content Area */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeSection === 'design' && <DesignSystemSection />}
          {activeSection === 'prompts' && <PromptsSection />}
        </div>
      </div>
    </div>
  );
}
