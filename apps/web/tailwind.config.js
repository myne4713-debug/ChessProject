import tailwindcssAnimate from 'tailwindcss-animate';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        chess: {
          bg: 'var(--chess-bg)',
          card: 'var(--chess-card)',
          surface: 'var(--chess-surface)',
          border: 'var(--chess-border)',
          obsidian: 'var(--chess-obsidian)',
          ink: 'var(--chess-ink)',
          muted: 'var(--chess-ink-muted)',
          boardLight: 'var(--chess-board-light)',
          boardDark: 'var(--chess-board-dark)',
          boardHighlight: 'var(--chess-board-highlight-light)',
          boardHighlightDark: 'var(--chess-board-highlight-dark)',
          primary: 'var(--chess-primary)',
          primaryHover: 'var(--chess-primary-hover)',
          focus: 'var(--chess-focus)',
          accent: 'var(--chess-accent)',
          accentLight: 'var(--chess-accent-light)',
          ice: 'var(--chess-ice)',
          clockAmber: 'var(--chess-clock-amber)',
          danger: 'var(--chess-danger)',
          success: 'var(--chess-success)',
        }
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
        'card': '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.03)',
        'glow-primary': '0 0 24px -4px rgba(2, 132, 199, 0.35)',
        'modal': '0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
      },
      letterSpacing: {
        'tight-title': '-0.02em',
      }
    },
  },
  plugins: [tailwindcssAnimate],
}
