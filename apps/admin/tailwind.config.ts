import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#8B6F47',
        'brand-dark': '#5C4425',
        'brand-light': '#C4A882',
        bg: '#F5F0E8',
        sidebar: '#EDE5D8',
        divider: '#E8DFD0',
        card: '#FFFFFF',
        output: '#FAF8F5',
        muted: '#C4A882',
        heading: '#5C4425',
        error: '#DC2626',
        success: '#16A34A',
        warning: '#D97706',
        'admin-red': '#DC2626',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['Arial', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        chip: '6px',
        card: '12px',
        panel: '20px',
        bubble: '28px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.08)',
        md: '0 4px 16px rgba(0,0,0,0.10)',
        lg: '0 8px 32px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
