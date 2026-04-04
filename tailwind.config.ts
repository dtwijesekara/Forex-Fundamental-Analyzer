import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark background palette
        bg: {
          primary: '#0a0a0f',
          secondary: '#111118',
          card: '#16161f',
          border: '#1e1e2e',
          hover: '#1a1a28',
        },
        // Signal colors
        bullish: {
          strong: '#00d4aa',
          base: '#00b894',
          muted: '#00b89420',
          text: '#00d4aa',
        },
        bearish: {
          strong: '#ff4757',
          base: '#e84393',
          muted: '#ff475720',
          text: '#ff6b81',
        },
        neutral: {
          base: '#74b9ff',
          muted: '#74b9ff20',
          text: '#a4b0be',
        },
        warning: {
          hot: '#ffa502',
          muted: '#ffa50220',
          text: '#ffa502',
        },
        accent: {
          purple: '#a29bfe',
          blue: '#74b9ff',
          teal: '#00cec9',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
