import forms from '@tailwindcss/forms'
import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './providers/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F5F0E8',
        sidebar: '#EDE5D8',
        card: '#FFFFFF',
        output: '#FAF8F5',
        divider: '#E8DFD0',
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
        chip: '6px',
        card: '12px',
        panel: '20px',
        bubble: '28px',
      },
      boxShadow: {
        sm: '0 1px 3px 0 rgb(0 0 0 / 0.06)',
        md: '0 4px 12px 0 rgb(0 0 0 / 0.08)',
        lg: '0 8px 24px 0 rgb(0 0 0 / 0.10)',
        card: '0 2px 8px 0 rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [forms],
}

export default config
