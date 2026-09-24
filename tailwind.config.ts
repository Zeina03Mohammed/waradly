import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-outfit)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        navy: {
          50: '#f1f4f8',
          100: '#dde4ed',
          400: '#3d5a80',
          600: '#1c2f47',
          700: '#152337',
          900: '#0e1826',
          950: '#0a1220',
        },
        gold: {
          400: '#d9ab5f',
          500: '#c8964f',
          600: '#ad7d3c',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(14, 24, 38, 0.04), 0 8px 24px -8px rgba(14, 24, 38, 0.10)',
        'soft-lg': '0 2px 4px 0 rgba(14, 24, 38, 0.04), 0 16px 40px -12px rgba(14, 24, 38, 0.14)',
      },
    },
  },
  plugins: [],
};

export default config;
