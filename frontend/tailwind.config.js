/** IndusGate AI Brand & Identity Guidelines v2.0 — design tokens
 *  See docs/DESIGN_SYSTEM.md for full rationale and usage rules.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Foundation
        white: '#FFFFFF',
        ivory: '#FAF7F2',
        // Heritage Saffron family
        saffron: {
          DEFAULT: '#E87722',
          dawn: '#FFA940',
          deep: '#C95F0E',
        },
        // Emerald family
        emerald: {
          DEFAULT: '#0F7B3E',
          sage: '#2E9D5F',
          deep: '#0A5C2D',
        },
        // Navy / Ink family
        navy: {
          DEFAULT: '#1A2B4A',
          ink: '#0D1B3A',
          raised: '#22375C',
        },
        // Gold family
        gold: {
          DEFAULT: '#C9A961',
          sandalwood: '#E8D094',
        },
        // AI / data
        teal: {
          DEFAULT: '#0EA5E9',
        },
        // Error
        critical: {
          DEFAULT: '#DC2626',
        },
        // Dark theme muted text
        muted: {
          DEFAULT: '#94A3B8',
        },
      },
      fontFamily: {
        heading: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        display: ['48px', { lineHeight: '1.1' }],
        h1: ['32px', { lineHeight: '1.2' }],
        h2: ['24px', { lineHeight: '1.25' }],
        h3: ['20px', { lineHeight: '1.3' }],
        'body-lg': ['18px', { lineHeight: '1.5' }],
        body: ['16px', { lineHeight: '1.5' }],
        table: ['14px', { lineHeight: '1.45' }],
        caption: ['12px', { lineHeight: '1.4' }],
      },
      spacing: {
        4.5: '18px',
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
      },
      boxShadow: {
        subtle: '0 1px 2px rgba(13, 27, 58, 0.06)',
        raised: '0 2px 8px rgba(13, 27, 58, 0.08)',
      },
      maxWidth: {
        content: '1280px',
      },
    },
  },
  plugins: [],
}
