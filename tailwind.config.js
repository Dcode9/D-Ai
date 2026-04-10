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
        }
      },
      fontFamily: {
        sans: ['Inter'],
        mono: ['JetBrains Mono']
      }
    }
  },
  plugins: []
};
