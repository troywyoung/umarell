import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface Instance {
  key: string;
  display_name: string;
}

interface CreateInstanceWizardProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateInstanceWizard({ onClose, onCreated }: CreateInstanceWizardProps) {
  const [step, setStep] = useState(1);
  const [key, setKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [subdirectory, setSubdirectory] = useState('');
  const [cloneFrom, setCloneFrom] = useState<string>('');
  const [availableInstances, setAvailableInstances] = useState<Instance[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setAvailableInstances(data.filter((i: any) => i.is_active));
    } catch (err) {
      // Silent fail - not critical
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/instances`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key,
          display_name: displayName,
          subdirectory: subdirectory || null,
          clone_from: cloneFrom || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to create instance');
      }

      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    if (step === 1) {
      return key && displayName && /^[a-z0-9-]+$/.test(key);
    }
    return true;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.7)',
        zIndex: 1000,
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
          maxWidth: 600,
          width: '100%',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: 20,
            borderBottom: '1px solid #EEE',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>
            Create New Instance
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              padding: 0,
              width: 32,
              height: 32,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: 20 }}>
          {error && (
            <div
              style={{
                padding: 12,
                background: '#FFE5E5',
                color: '#D00',
                borderRadius: 8,
                marginBottom: 16,
                fontSize: 14,
              }}
            >
              {error}
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Instance Key (slug) *
                </label>
                <input
                  type="text"
                  value={key}
                  onChange={(e) => setKey(e.target.value.toLowerCase())}
                  placeholder="e.g. true-confessions"
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  Lowercase letters, numbers, and hyphens only. Used in URLs.
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Display Name *
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. True Confessions"
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  Human-readable name shown in the UI.
                </div>
              </div>

              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: 4,
                  }}
                >
                  Subdirectory (optional)
                </label>
                <input
                  type="text"
                  value={subdirectory}
                  onChange={(e) => setSubdirectory(e.target.value)}
                  placeholder="e.g. /confessions"
                  style={{
                    width: '100%',
                    padding: 8,
                    fontSize: 14,
                    border: '1px solid #CCC',
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    display: 'block',
                    marginBottom: 8,
                  }}
                >
                  Clone Configuration From (optional)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="clone"
                      value=""
                      checked={cloneFrom === ''}
                      onChange={(e) => setCloneFrom(e.target.value)}
                    />
                    <span style={{ fontSize: 14 }}>Use system defaults</span>
                  </label>
                  {availableInstances.map((inst) => (
                    <label
                      key={inst.key}
                      style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                    >
                      <input
                        type="radio"
                        name="clone"
                        value={inst.key}
                        checked={cloneFrom === inst.key}
                        onChange={(e) => setCloneFrom(e.target.value)}
                      />
                      <span style={{ fontSize: 14 }}>
                        Clone from <strong>{inst.display_name}</strong> ({inst.key})
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: 24,
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
            }}
          >
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  padding: 12,
                  background: '#F0F0ED',
                  color: '#1A1A1A',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Back
              </button>
            )}
            {step < 2 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={!canProceed()}
                style={{
                  padding: 12,
                  background: canProceed() ? '#FF00AE' : '#CCC',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: canProceed() ? 'pointer' : 'not-allowed',
                }}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={creating}
                style={{
                  padding: 12,
                  background: creating ? '#CCC' : '#FF00AE',
                  color: '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: creating ? 'not-allowed' : 'pointer',
                }}
              >
                {creating ? 'Creating...' : 'Create Instance'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
