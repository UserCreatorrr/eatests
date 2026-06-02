// MarginBite design tokens — editorial operational.
// Use these instead of hardcoded hex anywhere in components.

export const tk = {
  // Brand
  apple:     '#19F973',
  appleSoft: '#d6f9e0',
  appleDeep: '#0fa651',
  iron:      '#3D3834',
  iron60:    '#6c635a',
  iron40:    '#9a8f82',
  iron20:    '#c4b8a8',

  // Surfaces
  cream:     '#DFD5C9',
  creamSoft: '#ece4d8',
  creamBg:   '#f5f0e6',
  paper:     '#faf6ec',

  // Semantic — warm tonal derivatives (NEVER bright red/blue/violet)
  clay:      '#c97b3d',
  claySoft:  '#fcf2e8',
  terra:     '#a83e1e',
  terraSoft: '#fbeae2',
} as const

export type Status = 'ok' | 'warn' | 'crit' | 'neutral'

export function statusColor(s: Status): string {
  return s === 'ok' ? tk.apple : s === 'warn' ? tk.clay : s === 'crit' ? tk.terra : tk.iron20
}

export function statusFigureColor(s: Status): string {
  return s === 'crit' ? tk.terra : s === 'warn' ? tk.clay : tk.iron
}

export const ff = {
  display: "'Chillax', system-ui, sans-serif",
  mono: "'DM Mono', ui-monospace, monospace",
} as const

// Shared mb-card visual constants
export const cardShell = {
  width: '100%',
  maxWidth: 540,
  background: tk.paper,
  border: `1.5px solid ${tk.iron}`,
  fontFamily: ff.mono,
  overflow: 'hidden' as const,
}

export const ticker = {
  background: tk.iron,
  color: tk.cream,
  padding: '10px 16px',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  fontSize: 10,
  letterSpacing: '0.16em',
  textTransform: 'uppercase' as const,
}

export const ctaStrip = {
  background: tk.iron,
  color: tk.cream,
  padding: '11px 18px',
  display: 'flex' as const,
  justifyContent: 'space-between' as const,
  alignItems: 'center' as const,
  fontSize: 11,
  letterSpacing: '0.05em',
  cursor: 'pointer' as const,
  fontFamily: ff.mono,
  border: 'none',
  width: '100%',
}
