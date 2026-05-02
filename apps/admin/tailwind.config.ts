import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: '#8B6F47',
        'brand-dark': '#5C4425',
        'brand-light': '#C4A882',
        bg: '#F2EDEB',
        sidebar: '#F2EDEB',
        divider: '#E0DAD3',
        card: '#FFFFFF',
        output: '#F8F6F4',
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
        chip: '8px',
        card: '30px',
        panel: '30px',
        bubble: '30px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0,0,0,0.04)',
        md: '0 2px 8px rgba(0,0,0,0.06)',
        lg: '0 4px 16px rgba(0,0,0,0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config
