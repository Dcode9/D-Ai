/**
 * D-Ai Regal Ornate Design System for Sandboxed Code Studio & In-Chat Direct Previews.
 * Injected into HTML sandboxes so any output adheres seamlessly to D-Ai's visual philosophy.
 */

export const DAI_DESIGN_SYSTEM_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');

  :root {
    --ink: #1c1b1a;
    --ink-2: #232220;
    --ink-3: #141312;
    --gold: #c9a86a;
    --gold-2: #e8d3a0;
    --gold-bright: #ffd98a;
    --cream: #efe3c6;
    --cream-soft: #dcd0b3;
    --muted: #8f8574;
    --plum: #6b3fa0;
    --plum-2: #8a5bc4;
    --amber: #c9a04a;
    --font-display: 'Instrument Serif', Georgia, serif;
    --font-body: 'Newsreader', Garamond, serif;
    --font-sans: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
  }

  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  body {
    background-color: var(--ink);
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 16px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    padding: 1.25rem;
    overflow-x: hidden;
  }

  /* Typography */
  h1, h2, h3, .dai-display {
    font-family: var(--font-display);
    color: var(--cream);
    font-weight: 400;
    letter-spacing: 0.02em;
    line-height: 1.2;
  }
  h1 { font-size: 2.2rem; }
  h2 { font-size: 1.7rem; }
  h3 { font-size: 1.35rem; }

  p, span, label {
    color: var(--cream-soft);
  }

  code, pre, .dai-mono {
    font-family: var(--font-mono);
  }

  /* Predesigned D-Ai Components */
  
  /* 1. Ornate Buttons */
  .dai-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.55rem 1.25rem;
    font-family: var(--font-display);
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--cream);
    background: linear-gradient(135deg, rgba(201,168,106,0.18), rgba(201,168,106,0.06));
    border: 1px solid rgba(201,168,106,0.5);
    border-radius: 4px;
    cursor: pointer;
    position: relative;
    transition: all 0.25s ease;
    text-decoration: none;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  }
  .dai-btn::after {
    content: '';
    position: absolute;
    inset: 2px;
    border: 1px solid rgba(201,168,106,0.2);
    border-radius: 2px;
    pointer-events: none;
  }
  .dai-btn:hover {
    background: linear-gradient(135deg, rgba(201,168,106,0.3), rgba(201,168,106,0.15));
    border-color: var(--gold-2);
    color: #fff6e0;
    box-shadow: 0 0 16px rgba(201,168,106,0.35);
    transform: translateY(-1px);
  }
  .dai-btn:active {
    transform: translateY(0);
  }

  .dai-btn-secondary {
    background: rgba(255,255,255,0.03);
    border-color: rgba(201,168,106,0.25);
    color: var(--gold-2);
  }
  .dai-btn-secondary:hover {
    background: rgba(201,168,106,0.1);
    border-color: rgba(201,168,106,0.5);
  }

  /* 2. Ornate Cards */
  .dai-card {
    background: var(--ink-2);
    border: 1px solid rgba(201,168,106,0.35);
    border-radius: 8px;
    padding: 1.5rem;
    position: relative;
    box-shadow: 0 8px 32px rgba(0,0,0,0.45);
  }
  .dai-card::before {
    content: '';
    position: absolute;
    inset: 4px;
    border: 1px solid rgba(201,168,106,0.12);
    border-radius: 5px;
    pointer-events: none;
  }

  /* 3. Inputs & Forms */
  .dai-input, .dai-textarea, .dai-select {
    width: 100%;
    background: rgba(0,0,0,0.45);
    border: 1px solid rgba(201,168,106,0.35);
    border-radius: 4px;
    padding: 0.6rem 0.9rem;
    color: var(--cream);
    font-family: var(--font-body);
    font-size: 1.05rem;
    outline: none;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .dai-input:focus, .dai-textarea:focus, .dai-select:focus {
    border-color: var(--gold);
    box-shadow: 0 0 12px rgba(201,168,106,0.25);
  }
  .dai-input::placeholder {
    color: rgba(143,133,116,0.6);
    font-style: italic;
  }

  /* 4. Badges & Pills */
  .dai-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-family: var(--font-display);
    font-size: 0.82rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    background: rgba(201,168,106,0.12);
    border: 1px solid rgba(201,168,106,0.3);
    color: var(--gold-2);
  }

  /* 5. Ornate Divider */
  .dai-divider {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(201,168,106,0.5), transparent);
    margin: 1.25rem 0;
    border: none;
  }

  /* Scrollbar */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  ::-webkit-scrollbar-track {
    background: rgba(0,0,0,0.2);
  }
  ::-webkit-scrollbar-thumb {
    background: rgba(201,168,106,0.35);
    border-radius: 3px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: rgba(201,168,106,0.6);
  }
`;

/**
 * Wraps raw HTML or snippet into a full, self-contained, beautifully styled document
 * incorporating D-Ai's design philosophy so live previews always look stunning.
 */
export function wrapCodeInDaiSandboxedHtml(rawCode: string): string {
  const trimmed = rawCode.trim();

  // If it's already a full HTML document with its own head, inject our design system gently
  if (/<html[\s>]/i.test(trimmed)) {
    if (/<head[\s>]/i.test(trimmed)) {
      return trimmed.replace(
        /<head([^>]*)>/i,
        `<head$1>\n<style id="dai-theme">${DAI_DESIGN_SYSTEM_CSS}</style>`,
      );
    }
    return `<!DOCTYPE html>\n<html><head><style id="dai-theme">${DAI_DESIGN_SYSTEM_CSS}</style></head>${trimmed}</html>`;
  }

  // If it's an HTML/JS/CSS snippet, construct a full regal D-Ai webpage wrapper
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>D'Ai Output Preview</title>
  <style>
${DAI_DESIGN_SYSTEM_CSS}
  </style>
</head>
<body>
  ${trimmed}
</body>
</html>`;
}
