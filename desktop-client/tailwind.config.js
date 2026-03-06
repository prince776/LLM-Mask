import typography from '@tailwindcss/typography'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      animation: {
        bounce: 'bounce 1.4s infinite',
      },
      colors: {
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
      },
      typography: ({ theme }) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gray.700'),
            lineHeight: '1.7',
            p: { marginTop: '0.4em', marginBottom: '0.4em' },
            li: { marginTop: '0.2em', marginBottom: '0.2em' },
            h1: { fontSize: '1.35em', fontWeight: '700', marginTop: '0.9em', marginBottom: '0.3em' },
            h2: { fontSize: '1.2em', fontWeight: '600', marginTop: '0.8em', marginBottom: '0.25em' },
            h3: { fontSize: '1.05em', fontWeight: '600', marginTop: '0.7em', marginBottom: '0.2em' },
            h4: { fontSize: '1em', fontWeight: '600', marginTop: '0.6em', marginBottom: '0.2em' },
            blockquote: {
              fontStyle: 'normal',
              borderLeftColor: theme('colors.blue.400'),
              color: theme('colors.gray.500'),
              paddingLeft: '0.875em',
            },
            'blockquote p:first-of-type::before': { content: 'none' },
            'blockquote p:last-of-type::after': { content: 'none' },
            code: {
              fontSize: '0.85em',
              fontWeight: '400',
              color: theme('colors.gray.800'),
              backgroundColor: theme('colors.gray.100'),
              borderRadius: '0.25rem',
              paddingTop: '0.15em',
              paddingBottom: '0.15em',
              paddingLeft: '0.4em',
              paddingRight: '0.4em',
            },
            'code::before': { content: 'none' },
            'code::after': { content: 'none' },
            pre: {
              padding: '0',
              margin: '0',
              backgroundColor: 'transparent',
              borderRadius: '0',
              color: 'inherit',
            },
            'pre code': {
              backgroundColor: 'transparent',
              borderRadius: '0',
              padding: '0',
              fontSize: 'inherit',
              color: 'inherit',
            },
            hr: { margin: '1em 0' },
            table: { fontSize: '0.875em' },
            th: { backgroundColor: theme('colors.gray.50') },
          },
        },
        invert: {
          css: {
            color: '#d1d5db',
            '--tw-prose-headings': '#f3f4f6',
            '--tw-prose-bold': '#f3f4f6',
            code: {
              color: '#e5e7eb',
              backgroundColor: 'rgba(255,255,255,0.08)',
            },
            blockquote: {
              borderLeftColor: '#3b82f6',
              color: '#9ca3af',
            },
            th: { backgroundColor: 'rgba(255,255,255,0.04)' },
          },
        },
      }),
    },
  },
  plugins: [typography],
}
