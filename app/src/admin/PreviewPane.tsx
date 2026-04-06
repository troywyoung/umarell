import { useEffect, useRef, useState } from 'react';
import type { Observation } from '../types';

interface PreviewPaneProps {
  tokens: Record<string, string>;
  observations: Observation[];
}

/**
 * Live preview pane that renders Umarell components with design tokens applied.
 * Uses iframe isolation to prevent token bleed into parent app.
 */
export default function PreviewPane({ tokens, observations }: PreviewPaneProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  // Initialize iframe with preview document
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    // Write basic HTML structure
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              -webkit-font-smoothing: antialiased;
            }
          </style>
        </head>
        <body>
          <div id="preview-root"></div>
        </body>
      </html>
    `);
    doc.close();

    setIframeReady(true);
  }, []);

  // Update preview content when tokens or observations change
  useEffect(() => {
    if (!iframeReady) return;

    const iframe = iframeRef.current;
    if (!iframe?.contentDocument) return;

    const root = iframe.contentDocument.getElementById('preview-root');
    if (!root) return;

    renderDraftPreview(root, tokens, observations);
  }, [iframeReady, tokens, observations]);

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <iframe
        ref={iframeRef}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          background: '#FFF',
        }}
        title="Design Token Preview"
      />
    </div>
  );
}

/**
 * Render preview with draft tokens
 */
function renderDraftPreview(
  root: HTMLElement,
  tokens: Record<string, string>,
  observations: Observation[]
) {
  const cssVars = tokensToCSS(tokens);

  // Render multiple observations to show feed page context
  const observationsHTML = observations.length > 0
    ? observations.map(obs => renderObservationCard(obs)).join('')
    : renderObservationCard(); // Show sample if no observations

  root.innerHTML = `
    <style>
      :root {
        ${cssVars}
      }

      .preview-container {
        padding: 20px;
        background: var(--light-background);
        min-height: 100vh;
      }

      .page-header {
        max-width: var(--max-content-width);
        margin: 0 auto 24px;
        padding-bottom: 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.08);
      }

      .page-title {
        font-size: calc(var(--base-font-size) * 1.5);
        font-weight: var(--bold-font-weight);
        color: var(--dark-text);
        margin-bottom: 4px;
      }

      .page-subtitle {
        font-size: var(--base-font-size);
        color: var(--secondary-text);
      }

      .observation-card {
        background: var(--card-background);
        border-radius: var(--border-radius);
        box-shadow: var(--card-shadow);
        padding: var(--base-padding);
        margin-bottom: 16px;
        max-width: var(--max-content-width);
        margin-left: auto;
        margin-right: auto;
      }

      .thesis {
        font-size: calc(var(--base-font-size) * 1.2);
        font-weight: var(--bold-font-weight);
        color: var(--dark-text);
        margin-bottom: 12px;
        line-height: 1.4;
      }

      .summary {
        font-size: var(--base-font-size);
        color: var(--secondary-text);
        line-height: 1.6;
        margin-bottom: 16px;
      }

      .button {
        background: var(--button-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        padding: var(--base-padding);
        font-size: var(--base-font-size);
        font-weight: var(--bold-font-weight);
        cursor: pointer;
      }

      .secondary-section {
        background: var(--secondary-background);
        border-radius: var(--border-radius);
        padding: var(--base-padding);
        margin-top: 12px;
      }

      .section-title {
        font-size: var(--base-font-size);
        font-weight: var(--bold-font-weight);
        color: var(--dark-text);
        margin-bottom: 8px;
      }

      .bullet-list {
        list-style: none;
        padding: 0;
      }

      .bullet-list li {
        font-size: var(--base-font-size);
        color: var(--dark-text);
        padding: 4px 0;
        padding-left: 20px;
        position: relative;
      }

      .bullet-list li:before {
        content: "•";
        position: absolute;
        left: 8px;
        color: var(--button-color);
      }
    </style>

    <div class="preview-container">
      <div class="page-header">
        <div class="page-title">Your Observations</div>
        <div class="page-subtitle">Recent research and briefings</div>
      </div>
      ${observationsHTML}
    </div>
  `;
}


/**
 * Convert token object to CSS custom properties
 */
function tokensToCSS(tokens: Record<string, string>, prefix = ''): string {
  const props = Object.entries(tokens).map(([key, value]) => {
    const cssVarName = prefix ? `--${prefix}-${key.replace(/_/g, '-')}` : `--${key.replace(/_/g, '-')}`;
    return `${cssVarName}: ${value};`;
  });

  if (prefix) {
    return `.${prefix}-pane :root { ${props.join('\n')} }`;
  }

  return props.join('\n');
}

/**
 * Render a single observation card with all sections
 */
function renderObservationCard(obs?: Observation): string {
  if (!obs) {
    return `
      <div class="observation-card">
        <div class="thesis">Sample Thesis: AI will replace 50% of white collar jobs by 2030</div>
        <div class="summary">
          This is a sample observation showing how design tokens affect the UI appearance.
          The preview uses real component structures to demonstrate visual changes.
        </div>
        <button class="button">Research This Idea</button>
        <div class="secondary-section">
          <div class="section-title">Key Considerations</div>
          <ul class="bullet-list">
            <li>Token changes update in real-time</li>
            <li>Preview uses actual component styling</li>
            <li>Compare draft vs production side-by-side</li>
          </ul>
        </div>
      </div>
    `;
  }

  // Parse summary if it's JSON
  let summaryText = obs.summary || '';
  try {
    if (summaryText.startsWith('{')) {
      const parsed = JSON.parse(summaryText);
      summaryText = parsed.bottom_line || summaryText;
    }
  } catch {
    // Use as-is if not JSON
  }

  return `
    <div class="observation-card">
      <div class="thesis">${escapeHtml(obs.thesis || obs.raw_input)}</div>
      ${summaryText ? `<div class="summary">${escapeHtml(summaryText)}</div>` : ''}
      <button class="button">Research This Idea</button>
      ${obs.stress_test ? `
        <div class="secondary-section">
          <div class="section-title">Counter Arguments</div>
          <ul class="bullet-list">
            ${('bullets' in obs.stress_test ? obs.stress_test.bullets : obs.stress_test.cons || [])
              .slice(0, 3)
              .map(item => `<li>${escapeHtml(item)}</li>`)
              .join('')}
          </ul>
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
