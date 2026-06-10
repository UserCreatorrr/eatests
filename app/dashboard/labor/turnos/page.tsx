'use client'

export const dynamic = 'force-dynamic'

import { useState, useRef, useEffect } from 'react'
import { tk, ff } from '@/lib/design'

const FIELDS_TURNOS = ['site_id', 'date', 'employee_id', 'employee_name', 'role', 'area', 'start_time', 'end_time', 'break_minutes', 'hourly_cost', 'contract_hours_week', 'source']
const FIELDS_VENTAS = ['site_id', 'date', 'timeslot_start', 'timeslot_end', 'channel', 'sales_net', 'covers', 'orders', 'tickets', 'source']

const SAMPLE_TURNOS = `site_id,date,employee_name,role,area,start_time,end_time,break_minutes,hourly_cost,source
MADNUM,2026-06-03,Ana Pérez,Cocina,Comida,10:00,18:00,30,11.50,Factorial
MADNUM,2026-06-03,Carlos Ruiz,Sala,Cena,18:00,00:00,30,10.80,Factorial
MADNUM,2026-06-03,Lucía Vega,Manager,All day,09:00,17:00,30,18.00,Factorial`

const SAMPLE_VENTAS = `site_id,date,timeslot_start,timeslot_end,channel,sales_net,covers,tickets,source
MADNUM,2026-06-03,12:00,13:00,Sala,420.80,28,18,POS
MADNUM,2026-06-03,13:00,14:00,Sala,1280.50,62,38,POS
MADNUM,2026-06-03,14:00,15:00,Sala,840.40,40,24,POS`

export default function TurnosPage() {
  const [tab, setTab] = useState<'turnos' | 'ventas'>('turnos')
  const [csvText, setCsvText] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const availableFields = tab === 'turnos' ? FIELDS_TURNOS : FIELDS_VENTAS

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter(l => l.trim())
    if (lines.length === 0) return
    const heads = lines[0].split(',').map(s => s.trim())
    const dataRows = lines.slice(1).map(line => {
      const cols = line.split(',').map(s => s.trim())
      const obj: Record<string, string> = {}
      heads.forEach((h, i) => { obj[h] = cols[i] || '' })
      return obj
    })
    setHeaders(heads)
    setRows(dataRows)
    // Auto-mapping: si el header coincide con un field, mapearlo
    const autoMap: Record<string, string> = {}
    for (const h of heads) {
      if (availableFields.includes(h)) autoMap[h] = h
      else autoMap[h] = '__skip__'
    }
    setMapping(autoMap)
  }

  useEffect(() => {
    if (csvText) parseCsv(csvText)
  }, [tab])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    const text = await f.text()
    setCsvText(text)
    parseCsv(text)
    e.target.value = ''
  }

  async function commit() {
    setLoading(true); setResult(null)
    const res = await fetch('/api/labor/import-csv', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: tab === 'turnos' ? 'turnos' : 'ventas_franja', rows, mapping }),
    })
    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  function loadSample() {
    const text = tab === 'turnos' ? SAMPLE_TURNOS : SAMPLE_VENTAS
    setCsvText(text)
    parseCsv(text)
  }

  return (
    <div style={{ padding: '32px 36px 60px', maxWidth: 1280 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.2em', color: tk.appleDeep, textTransform: 'uppercase', margin: '0 0 8px' }}>
          LABOR COST · HORARIOS PLAN
        </p>
        <h1 style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 36, lineHeight: 1.0, letterSpacing: '-0.02em', margin: '0 0 6px', color: tk.iron }}>
          Importa horarios y ventas por franja
        </h1>
        <p style={{ fontFamily: ff.mono, fontSize: 12.5, color: tk.iron60, margin: 0 }}>
          CSV/Excel exportado de Factorial, Sesame, POS o un Excel manual. Mapea columnas y carga.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, border: `1.5px solid ${tk.iron}`, marginBottom: 18, width: 'fit-content' }}>
        {(['turnos', 'ventas'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setHeaders([]); setRows([]); setResult(null) }}
            style={{
              padding: '9px 18px',
              background: tab === t ? tk.iron : tk.paper,
              color: tab === t ? tk.cream : tk.iron,
              border: 'none', cursor: 'pointer',
              fontFamily: ff.mono, fontSize: 11, letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              borderLeft: t !== 'turnos' ? `1.5px solid ${tk.iron}` : 'none',
            }}
          >
            {t === 'turnos' ? 'Turnos (plan)' : 'Ventas por franja'}
          </button>
        ))}
      </div>

      {/* Upload area */}
      <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, padding: 24, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <button onClick={() => fileRef.current?.click()} style={btnPrimary}>SUBIR CSV/EXCEL</button>
          <button onClick={loadSample} style={btnGhost}>Probar con plantilla de ejemplo</button>
          <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: 'none' }} onChange={onFile} />
        </div>
        <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: '0 0 8px' }}>
          Campos esperados: {availableFields.join(', ')}
        </p>
        <textarea
          value={csvText}
          onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value) }}
          placeholder="O pega aquí tu CSV…"
          style={{
            width: '100%', minHeight: 110, padding: 12, fontFamily: ff.mono, fontSize: 11.5,
            border: `1.5px solid ${tk.iron20}`, background: tk.cream, color: tk.iron, outline: 'none',
            resize: 'vertical' as const, lineHeight: 1.5,
          }}
        />
      </div>

      {headers.length > 0 && (
        <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 18 }}>
          <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: tk.iron }}>
            Mapping de columnas · {rows.length} filas detectadas
          </div>
          <div style={{ padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: ff.mono, fontSize: 11.5 }}>
              <thead><tr>
                <th style={thStyle}>Columna CSV</th>
                <th style={thStyle}>→ mapear a campo</th>
                <th style={thStyle}>Ejemplo (primera fila)</th>
              </tr></thead>
              <tbody>
                {headers.map(h => (
                  <tr key={h} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                    <td style={tdStyle}><strong>{h}</strong></td>
                    <td style={tdStyle}>
                      <select
                        value={mapping[h] || '__skip__'}
                        onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                        style={{
                          padding: '5px 8px', fontFamily: ff.mono, fontSize: 11,
                          border: `1px solid ${tk.iron20}`, background: tk.cream, color: tk.iron,
                        }}
                      >
                        <option value="__skip__">— ignorar —</option>
                        {availableFields.map(f => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </td>
                    <td style={{ ...tdStyle, color: tk.iron60 }}>{rows[0]?.[h] || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={commit} disabled={loading || rows.length === 0} style={btnPrimary}>
                {loading ? 'CARGANDO…' : `Importar ${rows.length} filas →`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview de las primeras filas mapeadas */}
      {rows.length > 0 && (
        <div style={{ background: tk.paper, border: `1.5px solid ${tk.iron}`, marginBottom: 18, overflowX: 'auto' as const }}>
          <div style={{ padding: '10px 16px', borderBottom: `1.5px solid ${tk.iron20}`, fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: tk.iron }}>
            Preview · primeras 5 filas
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' as const, fontFamily: ff.mono, fontSize: 11 }}>
            <thead><tr>{headers.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${tk.iron20}` }}>
                  {headers.map(h => <td key={h} style={tdStyle}>{r[h]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div style={{
          background: result.errors?.length ? tk.claySoft : tk.appleSoft,
          border: `1.5px solid ${result.errors?.length ? tk.clay : tk.appleDeep}`,
          padding: '14px 18px',
        }}>
          <p style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 14, margin: 0, color: tk.iron }}>
            {result.inserted} de {result.total} filas importadas
          </p>
          {result.errors?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.clay, margin: '0 0 4px' }}>
                {result.errors.length} fila{result.errors.length !== 1 ? 's' : ''} con errores:
              </p>
              <ul style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, margin: 0, paddingLeft: 16 }}>
                {result.errors.slice(0, 5).map((e: any, i: number) => (
                  <li key={i}>Fila {e.row}: {e.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '8px 12px', textAlign: 'left' as const, fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' as const, fontWeight: 400, background: tk.creamSoft, borderBottom: `1px solid ${tk.iron20}` }
const tdStyle: React.CSSProperties = { padding: '7px 12px', color: tk.iron, fontFamily: ff.mono, fontSize: 11 }
const btnPrimary: React.CSSProperties = { padding: '9px 18px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.08em', cursor: 'pointer' }
const btnGhost: React.CSSProperties = { padding: '9px 18px', background: tk.paper, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.08em', cursor: 'pointer' }
