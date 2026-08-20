/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './scripts/**/*.js'],
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
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    }
  },
  plugins: []
};
