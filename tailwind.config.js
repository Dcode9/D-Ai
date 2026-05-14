/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: '#2563eb',
        dark: {
          bg: '#050505',
          surface: '#0F0F0F',
          border: '#1F1F1F'
        },
        indique: {
          'dark': '#1a1a1a',
          'darker': '#0f0f0f',
          'gold': '#d4af37',
          'gold-light': '#f4a460',
          'purple': '#a855f7',
          'purple-light': '#c084fc',
          'accent': '#e0a82d'
        }
      },
      fontFamily: {
        sans: ['Inter'],
        mono: ['JetBrains Mono'],
        serif: ['Playfair Display']
      },
      boxShadow: {
        'ornate': '0 0 40px rgba(168, 85, 247, 0.25), inset 0 0 20px rgba(212, 175, 55, 0.1)',
        'ornate-hover': '0 0 60px rgba(168, 85, 247, 0.4), inset 0 0 30px rgba(212, 175, 55, 0.15)'
      }
    }
  },
  plugins: []
};
