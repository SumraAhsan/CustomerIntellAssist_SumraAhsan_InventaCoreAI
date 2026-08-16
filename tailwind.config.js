/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B2559',
          light: '#14336B',
          deep: '#071427',
        },
        surface: {
          bg: '#F3F6FB',
          card: '#FFFFFF',
          dark: '#0B1730',
          darkcard: '#101E3D',
        },
        accent: {
          DEFAULT: '#F2994A',
          soft: '#FDEBD8',
        },
        info: {
          DEFAULT: '#2F80ED',
          soft: '#E4EEFD',
        },
        intel: {
          DEFAULT: '#7C5CFC',
          soft: '#EEE8FF',
        },
        success: {
          DEFAULT: '#1F9D55',
          soft: '#E4F7EB',
        },
        critical: {
          DEFAULT: '#DC2626',
          soft: '#FDE8E8',
        },
        warn: {
          DEFAULT: '#D97706',
          soft: '#FDF1DC',
        },
        ink: {
          DEFAULT: '#101828',
          soft: '#475467',
          faint: '#98A2B3',
        },
      },
      fontFamily: {
        display: ['Lexend', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.06), 0 1px 3px rgba(16,24,40,0.08)',
        pop: '0 4px 12px rgba(16,24,40,0.10)',
      },
      borderRadius: {
        xl2: '1.1rem',
      },
      keyframes: {
        driftSlow: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(3%, 4%) scale(1.08)' },
        },
        driftSlower: {
          '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
          '50%': { transform: 'translate(-4%, 3%) scale(1.05)' },
        },
      },
      animation: {
        'drift-slow': 'driftSlow 22s ease-in-out infinite',
        'drift-slower': 'driftSlower 28s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
