import { useState, useEffect } from 'react';
import { API as API_BASE } from '../config';

interface SimplifiedTokensData {
  tokens: Record<string, string>;
  labels: Record<string, string>;
  descriptions: Record<string, string>;
}

interface SimplifiedDesignEditorProps {
  onClose: () => void;
}

export default function SimplifiedDesignEditor({ onClose: _onClose }: SimplifiedDesignEditorProps) {
  const [data, setData] = useState<SimplifiedTokensData | null>(null);
  const [editedTokens, setEditedTokens] = useState<Record<string, string>>({});
  const [savedTokens, setSavedTokens] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [deploymentTriggered, setDeploymentTriggered] = useState(false);
  const [saveType, setSaveType] = useState<'draft' | 'deploy' | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    setError(null);
    const endpoint = `${API_BASE}/admin/simplified-tokens`;
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} from ${endpoint}`);
      const result = await res.json();
      setData(result);
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
    } catch (err: any) {
      setError(`${err.message} (target: ${endpoint})`);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenChange = (key: string, value: string) => {
    setEditedTokens((prev) => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  };

  const saveTokens = async (deploy: boolean) => {
    setSaving(true);
    setError(null);
    setSaveStatus('idle');
    setDeploymentTriggered(false);
    setSaveType(deploy ? 'deploy' : 'draft');
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens?deploy=${deploy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tokens: editedTokens }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `HTTP ${res.status}`);
      }
      const result = await res.json();
      setSaveStatus('saved');
      setSavedTokens(editedTokens);
      setDeploymentTriggered(result.deployment_triggered);
      setTimeout(() => { setSaveStatus('idle'); setSaveType(null); }, 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const revertToDefaults = async () => {
    if (!confirm('Revert all design tokens to defaults?')) return;
    setSaving(true);
    setError(null);
    try {
      const token = localStorage.getItem('sm_token');
      const res = await fetch(`${API_BASE}/admin/simplified-tokens/revert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to revert design tokens');
      const result = await res.json();
      setEditedTokens(result.tokens);
      setSavedTokens(result.tokens);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setError(err.message);
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const isColorToken = (key: string) =>
    ['primary_accent', 'button_color', 'dark_background',
     'card_background', 'collection_card_background', 'dark_text', 'secondary_text'].includes(key);

  const isFontToken = (key: string) => key === 'body_font_family' || key === 'display_font_family';
  const isSizeToken = (key: string) => key === 'card_headline_size' || key === 'detail_headline_size';
  const isTrackingToken = (key: string) => key === 'headline_letter_spacing';

  const BODY_FONTS: { label: string; value: string }[] = [
    { label: 'System UI (default)',    value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
    { label: 'Inter',                  value: "'Inter', sans-serif" },
    { label: 'Helvetica Neue',         value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
    { label: 'Georgia (serif)',        value: "Georgia, 'Times New Roman', serif" },
    { label: 'Libre Baskerville',      value: "'Libre Baskerville', serif" },
  ];

  const DISPLAY_FONTS: { label: string; value: string }[] = [
    { label: 'Besley (default)',        value: "'Besley', serif" },
    { label: 'Playfair Display',        value: "'Playfair Display', serif" },
    { label: 'DM Serif Display',        value: "'DM Serif Display', serif" },
    { label: 'Fraunces',                value: "'Fraunces', serif" },
    { label: 'Libre Baskerville',       value: "'Libre Baskerville', serif" },
    { label: 'Georgia',                 value: "Georgia, serif" },
    { label: 'Abril Fatface',           value: "'Abril Fatface', serif" },
    { label: 'Alfa Slab One',           value: "'Alfa Slab One', serif" },
    { label: 'Bebas Neue',              value: "'Bebas Neue', sans-serif" },
    { label: 'Bodoni Moda',             value: "'Bodoni Moda', serif" },
    { label: 'Cormorant Garamond',      value: "'Cormorant Garamond', serif" },
    { label: 'Gravitas One',            value: "'Gravitas One', serif" },
    { label: 'Rozha One',               value: "'Rozha One', serif" },
    { label: 'Syne',                    value: "'Syne', sans-serif" },
    { label: 'Ultra',                   value: "'Ultra', serif" },
    { label: 'Big Shoulders Display',   value: "'Big Shoulders Display', sans-serif" },
    { label: '── New ──',               value: "" },
    { label: 'Racher',                  value: "'Racher', sans-serif" },
    { label: 'Bitcount Grid Double',    value: "'Bitcount Grid Double', monospace" },
    { label: 'Coiny',                   value: "'Coiny', sans-serif" },
    { label: 'Bitcount Prop Single',    value: "'Bitcount Prop Single', monospace" },
    { label: 'Danfo',                   value: "'Danfo', serif" },
    { label: 'Climate Crisis',          value: "'Climate Crisis', sans-serif" },
    { label: 'Oi',                      value: "'Oi', serif" },
    { label: 'Rubik Bubbles',           value: "'Rubik Bubbles', sans-serif" },
    { label: 'Vina Sans',               value: "'Vina Sans', sans-serif" },
  ];

  const hasUnsavedChanges = () =>
    Object.keys(editedTokens).some(key => editedTokens[key] !== savedTokens[key]);

  const isLogoTextField = (key: string) => ['logo_accent_text', 'logo_plain_text'].includes(key);
  const isLogoSizeToken = (key: string) => key === 'logo_size';

  const renderTokenField = (key: string) => {
    const currentValue = editedTokens[key] ?? '';

    if (isLogoTextField(key)) {
      const accentText = editedTokens['logo_accent_text'] ?? 'hot';
      const plainText  = editedTokens['logo_plain_text']  ?? 'take';
      const logoSize   = parseInt(editedTokens['logo_size'] || '27') || 27;
      const displayFont = editedTokens['display_font_family'] || "'Besley', serif";
      const letterSpacing = editedTokens['headline_letter_spacing'] || '-1.5px';
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data!.labels[key]}</label>
          <input
            type="text"
            value={currentValue}
            onChange={e => handleTokenChange(key, e.target.value)}
            style={{ padding: '8px 10px', border: '1px solid #DDD', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', outline: 'none' }}
          />
          {key === 'logo_plain_text' && (
            <div style={{ padding: '12px 16px', borderRadius: 6, background: '#12102B', display: 'flex', justifyContent: 'center' }}>
              <span style={{ fontSize: logoSize, fontWeight: 400, fontFamily: displayFont, letterSpacing, lineHeight: 1 }}>
                <span style={{ color: '#FF00AE' }}>{accentText}</span>
                <span style={{ color: '#FFF' }}>{plainText}</span>
              </span>
            </div>
          )}
        </div>
      );
    }

    if (isLogoSizeToken(key)) {
      const px = parseInt(currentValue) || 27;
      const accentText = editedTokens['logo_accent_text'] ?? 'hot';
      const plainText  = editedTokens['logo_plain_text']  ?? 'take';
      const displayFont = editedTokens['display_font_family'] || "'Besley', serif";
      const letterSpacing = editedTokens['headline_letter_spacing'] || '-1.5px';
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data!.labels[key]}</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF00AE' }}>{px}px</span>
          </div>
          <input
            type="range" min={16} max={60} step={1}
            value={px}
            onChange={e => handleTokenChange(key, `${e.target.value}px`)}
            style={{ width: '100%', accentColor: '#FF00AE' }}
          />
          <div style={{ padding: '12px 16px', borderRadius: 6, background: '#12102B', display: 'flex', justifyContent: 'center' }}>
            <span style={{ fontSize: px, fontWeight: 400, fontFamily: displayFont, letterSpacing, lineHeight: 1 }}>
              <span style={{ color: '#FF00AE' }}>{accentText}</span>
              <span style={{ color: '#FFF' }}>{plainText}</span>
            </span>
          </div>
        </div>
      );
    }

    if (isSizeToken(key)) {
      const px = parseInt(currentValue) || (key === 'detail_headline_size' ? 20 : 14);
      const previewText = key === 'detail_headline_size'
        ? 'AI will take your job and your podcast.'
        : 'AI will take your job and your podcast.';
      const previewFont = key === 'detail_headline_size' ? '#FFF' : '#1A1A1A';
      const previewBg = key === 'detail_headline_size' ? '#12102B' : '#FFF';
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data!.labels[key]}</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF00AE', fontVariantNumeric: 'tabular-nums' }}>{px}px</span>
          </div>
          <input
            type="range"
            min={10} max={36} step={1}
            value={px}
            onChange={e => handleTokenChange(key, `${e.target.value}px`)}
            style={{ width: '100%', accentColor: '#FF00AE' }}
          />
          <div style={{ padding: '10px 12px', borderRadius: 6, background: previewBg, border: '1px solid #EEE' }}>
            <div style={{ fontSize: px, fontWeight: 700, color: previewFont, lineHeight: 1.3, letterSpacing: -0.3 }}>
              {previewText}
            </div>
          </div>
        </div>
      );
    }

    if (isTrackingToken(key)) {
      const parsed = parseFloat(currentValue) || -1.5;
      const displayFont = editedTokens['display_font_family'] || "'Besley', serif";
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data!.labels[key]}</label>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#FF00AE', fontVariantNumeric: 'tabular-nums' }}>{parsed.toFixed(1)}px</span>
          </div>
          <input
            type="range" min={-6} max={3} step={0.1}
            value={parsed}
            onChange={e => handleTokenChange(key, `${parseFloat(e.target.value).toFixed(1)}px`)}
            style={{ width: '100%', accentColor: '#FF00AE' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#CCC', marginTop: -2 }}>
            <span>tight −6px</span><span>normal 0</span><span>loose +3px</span>
          </div>
          <div style={{ padding: '12px 16px', borderRadius: 6, background: '#12102B', border: '1px solid #EEE' }}>
            <span style={{ fontSize: 27, fontWeight: 900, color: '#FFF', lineHeight: 1, fontFamily: displayFont, letterSpacing: `${parsed}px` }}>
              <span style={{ color: '#FF00AE' }}>hot</span>take
            </span>
          </div>
        </div>
      );
    }

    if (isFontToken(key)) {
      const options = key === 'body_font_family' ? BODY_FONTS : DISPLAY_FONTS;
      const previewText = key === 'display_font_family' ? 'hottake' : 'The quick brown fox jumps over the lazy dog.';
      const matched = options.find(o => o.value === currentValue);
      return (
        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>{data!.labels[key]}</label>

          {/* Preset picker */}
          <select
            value={matched ? currentValue : '__custom__'}
            onChange={e => {
              if (e.target.value !== '__custom__') handleTokenChange(key, e.target.value);
            }}
            style={{ padding: '6px 8px', fontSize: 13, border: '1px solid #CCC', borderRadius: 4, background: '#FFF' }}
          >
            {options.map(o => (
              o.value === ''
                ? <option key={o.label} value="" disabled style={{ color: '#AAA' }}>{o.label}</option>
                : <option key={o.value} value={o.value}>{o.label}</option>
            ))}
            {!matched && <option value="__custom__">Custom</option>}
          </select>

          {/* Editable CSS value */}
          <input
            type="text"
            value={currentValue}
            onChange={e => handleTokenChange(key, e.target.value)}
            style={{ padding: '5px 8px', fontSize: 11, fontFamily: 'monospace', color: '#555', border: '1px solid #E0E0E0', borderRadius: 4, background: '#FAFAFA' }}
          />

          {/* Live preview */}
          <div style={{ padding: '10px 12px', border: '1px solid #EEE', borderRadius: 6, background: '#FFF' }}>
            <div style={{ fontFamily: currentValue, fontSize: key === 'display_font_family' ? 22 : 14, color: '#1A1A1A', lineHeight: 1.45 }}>
              {previewText}
            </div>
            {key === 'body_font_family' && (
              <div style={{ fontFamily: currentValue, fontSize: 12, color: '#888', marginTop: 4, lineHeight: 1.5 }}>
                Bold predictions about the future of media, platforms, and AI.
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#1A1A1A' }}>
          {data!.labels[key]}
        </label>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{data!.descriptions[key]}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {isColorToken(key) && (
            <input
              type="color"
              value={currentValue}
              onChange={(e) => handleTokenChange(key, e.target.value)}
              style={{ width: 36, height: 30, border: '1px solid #CCC', borderRadius: 4, cursor: 'pointer', padding: 2 }}
            />
          )}
          <input
            type="text"
            value={currentValue}
            onChange={(e) => handleTokenChange(key, e.target.value)}
            style={{ flex: 1, padding: '6px 8px', fontSize: 13, fontFamily: 'monospace', border: '1px solid #CCC', borderRadius: 4 }}
          />
        </div>
      </div>
    );
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading design tokens...</div>;
  if (!data) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#E53E3E' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>Failed to load design tokens</div>
      {error && <div style={{ fontSize: 12, color: '#888', fontFamily: 'monospace', marginBottom: 12 }}>{error}</div>}
      <button onClick={loadTokens} style={{ padding: '7px 14px', fontSize: 12, border: '1px solid #DDD', borderRadius: 5, cursor: 'pointer', background: '#FFF' }}>Retry</button>
    </div>
  );

  const sectionStyle = { marginBottom: 32 };
  const headingStyle: React.CSSProperties = { margin: '0 0 14px', fontSize: 13, fontWeight: 700, color: '#555', textTransform: 'uppercase', letterSpacing: '0.05em' };
  const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 };

  return (
    <div>
      {/* Status banners */}
      {error && (
        <div style={{ padding: 12, background: '#FEE', color: '#E53E3E', borderRadius: 8, marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}
      {saveStatus === 'saved' && (
        <div style={{ padding: 12, background: '#E6FFED', color: '#22863A', borderRadius: 8, marginBottom: 20, fontSize: 13, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>✓</span>
          <div>
            <div style={{ fontWeight: 600 }}>
              {deploymentTriggered ? 'Saved and deployed to staging' : 'Draft saved'}
            </div>
            {deploymentTriggered && (
              <div style={{ fontSize: 12, marginTop: 2 }}>
                May take 1–2 minutes to reflect.{' '}
                <a href="https://umarell-staging.up.railway.app" target="_blank" rel="noopener noreferrer"
                  style={{ color: '#22863A', textDecoration: 'underline', fontWeight: 600 }}>
                  Verify on staging ↗
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Unsaved indicator */}
      {hasUnsavedChanges() && (
        <div style={{ display: 'inline-block', padding: '4px 10px', background: '#FFF4E6', color: '#D97706', borderRadius: 12, fontSize: 12, fontWeight: 600, border: '1px solid #FDB94E', marginBottom: 12 }}>
          Unsaved changes
        </div>
      )}

      {/* Actions — top */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28, paddingBottom: 24, borderBottom: '1px solid #EEE' }}>
        <button onClick={() => saveTokens(false)} disabled={saving}
          style={{ flex: 1, padding: '10px 0', background: '#FF00AE', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving && saveType === 'draft' ? 'Saving...' : 'Save Draft'}
        </button>
        <button onClick={() => saveTokens(true)} disabled={saving}
          style={{ flex: 1, padding: '10px 0', background: '#1A1A1A', color: '#FFF', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving && saveType === 'deploy' ? 'Deploying...' : 'Deploy to Staging'}
        </button>
        <button onClick={revertToDefaults} disabled={saving}
          style={{ padding: '10px 16px', background: '#F0F0ED', color: '#888', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
          Revert
        </button>
      </div>

      {/* Branding / Logo */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Logo</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {['logo_accent_text', 'logo_plain_text', 'logo_size', 'logo_tagline']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Colors */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Colors</h3>
        <div style={gridStyle}>
          {['primary_accent', 'button_color', 'dark_background', 'card_background', 'collection_card_background', 'dark_text', 'secondary_text']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Typography */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Typography</h3>
        <div style={gridStyle}>
          {['body_font_family', 'display_font_family', 'card_headline_size', 'detail_headline_size', 'headline_letter_spacing', 'base_font_size']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Layout */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Layout</h3>
        <div style={gridStyle}>
          {['max_content_width', 'card_shadow']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

      {/* Background */}
      <div style={sectionStyle}>
        <h3 style={headingStyle}>Background</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 20 }}>
          {['feed_background_image']
            .filter(k => data.tokens[k] !== undefined)
            .map(renderTokenField)}
        </div>
      </div>

    </div>
  );
}
