import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ghost: {
          ink: '#08070d',
          panel: '#0f0d17',
          line: '#241f33',
          haze: '#a78bfa',
          spirit: '#5eead4',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Inter',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        halo: '0 0 0 1px rgba(167, 139, 250, 0.18), 0 24px 60px -32px rgba(138, 92, 246, 0.55)',
      },
    },
  },
  plugins: [],
};

export default config;
