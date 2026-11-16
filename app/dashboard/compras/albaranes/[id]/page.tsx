'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_ALBARAN, eur, fecha, num } from '@/lib/format'
import { IVA_OPTIONS, UNIT_OPTIONS, unitsCompatibleWith } from '@/lib/units-ui'
import { Badge, Btn, Delta, Empty, Field, Input, Loading, Modal, Note, Page, Panel, Select, Table, Td, Tr } from '@/components/ui'

const TONE: Record<string, 'ok' | 'warn' | 'crit' | 'neutral' | 'info'> = { draft: 'neutral', review: 'warn', validated: 'ok', invoiced: 'info' }
const EMPTY_LINE = { ingredientId: '', description: '', qty: '', unit: 'kg', unitPrice: '', lineTotal: '', vatRate: '' }

export default function AlbaranDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [head, setHead] = useState<null | Record<string, string>>(null)
  const [d, setD] = useState<any>(null)
  const [ings, setIngs] = useState<any[]>([])
  const [err, setErr] = useState('')
  const [line, setLine] = useState({ ...EMPTY_LINE })
  const [editing, setEditing] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [applyPrices, setApplyPrices] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    try { const [n, i] = await Promise.all([api.get(`/api/delivery-notes/${id}`), api.get('/api/ingredients')]); setD(n); setIngs(i.data) } catch (e) { setErr(errorMessage(e)) }
  }, [id])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); setMsg(''); try { await fn(); await load() } catch (e) { setMsg(errorMessage(e)) } setBusy(false) }
  const body = (l: typeof line) => ({ ingredientId: l.ingredientId ? Number(l.ingredientId) : null, description: l.description || ings.find(x => String(x.id) === l.ingredientId)?.name || '', qty: l.qty === '' ? null : Number(l.qty), unit: l.unit || null, unitPrice: l.unitPrice === '' ? null : Number(l.unitPrice), lineTotal: l.lineTotal === '' ? null : Number(l.lineTotal), vatRate: l.vatRate === '' ? null : Number(l.vatRate) })

  function pickIng(v: string) { const ing = ings.find(x => String(x.id) === v); setLine(l => ({ ...l, ingredientId: v, description: ing?.name ?? l.description, unit: ing?.base_unit ?? l.unit, vatRate: l.vatRate || (ing?.vat_rate != null ? String(ing.vat_rate) : '') })) }
  const addLine = () => run(async () => { await api.post(`/api/delivery-notes/${id}/lines`, body(line)); setLine({ ...EMPTY_LINE }) })
  const saveLine = () => run(async () => { await api.patch(`/api/delivery-notes/${id}/lines/${editing}`, body(line)); setEditing(null); setLine({ ...EMPTY_LINE }) })
  const removeLine = (lid: number) => run(() => api.del(`/api/delivery-notes/${id}/lines/${lid}`))
  const validate = (force = false) => run(async () => { setResult(await api.post(`/api/delivery-notes/${id}/validate`, { applyPrices, force })) })
  const toReview = () => run(() => api.post(`/api/delivery-notes/${id}/status`, { status: 'review' }))

  const saveHeader = () => run(async () => {
    const h = head!
    await api.patch(`/api/delivery-notes/${id}`, { number: h.number, deliveryDate: h.deliveryDate, base: h.base === '' ? null : Number(h.base), vat: h.vat === '' ? null : Number(h.vat), total: h.total === '' ? null : Number(h.total) })
    setHead(null)
  })
  async function remove() {
    if (!confirm(`¿Borrar el albarán ${d.number}? Úsalo solo para duplicados o escaneos erróneos: no ha movido precios ni stock.`)) return
    try { await api.del(`/api/delivery-notes/${id}`); router.push('/dashboard/compras/albaranes') } catch (e) { setMsg(errorMessage(e)) }
  }

  function startEdit(l: any) { setEditing(l.id); setLine({ ingredientId: l.ingredient_id ? String(l.ingredient_id) : '', description: l.description, qty: l.qty != null ? String(l.qty) : '', unit: l.unit ?? 'kg', unitPrice: l.unit_price != null ? String(l.unit_price) : '', lineTotal: l.line_total_cents != null ? String(l.line_total_cents / 100) : '', vatRate: l.vat_rate != null ? String(l.vat_rate) : '' }) }

  if (err) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>{err}</div>
  if (!d) return <Loading />
  const editable = d.status === 'draft' || d.status === 'review'
  const linesSum = d.lines_total_cents / 100, base = d.base_cents / 100
  const gap = Math.round((linesSum - base) * 100) / 100
  const unmapped = d.lines.filter((l: any) => !l.ingredient_id).length
  const lineTotalPreview = line.qty && line.unitPrice ? Math.round(Number(line.qty) * Number(line.unitPrice) * 100) / 100 : null

  return (
    <Page back={{ href: '/dashboard/compras/albaranes', label: 'Albaranes' }} eyebrow="Albarán de compra" title={d.number}
      subtitle={<><Link href={`/dashboard/proveedores/${d.supplier_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{d.supplier_name}</Link> · {fecha(d.delivery_date)}{d.purchase_order_id ? <> · de <Link href={`/dashboard/compras/pedidos/${d.purchase_order_id}`} style={{ color: tk.appleDeep, textDecoration: 'none' }}>pedido</Link></> : ''}{d.invoice_id ? <> · en <Link href={`/dashboard/compras/facturas/${d.invoice_id}`} style={{ color: tk.appleDeep, textDecoration: 'none' }}>factura</Link></> : ''}</>}
      actions={<>
        <Badge tone={TONE[d.status]}>{ESTADO_ALBARAN[d.status]}</Badge>
        {editable && <label style={{ fontFamily: ff.mono, fontSize: 11, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={applyPrices} onChange={e => setApplyPrices(e.target.checked)} /> actualizar costes</label>}
        {editable && <Btn onClick={() => validate(false)} disabled={busy || !d.lines.length || unmapped > 0}>VALIDAR →</Btn>}
        {d.status === 'draft' && <Btn kind="ghost" onClick={toReview} disabled={busy}>A REVISIÓN</Btn>}
        {editable && <Btn kind="ghost" onClick={() => setHead({ number: d.number, deliveryDate: d.delivery_date, base: String(d.base_cents / 100), vat: String(d.vat_cents / 100), total: String(d.total_cents / 100) })} disabled={busy}>EDITAR CABECERA</Btn>}
        {editable && <Btn kind="danger" onClick={remove} disabled={busy}>ELIMINAR</Btn>}
      </>}>
      {head && (
        <Modal title="Corregir cabecera del albarán" onClose={() => setHead(null)} width={480}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Nº albarán"><Input value={head.number} onChange={e => setHead(h => ({ ...h!, number: e.target.value }))} /></Field>
            <Field label="Fecha de entrega"><Input type="date" value={head.deliveryDate} onChange={e => setHead(h => ({ ...h!, deliveryDate: e.target.value }))} /></Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 12 }}>
            <Field label="Base (€)"><Input type="number" step="0.01" value={head.base} onChange={e => setHead(h => ({ ...h!, base: e.target.value }))} /></Field>
            <Field label="IVA (€)"><Input type="number" step="0.01" value={head.vat} onChange={e => setHead(h => ({ ...h!, vat: e.target.value }))} /></Field>
            <Field label="Total (€)"><Input type="number" step="0.01" value={head.total} onChange={e => setHead(h => ({ ...h!, total: e.target.value }))} /></Field>
          </div>
          {msg && <p style={{ fontFamily: ff.mono, fontSize: 12, color: tk.terra, margin: '14px 0 0' }}>{msg}</p>}
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setHead(null)}>CANCELAR</Btn><Btn onClick={saveHeader} disabled={busy || !head.number}>GUARDAR</Btn></div>
        </Modal>
      )}
      {msg && <Note tone="crit">{msg}{/no cuadra|cuadr/i.test(msg) && editable && <> <button onClick={() => validate(true)} style={{ marginLeft: 8, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, background: 'transparent', border: `1px solid ${tk.terra}`, color: tk.terra, cursor: 'pointer', padding: '2px 8px' }}>Validar de todas formas</button></>}</Note>}
      {result && (
        <Note tone="ok">✓ Validado: {result.pricesUpdated} precio(s) actualizados, {result.stockMovements} entrada(s) de stock{result.affectedRecipes.length ? `, ${result.affectedRecipes.length} escandallo(s) afectado(s): ${result.affectedRecipes.map((r: any) => r.name).join(', ')}` : ''}.
          {result.priceChanges.length > 0 && <div style={{ marginTop: 6 }}>{result.priceChanges.map((p: any) => <div key={p.ingredientId}>{p.name}: {eur(p.previous)} → {eur(p.current)} (<Delta pct={p.changedPct} />)</div>)}</div>}
        </Note>
      )}
      {editable && unmapped > 0 && <Note tone="warn">{unmapped} línea(s) sin ingrediente del catálogo. Hasta mapearlas (o crearlas en Ingredientes) no se puede validar.</Note>}
      {editable && base > 0 && Math.abs(gap) > Math.max(0.02, base * 0.01) && <Note tone="warn">Las líneas suman {eur(linesSum)} y la base del documento es {eur(base)} (diferencia {eur(gap)}). Revisa cantidades y precios antes de validar.</Note>}

      <div style={{ display: 'grid', gridTemplateColumns: d.image ? '1fr 300px' : '1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <Panel title="Importes">
            <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, fontFamily: ff.mono, fontSize: 13 }}>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Base</div>{eur(base)}</div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>IVA</div>{eur(d.vat_cents / 100)}</div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Total</div><strong>{eur(d.total_cents / 100)}</strong></div>
              <div><div style={{ fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase' }}>Suma líneas</div><span style={{ color: base > 0 && Math.abs(gap) > 0.02 ? tk.clay : tk.iron }}>{eur(linesSum)}</span></div>
            </div>
          </Panel>
          <Panel title={`Líneas · ${d.lines.length}`}>
            {d.lines.length === 0 ? <Empty>Sin líneas. Añade productos abajo.</Empty> : (
              <Table head={['Producto', 'Ingrediente', 'Cant.', '€/ud', 'IVA', 'Total', 'Cambio', '']} right={[2, 3, 5, 6]}>
                {d.lines.map((l: any) => (
                  <Tr key={l.id}>
                    <Td>{l.description}</Td>
                    <Td>{l.ingredient_id ? <Link href={`/dashboard/ingredientes/${l.ingredient_id}`} style={{ color: tk.appleDeep, textDecoration: 'none' }}>{l.ingredient_name}</Link> : <span style={{ color: tk.clay }}>sin mapear</span>}</Td>
                    <Td right>{l.qty != null ? `${num(l.qty)} ${l.unit ?? ''}` : '—'}</Td>
                    <Td right>{eur(l.unit_price)}</Td>
                    <Td style={{ color: tk.iron60 }}>{l.vat_rate != null ? `${l.vat_rate}%` : '—'}</Td>
                    <Td right style={{ fontWeight: 600 }}>{l.line_total_cents != null ? eur(l.line_total_cents / 100) : '—'}</Td>
                    <Td right><Delta pct={l.previous_unit_price && l.unit_price ? Math.round(((l.unit_price - l.previous_unit_price) / l.previous_unit_price) * 1000) / 10 : null} /></Td>
                    <Td right>{editable && <div style={{ display: 'inline-flex', gap: 4 }}><Btn small kind="ghost" onClick={() => startEdit(l)} disabled={busy}>EDITAR</Btn><Btn small kind="danger" onClick={() => removeLine(l.id)} disabled={busy}>×</Btn></div>}</Td>
                  </Tr>
                ))}
              </Table>
            )}
          </Panel>
          {editable && (
            <Panel title={editing ? 'Editar línea' : 'Añadir línea'}>
              <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '1.6fr 1.4fr 0.7fr 0.7fr 0.8fr 0.7fr 0.8fr auto', gap: 8, alignItems: 'end' }}>
                <Field label="Ingrediente"><Select value={line.ingredientId} onChange={e => pickIng(e.target.value)}><option value="">— sin mapear —</option>{ings.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field>
                <Field label="Descripción"><Input value={line.description} onChange={e => setLine(l => ({ ...l, description: e.target.value }))} /></Field>
                <Field label="Cant."><Input type="number" step="any" min={0} value={line.qty} onChange={e => setLine(l => ({ ...l, qty: e.target.value }))} /></Field>
                <Field label="Ud."><Select value={line.unit} onChange={e => setLine(l => ({ ...l, unit: e.target.value }))}>{(line.ingredientId ? unitsCompatibleWith(ings.find(x => String(x.id) === line.ingredientId)?.base_unit) : UNIT_OPTIONS).map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select></Field>
                <Field label="€/ud"><Input type="number" step="0.0001" min={0} value={line.unitPrice} onChange={e => setLine(l => ({ ...l, unitPrice: e.target.value }))} /></Field>
                <Field label="IVA"><Select value={line.vatRate} onChange={e => setLine(l => ({ ...l, vatRate: e.target.value }))}><option value="">—</option>{IVA_OPTIONS.map(v => <option key={v} value={v}>{v}%</option>)}</Select></Field>
                <Field label="Total línea" hint={lineTotalPreview != null && line.lineTotal === '' ? `≈ ${eur(lineTotalPreview)}` : undefined}><Input type="number" step="0.01" min={0} value={line.lineTotal} onChange={e => setLine(l => ({ ...l, lineTotal: e.target.value }))} placeholder={lineTotalPreview != null ? String(lineTotalPreview) : ''} /></Field>
                <div style={{ display: 'flex', gap: 6 }}>{editing ? <><Btn onClick={saveLine} disabled={busy}>GUARDAR</Btn><Btn kind="ghost" onClick={() => { setEditing(null); setLine({ ...EMPTY_LINE }) }}>✕</Btn></> : <Btn onClick={addLine} disabled={busy || !line.description && !line.ingredientId}>+</Btn>}</div>
              </div>
            </Panel>
          )}
          {(d.impact.prices.length > 0 || d.impact.movements.length > 0) && (
            <Panel title="Impacto de la validación">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                <Table head={['Precio registrado', 'Anterior', 'Nuevo']} right={[1, 2]}>{d.impact.prices.map((p: any, i: number) => <Tr key={i}><Td>{p.name}</Td><Td right>{eur(p.previous_price)}</Td><Td right style={{ fontWeight: 600 }}>{eur(p.unit_price)}</Td></Tr>)}</Table>
                <Table head={['Entrada de stock', 'Cantidad', 'Almacén']} right={[1]}>{d.impact.movements.map((m: any, i: number) => <Tr key={i}><Td>{m.name}</Td><Td right>+{num(m.qty)} {m.base_unit}</Td><Td style={{ color: tk.iron60 }}>{m.warehouse_id ?? '—'}</Td></Tr>)}</Table>
              </div>
            </Panel>
          )}
        </div>
        {d.image && <Panel title="Documento original"><img src={d.image.data} alt="" style={{ width: '100%', display: 'block' }} /></Panel>}
      </div>
    </Page>
  )
}
