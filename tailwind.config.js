/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'dai-brand': 'var(--dai-brand)',
        'dai-brand-dim': 'var(--dai-brand-dim)',
        'dai-bg': 'var(--dai-bg)',
        'dai-surface': 'var(--dai-surface)',
        'dai-border': 'var(--dai-border)',
        'dai-text': 'var(--dai-text)',
        'dai-muted': 'var(--dai-muted)',
        'dai-soft': 'var(--dai-soft)',
        'dai-accent': 'var(--dai-accent)',
        'parchment-surface': 'var(--dai-surface)',
        'parchment-ink': 'var(--dai-text)',
      },
      colors: {
        brand: '#b48c51', /* gold */
        dark: {
          bg: '#1a181e',
          surface: '#242129',
          border: '#3b3345'
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
