'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { api, errorMessage } from '@/lib/api'
import { tk, ff } from '@/lib/design'
import { ESTADO_PEDIDO, eur, fecha, num } from '@/lib/format'
import { UNIT_OPTIONS, unitsCompatibleWith } from '@/lib/units-ui'
import { Badge, Btn, Empty, Field, Input, Loading, Modal, Note, Page, Panel, Select, Table, Td, Textarea, Tr } from '@/components/ui'

export default function PedidoDetallePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [o, setO] = useState<any>(null)
  const [ings, setIngs] = useState<any[]>([])
  const [supplier, setSupplier] = useState<any>(null)
  const [err, setErr] = useState('')
  const [line, setLine] = useState({ ingredientId: '', description: '', qty: '', unit: 'kg' })
  const [send, setSend] = useState<null | { channel: 'email' | 'whatsapp' }>(null)
  const [sendForm, setSendForm] = useState({ to: '', subject: '', message: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const order = await api.get(`/api/orders/${id}`)
      setO(order)
      const [i, s] = await Promise.all([api.get('/api/ingredients'), api.get(`/api/suppliers/${order.supplier_id}`)])
      setIngs(i.data.filter((x: any) => !x.supplier_id || x.supplier_id === order.supplier_id)); setSupplier(s.supplier)
    } catch (e) { setErr(errorMessage(e)) }
  }, [id])
  useEffect(() => { load() }, [load])

  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); await load() } catch (e) { alert(errorMessage(e)) } setBusy(false) }

  function pickIng(v: string) {
    const ing = ings.find(x => String(x.id) === v)
    setLine(l => ({ ...l, ingredientId: v, description: ing?.name ?? l.description, unit: ing?.base_unit ?? l.unit }))
  }
  const addLine = () => run(async () => { await api.post(`/api/orders/${id}/lines`, { ingredientId: line.ingredientId ? Number(line.ingredientId) : null, description: line.description || null, qty: Number(line.qty), unit: line.unit }); setLine({ ingredientId: '', description: '', qty: '', unit: 'kg' }) })
  const removeLine = (lid: number) => run(() => api.del(`/api/orders/${id}/lines/${lid}`))
  const setStatus = (status: string) => run(() => api.post(`/api/orders/${id}/status`, { status, sentVia: status === 'sent' ? 'manual' : undefined }))
  const receive = () => run(async () => { const dn = await api.post(`/api/orders/${id}/receive`, {}); router.push(`/dashboard/compras/albaranes/${dn.id}`) })

  function openSend(channel: 'email' | 'whatsapp') {
    const items = o.lines.map((l: any) => `• ${l.description}: ${num(l.qty)} ${l.unit}`).join('\n')
    const date = new Date().toLocaleDateString('es-ES')
    setSendForm({ to: channel === 'email' ? supplier?.email ?? '' : supplier?.phone ?? '', subject: `Pedido ${o.number}`, message: channel === 'email' ? `Hola,\n\nos pasamos el pedido para la próxima entrega:\n\n${items}\n\nPor favor, confirmad disponibilidad y fecha de entrega.\n\nGracias` : `Hola, pedido para el ${date}:\n\n${items}\n\nGracias` })
    setSend({ channel })
  }
  const doSend = () => run(async () => {
    // El pedido ya existe: se envía por el canal elegido reutilizando sus líneas.
    const r = await api.post('/api/orders/send', { supplierId: o.supplier_id, channel: send!.channel, to: sendForm.to, subject: sendForm.subject, message: sendForm.message, items: o.lines.map((l: any) => ({ ingredientId: l.ingredient_id, description: l.description, qty: l.qty, unit: l.unit })), expectedDate: o.expected_date, notes: o.notes })
    await api.post(`/api/orders/${id}/status`, { status: 'cancelled' }).catch(() => {})
    setSend(null)
    router.push(`/dashboard/compras/pedidos/${r.order.id}`)
  })

  if (err) return <div style={{ padding: 36, fontFamily: ff.mono, color: tk.terra }}>{err}</div>
  if (!o) return <Loading />
  const draft = o.status === 'draft'

  return (
    <Page back={{ href: '/dashboard/compras/pedidos', label: 'Pedidos' }} eyebrow="Pedido de compra" title={o.number}
      subtitle={<><Link href={`/dashboard/proveedores/${o.supplier_id}`} style={{ color: tk.appleDeep, textDecoration: 'none', fontWeight: 600 }}>{o.supplier_name}</Link> · {fecha(o.order_date)}{o.expected_date ? ` · entrega prevista ${fecha(o.expected_date)}` : ''}{o.notes ? ` · ${o.notes}` : ''}</>}
      actions={<>
        <Badge tone={o.status === 'sent' ? 'warn' : o.status === 'closed' ? 'ok' : o.status === 'cancelled' ? 'crit' : 'neutral'}>{ESTADO_PEDIDO[o.status]}</Badge>
        {draft && <><Btn kind="ghost" onClick={() => openSend('email')} disabled={busy || !o.lines.length}>ENVIAR POR EMAIL</Btn><Btn kind="ghost" onClick={() => openSend('whatsapp')} disabled={busy || !o.lines.length}>WHATSAPP</Btn><Btn kind="ghost" onClick={() => setStatus('sent')} disabled={busy || !o.lines.length} title="Ya lo has enviado por otro medio">MARCAR ENVIADO</Btn></>}
        {o.status === 'sent' && <Btn onClick={receive} disabled={busy}>RECIBIR → CREAR ALBARÁN</Btn>}
        {o.status === 'received' && <Btn kind="ghost" onClick={() => setStatus('closed')} disabled={busy}>CERRAR</Btn>}
        {(draft || o.status === 'sent') && <Btn kind="danger" onClick={() => confirm('¿Cancelar el pedido?') && setStatus('cancelled')} disabled={busy}>CANCELAR</Btn>}
      </>}>
      {o.status === 'received' && <Note tone="ok">Pedido recibido: el albarán está creado en borrador. Revísalo y valídalo para que entren precios y stock.</Note>}
      <Panel title={`Líneas · ${o.lines.length}`} right={<span style={{ fontFamily: ff.mono, fontSize: 11 }}>Total estimado <strong>{eur(o.total)}</strong></span>}>
        {o.lines.length === 0 ? <Empty>Sin líneas. Añade el primer producto abajo.</Empty> : (
          <Table head={['Producto', 'Cantidad', 'Coste estimado', 'Línea', '']} right={[1, 2, 3, 4]}>
            {o.lines.map((l: any) => (
              <Tr key={l.id}>
                <Td>{l.ingredient_id ? <Link href={`/dashboard/ingredientes/${l.ingredient_id}`} style={{ color: tk.iron, textDecoration: 'none', borderBottom: `1px solid ${tk.iron40}` }}>{l.description}</Link> : l.description}</Td>
                <Td right>{num(l.qty)} {l.unit}</Td>
                <Td right style={{ color: tk.iron60 }}>{l.current_unit_cost != null ? `${eur(l.current_unit_cost)}/${l.unit}` : '—'}</Td>
                <Td right style={{ fontWeight: 600 }}>{eur(l.line_total)}</Td>
                <Td right>{draft && <Btn small kind="danger" onClick={() => removeLine(l.id)} disabled={busy}>×</Btn>}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Panel>
      {draft && (
        <Panel title="Añadir producto">
          <div style={{ padding: 16, display: 'grid', gridTemplateColumns: '2fr 1.5fr 0.8fr 0.9fr auto', gap: 8, alignItems: 'end' }}>
            <Field label="Del catálogo"><Select value={line.ingredientId} onChange={e => pickIng(e.target.value)}><option value="">— ingrediente —</option>{ings.map(i => <option key={i.id} value={i.id}>{i.name}{i.cost ? ` · ${eur(i.cost)}/${i.base_unit}` : ''}</option>)}</Select></Field>
            <Field label="O texto libre"><Input value={line.description} onChange={e => setLine(l => ({ ...l, description: e.target.value }))} placeholder="Descripción" /></Field>
            <Field label="Cantidad"><Input type="number" step="any" min={0} value={line.qty} onChange={e => setLine(l => ({ ...l, qty: e.target.value }))} /></Field>
            <Field label="Unidad"><Select value={line.unit} onChange={e => setLine(l => ({ ...l, unit: e.target.value }))}>{(line.ingredientId ? unitsCompatibleWith(ings.find(x => String(x.id) === line.ingredientId)?.base_unit) : UNIT_OPTIONS).map(u => <option key={u.value} value={u.value}>{u.value}</option>)}</Select></Field>
            <Btn onClick={addLine} disabled={busy || !line.qty || (!line.ingredientId && !line.description)}>+</Btn>
          </div>
        </Panel>
      )}
      {send && (
        <Modal title={send.channel === 'email' ? 'Enviar pedido por email' : 'Enviar pedido por WhatsApp'} onClose={() => setSend(null)} width={560}>
          <Field label={send.channel === 'email' ? 'Para (email)' : 'Para (teléfono con prefijo)'}><Input value={sendForm.to} onChange={e => setSendForm(f => ({ ...f, to: e.target.value }))} /></Field>
          {send.channel === 'email' && <div style={{ marginTop: 12 }}><Field label="Asunto"><Input value={sendForm.subject} onChange={e => setSendForm(f => ({ ...f, subject: e.target.value }))} /></Field></div>}
          <div style={{ marginTop: 12 }}><Field label="Mensaje"><Textarea rows={9} value={sendForm.message} onChange={e => setSendForm(f => ({ ...f, message: e.target.value }))} /></Field></div>
          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}><Btn kind="ghost" onClick={() => setSend(null)}>CANCELAR</Btn><Btn onClick={doSend} disabled={busy || !sendForm.to}>ENVIAR</Btn></div>
        </Modal>
      )}
    </Page>
  )
}
