'use client'
// Selector de periodo compartido por labor y productividad.
import { useState } from 'react'
import { ff, tk } from '@/lib/design'

const dateInput: React.CSSProperties = { padding: '6px 8px', border: `1.5px solid ${tk.iron}`, background: tk.paper, color: tk.iron, fontFamily: ff.mono, fontSize: 11 }

export function useRange() {
  const [range, setRange] = useState<'7' | '30' | 'mtd' | 'custom'>('7')
  const [from, setFrom] = useState(''), [to, setTo] = useState('')
  const today = new Date().toISOString().slice(0, 10)
  const d = new Date(); if (range === '7') d.setDate(d.getDate() - 7); else if (range === '30') d.setDate(d.getDate() - 30); else d.setDate(1)
  const computed = range === 'custom' ? (from && to ? { from, to } : null) : { from: d.toISOString().slice(0, 10), to: today }
  const picker = (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}` }}>
        {(['7', '30', 'mtd', 'custom'] as const).map(r => <button key={r} onClick={() => setRange(r)} style={{ padding: '7px 14px', background: range === r ? tk.iron : tk.paper, color: range === r ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.06em' }}>{r === '7' ? 'ÚLTIMA SEMANA' : r === '30' ? 'ÚLTIMOS 30D' : r === 'mtd' ? 'ESTE MES' : 'PERSONALIZADO'}</button>)}
      </div>
      {range === 'custom' && <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: ff.mono, fontSize: 11 }}><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={dateInput} /><span>→</span><input type="date" value={to} onChange={e => setTo(e.target.value)} style={dateInput} /></div>}
    </div>
  )
  return { range: computed, picker }
}
