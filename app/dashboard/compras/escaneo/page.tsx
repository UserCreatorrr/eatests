'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { api, errorMessage } from '@/lib/api'
import { CATEGORIAS_INGREDIENTE } from '@/lib/catalog'
import { tk, ff } from '@/lib/design'
import { eur, fecha } from '@/lib/format'
import { IVA_OPTIONS, UNIT_OPTIONS } from '@/lib/units-ui'
import { Btn, Delta, Field, Input, Note, Page, Panel, Select, Table, Td, Tr } from '@/components/ui'

type Line = {
  description: string; qty: number | null; unit: string | null; unitRecognized: boolean; unitPrice: number | null; lineTotal: number | null; vatRate: number | null
  ingredientId: number | null; ingredientName: string | null; ingredientUnit: string | null; currentCost: number | null; match: string | null; unitPriceInBase: number | null; changePct: number | null; unitMismatch: boolean
  excluded?: boolean; create?: { category: string; vatRate: number | null; warehouseId: number | null } | null
}

export default function EscaneoPage() {
  const [kind, setKind] = useState<'delivery_note' | 'invoice'>('delivery_note')
  const [image, setImage] = useState<string | null>(null)
  const [scan, setScan] = useState<any>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [header, setHeader] = useState<any>(null)
  const [ings, setIngs] = useState<any[]>([])
  const [suppliers, setSuppliers] = useState<any[]>([])
  const [warehouses, setWarehouses] = useState<any[]>([])
  const [applyPrices, setApplyPrices] = useState(true)
  const [createSupplier, setCreateSupplier] = useState(false)
  const [busy, setBusy] = useState<'' | 'scan' | 'save'>('')
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { Promise.all([api.get('/api/ingredients'), api.get('/api/suppliers'), api.get('/api/warehouses')]).then(([i, s, w]) => { setIngs(i.data); setSuppliers(s.data); setWarehouses(w.data) }).catch(() => {}) }, [])

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const r = new FileReader(); r.onload = () => { setImage(r.result as string); setScan(null); setResult(null); setMsg('') }; r.readAsDataURL(f); e.target.value = ''
  }

  async function doScan() {
    if (!image) return
    setBusy('scan'); setMsg(''); setResult(null)
    try {
      const s = await api.post('/api/documents/scan', { image, kind })
      setScan(s); setLines(s.lines.map((l: Line) => ({ ...l, unit: l.unitRecognized ? l.unit : null }))); setHeader({ ...s.header }); setCreateSupplier(s.warnings.newSupplier)
    } catch (e) { setMsg(errorMessage(e)) }
    setBusy('')
  }

  const setL = (i: number, patch: Partial<Line>) => setLines(ls => ls.map((l, j) => j === i ? { ...l, ...patch } : l))
  function remap(i: number, v: string) {
    if (v === '__create__') { setL(i, { ingredientId: null, ingredientName: null, create: { category: '', vatRate: lines[i].vatRate ?? 10, warehouseId: null }, changePct: null }); return }
    const ing = ings.find(x => String(x.id) === v)
    setL(i, { ingredientId: ing?.id ?? null, ingredientName: ing?.name ?? null, ingredientUnit: ing?.base_unit ?? null, currentCost: ing?.cost ?? null, create: null, changePct: null })
  }

  async function save() {
    setBusy('save'); setMsg('')
    try {
      const r = await api.post('/api/documents/commit', {
        kind, image, applyPrices, createSupplier,
        header: { supplierId: header.supplierId, vendor: header.vendor, vendorTaxId: header.vendorTaxId, number: header.number, date: header.date, dueDate: header.dueDate, base: header.base, vat: header.vat, total: header.total },
        lines: lines.map(l => ({ excluded: !!l.excluded, description: l.description, qty: l.qty, unit: l.unit, unitPrice: l.unitPrice, lineTotal: l.lineTotal, vatRate: l.vatRate, ingredientId: l.ingredientId, create: l.create ? { category: l.create.category || null, vatRate: l.create.vatRate, warehouseId: l.create.warehouseId } : null })),
      })
      setResult(r)
    } catch (e) { setMsg(errorMessage(e)) }
    setBusy('')
  }

  const unresolved = lines.filter(l => !l.excluded && !l.ingredientId && !l.create).length
  const noUnit = lines.filter(l => !l.excluded && !l.unit).length
  const sumLines = Math.round(lines.filter(l => !l.excluded).reduce((s, l) => s + (l.lineTotal ?? 0), 0) * 100) / 100
  const gap = header && header.base != null && header.vat != null && header.total != null ? Math.round((header.base + header.vat - header.total) * 100) / 100 : null

  return (
    <Page back={{ href: '/dashboard/compras', label: 'Compras' }} eyebrow="Food cost · Escaneo + validación" title="Sube un documento y valídalo" subtitle="Foto → la IA extrae proveedor y líneas → tú confirmas el mapeo → se guarda y, si todo está resuelto, se valida: precios, stock y escandallos afectados.">
      <Panel>
        <div style={{ padding: 18, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: `1.5px solid ${tk.iron}` }}>
            {(['delivery_note', 'invoice'] as const).map(t => <button key={t} onClick={() => setKind(t)} style={{ padding: '7px 14px', background: kind === t ? tk.iron : tk.paper, color: kind === t ? tk.cream : tk.iron, border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t === 'delivery_note' ? 'Albarán' : 'Factura'}</button>)}
          </div>
          <Btn kind="ghost" onClick={() => fileRef.current?.click()}>{image ? 'CAMBIAR IMAGEN' : 'SUBIR FOTO'}</Btn>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onFile} />
          {image && <img src={image} alt="" style={{ height: 44, border: `1.5px solid ${tk.iron20}` }} />}
          <Btn onClick={doScan} disabled={!image || busy !== ''}>{busy === 'scan' ? 'ANALIZANDO…' : 'EXTRAER Y VALIDAR →'}</Btn>
        </div>
      </Panel>
      {msg && <Note tone="crit">{msg}</Note>}

      {scan && header && !result && (
        <>
          <Panel title="Cabecera detectada">
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <Field label="Proveedor" hint={header.supplierId ? `↳ ${scan.header.supplierName}` : header.vendor ? 'no está en el catálogo' : undefined}>
                <Select value={header.supplierId ?? ''} onChange={e => setHeader((h: any) => ({ ...h, supplierId: e.target.value ? Number(e.target.value) : null }))}><option value="">{header.vendor ? `${header.vendor} (nuevo)` : '— elegir —'}</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
              </Field>
              <Field label="Nº documento"><Input value={header.number ?? ''} onChange={e => setHeader((h: any) => ({ ...h, number: e.target.value }))} /></Field>
              <Field label="Fecha"><Input type="date" value={header.date ?? ''} onChange={e => setHeader((h: any) => ({ ...h, date: e.target.value }))} /></Field>
              {kind === 'invoice' ? <Field label="Vencimiento"><Input type="date" value={header.dueDate ?? ''} onChange={e => setHeader((h: any) => ({ ...h, dueDate: e.target.value }))} /></Field> : <Field label="NIF"><Input value={header.vendorTaxId ?? ''} onChange={e => setHeader((h: any) => ({ ...h, vendorTaxId: e.target.value }))} /></Field>}
              <Field label="Base (€)"><Input type="number" step="0.01" value={header.base ?? ''} onChange={e => setHeader((h: any) => ({ ...h, base: e.target.value === '' ? null : Number(e.target.value) }))} /></Field>
              <Field label="IVA (€)"><Input type="number" step="0.01" value={header.vat ?? ''} onChange={e => setHeader((h: any) => ({ ...h, vat: e.target.value === '' ? null : Number(e.target.value) }))} /></Field>
              <Field label="Total (€)"><Input type="number" step="0.01" value={header.total ?? ''} onChange={e => setHeader((h: any) => ({ ...h, total: e.target.value === '' ? null : Number(e.target.value) }))} /></Field>
              <div style={{ fontFamily: ff.mono, fontSize: 11, alignSelf: 'end', color: gap != null && Math.abs(gap) > 0.02 ? tk.terra : tk.appleDeep }}>{gap == null ? 'Cuadre: faltan importes' : Math.abs(gap) > 0.02 ? `⚠ Base + IVA − total = ${eur(gap)}` : '✓ Base + IVA = total'}<div style={{ color: tk.iron60 }}>Líneas suman {eur(sumLines)}</div></div>
            </div>
          </Panel>

          {(unresolved > 0 || noUnit > 0 || scan.warnings.priceChanges > 0) && (
            <Note tone="warn">{[unresolved > 0 && `${unresolved} línea(s) sin ingrediente: mapea o crea; si quedan así el documento se guarda en revisión`, noUnit > 0 && `${noUnit} línea(s) sin unidad reconocida`, scan.warnings.priceChanges > 0 && `${scan.warnings.priceChanges} cambio(s) de precio detectados`].filter(Boolean).join(' · ')}</Note>
          )}

          <Panel title="Líneas extraídas · valida el mapeo">
            <Table head={['Producto detectado', 'Cant.', 'Ud.', '€/ud', 'IVA', 'Ingrediente del catálogo', 'Cambio', '']} right={[1, 3, 6]}>
              {lines.map((l, i) => (
                <Tr key={i}>
                  <Td style={{ opacity: l.excluded ? 0.4 : 1 }}>{l.description}</Td>
                  <Td right><Input type="number" step="any" value={l.qty ?? ''} onChange={e => setL(i, { qty: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 80, padding: '4px 6px', textAlign: 'right' }} /></Td>
                  <Td><Select value={l.unit ?? ''} onChange={e => setL(i, { unit: e.target.value || null })} style={{ width: 80, padding: '4px 6px', borderColor: l.unit ? tk.iron20 : tk.clay }}><option value="">—</option>{UNIT_OPTIONS.map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select></Td>
                  <Td right><Input type="number" step="0.0001" value={l.unitPrice ?? ''} onChange={e => setL(i, { unitPrice: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 90, padding: '4px 6px', textAlign: 'right' }} /></Td>
                  <Td><Select value={l.vatRate ?? ''} onChange={e => setL(i, { vatRate: e.target.value === '' ? null : Number(e.target.value) })} style={{ width: 70, padding: '4px 6px', borderColor: l.vatRate == null ? tk.clay : tk.iron20 }}><option value="">—</option>{IVA_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}</Select></Td>
                  <Td style={{ minWidth: 220 }}>
                    <Select value={l.create ? '__create__' : (l.ingredientId ?? '')} onChange={e => remap(i, e.target.value)} style={{ padding: '4px 6px', borderColor: l.ingredientId ? (l.match === 'partial' ? tk.clay : tk.iron20) : l.create ? tk.appleDeep : tk.terra }}>
                      <option value="">— sin mapear —</option>
                      <option value="__create__">+ Crear «{l.description.slice(0, 40)}» como ingrediente nuevo</option>
                      {ings.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                    </Select>
                    {l.match === 'partial' && l.ingredientId && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.clay, marginTop: 2 }}>coincidencia aproximada: confirma</div>}
                    {l.unitMismatch && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.terra, marginTop: 2 }}>unidad incompatible con el ingrediente ({l.ingredientUnit})</div>}
                    {l.create && (
                      <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
                        <Select value={l.create.category} onChange={e => setL(i, { create: { ...l.create!, category: e.target.value } })} style={{ padding: '3px 6px', fontSize: 10 }}><option value="">Categoría</option>{CATEGORIAS_INGREDIENTE.map(c => <option key={c} value={c}>{c}</option>)}</Select>
                        <Select value={l.create.warehouseId ?? ''} onChange={e => setL(i, { create: { ...l.create!, warehouseId: e.target.value ? Number(e.target.value) : null } })} style={{ padding: '3px 6px', fontSize: 10 }}><option value="">Almacén</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</Select>
                      </div>
                    )}
                  </Td>
                  <Td right><Delta pct={l.changePct} />{l.unitPriceInBase != null && l.currentCost != null && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40 }}>{eur(l.currentCost)} → {eur(l.unitPriceInBase)}/{l.ingredientUnit}</div>}</Td>
                  <Td right><button onClick={() => setL(i, { excluded: !l.excluded })} title={l.excluded ? 'Incluir' : 'Excluir'} style={{ padding: '2px 8px', background: l.excluded ? tk.creamSoft : tk.terraSoft, border: `1px solid ${l.excluded ? tk.iron20 : tk.terra}`, color: l.excluded ? tk.iron60 : tk.terra, cursor: 'pointer', fontFamily: ff.mono, fontSize: 11 }}>{l.excluded ? '+' : '×'}</button></Td>
                </Tr>
              ))}
              {lines.length === 0 && <Tr><Td colSpan={8}><div style={{ padding: 20, textAlign: 'center', color: tk.iron40, fontFamily: ff.mono, fontSize: 11 }}>No se detectaron líneas.</div></Td></Tr>}
            </Table>
          </Panel>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', gap: 18, fontFamily: ff.mono, fontSize: 11.5 }}>
              <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={applyPrices} onChange={e => setApplyPrices(e.target.checked)} /> Actualizar costes de los ingredientes</label>
              {!header.supplierId && header.vendor && <label style={{ display: 'flex', gap: 6, cursor: 'pointer' }}><input type="checkbox" checked={createSupplier} onChange={e => setCreateSupplier(e.target.checked)} /> Crear proveedor «{header.vendor}»</label>}
            </div>
            <Btn onClick={save} disabled={busy !== '' || (!header.supplierId && !createSupplier)}>{busy === 'save' ? 'GUARDANDO…' : `GUARDAR ${kind === 'invoice' ? 'FACTURA' : 'ALBARÁN'} →`}</Btn>
          </div>
        </>
      )}

      {result && (
        <Note tone={result.status === 'review' ? 'warn' : 'ok'}>
          ✓ Guardado <strong>{result.number}</strong> · {result.lines} líneas{result.ingredientsCreated ? ` · ${result.ingredientsCreated} ingrediente(s) nuevo(s)` : ''}
          {result.validation ? ` · ${result.validation.pricesUpdated} precio(s) actualizados · ${result.validation.stockMovements} entrada(s) de stock${result.validation.affectedRecipes.length ? ` · ${result.validation.affectedRecipes.length} escandallo(s) afectado(s)` : ''}` : ''}
          {result.status === 'review' && <strong> · en REVISIÓN: {result.pendingLines} línea(s) sin mapear no actualizan costes ni stock.</strong>}
          {' '}<Link href={result.kind === 'invoice' && result.invoiceId ? `/dashboard/compras/facturas/${result.invoiceId}` : `/dashboard/compras/albaranes/${result.deliveryNoteId}`} style={{ color: tk.appleDeep, fontWeight: 600 }}>Ver documento →</Link>
          {' · '}<button onClick={() => { setImage(null); setScan(null); setResult(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: ff.mono, fontSize: 11.5, color: tk.appleDeep, fontWeight: 600, padding: 0 }}>Escanear otro</button>
          <div style={{ fontSize: 10.5, color: tk.iron60, marginTop: 4 }}>{fecha(header?.date)}</div>
        </Note>
      )}
    </Page>
  )
}
