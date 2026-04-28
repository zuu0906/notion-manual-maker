import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#E8453C',
        /* Notion warm palette */
        n: {
          900: '#37352F',   // primary text
          700: '#5E5C57',   // secondary text
          500: '#9B9A97',   // muted / placeholder
          300: '#D3D1CB',   // dividers
          200: '#E9E9E7',   // card borders
          100: '#F1F0EE',   // hover bg
          50:  '#F9F8F6',   // section bg (Notion sidebar tone)
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '"Noto Sans JP"',
          'ui-sans-serif',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Helvetica',
          'sans-serif',
        ],
      },
      borderRadius: {
        notion: '6px',
      },
      boxShadow: {
        notion: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'notion-md': '0 4px 12px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.05)',
        'notion-lg': '0 8px 24px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
};

export default config;
