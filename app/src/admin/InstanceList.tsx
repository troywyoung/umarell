import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8100';

interface Instance {
  id: string;
  key: string;
  display_name: string;
  subdirectory: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  url: string;
}

interface InstanceListProps {
  onCreateNew: () => void;
  onEdit: (instanceKey: string) => void;
}

export default function InstanceList({ onCreateNew, onEdit }: InstanceListProps) {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  const loadInstances = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      if (!token) {
        setError('Not authenticated');
        return;
      }

      const res = await fetch(`${API_BASE}/admin/instances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load instances');
      const data = await res.json();
      setInstances(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (instanceKey: string, currentActive: boolean) => {
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/instances/${instanceKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_active: !currentActive }),
      });
      if (!res.ok) throw new Error('Failed to update instance');
      await loadInstances();
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
        Loading instances...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          background: '#FFE5E5',
          color: '#D00',
          borderRadius: 8,
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Instances</h3>
        <button
          onClick={onCreateNew}
          style={{
            padding: '8px 16px',
            background: '#FF00AE',
            color: '#FFF',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          + Create New Instance
        </button>
      </div>

      {instances.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>
          No instances found. Create your first instance to get started.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {instances.map((inst) => (
            <div
              key={inst.id}
              style={{
                padding: 16,
                background: '#F0F0ED',
                borderRadius: 8,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{inst.display_name}</div>
                  <div
                    style={{
                      fontSize: 11,
                      fontFamily: 'monospace',
                      background: '#DDD',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: '#555',
                    }}
                  >
                    {inst.key}
                  </div>
                  {!inst.is_active && (
                    <div
                      style={{
                        fontSize: 11,
                        background: '#FFB',
                        padding: '2px 6px',
                        borderRadius: 4,
                        color: '#660',
                      }}
                    >
                      INACTIVE
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  URL: <a href={inst.url} style={{ color: '#FF00AE' }}>{inst.url}</a>
                  {inst.subdirectory && ` · Subdirectory: ${inst.subdirectory}`}
                </div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>
                  Created {new Date(inst.created_at).toLocaleDateString()}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onEdit(inst.key)}
                  style={{
                    padding: '6px 12px',
                    background: '#1A1A1A',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Edit
                </button>
                <button
                  onClick={() => toggleActive(inst.key, inst.is_active)}
                  style={{
                    padding: '6px 12px',
                    background: inst.is_active ? '#FFF' : '#FF00AE',
                    color: inst.is_active ? '#666' : '#FFF',
                    border: inst.is_active ? '1px solid #CCC' : 'none',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {inst.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
