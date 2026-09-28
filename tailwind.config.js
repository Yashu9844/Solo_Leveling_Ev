/** @type {import('tailwindcss').Config} */
// Every colour, size and shadow here resolves to a custom property in
// src/ui/tokens.css. design/00-DESIGN-SYSTEM.md §3-§4 is the source of
// truth; this file only exposes those tokens to Tailwind, so a theme
// switch is a data-attribute change and nothing here has to know.
//
// Type sizes are wrapped in calc(… * var(--type-scale)) so the user's
// text-size setting scales the WHOLE scale coherently. Line heights are
// unitless ratios for the same reason — a fixed px leading would not
// scale with its font size.
const scaled = (size) => `calc(${size} * var(--type-scale))`;

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── ground ──
        void: 'var(--void)',
        abyss: 'var(--abyss)',
        deep: 'var(--deep)',
        'panel-top': 'var(--panel-top)',
        'panel-bot': 'var(--panel-bot)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        scrim: 'var(--scrim)',

        // ── mana ──
        accent: 'var(--accent)',
        'accent-deep': 'var(--accent-deep)',
        'accent-mid': 'var(--accent-mid)',
        'accent-bright': 'var(--accent-bright)',
        'accent-soft': 'var(--accent-soft)',
        'accent-core': 'var(--accent-core)',
        'on-accent': 'var(--on-accent)',

        // ── dawn — Gold Horizon surfaces only (design system §2.2) ──
        'dawn-deep': 'var(--dawn-deep)',
        dawn: 'var(--dawn)',
        'dawn-bright': 'var(--dawn-bright)',
        'dawn-core': 'var(--dawn-core)',

        // ── hairlines & fills ──
        hair: 'var(--hair)',
        'hair-strong': 'var(--hair-strong)',
        'hair-faint': 'var(--hair-faint)',
        'fill-faint': 'var(--fill-faint)',

        // ── ink ──
        'ink-100': 'var(--ink-100)',
        'ink-300': 'var(--ink-300)',
        'ink-500': 'var(--ink-500)',
        'ink-700': 'var(--ink-700)',
        'ink-900': 'var(--ink-900)',
        faint: 'var(--faint)',

        // ── state ──
        'state-complete': 'var(--state-complete)',
        'state-pending': 'var(--state-pending)',
        'state-recover': 'var(--state-recover)',
        'state-alert': 'var(--state-alert)',
        boss: 'var(--boss)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      spacing: {
        1: 'var(--sp-1)',
        2: 'var(--sp-2)',
        3: 'var(--sp-3)',
        4: 'var(--sp-4)',
        5: 'var(--sp-5)',
        6: 'var(--sp-6)',
        8: 'var(--sp-8)',
        12: 'var(--sp-12)',
        gutter: 'var(--gutter)',
      },
      minHeight: {
        row: 'var(--row-min)',
        tap: '44px',
      },
      maxWidth: {
        shell: 'var(--shell-max)',
      },
      // design/00-DESIGN-SYSTEM.md §4.
      fontSize: {
        display: [scaled('clamp(34px, 11vw, 46px)'), { lineHeight: '1', fontWeight: '300' }],
        title: [scaled('clamp(20px, 5.6vw, 24px)'), { lineHeight: '1.2', fontWeight: '500' }],
        h1: [scaled('21px'), { lineHeight: '1.24', fontWeight: '500' }],
        xl: [scaled('clamp(26px, 8vw, 32px)'), { lineHeight: '1.05', fontWeight: '600' }],
        lg: [scaled('22px'), { lineHeight: '1.27', fontWeight: '600' }],
        md: [scaled('17px'), { lineHeight: '1.41', fontWeight: '500' }],
        sm: [scaled('15px'), { lineHeight: '1.47', fontWeight: '400' }],
        xs: [scaled('13px'), { lineHeight: '1.38', fontWeight: '400' }],
        xxs: [
          scaled('11px'),
          { lineHeight: '1.45', fontWeight: '500', letterSpacing: '0.16em' },
        ],
        micro: [
          scaled('9.5px'),
          { lineHeight: '1.47', fontWeight: '500', letterSpacing: '0.14em' },
        ],
      },
      letterSpacing: {
        label: '0.16em',
        wordmark: '0.34em',
        button: '0.2em',
      },
      boxShadow: {
        'glow-sm': 'var(--glow-sm)',
        'glow-md': 'var(--glow-md)',
        'glow-lg': 'var(--glow-lg)',
      },
      opacity: {
        art: 'var(--art-opacity)',
      },
    },
  },
  plugins: [],
};
