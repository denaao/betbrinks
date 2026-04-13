import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F8F6F4',
          100: '#F0EAE4',
          200: '#E2D5C8',
          300: '#D4BFA8',
          400: '#C4956A',
          500: '#B8845C',
          600: '#A87D5A',
          700: '#8B6548',
          800: '#6E503A',
          900: '#573E2E',
        },
        navy: {
          50: '#F1F5F9',
          100: '#E2E8F0',
          200: '#CBD5E1',
          600: '#1E293B',
          700: '#172033',
          800: '#141B2D',
          900: '#0F172A',
          950: '#0B1120',
        },
      },
    },
  },
  plugins: [],
};

export default config;
