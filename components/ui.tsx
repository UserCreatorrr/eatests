'use client'
// Primitivas de interfaz compartidas (tokens de lib/design). Cada pantalla
// compone con esto en vez de repetir estilos en línea.
import Link from 'next/link'
import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { ff, tk } from '@/lib/design'

export const S = {
  label: { fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: tk.iron40, display: 'block', marginBottom: 5 } as CSSProperties,
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', border: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 12.5, color: tk.iron, outline: 'none', background: tk.cream } as CSSProperties,
  th: { padding: '8px 12px', textAlign: 'left', fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.1em', color: tk.iron40, textTransform: 'uppercase', fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}`, whiteSpace: 'nowrap' } as CSSProperties,
  td: { padding: '8px 12px', color: tk.iron, fontFamily: ff.mono, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', verticalAlign: 'middle' } as CSSProperties,
  panelHead: { padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', color: tk.iron, textTransform: 'uppercase', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 } as CSSProperties,
}

export function Page({ eyebrow, title, subtitle, actions, back, children }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string }; children: ReactNode }) {
  return (
    <div style={{ padding: '32px 36px 60px' }}>
      {back && <Link href={back.href} style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, textDecoration: 'none' }}>← {back.label}</Link>}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', margin: back ? '12px 0 22px' : '0 0 22px' }}>
        <div>
          {eyebrow && <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>{eyebrow}</p>}
          <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 30, letterSpacing: '-0.02em', margin: 0, color: tk.iron }}>{title}</h1>
          {subtitle && <div style={{ fontFamily: ff.mono, fontSize: 12, color: tk.iron60, margin: '6px 0 0', lineHeight: 1.5 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </div>
  )
}

export function Panel({ title, right, children, style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 16, ...style }}>
      {title != null && <div style={S.panelHead}><span>{title}</span>{right}</div>}
      {children}
    </div>
  )
}

export function Btn({ children, onClick, kind = 'primary', disabled, href, title, small, type = 'button' }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'ghost' | 'danger' | 'dark'; disabled?: boolean; href?: string; title?: string; small?: boolean; type?: 'button' | 'submit' }) {
  const base: CSSProperties = {
    fontFamily: ff.mono, fontSize: small ? 10.5 : 11, fontWeight: 600, letterSpacing: '0.06em', cursor: disabled ? 'not-allowed' : 'pointer', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: small ? '5px 10px' : '9px 16px', border: `1.5px solid ${kind === 'danger' ? tk.terra : tk.iron}`, opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
    background: kind === 'primary' ? tk.apple : kind === 'dark' ? tk.iron : kind === 'danger' ? tk.terraSoft : tk.paper,
    color: kind === 'dark' ? tk.cream : kind === 'danger' ? tk.terra : tk.iron,
  }
  if (href) return <Link href={href} style={base} title={title}>{children}</Link>
  return <button type={type} onClick={onClick} disabled={disabled} style={base} title={title}>{children}</button>
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'ok' | 'warn' | 'crit' | 'neutral' | 'info' }) {
  const c = tone === 'ok' ? [tk.appleSoft, tk.appleDeep] : tone === 'warn' ? [tk.claySoft, tk.clay] : tone === 'crit' ? [tk.terraSoft, tk.terra] : tone === 'info' ? [tk.cream, tk.iron60] : [tk.creamSoft, tk.iron60]
  return <span style={{ fontFamily: ff.mono, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', padding: '2px 8px', background: c[0], color: c[1], border: `1px solid ${c[1]}`, whiteSpace: 'nowrap' }}>{children}</span>
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {children}
      {hint && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, marginTop: 4 }}>{hint}</div>}
    </div>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...S.input, ...(props.style ?? {}) }} onFocus={e => { e.currentTarget.style.borderColor = tk.iron; props.onFocus?.(e) }} onBlur={e => { e.currentTarget.style.borderColor = tk.iron20; props.onBlur?.(e) }} />
}
export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...S.input, cursor: 'pointer', ...(props.style ?? {}) }} />
}
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} style={{ ...S.input, minHeight: 80, resize: 'vertical', ...(props.style ?? {}) }} />
}

export function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'crit' | 'ok' }) {
  const c = tone === 'warn' ? [tk.claySoft, tk.clay] : tone === 'crit' ? [tk.terraSoft, tk.terra] : tone === 'ok' ? [tk.appleSoft, tk.appleDeep] : [tk.creamSoft, tk.iron60]
  return <div style={{ background: c[0], border: `1.5px solid ${c[1]}`, color: tone === 'info' ? tk.iron : c[1], padding: '10px 14px', fontFamily: ff.mono, fontSize: 11.5, lineHeight: 1.5, marginBottom: 14 }}>{children}</div>
}

export function Empty({ children }: { children: ReactNode }) {
  return <div style={{ padding: '26px 16px', textAlign: 'center', fontFamily: ff.mono, fontSize: 11.5, color: tk.iron40 }}>{children}</div>
}

export function Loading() {
  return <div style={{ padding: 36, fontFamily: ff.mono, fontSize: 12, color: tk.iron60 }}>Cargando…</div>
}

export function Table({ head, children, right = [] }: { head: string[]; children: ReactNode; right?: number[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...S.th, textAlign: right.includes(i) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}
export function Tr({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <tr onClick={onClick} style={{ borderTop: `1px solid ${tk.iron20}`, cursor: onClick ? 'pointer' : undefined }}>{children}</tr>
}
export function Td({ children, right, style, colSpan }: { children: ReactNode; right?: boolean; style?: CSSProperties; colSpan?: number }) {
  return <td colSpan={colSpan} style={{ ...S.td, textAlign: right ? 'right' : 'left', ...style }}>{children}</td>
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'warn' | 'crit' }) {
  const color = tone === 'crit' ? tk.terra : tone === 'warn' ? tk.clay : tone === 'ok' ? tk.appleDeep : tk.iron
  return (
    <div style={{ padding: '14px 18px', background: tk.paper, border: `1.5px solid ${tk.iron}` }}>
      <div style={S.label}>{label}</div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 26, color, letterSpacing: '-0.01em' }}>{value}</div>
      {sub && <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

export function Modal({ title, onClose, children, width = 520 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div onMouseDown={e => { if (e.target === e.currentTarget) onClose() }} style={{ position: 'fixed', inset: 0, background: 'rgba(61,56,52,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, width: '100%', maxWidth: width, maxHeight: '92vh', overflowY: 'auto' }}>
        <div style={{ background: tk.iron, color: tk.cream, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 15, margin: 0 }}>{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: tk.cream, opacity: 0.7, padding: 0, display: 'flex' }}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

export function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} style={{ fontFamily: ff.mono, fontSize: 11, padding: '4px 10px', cursor: 'pointer', border: `1.5px solid ${active ? color : tk.iron20}`, background: active ? color : 'transparent', color: active ? '#fff' : color, letterSpacing: '0.02em' }}>{children}</button>
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <Input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder ?? 'Buscar…'} style={{ maxWidth: 420, background: tk.paper }} />
}

export function Delta({ pct: v }: { pct: number | null | undefined }) {
  if (v == null) return <span style={{ color: tk.iron40 }}>—</span>
  return <span style={{ fontWeight: 600, color: v > 0 ? tk.terra : v < 0 ? tk.appleDeep : tk.iron40 }}>{v > 0 ? '+' : ''}{v}%</span>
}
