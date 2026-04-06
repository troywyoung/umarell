import { useEffect, useRef, useState } from 'react';
import type { Observation } from '../types';

interface PreviewPaneProps {
  tokens: Record<string, string>;
  observations: Observation[];
  mode: 'draft' | 'comparison';
  productionTokens?: Record<string, string>;
}

/**
 * Live preview pane that renders Umarell components with design tokens applied.
 * Uses iframe isolation to prevent token bleed into parent app.
 */
export default function PreviewPane({ tokens, observations, mode, productionTokens }: PreviewPaneProps) {
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

    if (mode === 'draft') {
      renderDraftPreview(root, tokens, observations);
    } else {
      renderComparisonPreview(root, tokens, productionTokens || {}, observations);
    }
  }, [iframeReady, tokens, observations, mode, productionTokens]);

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
  const obs = observations[0]; // Use first observation as preview content

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
      ${renderObservationCard(obs)}
    </div>
  `;
}

/**
 * Render side-by-side comparison
 */
function renderComparisonPreview(
  root: HTMLElement,
  draftTokens: Record<string, string>,
  productionTokens: Record<string, string>,
  observations: Observation[]
) {
  const draftCSS = tokensToCSS(draftTokens, 'draft');
  const prodCSS = tokensToCSS(productionTokens, 'prod');
  const obs = observations[0];

  root.innerHTML = `
    <style>
      .comparison-container {
        display: flex;
        min-height: 100vh;
      }

      .comparison-pane {
        flex: 1;
        overflow: auto;
        position: relative;
      }

      .comparison-label {
        position: sticky;
        top: 0;
        background: rgba(0,0,0,0.8);
        color: white;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 700;
        text-align: center;
        z-index: 10;
      }

      .divider {
        width: 2px;
        background: #DDD;
        flex-shrink: 0;
      }

      ${draftCSS}
      ${prodCSS}

      .preview-container {
        padding: 20px;
        min-height: calc(100vh - 32px);
      }

      .draft-pane .preview-container {
        background: var(--draft-light-background);
      }

      .prod-pane .preview-container {
        background: var(--prod-light-background);
      }

      .observation-card {
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 16px;
        max-width: 480px;
        margin-left: auto;
        margin-right: auto;
      }

      .draft-pane .observation-card {
        background: var(--draft-card-background);
        box-shadow: var(--draft-card-shadow);
        border-radius: var(--draft-border-radius);
        padding: var(--draft-base-padding);
      }

      .prod-pane .observation-card {
        background: var(--prod-card-background);
        box-shadow: var(--prod-card-shadow);
        border-radius: var(--prod-border-radius);
        padding: var(--prod-base-padding);
      }

      .thesis {
        margin-bottom: 12px;
        line-height: 1.4;
      }

      .draft-pane .thesis {
        font-size: calc(var(--draft-base-font-size) * 1.2);
        font-weight: var(--draft-bold-font-weight);
        color: var(--draft-dark-text);
      }

      .prod-pane .thesis {
        font-size: calc(var(--prod-base-font-size) * 1.2);
        font-weight: var(--prod-bold-font-weight);
        color: var(--prod-dark-text);
      }

      .summary {
        line-height: 1.6;
        margin-bottom: 16px;
      }

      .draft-pane .summary {
        font-size: var(--draft-base-font-size);
        color: var(--draft-secondary-text);
      }

      .prod-pane .summary {
        font-size: var(--prod-base-font-size);
        color: var(--prod-secondary-text);
      }

      .button {
        color: white;
        border: none;
        cursor: pointer;
      }

      .draft-pane .button {
        background: var(--draft-button-color);
        border-radius: var(--draft-border-radius);
        padding: var(--draft-base-padding);
        font-size: var(--draft-base-font-size);
        font-weight: var(--draft-bold-font-weight);
      }

      .prod-pane .button {
        background: var(--prod-button-color);
        border-radius: var(--prod-border-radius);
        padding: var(--prod-base-padding);
        font-size: var(--prod-base-font-size);
        font-weight: var(--prod-bold-font-weight);
      }

      .secondary-section {
        margin-top: 12px;
      }

      .draft-pane .secondary-section {
        background: var(--draft-secondary-background);
        border-radius: var(--draft-border-radius);
        padding: var(--draft-base-padding);
      }

      .prod-pane .secondary-section {
        background: var(--prod-secondary-background);
        border-radius: var(--prod-border-radius);
        padding: var(--prod-base-padding);
      }

      .section-title {
        margin-bottom: 8px;
      }

      .draft-pane .section-title {
        font-size: var(--draft-base-font-size);
        font-weight: var(--draft-bold-font-weight);
        color: var(--draft-dark-text);
      }

      .prod-pane .section-title {
        font-size: var(--prod-base-font-size);
        font-weight: var(--prod-bold-font-weight);
        color: var(--prod-dark-text);
      }

      .bullet-list {
        list-style: none;
        padding: 0;
      }

      .bullet-list li {
        padding: 4px 0;
        padding-left: 20px;
        position: relative;
      }

      .draft-pane .bullet-list li {
        font-size: var(--draft-base-font-size);
        color: var(--draft-dark-text);
      }

      .draft-pane .bullet-list li:before {
        content: "•";
        position: absolute;
        left: 8px;
        color: var(--draft-button-color);
      }

      .prod-pane .bullet-list li {
        font-size: var(--prod-base-font-size);
        color: var(--prod-dark-text);
      }

      .prod-pane .bullet-list li:before {
        content: "•";
        position: absolute;
        left: 8px;
        color: var(--prod-button-color);
      }
    </style>

    <div class="comparison-container">
      <div class="comparison-pane prod-pane">
        <div class="comparison-label">PRODUCTION</div>
        <div class="preview-container">
          ${renderObservationCard(obs)}
        </div>
      </div>
      <div class="divider"></div>
      <div class="comparison-pane draft-pane">
        <div class="comparison-label">DRAFT</div>
        <div class="preview-container">
          ${renderObservationCard(obs)}
        </div>
      </div>
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
