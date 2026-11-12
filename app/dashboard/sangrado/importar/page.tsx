'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { eur } from '@/lib/format'
import { Btn, Input, Note, Page, Panel, Select, Table, Td, Tr } from '@/components/ui'

function loadXLSX(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).XLSX) return resolve((window as any).XLSX)
    const s = document.createElement('script')
    s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js'
    s.onload = () => (window as any).XLSX ? resolve((window as any).XLSX) : reject(new Error('No se pudo cargar el lector de Excel'))
    s.onerror = () => reject(new Error('No se pudo cargar el lector de Excel'))
    document.head.appendChild(s)
  })
}
const F: Record<string, number> = { kg: 1, g: 0.001, mg: 0.000001, l: 1, cl: 0.01, ml: 0.001, ud: 1, docena: 12 }
const lineCost = (l: any) => { const q = l.grossQty ?? l.netQty; if (q == null || l.effectiveCost == null) return null; const u = (l.unit ?? '').toLowerCase(), b = (l.ingredientUnit ?? u).toLowerCase(); const f = F[u] != null && F[b] != null ? F[u] / F[b] : 1; return q * f * l.effectiveCost }

export default function ImportarRecetasPage() {
  const [ings, setIngs] = useState<any[]>([])
  const [file, setFile] = useState('')
  const [busy, setBusy] = useState<'' | 'parse' | 'save'>('')
  const [recipes, setRecipes] = useState<any[]>([])
  const [error, setError] = useState('')
  const [result, setResult] = useState<any>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => { api.get('/api/ingredients').then(r => setIngs(r.data)).catch(() => {}) }, [])

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f) return
    setError(''); setResult(null); setRecipes([]); setBusy('parse'); setFile(f.name)
    try {
      const XLSX = await loadXLSX()
      const wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' })
      const sheets = wb.SheetNames.map((name: string) => ({ name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: true }) }))
      const d = await api.post('/api/recipes/import/parse', { sheets })
      setRecipes(d.recipes)
    } catch (err) { setError(errorMessage(err)) }
    setBusy('')
  }
  const editR = (ri: number, patch: any) => setRecipes(rs => rs.map((r, i) => i === ri ? { ...r, ...patch } : r))
  const editL = (ri: number, li: number, patch: any) => setRecipes(rs => rs.map((r, i) => i !== ri ? r : { ...r, lines: r.lines.map((l: any, j: number) => j === li ? { ...l, ...patch } : l) }))
  function setTarget(ri: number, li: number, v: string) {
    const l = recipes[ri].lines[li]
    if (v === '__create__') return editL(ri, li, { action: 'create', ingredientId: null, ingredientName: null, ingredientUnit: null, effectiveCost: l.price ?? null, match: null, unitMismatch: false, hint: null })
    if (v === '__skip__') return editL(ri, li, { action: 'skip' })
    const ing = ings.find(i => String(i.id) === v)
    editL(ri, li, { action: 'link', ingredientId: ing?.id ?? null, ingredientName: ing?.name ?? null, ingredientUnit: ing?.base_unit ?? null, effectiveCost: l.price ?? ing?.cost ?? null, match: 'manual', unitMismatch: false, hint: null })
  }
  async function save() {
    setBusy('save'); setError('')
    try {
      const r = await api.post('/api/recipes/import/commit', { recipes: recipes.map(r => ({ name: r.name, code: r.code, family: r.family, portions: r.portions, gramsPerPortion: r.gramsPerPortion, salePrice: r.salePrice, description: r.description, allergens: r.allergens, conservation: r.conservation, regeneration: r.regeneration, notes: r.notes, procedure: r.procedure,
        lines: r.lines.map((l: any) => ({ action: l.action, name: l.name, unit: l.unit, grossQty: l.grossQty, netQty: l.netQty, wastePct: l.wastePct, note: l.note, supplier: l.supplier, ingredientId: l.ingredientId, effectiveCost: l.effectiveCost })) })) })
      setResult(r); setRecipes([])
    } catch (e) { setError(errorMessage(e)) }
    setBusy('')
  }
  const totalLines = recipes.reduce((s, r) => s + r.lines.filter((l: any) => l.action !== 'skip').length, 0)

  return (
    <Page back={{ href: '/dashboard/sangrado', label: 'Escandallos' }} eyebrow="Escandallos · Importar recetario" title="Sube tu recetario en Excel" subtitle="Cada hoja se lee como una receta: ingredientes, cantidades, merma, rendimiento y procedimiento. Antes de guardar revisas todo y completas los precios que falten.">
      <Panel><div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <Btn kind="ghost" onClick={() => fileRef.current?.click()}>{file ? 'CAMBIAR ARCHIVO' : 'SELECCIONAR EXCEL'}</Btn>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={onFile} />
        {file && <span style={{ fontFamily: ff.mono, fontSize: 12 }}>{file}</span>}
        {busy === 'parse' && <span style={{ fontFamily: ff.mono, fontSize: 12, color: tk.appleDeep }}>Analizando…</span>}
      </div></Panel>
      {error && <Note tone="crit">{error}</Note>}
      {result && (
        <Note tone="ok"><strong>✓ Importación completada.</strong> {result.recipes} receta(s) · {result.lines} líneas · {result.ingredientsCreated} ingrediente(s) nuevos.
          {result.details.some((d: any) => d.skipped.length) && <div style={{ marginTop: 6 }}>Líneas omitidas: {result.details.flatMap((d: any) => d.skipped.map((s: any) => `${s.name} (${s.reason})`)).join(' · ')}</div>}
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}><Btn href="/dashboard/sangrado">VER ESCANDALLOS →</Btn>{result.ingredientsCreated > 0 && <Btn kind="ghost" href="/dashboard/ingredientes?filtro=sin_coste">COMPLETAR INGREDIENTES NUEVOS →</Btn>}</div>
        </Note>
      )}
      {recipes.map((r, ri) => (
        <Panel key={ri} title={`Hoja «${r.sheet}» · revisión antes de guardar`}>
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, borderBottom: `1px solid ${tk.iron20}` }}>
            <div style={{ gridColumn: 'span 2' }}><div style={lab}>Nombre de la receta</div><Input value={r.name || ''} onChange={e => editR(ri, { name: e.target.value })} /></div>
            <div><div style={lab}>Código</div><Input value={r.code || ''} onChange={e => editR(ri, { code: e.target.value })} /></div>
            <div><div style={lab}>Familia</div><Input value={r.family || ''} onChange={e => editR(ri, { family: e.target.value })} /></div>
            <div><div style={lab}>Porciones</div><Input type="number" value={r.portions ?? ''} onChange={e => editR(ri, { portions: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            <div><div style={lab}>PVP por porción (€)</div><Input type="number" step="0.01" value={r.salePrice ?? ''} onChange={e => editR(ri, { salePrice: e.target.value === '' ? null : Number(e.target.value) })} /></div>
          </div>
          {r.warnings?.length > 0 && <div style={{ background: tk.claySoft, borderBottom: `1px solid ${tk.iron20}`, padding: '10px 16px', fontFamily: ff.mono, fontSize: 11, color: tk.clay }}>{r.warnings.map((a: string, i: number) => <div key={i}>· {a}</div>)}</div>}
          <div style={{ padding: '10px 16px', display: 'flex', gap: 16, flexWrap: 'wrap', fontFamily: ff.mono, fontSize: 11, color: tk.iron60, borderBottom: `1px solid ${tk.iron20}` }}>
            <span>{r.summary.lines} ingredientes</span><span style={{ color: tk.appleDeep }}>{r.summary.toLink} ya en el catálogo</span><span style={{ color: tk.clay }}>{r.summary.toCreate} se crearán</span>
            {r.summary.partial > 0 && <span style={{ color: tk.clay }}>{r.summary.partial} por coincidencia aproximada</span>}{r.summary.unitMismatch > 0 && <span style={{ color: tk.terra }}>{r.summary.unitMismatch} con unidades incompatibles</span>}{r.procedure?.length > 0 && <span>{r.procedure.length} pasos</span>}
          </div>
          <Table head={['Ingrediente (Excel)', 'Cant.', 'Ud.', 'Merma', 'Destino en el catálogo', '€/ud', 'Coste línea']} right={[1, 3, 5, 6]}>
            {r.lines.map((l: any, li: number) => {
              const c = lineCost(l)
              return (
                <Tr key={li}>
                  <Td style={{ opacity: l.action === 'skip' ? 0.4 : 1 }}>{l.name}{l.note && <div style={{ color: tk.iron40, fontSize: 10 }}>{l.note}</div>}</Td>
                  <Td right>{l.grossQty ?? l.netQty ?? '—'}</Td><Td style={{ color: l.unitRecognized ? tk.iron : tk.terra }}>{l.unit || '—'}</Td><Td right>{l.wastePct != null ? `${l.wastePct}%` : '—'}</Td>
                  <Td style={{ minWidth: 240 }}>
                    <Select value={l.action === 'create' ? '__create__' : l.action === 'skip' ? '__skip__' : String(l.ingredientId ?? '')} onChange={e => setTarget(ri, li, e.target.value)} style={{ padding: '5px 8px', fontSize: 11, borderColor: l.match === 'partial' ? tk.clay : tk.iron20 }}>
                      <option value="__create__">+ Crear «{l.name}» como ingrediente nuevo</option><option value="__skip__">— No importar esta línea</option>
                      {ings.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </Select>
                    {l.match === 'partial' && l.action === 'link' && <div style={{ color: tk.clay, fontSize: 10, marginTop: 3 }}>Coincidencia aproximada: confirma que es el ingrediente correcto</div>}
                    {l.hint && l.action !== 'skip' && <div style={{ color: tk.terra, fontSize: 10, marginTop: 3 }}>⚠ {l.hint}</div>}
                  </Td>
                  <Td right><Input type="number" step="0.0001" placeholder="—" value={l.effectiveCost ?? ''} onChange={e => editL(ri, li, { effectiveCost: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 84, textAlign: 'right', padding: '4px 6px' }} /></Td>
                  <Td right style={{ fontWeight: 600 }}>{c != null ? eur(c) : '—'}</Td>
                </Tr>
              )
            })}
          </Table>
        </Panel>
      ))}
      {recipes.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <p style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60, margin: 0 }}>Se guardarán {recipes.length} receta(s) con {totalLines} líneas. Los ingredientes nuevos entran al catálogo en su unidad de compra.</p>
          <Btn onClick={save} disabled={busy !== ''}>{busy === 'save' ? 'GUARDANDO…' : 'CONFIRMAR E IMPORTAR →'}</Btn>
        </div>
      )}
      <p style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron40, marginTop: 20 }}><Link href="/dashboard/sangrado" style={{ color: tk.iron60 }}>← Volver a escandallos</Link></p>
    </Page>
  )
}
const lab: React.CSSProperties = { fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }
