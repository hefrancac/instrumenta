/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Cores = as mesmas variáveis CSS de index.css (tema claro/escuro).
      // Assim `bg-card`, `text-ink`, `border-line`… trocam de tema sozinhas.
      colors: {
        canvas: 'var(--bg)',            // fundo da página (evita o confuso "bg-bg")
        card: 'var(--card)',
        ink: { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)' },
        line: 'var(--line)',
        primary: { DEFAULT: 'var(--primary)', dk: 'var(--primary-dk)', soft: 'var(--primary-soft)' },
        amber: { DEFAULT: 'var(--amber)', dk: 'var(--amber-dk)', soft: 'var(--amber-soft)' },
        emerald: 'var(--emerald)',
        divider: 'var(--divider)',
        'chip-instr': 'var(--chip-instr)',
        track: 'var(--track)',
        toggle: 'var(--toggle)',
        skeleton: 'var(--skeleton)',
        'banner-line': 'var(--banner-line)',
        'amber-line': 'var(--amber-line)',
        'amber-chip': 'var(--amber-chip)',
        danger: 'var(--danger)',
        'accent-card': 'var(--accent-card)',
        header: 'var(--header-bg)',
      },
    },
  },
  plugins: [],
}
