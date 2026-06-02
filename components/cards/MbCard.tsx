'use client'

import React from 'react'
import { tk, ff, Status, statusColor, statusFigureColor } from '@/lib/design'

interface MbCardProps {
  category: string                  // ticker eyebrow (uppercase)
  timestamp?: string                // optional ticker timestamp
  status?: Status
  title: string
  figure?: string | number          // big number on the right
  sub?: React.ReactNode             // line under title
  cta?: { label: string; onClick?: () => void }
  maxWidth?: number
  children?: React.ReactNode
}

export function MbCard({ category, timestamp, status = 'neutral', title, figure, sub, cta, maxWidth = 540, children }: MbCardProps) {
  return (
    <div style={{
      width: '100%', maxWidth,
      background: tk.paper,
      border: `1.5px solid ${tk.iron}`,
      fontFamily: ff.mono,
      overflow: 'hidden',
    }}>
      {/* Ticker */}
      <div style={{
        background: tk.iron, color: tk.cream,
        padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' as const,
      }}>
        <span style={{ color: tk.apple }}>{category}</span>
        {timestamp && <span style={{ opacity: 0.55 }}>{timestamp}</span>}
      </div>

      {/* Body */}
      <div style={{ padding: '18px 18px 16px', position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: 3, background: statusColor(status),
        }} />

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
          marginBottom: 12, paddingLeft: 6, gap: 12,
        }}>
          <h3 style={{
            fontFamily: ff.display, fontWeight: 600, fontSize: 19, lineHeight: 1.15,
            margin: 0, color: tk.iron, letterSpacing: '-0.01em',
          }}>{title}</h3>
          {figure != null && (
            <div style={{
              fontFamily: ff.display, fontWeight: 600, fontSize: 30, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.015em',
              color: statusFigureColor(status), whiteSpace: 'nowrap',
            }}>{figure}</div>
          )}
        </div>

        {sub && (
          <div style={{
            paddingLeft: 6, fontSize: 11.5, color: tk.iron60, margin: '0 0 12px',
            lineHeight: 1.5,
          }}>{sub}</div>
        )}

        <div style={{ paddingLeft: 6 }}>{children}</div>
      </div>

      {/* CTA */}
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            background: tk.iron, color: tk.cream,
            padding: '11px 18px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer',
            fontFamily: ff.mono, border: 'none', width: '100%',
            textAlign: 'left' as const, textTransform: 'uppercase' as const,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#2a2522' }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = tk.iron }}
        >
          <span>{cta.label}</span>
          <span style={{ color: tk.apple }}>→</span>
        </button>
      )}
    </div>
  )
}

interface MbRowProps {
  label: React.ReactNode
  meta?: React.ReactNode
  right?: React.ReactNode
  rightVariant?: 'default' | 'crit' | 'warn'
  isLast?: boolean
}

export function MbRow({ label, meta, right, rightVariant = 'default', isLast }: MbRowProps) {
  const rightColor = rightVariant === 'crit' ? tk.terra : rightVariant === 'warn' ? tk.clay : tk.iron
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: isLast ? 'none' : `1px solid ${tk.iron20}`,
      fontSize: 11.5, gap: 12,
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ color: tk.iron, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{label}</div>
        {meta && <div style={{ color: tk.iron40, fontSize: 10.5, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>{meta}</div>}
      </div>
      {right != null && (
        <div style={{
          fontVariantNumeric: 'tabular-nums' as const, color: rightColor,
          whiteSpace: 'nowrap' as const, flexShrink: 0,
        }}>{right}</div>
      )}
    </div>
  )
}

// Status badges (color-tinted micro-pills)
type BadgeVariant = 'apple' | 'clay' | 'terra' | 'iron' | 'solid-iron'
export function MbBadge({ children, variant = 'iron' }: { children: React.ReactNode; variant?: BadgeVariant }) {
  const variants: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
    'apple':      { color: tk.appleDeep, bg: tk.appleSoft,  border: tk.appleDeep },
    'clay':       { color: tk.clay,      bg: tk.claySoft,   border: tk.clay },
    'terra':      { color: tk.terra,     bg: tk.terraSoft,  border: tk.terra },
    'iron':       { color: tk.iron,      bg: tk.creamSoft,  border: tk.iron },
    'solid-iron': { color: tk.cream,     bg: tk.iron,       border: tk.iron },
  }
  const v = variants[variant]
  return (
    <span style={{
      display: 'inline-block',
      fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.14em',
      textTransform: 'uppercase' as const,
      padding: '3px 7px',
      border: `1px solid ${v.border}`,
      color: v.color, background: v.bg,
      lineHeight: 1.1, whiteSpace: 'nowrap' as const,
    }}>{children}</span>
  )
}

// Mini sparkline (price acceleration)
export function MbSparkline({ heights, variant = 'default' }: { heights: number[]; variant?: 'default' | 'crit' | 'warn' }) {
  const lastColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron
  return (
    <div style={{ display: 'flex', alignItems: 'end', gap: 2, height: 22 }}>
      {heights.map((h, i) => (
        <span key={i} style={{
          display: 'block', width: 4,
          height: `${Math.max(8, h)}%`,
          background: i === heights.length - 1 ? lastColor : tk.iron,
        }} />
      ))}
    </div>
  )
}

// Mini progress bar (cash flow per week)
export function MbBar({ pct, variant = 'default' }: { pct: number; variant?: 'default' | 'crit' | 'warn' }) {
  const color = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron
  return (
    <div style={{ height: 4, background: tk.creamSoft, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  )
}

// Section header inside a long card
export function MbSection({ title, badge, badgeVariant, children }: { title: string; badge?: string; badgeVariant?: BadgeVariant; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 18px 16px', borderTop: `1.5px solid ${tk.iron20}`, paddingTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 6 }}>
        <span style={{
          fontFamily: ff.display, fontWeight: 600, fontSize: 13,
          color: tk.iron, letterSpacing: '0.01em',
        }}>{title}</span>
        {badge && <MbBadge variant={badgeVariant || 'iron'}>{badge}</MbBadge>}
      </div>
      <div style={{ paddingLeft: 6 }}>{children}</div>
    </div>
  )
}

// 3-step timeline: HOY → +30d → +60d
type TimelineCol = { label: string; value: string; variant?: 'default' | 'crit' | 'warn' }
export function MbTimeline({ cols }: { cols: TimelineCol[] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 18px 1fr 18px 1fr',
      alignItems: 'end', padding: '10px 0 4px',
    }}>
      {cols.map((c, i) => (
        <React.Fragment key={i}>
          <div style={{ textAlign: 'center' as const }}>
            <div style={{
              fontFamily: ff.mono, fontSize: 9, letterSpacing: '0.1em',
              color: tk.iron40, textTransform: 'uppercase' as const,
            }}>{c.label}</div>
            <div style={{
              fontFamily: ff.display, fontWeight: 600, fontSize: 22, lineHeight: 1,
              fontVariantNumeric: 'tabular-nums' as const, marginTop: 4,
              color: c.variant === 'crit' ? tk.terra : c.variant === 'warn' ? tk.clay : tk.iron,
            }}>{c.value}</div>
          </div>
          {i < cols.length - 1 && (
            <div style={{
              fontFamily: ff.mono, color: tk.iron20,
              paddingBottom: 5, textAlign: 'center' as const,
            }}>→</div>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}
