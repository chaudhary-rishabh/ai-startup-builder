import forms from '@tailwindcss/forms'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './providers/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F2EDEB',
        sidebar: '#F2EDEB',
        card: '#FFFFFF',
        output: '#F8F6F4',
        divider: '#E0DAD3',
        brand: '#8B6F47',
        heading: '#5C4425',
        muted: '#C4A882',
        success: '#16A34A',
        'success-bg': '#DCFCE7',
        design: '#7C3AED',
        dev: '#0D9488',
        error: '#DC2626',
        warning: '#D97706',
        info: '#2563EB',
      },
      fontFamily: {
        display: ['Georgia', 'serif'],
        body: ['system-ui', 'Arial', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        chip: '8px',
        card: '30px',
        panel: '30px',
        bubble: '30px',
      },
      boxShadow: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        md: '0 2px 8px 0 rgb(0 0 0 / 0.06)',
        lg: '0 4px 16px 0 rgb(0 0 0 / 0.08)',
        card: '0 1px 4px 0 rgb(0 0 0 / 0.04)',
      },
    },
  },
  plugins: [forms],
}

export default config
