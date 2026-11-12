'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_ALBARAN, eur, fecha, num, pct } from '@/lib/format'
import { Badge, Btn, Delta, Empty, Field, Input, Loading, Modal, Page, Panel, Table, Td, Tr } from '@/components/ui'

export default function FichaIngredientePage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [priceModal, setPriceModal] = useState(false)
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try { setData(await api.get(`/api/ingredients/${id}`)) } catch (e) { setError(errorMessage(e)) }
  }, [id])
  useEffect(() => { load() }, [load])

  async function savePrice() {
    setSaving(true)
    try { await api.post(`/api/ingredients/${id}/prices`, { unitPrice: Number(price), apply: true }); setPriceModal(false); setPrice(''); await load() } catch (e) { alert(errorMessage(e)) }
    setSaving(false)
  }

  if (error) return <div style={{ padding: 40, fontFamily: ff.mono, fontSize: 13, color: tk.terra }}>{error}</div>
  if (!data) return <Loading />
  const { ingredient: ing, usage, purchases, prices, waste, stock, movements } = data
  const stockQty = stock.reduce((s: number, l: any) => s + l.qty, 0)

  return (
    <Page back={{ href: '/dashboard/ingredientes', label: 'Ingredientes' }} eyebrow="Ficha de ingrediente · Trazabilidad" title={ing.name} subtitle={[ing.category, ing.code].filter(Boolean).join(' · ') || 'Sin categoría'}
      actions={<Btn kind="ghost" onClick={() => { setPrice(ing.cost != null ? String(ing.cost) : ''); setPriceModal(true) }}>REGISTRAR PRECIO</Btn>}>
      <Panel title="Estado actual">
        <div style={{ padding: 16, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          <Info label="Coste actual" value={ing.cost != null ? `${eur(ing.cost)}/${ing.base_unit}` : 'Sin coste'} />
          <Info label="Unidad base" value={ing.base_unit} />
          <Info label="IVA" value={ing.vat_rate != null ? `${ing.vat_rate}%` : '—'} />
          <Info label="Proveedor" value={ing.supplier_name || 'Sin asignar'} link={ing.supplier_id ? `/dashboard/proveedores/${ing.supplier_id}` : undefined} />
          <Info label="Almacén" value={ing.warehouse_name || 'Sin asignar'} />
          <Info label="Stock teórico" value={stock.length ? `${num(stockQty)} ${ing.base_unit}` : 'Sin movimientos'} />
          <Info label="Última compra" value={purchases[0] ? fecha(purchases[0].date) : '—'} />
        </div>
      </Panel>

      <Panel title={`Últimas compras · ${purchases.length}`}>
        <Table head={['Fecha', 'Albarán', 'Proveedor', 'Cant.', '€/ud', 'Total', 'Cambio', 'Estado']} right={[3, 4, 5, 6]}>
          {purchases.map((l: any) => (
            <Tr key={l.id}>
              <Td>{fecha(l.date)}</Td>
              <Td><Link href={`/dashboard/compras/albaranes/${l.delivery_note_id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{l.number}</Link></Td>
              <Td>{l.supplier}</Td>
              <Td right>{l.qty != null ? `${num(l.qty)} ${l.unit ?? ''}` : '—'}</Td>
              <Td right>{eur(l.unit_price)}</Td>
              <Td right>{l.line_total_cents != null ? eur(l.line_total_cents / 100) : '—'}</Td>
              <Td right><Delta pct={l.previous_unit_price && l.unit_price ? Math.round(((l.unit_price - l.previous_unit_price) / l.previous_unit_price) * 1000) / 10 : null} /></Td>
              <Td><Badge tone={l.status === 'validated' || l.status === 'invoiced' ? 'ok' : 'warn'}>{ESTADO_ALBARAN[l.status] ?? l.status}</Badge></Td>
            </Tr>
          ))}
          {purchases.length === 0 && <Tr><Td colSpan={8}><Empty>Sin compras registradas. Sube un albarán desde Escaneo.</Empty></Td></Tr>}
        </Table>
      </Panel>

      <Panel title={`Historial de precios · ${prices.length}`}>
        <Table head={['Fecha', 'Proveedor', 'Anterior', 'Nuevo', 'Variación', 'Origen']} right={[2, 3, 4]}>
          {prices.map((p: any) => {
            const delta = p.previous_price > 0 ? Math.round(((p.unit_price - p.previous_price) / p.previous_price) * 1000) / 10 : null
            return (
              <Tr key={p.id}>
                <Td>{fecha(p.observed_on)}</Td><Td>{p.supplier_name || '—'}</Td>
                <Td right>{p.previous_price != null ? eur(p.previous_price) : '—'}</Td>
                <Td right style={{ fontWeight: 600 }}>{eur(p.unit_price)}/{ing.base_unit}</Td>
                <Td right><Delta pct={delta} /></Td>
                <Td style={{ color: tk.iron60 }}>{{ delivery_note: 'albarán', invoice: 'factura', manual: 'manual', import: 'importación', legacy: 'histórico' }[p.source_type as string] ?? p.source_type}{p.source_type === 'delivery_note' && p.source_id ? <> · <Link href={`/dashboard/compras/albaranes/${p.source_id}`} style={{ color: tk.appleDeep, textDecoration: 'none' }}>ver</Link></> : null}</Td>
              </Tr>
            )
          })}
          {prices.length === 0 && <Tr><Td colSpan={6}><Empty>Sin historial de precios todavía.</Empty></Td></Tr>}
        </Table>
      </Panel>

      <Panel title={`Se usa en · ${usage.length} escandallo(s)`}>
        <Table head={['Receta', 'Tipo', 'Cantidad', 'PVP', 'Food cost']} right={[2, 3, 4]}>
          {usage.map((r: any) => (
            <Tr key={r.id}>
              <Td><Link href={`/dashboard/sangrado?receta=${r.id}`} style={{ color: tk.appleDeep, fontWeight: 600, textDecoration: 'none' }}>{r.name}</Link></Td>
              <Td>{r.kind === 'preparation' ? 'elaboración' : 'plato'}</Td>
              <Td right>{r.lineQty != null ? `${num(r.lineQty)} ${r.lineUnit}` : '—'}</Td>
              <Td right>{r.kind === 'dish' ? eur(r.salePrice) : '—'}</Td>
              <Td right>{r.kind === 'dish' ? pct(r.foodCostPct) : '—'}</Td>
            </Tr>
          ))}
          {usage.length === 0 && <Tr><Td colSpan={5}><Empty>Ningún escandallo usa este ingrediente.</Empty></Td></Tr>}
        </Table>
      </Panel>

      {movements.length > 0 && (
        <Panel title={`Movimientos de stock · ${movements.length}`}>
          <Table head={['Fecha', 'Tipo', 'Cantidad', 'Almacén', 'Nota']} right={[2]}>
            {movements.map((m: any) => (
              <Tr key={m.id}><Td>{fecha(m.occurred_at)}</Td><Td>{m.kind}</Td><Td right style={{ color: m.qty < 0 ? tk.terra : tk.appleDeep, fontWeight: 600 }}>{m.qty > 0 ? '+' : ''}{num(m.qty)} {ing.base_unit}</Td><Td>{m.warehouse_name || '—'}</Td><Td style={{ color: tk.iron60 }}>{m.note || '—'}</Td></Tr>
            ))}
          </Table>
        </Panel>
      )}

      {waste.length > 0 && (
        <Panel title={`Mermas registradas · ${waste.length}`}>
          <Table head={['Fecha', 'Cantidad', 'Motivo', 'Coste estimado']} right={[1, 3]}>
            {waste.map((m: any) => <Tr key={m.id}><Td>{fecha(m.occurred_on)}</Td><Td right>{num(m.qty)} {m.unit}</Td><Td>{m.reason || '—'}</Td><Td right style={{ color: tk.terra, fontWeight: 600 }}>{eur(m.estimated_cost)}</Td></Tr>)}
          </Table>
        </Panel>
      )}

      {priceModal && (
        <Modal title={`Nuevo precio de ${ing.name}`} onClose={() => setPriceModal(false)} width={420}>
          <Field label={`Precio (€/${ing.base_unit})`} hint="Se guarda en el histórico y pasa a ser el coste actual."><Input type="number" step="0.0001" min={0} value={price} onChange={e => setPrice(e.target.value)} autoFocus /></Field>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setPriceModal(false)}>CANCELAR</Btn><Btn onClick={savePrice} disabled={saving || price === ''}>GUARDAR</Btn></div>
        </Modal>
      )}
    </Page>
  )
}

function Info({ label, value, link }: { label: string; value: string; link?: string }) {
  return (
    <div>
      <div style={{ fontFamily: ff.mono, fontSize: 9.5, letterSpacing: '0.12em', color: tk.iron40, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {link ? <Link href={link} style={{ fontFamily: ff.mono, fontSize: 13, color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{value}</Link> : <div style={{ fontFamily: ff.mono, fontSize: 13, color: tk.iron }}>{value}</div>}
    </div>
  )
}
