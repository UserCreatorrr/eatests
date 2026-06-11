'use client'

import { useState, useRef, useEffect } from 'react'
import { tk, ff } from '@/lib/design'
import { MbCard, MbRow, MbBadge, MbSparkline, MbBar, MbSection, MbTimeline } from '@/components/cards/MbCard'

interface EmailProposal {
  proveedor: string
  to: string
  subject: string
  body: string
  items?: { nombre: string; cantidad?: number; unidad?: string }[]
}

interface BriefCard {
  id: string
  titulo: string
  icon: 'chart' | 'truck' | 'invoice' | 'merma' | 'alert' | 'warning'
  urgencia: 'normal' | 'warning' | 'danger'
  items: string[]
  acciones: { label: string; href?: string; chat?: string }[]
}

interface BriefData {
  saludo: string
  fecha: string
  cards: BriefCard[]
}

interface WhatsAppProposal {
  proveedor: string
  phone: string
  message: string
  items?: { nombre: string; cantidad?: number; unidad?: string }[]
}

interface PedidoPendiente {
  id: number
  descr: string
  data: string
  pending_receive: number
}

interface ProveedorSelectorItem {
  id: number
  descr: string
  descr_type: string | null
  mail: string | null
  phone: string | null
  canal_preferido: 'email' | 'whatsapp' | null
}

interface IngredienteBasico {
  descr: string
  unit: string | null
  cost: number | null
}

interface PedidoProveedor {
  proveedor: ProveedorSelectorItem
  ingredientes: IngredienteBasico[]
}

interface PedidoSelectorData {
  pedidosPorProveedor: PedidoProveedor[]
  pendientes: PedidoPendiente[]
  proveedores: ProveedorSelectorItem[]
}

interface NecesidadItem {
  nombre: string
  cantidad: number | null
  unidad: string | null
  dias_sin_pedir: number | 'nunca'
}

interface NecesidadGrupo {
  proveedor: {
    nombre: string
    email: string | null
    phone: string | null
  }
  items: NecesidadItem[]
}

interface NecesidadesPedidoData {
  grupos: NecesidadGrupo[]
}

interface IngredienteItem {
  id: number
  descr: string
  type: string | null
  unit: string | null
  cost: number | null
}

interface ProveedorItem {
  id: number
  codi: string | null
  descr: string
  descr_type: string | null
  mail: string | null
  phone: string | null
}

interface Message {
  role: 'user' | 'assistant' | 'email_proposal' | 'whatsapp_proposal' | 'brief_cards' | 'pedido_selector' | 'necesidades_pedido' | 'compra_semanal' | 'facturas_pagar' | 'albaran_guardado' | 'informe_semanal' | 'ingredientes_cards' | 'proveedores_cards' | 'pedidos_recibir_cards' | 'precios_alerta_cards' | 'food_cost_cards' | 'alertas_predictivas_cards'
  content: string
  image?: string
  emailProposal?: EmailProposal
  whatsappProposal?: WhatsAppProposal
  briefCards?: BriefData
  pedidoSelector?: PedidoSelectorData
  necesidadesPedido?: NecesidadesPedidoData
  compraSemanal?: CompraSemanalData
  facturasPagar?: FacturasPagarData
  albaranGuardado?: AlbaranGuardadoData
  informeSemanal?: InformeSemanalData
  chartData?: ChartData
  ingredientesCards?: { ingredientes: IngredienteItem[]; filtro: string }
  proveedoresCards?: { proveedores: ProveedorItem[] }
  pedidosRecibirCards?: { pedidos: { id: number; descr: string; mes: string | null; lineas: any[]; total_lineas: number }[] }
  preciosAlertaCards?: { subidas: { nombre: string; precio_anterior: number; precio_actual: number; diff_pct: number; vendor: string | null; fecha: string }[]; umbral_pct: number }
  foodCostCards?: { recetas: { id: number; nombre: string; coste: number; pvp: number; pct: number; pvSugerido: number | null; nivel: 'critico' | 'revisar' | 'aceptable' | 'excelente' }[]; umbral_pct: number }
  alertasPredictivasCards?: AlertasPredictivasData
}

interface AlertasPredictivasData {
  generado: string
  fc_proyectado: { receta: string; pct_actual: number; pct_30: number; pct_60: number; ingrediente_top: string | null }[]
  ciclos_reposicion: { ingrediente: string; proveedor: string; ciclo_dias: number; dias_desde: number; toca: 'hoy' | 'manana' | 'retrasado' }[]
  aceleracion_precio: { nombre: string; subidas_consecutivas: number; precio_inicio: number; precio_actual: number; diff_pct: number }[]
  cashflow: { inicio: string; fin: string; total: number; count: number; vencidas: number }[]
}

const CARD_ICONS: Record<string, JSX.Element> = {
  chart: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V6" /></svg>,
  truck: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM21 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M1 1h11l1 6H1V1zM13 7h5l3 5v4h-8V7z"/></svg>,
  invoice: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  merma: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  alert: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>,
  warning: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>,
}

const URGENCIA_COLORS = {
  normal:  { bg: '#ece4d8', border: '#e8e2db', icon: '#3d3834', badge: null },
  warning: { bg: '#fcf2e8', border: '#c97b3d', icon: '#c97b3d', badge: '#c97b3d' },
  danger:  { bg: '#fbeae2', border: '#a83e1e', icon: '#a83e1e', badge: '#a83e1e' },
}

function parseInline(text: string): (JSX.Element | string)[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ fontFamily: 'DM Mono, monospace', backgroundColor: '#e8e2db', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{part.slice(1, -1)}</code>
    return part
  })
}

// Full markdown renderer for assistant messages
function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Headings
    if (line.startsWith('#### ')) {
      elements.push(<p key={i} style={{ fontFamily: 'DM Mono, monospace', fontWeight: 700, fontSize: 11, color: '#3d3834', opacity: 0.5, margin: '14px 0 4px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{parseInline(line.slice(5))}</p>)
      i++; continue
    }
    if (line.startsWith('### ')) {
      elements.push(<p key={i} style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#3d3834', margin: '16px 0 6px' }}>{parseInline(line.slice(4))}</p>)
      i++; continue
    }
    if (line.startsWith('## ')) {
      elements.push(<p key={i} style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#3d3834', margin: '18px 0 8px' }}>{parseInline(line.slice(3))}</p>)
      i++; continue
    }

    // Horizontal rule
    if (line.trim() === '---' || line.trim() === '***') {
      elements.push(<hr key={i} style={{ border: 'none', borderTop: '1px solid #e8e2db', margin: '12px 0' }} />)
      i++; continue
    }

    // Table
    if (line.trim().startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const isSep = (l: string) => /^\|[\s\-:|]+\|/.test(l.trim())
      const dataRows = tableLines.filter(l => !isSep(l))
      if (dataRows.length < 1) continue
      const parseCells = (l: string) => l.split('|').slice(1, -1).map(c => c.trim())
      elements.push(
        <div key={i} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 0, border: '1px solid #e8e2db' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
            <thead>
              <tr>{parseCells(dataRows[0]).map((cell, j) => (
                <th key={j} style={{ padding: '8px 14px', backgroundColor: '#f5f2ee', borderBottom: '1px solid #e8e2db', color: '#3d3834', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{parseInline(cell)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {dataRows.slice(1).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < dataRows.length - 2 ? '1px solid #e8e2db' : 'none' }}>
                  {parseCells(row).map((cell, j) => (
                    <td key={j} style={{ padding: '7px 14px', color: '#3d3834' }}>{parseInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Bullet list
    if (line.match(/^[-*] /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(lines[i].slice(2))
        i++
      }
      elements.push(
        <ul key={i} style={{ margin: '6px 0', paddingLeft: 18 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', margin: '3px 0', lineHeight: 1.55 }}>{parseInline(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\d+\. /)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ''))
        i++
      }
      elements.push(
        <ol key={i} style={{ margin: '6px 0', paddingLeft: 20 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', margin: '3px 0', lineHeight: 1.55 }}>{parseInline(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') { i++; continue }

    // Regular paragraph
    elements.push(
      <p key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834', margin: '4px 0', lineHeight: 1.65 }}>
        {parseInline(line)}
      </p>
    )
    i++
  }

  return <div style={{ minWidth: 0 }}>{elements}</div>
}

function renderBriefText(text: string) {
  return parseInline(text)
}

function BriefCards({ data, onAction }: { data: BriefData; onAction: (chat: string) => void }) {
  const urgenciaToStatus: Record<string, 'ok' | 'warn' | 'crit' | 'neutral'> = {
    normal: 'neutral', warning: 'warn', danger: 'crit',
  }
  return (
    <div style={{ width: '100%', maxWidth: 620 }}>
      {/* Editorial header */}
      <div style={{
        background: tk.iron, color: tk.cream,
        padding: '14px 18px', marginBottom: 12,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage:
            `linear-gradient(to right, rgba(223,213,201,0.06) 1px, transparent 1px),
             linear-gradient(to bottom, rgba(223,213,201,0.06) 1px, transparent 1px)`,
          backgroundSize: '14px 14px',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p style={{
            fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em',
            color: tk.apple, margin: 0, textTransform: 'uppercase' as const,
          }}>
            BRIEF · {data.fecha?.toUpperCase()}
          </p>
          <p style={{
            fontFamily: ff.display, fontWeight: 600, fontSize: 20, lineHeight: 1.1,
            margin: '4px 0 0', letterSpacing: '-0.015em',
          }}>{data.saludo}</p>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.cards.map(card => {
          const status = urgenciaToStatus[card.urgencia] || 'neutral'
          return (
            <MbCard
              key={card.id}
              category={card.titulo.toUpperCase()}
              status={status}
              title={card.titulo}
              maxWidth={620}
            >
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 4, marginBottom: card.acciones.length > 0 ? 12 : 0 }}>
                {card.items.map((item, i) => (
                  <p key={i} style={{
                    fontFamily: ff.mono, fontSize: 11.5, color: tk.iron,
                    opacity: 0.85, margin: 0, lineHeight: 1.55,
                  }}>{renderBriefText(item)}</p>
                ))}
              </div>
              {card.acciones.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6, marginTop: 4 }}>
                  {card.acciones.map((accion, i) => (
                    accion.href ? (
                      <a key={i} href={accion.href} style={{
                        padding: '5px 11px', background: tk.paper,
                        border: `1.5px solid ${tk.iron}`,
                        fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
                        color: tk.iron, textDecoration: 'none',
                        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      }}>{accion.label} →</a>
                    ) : (
                      <button key={i} onClick={() => onAction(accion.chat!)} style={{
                        padding: '5px 11px', background: tk.paper,
                        border: `1.5px solid ${tk.iron}`, cursor: 'pointer',
                        fontFamily: ff.mono, fontSize: 10.5, fontWeight: 600,
                        color: tk.iron,
                        letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      }}>{accion.label}</button>
                    )
                  ))}
                </div>
              )}
            </MbCard>
          )
        })}
      </div>
    </div>
  )
}

function WhatsAppCard({ proposal, onDiscard }: { proposal: WhatsAppProposal; onDiscard: () => void }) {
  const [phone, setPhone] = useState(proposal.phone)
  const [message, setMessage] = useState(proposal.message)
  const [sending, setSending] = useState(false)
  const [sentInfo, setSentInfo] = useState<{ num_order?: string } | null>(null)
  const [error, setError] = useState('')

  async function handleSend() {
    if (!phone.trim()) { setError('Introduce el número de teléfono'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, message, proveedor: proposal.proveedor, items: proposal.items }),
      })
      const json = await res.json()
      if (json.ok) setSentInfo({ num_order: json.num_order })
      else setError(json.error || 'Error al enviar')
    } catch { setError('Error de conexión') }
    finally { setSending(false) }
  }

  if (sentInfo) {
    return (
      <div style={{ backgroundColor: '#d6f9e0', border: '1.5px solid #0fa651', borderRadius: 0, padding: '14px 18px', maxWidth: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0fa651" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#0fa651' }}>
            WhatsApp enviado a {phone}
          </span>
        </div>
        {sentInfo.num_order && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', opacity: 0.7, margin: '6px 0 0 28px' }}>
            Pedido registrado: {sentInfo.num_order}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#d6f9e0', border: '1.5px solid #0fa651', borderRadius: 0, padding: 18, maxWidth: '90%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#0fa651', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#0fa651', margin: 0 }}>
            WhatsApp — {proposal.proveedor}
          </p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', opacity: 0.6, margin: 0 }}>
            Revisa y envía con un clic
          </p>
        </div>
      </div>

      {/* Phone */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', opacity: 0.6, display: 'block', marginBottom: 4 }}>Teléfono</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+34 645 966 701"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#0fa651', backgroundColor: '#d6f9e0', border: '1px solid #0fa651', borderRadius: 8, padding: '8px 10px', outline: 'none' }}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', opacity: 0.6, display: 'block', marginBottom: 4 }}>Mensaje</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#0fa651', backgroundColor: '#d6f9e0', border: '1px solid #0fa651', borderRadius: 8, padding: '8px 10px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {error && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#a83e1e', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#0fa651', border: 'none', borderRadius: 0, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
          </svg>
          {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
        </button>
        <button
          onClick={onDiscard}
          style={{ padding: '10px 16px', backgroundColor: '#d6f9e0', border: '1px solid #0fa651', borderRadius: 0, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#0fa651', opacity: 0.7 }}
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

function findSupplierForPedido(descr: string, proveedores: ProveedorSelectorItem[]): ProveedorSelectorItem | null {
  const lower = descr.toLowerCase()
  // Try matching supplier name words directly in the description
  for (const prov of proveedores) {
    const words = prov.descr.toLowerCase().split(/\s+/).filter(w => w.length > 4)
    if (words.some(w => lower.includes(w))) return prov
  }
  // Keyword → type fallback
  const kwMap: [string, string][] = [
    ['carne', 'Carnicería'], ['lácteo', 'Lácteo'], ['lacteo', 'Lácteo'],
    ['pescado', 'Pescad'], ['verdura', 'Verdura'], ['fruta', 'Verdura'],
    ['marisco', 'Marisco'], ['vino', 'Vinos'], ['bebida', 'Bebidas'],
    ['harina', 'Harinas'], ['especia', 'Especias'], ['congela', 'Congelad'],
    ['charcutería', 'Charcutería'], ['charcuteria', 'Charcutería'],
  ]
  for (const [kw, type] of kwMap) {
    if (lower.includes(kw)) {
      const match = proveedores.find(p => (p.descr_type || '').toLowerCase().includes(type.toLowerCase()))
      if (match) return match
    }
  }
  return null
}

function PedidoSelectorCard({ data, onAction }: { data: PedidoSelectorData; onAction: (chat: string) => void }) {
  const [showOtro, setShowOtro] = useState(false)
  const [otroText, setOtroText] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [expandedPendiente, setExpandedPendiente] = useState<Record<number, boolean>>({})
  const [showAllProvs, setShowAllProvs] = useState(false)

  const iconEmail = (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
  const iconWA = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
    </svg>
  )

  const btnBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
    borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11,
    border: '1px solid #e8e2db', backgroundColor: '#f5f2ee', color: '#3d3834',
  }

  function ingText(ingredientes: IngredienteBasico[]) {
    return ingredientes.map(i => `${i.descr}${i.unit ? ' (' + i.unit + ')' : ''}`).join(', ')
  }

  return (
    <div style={{ width: '100%', maxWidth: 580 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#3d3834', margin: 0 }}>
          Pedidos por proveedor
        </p>
      </div>

      {/* === MAIN: proveedores con ingredientes asignados === */}
      {data.pedidosPorProveedor.length > 0 ? (
        <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e2db', borderRadius: 0, overflow: 'hidden', marginBottom: 10 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, fontWeight: 600, margin: 0, padding: '8px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #e8e2db' }}>
            Tus proveedores · {data.pedidosPorProveedor.length} con productos asignados
          </p>
          {data.pedidosPorProveedor.map((pp, i) => {
            const isExp = expanded[pp.proveedor.id] ?? false
            return (
              <div key={pp.proveedor.id} style={{ borderBottom: i < data.pedidosPorProveedor.length - 1 ? '1px solid #e8e2db' : 'none' }}>
                {/* Row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  {/* Toggle */}
                  <button
                    onClick={() => setExpanded(prev => ({ ...prev, [pp.proveedor.id]: !isExp }))}
                    style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <span style={{ fontSize: 10, color: '#3d3834', opacity: 0.35, flexShrink: 0, transform: isExp ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13, color: '#3d3834', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pp.proveedor.descr}</p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: 0 }}>
                        {pp.ingredientes.length} productos{pp.proveedor.descr_type ? ' · ' + pp.proveedor.descr_type : ''}
                      </p>
                    </div>
                  </button>
                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button
                      onClick={() => onAction(`Preparar pedido por email a ${pp.proveedor.descr} con estos productos: ${ingText(pp.ingredientes)}`)}
                      title={pp.proveedor.mail || 'Email'}
                      style={{ ...btnBase, backgroundColor: pp.proveedor.canal_preferido === 'email' ? '#19f973' : '#f5f2ee', borderColor: pp.proveedor.canal_preferido === 'email' ? '#19f973' : '#e8e2db', color: pp.proveedor.canal_preferido === 'email' ? '#3d3834' : '#3d3834', fontWeight: pp.proveedor.canal_preferido === 'email' ? 600 : 400 }}
                    >
                      {iconEmail} Email
                    </button>
                    <button
                      onClick={() => onAction(`Preparar pedido por WhatsApp a ${pp.proveedor.descr} con estos productos: ${ingText(pp.ingredientes)}`)}
                      title={pp.proveedor.phone || 'WhatsApp'}
                      style={{ ...btnBase, backgroundColor: pp.proveedor.canal_preferido === 'whatsapp' ? '#d6f9e0' : '#f5f2ee', borderColor: pp.proveedor.canal_preferido === 'whatsapp' ? '#0fa651' : '#e8e2db', color: pp.proveedor.canal_preferido === 'whatsapp' ? '#0fa651' : '#3d3834', fontWeight: pp.proveedor.canal_preferido === 'whatsapp' ? 600 : 400 }}
                    >
                      {iconWA} WA
                    </button>
                  </div>
                </div>
                {/* Expanded ingredients */}
                {isExp && (
                  <div style={{ padding: '0 14px 12px 32px', display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {pp.ingredientes.map((ing, j) => (
                      <span key={j} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', backgroundColor: '#f5f2ee', borderRadius: 6, padding: '3px 8px', opacity: 0.8 }}>
                        {ing.descr}{ing.unit ? <span style={{ opacity: 0.5 }}> · {ing.unit}</span> : null}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ backgroundColor: '#fcf2e8', border: '1.5px solid #c97b3d', borderRadius: 0, padding: '12px 16px', marginBottom: 10 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#c97b3d', margin: 0, lineHeight: 1.6 }}>
            Ningún ingrediente tiene proveedor asignado aún.<br />
            Ve a <strong>Ingredientes</strong> y asigna proveedores a tus productos para que el sistema sepa a quién pedir cada cosa.
          </p>
        </div>
      )}

      {/* Listas de pedido pendientes */}
      {data.pendientes.length > 0 && (
        <div style={{ backgroundColor: '#fcf2e8', border: '1.5px solid #c97b3d', borderRadius: 0, padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Listas pendientes de enviar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.pendientes.map(lp => {
              const isExpLP = expandedPendiente[lp.id] ?? false
              const suggested = findSupplierForPedido(lp.descr, data.proveedores)
              return (
                <div key={lp.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', flex: 1 }}>📋 {lp.descr}</span>
                    <button
                      onClick={() => setExpandedPendiente(prev => ({ ...prev, [lp.id]: !isExpLP }))}
                      style={{ padding: '4px 10px', backgroundColor: isExpLP ? '#fcf2e8' : '#fcf2e8', border: '1px solid #c97b3d', borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c97b3d', whiteSpace: 'nowrap' }}
                    >
                      {isExpLP ? '▲ Cerrar' : 'Enviar →'}
                    </button>
                  </div>
                  {isExpLP && (
                    <div style={{ marginTop: 8, padding: '10px 12px', backgroundColor: '#fff', border: '1px solid #c97b3d', borderRadius: 8 }}>
                      {suggested ? (
                        <>
                          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c97b3d', margin: '0 0 8px', opacity: 0.7 }}>
                            Proveedor sugerido: <strong style={{ color: '#c97b3d', opacity: 1 }}>{suggested.descr}</strong>
                          </p>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              onClick={() => onAction(`Preparar pedido por email a ${suggested.descr} para el pedido "${lp.descr}"`)}
                              style={{ ...btnBase, flex: 1, justifyContent: 'center', backgroundColor: '#fcf2e8', borderColor: '#c97b3d', color: '#c97b3d' }}
                            >
                              {iconEmail} Email a {suggested.descr.split(' ').slice(0,2).join(' ')}
                            </button>
                            <button
                              onClick={() => onAction(`Preparar pedido por WhatsApp a ${suggested.descr} para el pedido "${lp.descr}"`)}
                              style={{ ...btnBase, flex: 1, justifyContent: 'center', backgroundColor: '#fcf2e8', borderColor: '#c97b3d', color: '#c97b3d' }}
                            >
                              {iconWA} WA a {suggested.descr.split(' ').slice(0,2).join(' ')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c97b3d', margin: 0 }}>
                          Selecciona un proveedor de la lista de abajo
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pedido suelto: todos los proveedores */}
      <div style={{ marginBottom: 8 }}>
        <button
          onClick={() => setShowAllProvs(s => !s)}
          style={{ width: '100%', padding: '8px 14px', backgroundColor: 'transparent', border: '1.5px dashed #c4b8a8', borderRadius: 0, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.55, textAlign: 'center' }}
        >
          {showAllProvs ? '▲ Ocultar' : '+ Pedido suelto a cualquier proveedor'}
        </button>
        {showAllProvs && (
          <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e2db', borderRadius: 0, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              {data.proveedores.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: i < data.proveedores.length - 1 ? '1px solid #e8e2db' : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 12, color: '#3d3834', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descr}</p>
                    <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: 0 }}>{p.descr_type || ''}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                    <button onClick={() => onAction(`Preparar pedido por email a ${p.descr}`)} style={btnBase}>{iconEmail} Email</button>
                    <button onClick={() => onAction(`Preparar pedido por WhatsApp a ${p.descr}`)} style={btnBase}>{iconWA} WA</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Manual input */}
      {!showOtro ? (
        <button
          onClick={() => setShowOtro(true)}
          style={{ width: '100%', padding: '8px 14px', backgroundColor: 'transparent', border: '1.5px dashed #c4b8a8', borderRadius: 0, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, textAlign: 'center' }}
        >
          + Especificar proveedor manualmente
        </button>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={otroText}
            onChange={e => setOtroText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && otroText.trim()) onAction(`Preparar pedido a ${otroText.trim()}`) }}
            placeholder="Nombre del proveedor..."
            style={{ flex: 1, padding: '8px 12px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', backgroundColor: '#fff', border: '1.5px solid #e8e2db', borderRadius: 8, outline: 'none' }}
          />
          <button
            onClick={() => { if (otroText.trim()) onAction(`Preparar pedido a ${otroText.trim()}`) }}
            style={{ padding: '8px 14px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#2a2522' }}
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}

function FacturasCard({ data }: { data: FacturasPagarData }) {
  const [pendientes, setPendientes] = useState<FacturaPendiente[]>(data.facturas)
  const [paying, setPaying] = useState<Record<number, boolean>>({})
  const [payingAll, setPayingAll] = useState(false)
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)

  if (pendientes.length === 0) {
    return (
      <MbCard
        category="FACTURAS · ESTADO"
        timestamp={new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()}
        status="ok"
        title="Todo pagado"
        figure="✓"
        sub="No hay facturas pendientes en este momento."
        maxWidth={520}
      ><></></MbCard>
    )
  }

  async function pagarUna(id: number) {
    setPaying(prev => ({ ...prev, [id]: true }))
    await fetch(`/api/facturas/${id}/pay`, { method: 'PATCH' })
    setPendientes(prev => prev.filter(f => f.id !== id))
    setPaying(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  async function pagarTodas() {
    setPayingAll(true)
    await Promise.all(pendientes.map(f => fetch(`/api/facturas/${f.id}/pay`, { method: 'PATCH' })))
    setPendientes([])
    setPayingAll(false)
  }

  const total = pendientes.reduce((s, f) => s + (f.total || 0), 0)
  const vencidas = pendientes.filter(f => f.vencida)
  const status = vencidas.length > 0 ? 'crit' : 'warn'
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()

  return (
    <MbCard
      category={vencidas.length > 0 ? 'FACTURAS · VENCIDAS' : 'FACTURAS · PENDIENTES'}
      timestamp={ts}
      status={status}
      title={vencidas.length > 0 ? 'Sin pagar pasada fecha' : 'Pendientes de pago'}
      figure={pendientes.length}
      sub={<>{fmt(total)} acumulados{vencidas.length > 0 && <> · <span style={{ color: tk.terra }}>{vencidas.length} vencida{vencidas.length > 1 ? 's' : ''}</span></>}</>}
      cta={{ label: payingAll ? 'Procesando…' : `Marcar las ${pendientes.length} como pagadas`, onClick: payingAll ? undefined : pagarTodas }}
      maxWidth={560}
    >
      {pendientes.map((f, i) => {
        const overdue = f.vencida
        const soon = !overdue && f.date_due && (new Date(f.date_due).getTime() - Date.now()) < 5 * 86400000
        const dueText = overdue ? `vencida hace ${Math.abs(f.dias_vencida ?? 0)}d` : soon ? `vence pronto · ${f.date_due}` : (f.date_due || '')
        return (
          <div key={f.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 0',
            borderBottom: i < pendientes.length - 1 ? `1px solid ${tk.iron20}` : 'none',
            fontSize: 11.5,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: tk.iron, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.vendor || 'Sin proveedor'}
              </div>
              <div style={{ color: tk.iron40, fontSize: 10.5 }}>
                {f.invoice_num || 'S/N'}{dueText && <> · {dueText}</>}
              </div>
            </div>
            <span style={{
              fontVariantNumeric: 'tabular-nums', color: overdue ? tk.terra : tk.iron,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>
              {f.total != null ? fmt(f.total) : '—'}
            </span>
            <button
              onClick={() => pagarUna(f.id)}
              disabled={paying[f.id]}
              style={{
                flexShrink: 0, padding: '4px 10px',
                background: paying[f.id] ? tk.creamSoft : tk.apple,
                border: `1px solid ${tk.iron}`,
                cursor: paying[f.id] ? 'default' : 'pointer',
                fontFamily: ff.mono, fontSize: 10, fontWeight: 600,
                color: tk.iron, letterSpacing: '0.06em',
                opacity: paying[f.id] ? 0.6 : 1,
              }}
            >
              {paying[f.id] ? '…' : 'PAGADA'}
            </button>
          </div>
        )
      })}
    </MbCard>
  )
}

function IngredientesCard({ data }: { data: { ingredientes: IngredienteItem[]; filtro: string } }) {
  const sinCoste = data.ingredientes.filter(i => !i.cost || i.cost === 0)
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(v)
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
  const status = sinCoste.length > 0 ? 'warn' : 'ok'
  return (
    <MbCard
      category={`INGREDIENTES${data.filtro ? ' · ' + data.filtro.toUpperCase() : ''}`}
      timestamp={ts}
      status={status}
      title={sinCoste.length > 0 ? 'Faltan costes por registrar' : 'Catálogo al día'}
      figure={data.ingredientes.length}
      sub={sinCoste.length > 0 ? `${sinCoste.length} sin coste · afecta al escandallo` : `${data.ingredientes.length} con coste registrado`}
      cta={{ label: 'Ver todos', onClick: () => { if (typeof window !== 'undefined') window.location.href = '/dashboard/ingredientes' } }}
      maxWidth={560}
    >
      {data.ingredientes.slice(0, 25).map((ing, i, arr) => {
        const hasCost = ing.cost && ing.cost > 0
        return (
          <MbRow
            key={ing.id}
            label={ing.descr}
            meta={<>{ing.type || '—'}{ing.unit && <> · {ing.unit}</>}</>}
            right={hasCost ? fmt(ing.cost!) : <MbBadge variant="terra">SIN COSTE</MbBadge>}
            rightVariant={hasCost ? 'default' : 'crit'}
            isLast={i === arr.length - 1}
          />
        )
      })}
    </MbCard>
  )
}

function ProveedoresCard({ data }: { data: { proveedores: ProveedorItem[] } }) {
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
  return (
    <MbCard
      category="PROVEEDORES"
      timestamp={ts}
      status="neutral"
      title="Catálogo de proveedores"
      figure={data.proveedores.length}
      sub="Activos en tu cocina"
      cta={{ label: 'Ver todos', onClick: () => { if (typeof window !== 'undefined') window.location.href = '/dashboard/proveedores' } }}
      maxWidth={520}
    >
      {data.proveedores.map((p, i, arr) => (
        <MbRow
          key={p.id}
          label={p.descr}
          meta={<>{p.descr_type || '—'}{p.mail && <> · {p.mail}</>}{p.phone && <> · {p.phone}</>}</>}
          isLast={i === arr.length - 1}
        />
      ))}
    </MbCard>
  )
}

function PedidosRecibirCard({ data }: { data: { pedidos: { id: number; descr: string; mes: string | null; lineas: any[]; total_lineas: number }[] } }) {
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
  return (
    <MbCard
      category="PEDIDOS · POR RECIBIR"
      timestamp={ts}
      status="neutral"
      title="Entregas sin confirmar"
      figure={data.pedidos.length}
      sub="Albaranes esperados esta semana"
      cta={{ label: 'Confirmar recepción', onClick: () => { if (typeof window !== 'undefined') window.location.href = '/dashboard/compras/pedidos' } }}
      maxWidth={560}
    >
      {data.pedidos.map((p, i) => {
        const lineasPreview = p.lineas.slice(0, 3)
          .map((l: any) => l.nombre || l.descr || l.item || String(l))
          .join(' · ')
        return (
          <MbRow
            key={p.id}
            label={p.descr}
            meta={<>{p.mes && <>{p.mes} · </>}{p.total_lineas} línea{p.total_lineas !== 1 ? 's' : ''}{lineasPreview && <> · {lineasPreview}</>}{p.total_lineas > 3 && <> · +{p.total_lineas - 3} más</>}</>}
            right={<MbBadge variant="iron">{p.total_lineas} ART.</MbBadge>}
            isLast={i === data.pedidos.length - 1}
          />
        )
      })}
    </MbCard>
  )
}

function PreciosAlertaCard({ data }: { data: { subidas: { nombre: string; precio_anterior: number; precio_actual: number; diff_pct: number; vendor: string | null; fecha: string }[]; umbral_pct: number } }) {
  const fmt = (v: number) => `${v.toFixed(2)}€`
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
  const peor = data.subidas.reduce((m, s) => Math.max(m, s.diff_pct), 0)
  const status = peor >= 30 ? 'crit' : 'warn'
  return (
    <MbCard
      category="PRECIOS · SUBIDAS DETECTADAS"
      timestamp={ts}
      status={status}
      title="Ingredientes subiendo"
      figure={data.subidas.length}
      sub={`Por encima del ${data.umbral_pct}% de variación`}
      cta={{ label: 'Ver desviaciones', onClick: () => { if (typeof window !== 'undefined') window.location.href = '/dashboard/analytics' } }}
      maxWidth={560}
    >
      {data.subidas.map((s, i) => {
        const variant = s.diff_pct >= 30 ? 'terra' : 'clay'
        return (
          <MbRow
            key={i}
            label={s.nombre}
            meta={<>{s.vendor ? `${s.vendor} · ` : ''}{fmt(s.precio_anterior)} → {fmt(s.precio_actual)} · {s.fecha}</>}
            right={<MbBadge variant={variant}>+{s.diff_pct}%</MbBadge>}
            isLast={i === data.subidas.length - 1}
          />
        )
      })}
    </MbCard>
  )
}

const FC_BADGE: Record<'critico' | 'revisar' | 'aceptable' | 'excelente', { variant: 'apple' | 'clay' | 'terra'; label: string }> = {
  critico:   { variant: 'terra', label: 'CRÍTICO' },
  revisar:   { variant: 'clay',  label: 'REVISAR' },
  aceptable: { variant: 'apple', label: 'OK' },
  excelente: { variant: 'apple', label: 'EXCELENTE' },
}

function FoodCostCard({ data }: { data: { recetas: { id: number; nombre: string; coste: number; pvp: number; pct: number; pvSugerido: number | null; nivel: 'critico' | 'revisar' | 'aceptable' | 'excelente' }[]; umbral_pct: number } }) {
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
  const criticas = data.recetas.filter(r => r.nivel === 'critico' || r.nivel === 'revisar').length
  const status = criticas > 0 ? (data.recetas.some(r => r.nivel === 'critico') ? 'crit' : 'warn') : 'ok'
  const ts = new Date().toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()
  return (
    <MbCard
      category="ESCANDALLO · FC ACTUAL"
      timestamp={ts}
      status={status}
      title={criticas > 0 ? 'Recetas a revisar' : 'Todas dentro de objetivo'}
      figure={criticas}
      sub={criticas > 0 ? `Por encima del ${data.umbral_pct}% de food cost` : `${data.recetas.length} recetas analizadas`}
      cta={{ label: 'Ver escandallo completo', onClick: () => { if (typeof window !== 'undefined') window.location.href = '/dashboard/sangrado' } }}
      maxWidth={560}
    >
      {data.recetas.map((r, i) => {
        const b = FC_BADGE[r.nivel]
        const showSugerido = r.pvSugerido && (r.nivel === 'critico' || r.nivel === 'revisar')
        return (
          <MbRow
            key={r.id}
            label={r.nombre}
            meta={<>Coste {fmt(r.coste)} · PVP {fmt(r.pvp)}{showSugerido && <> · PVP sugerido <span style={{ color: tk.iron, borderBottom: `1px solid ${tk.clay}` }}>{fmt(r.pvSugerido!)}</span></>}</>}
            right={<MbBadge variant={b.variant}>{r.pct}%</MbBadge>}
            isLast={i === data.recetas.length - 1}
          />
        )
      })}
    </MbCard>
  )
}

function AlertasPredictivasCard({ data, onSend }: { data: AlertasPredictivasData; onSend: (text: string) => void }) {
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
  const semanaLabel = (s: { inicio: string; fin: string }) => {
    const d1 = new Date(s.inicio), d2 = new Date(s.fin)
    const opt: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }
    return `${d1.toLocaleDateString('es-ES', opt)} → ${d2.toLocaleDateString('es-ES', opt)}`
  }
  const tocaBadge: Record<'hoy' | 'manana' | 'retrasado', { variant: 'clay' | 'iron' | 'terra'; label: string }> = {
    hoy:       { variant: 'clay',  label: 'HOY' },
    manana:    { variant: 'iron',  label: 'MAÑANA' },
    retrasado: { variant: 'terra', label: 'RETRASADO' },
  }

  const maxCashflow = Math.max(1, ...data.cashflow.map(c => c.total))
  const totalSecciones =
    (data.fc_proyectado.length > 0 ? 1 : 0) +
    (data.ciclos_reposicion.length > 0 ? 1 : 0) +
    (data.aceleracion_precio.length > 0 ? 1 : 0) +
    (data.cashflow.length > 0 ? 1 : 0)

  // Status derivado: si hay cualquier sección crítica → crit; si hay warnings → warn
  const cruzaUmbral = data.fc_proyectado.some(r => r.pct_60 >= 33)
  const hayRetrasos = data.ciclos_reposicion.some(c => c.toca === 'retrasado')
  const hayVencidas = data.cashflow.some(s => s.vencidas > 0)
  const cardStatus = (cruzaUmbral || hayRetrasos || hayVencidas) ? 'crit' : (totalSecciones > 0 ? 'warn' : 'ok')

  const now = new Date()
  const ts = now.toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).toUpperCase()

  return (
    <MbCard
      category="PREDICCIÓN · 60 DÍAS VISTA"
      timestamp={ts}
      status={cardStatus}
      title={totalSecciones === 1 ? '1 señal sobre la mesa' : `${totalSecciones} señales sobre la mesa`}
      figure={totalSecciones}
      sub="Lo que va a romperse si no haces nada"
      maxWidth={640}
    >
      {/* FOOD COST PROYECTADO */}
      {data.fc_proyectado.length > 0 && data.fc_proyectado.map((r, i) => {
        const cruza = r.pct_60 >= 33
        return (
          <div key={`fc-${i}`} style={{
            background: tk.paper, border: `1.5px solid ${tk.iron}`,
            padding: '12px 14px', marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4, gap: 10 }}>
              <div style={{
                fontFamily: ff.display, fontWeight: 600, fontSize: 13.5, color: tk.iron,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>{r.receta}</div>
              {cruza && <MbBadge variant="terra">CRUZA 33%</MbBadge>}
            </div>
            <MbTimeline cols={[
              { label: 'HOY',  value: `${r.pct_actual}%`, variant: r.pct_actual >= 33 ? 'crit' : 'default' },
              { label: '+30d', value: `${r.pct_30}%`,     variant: r.pct_30     >= 33 ? 'crit' : r.pct_30 >= 30 ? 'warn' : 'default' },
              { label: '+60d', value: `${r.pct_60}%`,     variant: r.pct_60     >= 33 ? 'crit' : r.pct_60 >= 30 ? 'warn' : 'default' },
            ]} />
            {r.ingrediente_top && (
              <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60, marginTop: 8 }}>
                Mayor impacto: <span style={{ color: tk.iron, borderBottom: `1.5px solid ${tk.clay}`, paddingBottom: 1 }}>{r.ingrediente_top}</span>
              </div>
            )}
          </div>
        )
      })}

      {/* CICLOS DE REPOSICIÓN */}
      {data.ciclos_reposicion.length > 0 && (
        <MbSection title="Ciclos de reposición" badge={`${data.ciclos_reposicion.length} TOCA PEDIR`} badgeVariant="clay">
          {data.ciclos_reposicion.map((c, i) => {
            const b = tocaBadge[c.toca]
            return (
              <MbRow
                key={`cr-${i}`}
                label={c.ingrediente}
                meta={`${c.proveedor} · ciclo ${c.ciclo_dias}d · última hace ${c.dias_desde}d`}
                right={<MbBadge variant={b.variant}>{b.label}</MbBadge>}
                isLast={i === data.ciclos_reposicion.length - 1}
              />
            )
          })}
        </MbSection>
      )}

      {/* ACELERACIÓN DE PRECIO */}
      {data.aceleracion_precio.length > 0 && (
        <MbSection title="Aceleración sostenida de precio" badge="TENDENCIA" badgeVariant="clay">
          {data.aceleracion_precio.map((a, i) => {
            // 7 puntos sintéticos basados en subidas_consecutivas
            const heights = Array.from({ length: 7 }).map((_, j) => 20 + j * (70 / Math.max(1, a.subidas_consecutivas)))
            const variant = a.diff_pct >= 40 ? 'crit' : 'warn'
            return (
              <div key={`ap-${i}`} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: i < data.aceleracion_precio.length - 1 ? `1px solid ${tk.iron20}` : 'none',
                gap: 14,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
                  <div style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron40 }}>
                    {a.subidas_consecutivas} subidas seguidas · {fmt(a.precio_inicio)} → {fmt(a.precio_actual)}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <MbSparkline heights={heights} variant={variant} />
                  <span style={{
                    fontFamily: ff.display, fontWeight: 600, fontSize: 16,
                    color: variant === 'crit' ? tk.terra : tk.clay,
                    minWidth: 50, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums',
                  }}>+{a.diff_pct}%</span>
                </div>
              </div>
            )
          })}
          <button
            onClick={() => onSend('Muéstrame alternativas de proveedor más baratas para estos ingredientes')}
            style={{
              marginTop: 10, fontFamily: ff.mono, fontSize: 10.5,
              color: tk.iron, background: tk.paper,
              border: `1.5px solid ${tk.iron}`,
              padding: '6px 12px', cursor: 'pointer',
              letterSpacing: '0.08em', textTransform: 'uppercase' as const,
            }}
          >Buscar alternativas →</button>
        </MbSection>
      )}

      {/* CASH FLOW */}
      {data.cashflow.length > 0 && (
        <MbSection title="Cash flow por semana" badge={hayVencidas ? 'SEMANA EN ROJO' : 'PAGOS'} badgeVariant={hayVencidas ? 'terra' : 'iron'}>
          {data.cashflow.map((s, i) => (
            <div key={`cf-${i}`} style={{ marginBottom: i < data.cashflow.length - 1 ? 10 : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontFamily: ff.mono, fontSize: 10.5, color: tk.iron60 }}>
                  {semanaLabel(s)} · {s.count} fra{s.count !== 1 ? 's' : ''}
                  {s.vencidas > 0 && <span style={{ color: tk.terra }}> · {s.vencidas} vencida{s.vencidas !== 1 ? 's' : ''}</span>}
                </span>
                <span style={{
                  fontFamily: ff.display, fontWeight: 600, fontSize: 13,
                  color: s.vencidas > 0 ? tk.terra : tk.iron,
                  fontVariantNumeric: 'tabular-nums',
                }}>{fmt(s.total)}</span>
              </div>
              <MbBar pct={(s.total / maxCashflow) * 100} variant={s.vencidas > 0 ? 'crit' : 'default'} />
            </div>
          ))}
        </MbSection>
      )}
    </MbCard>
  )
}

function CompraSemanalCard({ data, onInsertMessage }: { data: CompraSemanalData; onInsertMessage: (m: Message) => void }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})

  const platosOk = data.platos.filter(p => p.encontrada)
  const platosNok = data.platos.filter(p => !p.encontrada)

  function toggle(i: number) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  }

  function pedirEmail(grupo: CompraSemanalGrupo) {
    const items = grupo.items.map(i => `  - ${i.nombre}: ${i.cantidad} ${i.unidad || 'ud'}`).join('\n')
    const body = `Estimado equipo de ${grupo.proveedor.nombre},\n\nNecesitamos el siguiente pedido para esta semana:\n\n${items}\n\nPor favor, confirmen disponibilidad y fecha de entrega.\n\nMuchas gracias,\nEquipo MarginBites`
    const mailtoItems = grupo.items.map(i => `• ${i.nombre}: ${i.cantidad} ${i.unidad || 'ud'}`).join('%0A')
    const subject = encodeURIComponent(`Pedido semanal - MarginBites`)
    const bodyEncoded = encodeURIComponent(body)
    const to = grupo.proveedor.email || ''
    window.open(`mailto:${to}?subject=${subject}&body=${bodyEncoded}`)
  }

  function pedirWhatsApp(grupo: CompraSemanalGrupo) {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const lines = grupo.items.map(i => `• ${i.nombre}: ${i.cantidad} ${i.unidad || 'ud'}`).join('\n')
    const msg = encodeURIComponent(`Hola, pedido para la semana (${today}):\n\n${lines}\n\nMuchas gracias`)
    const phone = (grupo.proveedor.phone || '').replace(/\s+/g, '')
    window.open(`https://wa.me/${phone}?text=${msg}`)
  }

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #e8e2db' }
  const labelStyle: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834' }
  const dimStyle: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45 }

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      {/* Header */}
      <div style={{ backgroundColor: '#3d3834', borderRadius: '16px 16px 0 0', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#dfd5c9', margin: '0 0 3px' }}>Lista de la compra semanal</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#dfd5c9', opacity: 0.5, margin: 0 }}>
            {platosOk.map(p => `${p.nombre} ×${p.raciones}`).join(' · ')}
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#dfd5c9', opacity: 0.45, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Coste estimado</p>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#19f973', margin: 0 }}>{data.coste_total_estimado}€</p>
        </div>
      </div>

      {/* Platos no encontrados */}
      {platosNok.length > 0 && (
        <div style={{ backgroundColor: '#fcf2e8', border: '1px solid #c97b3d', borderTop: 'none', padding: '8px 18px' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', margin: 0 }}>
            Sin escandallo: {platosNok.map(p => p.nombre).join(', ')}
          </p>
        </div>
      )}

      {/* Grupos por proveedor */}
      {data.grupos.map((grupo, gi) => (
        <div key={gi} style={{ border: '1px solid #e8e2db', borderTop: gi === 0 && platosNok.length === 0 ? '1px solid #e8e2db' : 'none' }}>
          {/* Supplier header */}
          <div
            onClick={() => toggle(gi)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 18px', cursor: 'pointer', backgroundColor: expanded[gi] ? '#faf6ec' : '#fff' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#19f973', flexShrink: 0 }} />
              <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#3d3834' }}>{grupo.proveedor.nombre}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4 }}>{grupo.items.length} art.</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {grupo.coste_total > 0 && (
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', fontWeight: 700 }}>{grupo.coste_total}€</span>
              )}
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#3d3834" strokeWidth={2} style={{ opacity: 0.4, transform: expanded[gi] ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Items */}
          {expanded[gi] && (
            <div style={{ padding: '0 18px 12px', backgroundColor: '#faf6ec' }}>
              <div style={{ marginBottom: 10 }}>
                {grupo.items.map((item, ii) => (
                  <div key={ii} style={rowStyle}>
                    <div>
                      <span style={labelStyle}>{item.nombre}</span>
                      {item.recetas.length > 1 && (
                        <span style={{ ...dimStyle, marginLeft: 6 }}>{item.recetas.join(', ')}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', fontWeight: 700 }}>
                        {item.cantidad} {item.unidad || 'ud'}
                      </span>
                      {item.subtotal != null && (
                        <span style={dimStyle}>{item.subtotal}€</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
                {grupo.proveedor.email && (
                  <button
                    onClick={() => pedirEmail(grupo)}
                    style={{ flex: 1, padding: '7px 0', backgroundColor: '#3d3834', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#dfd5c9' }}
                  >
                    Email
                  </button>
                )}
                {grupo.proveedor.phone && (
                  <button
                    onClick={() => pedirWhatsApp(grupo)}
                    style={{ flex: 1, padding: '7px 0', backgroundColor: '#25d366', border: 'none', borderRadius: 9, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, fontWeight: 700, color: '#fff' }}
                  >
                    WhatsApp
                  </button>
                )}
                {!grupo.proveedor.email && !grupo.proveedor.phone && (
                  <span style={{ ...dimStyle, padding: '7px 0' }}>Sin contacto registrado</span>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Sin proveedor */}
      {data.sinProveedor.length > 0 && (
        <div style={{ border: '1px solid #e8e2db', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '11px 18px', backgroundColor: '#faf6ec' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>Sin proveedor asignado</p>
          {data.sinProveedor.map((item, i) => (
            <div key={i} style={rowStyle}>
              <span style={labelStyle}>{item.nombre}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', fontWeight: 700 }}>{item.cantidad} {item.unidad || 'ud'}</span>
            </div>
          ))}
        </div>
      )}

      {data.grupos.length > 0 && data.sinProveedor.length === 0 && (
        <div style={{ height: 16, borderRadius: '0 0 16px 16px', border: '1px solid #e8e2db', borderTop: 'none', backgroundColor: '#fff' }} />
      )}
    </div>
  )
}

function MiniBarChart({ data }: { data: ChartData }) {
  const max = Math.max(...data.datos.map(d => d.value), 1)
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 8px' }}>
        {data.titulo}
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {data.datos.map((d, i) => {
          const pct = Math.round((d.value / max) * 100)
          const label = d.label.length > 18 ? d.label.slice(0, 16) + '…' : d.label
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.6, width: 96, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {label}
              </span>
              <div style={{ flex: 1, height: 13, backgroundColor: '#e8e2db', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', backgroundColor: '#c97b3d', borderRadius: 3 }} />
              </div>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', width: 50, flexShrink: 0, textAlign: 'right' }}>
                {d.value}{data.unidad}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function MiniLineChart({ data }: { data: ChartData }) {
  const W = 280
  const H = 88
  const PL = 34, PR = 8, PT = 8, PB = 22
  const cW = W - PL - PR
  const cH = H - PT - PB
  const vals = data.datos.map(d => d.value)
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const range = maxV - minV || 1
  const n = data.datos.length
  const pts = data.datos.map((d, i) => ({
    x: PL + (n < 2 ? cW / 2 : (i / (n - 1)) * cW),
    y: PT + (1 - (d.value - minV) / range) * cH,
    label: d.label,
    value: d.value,
  }))
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 6px' }}>
        {data.titulo}
      </p>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }}>
        {[0, 0.5, 1].map((t, i) => (
          <line key={i} x1={PL} y1={PT + t * cH} x2={W - PR} y2={PT + t * cH} stroke="#e8e2db" strokeWidth={0.5} />
        ))}
        {[0, 1].map((t, i) => (
          <text key={i} x={PL - 3} y={PT + t * cH + 3} textAnchor="end" fontFamily="DM Mono, monospace" fontSize={8} fill="#3d3834" fillOpacity={0.45}>
            {Math.round(t === 0 ? maxV : minV)}{data.unidad}
          </text>
        ))}
        <path d={pathD} fill="none" stroke="#c97b3d" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill="#c97b3d" />
        ))}
        {[pts[0], pts[pts.length - 1]].filter(Boolean).map((p, i) => (
          <text key={i} x={p.x} y={H - 4} textAnchor={i === 0 ? 'start' : 'end'} fontFamily="DM Mono, monospace" fontSize={8} fill="#3d3834" fillOpacity={0.5}>
            {p.label.slice(0, 7)}
          </text>
        ))}
      </svg>
    </div>
  )
}

function MiniChart({ data }: { data: ChartData }) {
  return (
    <div style={{ backgroundColor: '#faf6ec', border: '1px solid #e8e2db', borderRadius: 0, padding: '12px 14px', marginBottom: 10 }}>
      {data.tipo === 'bar' ? <MiniBarChart data={data} /> : <MiniLineChart data={data} />}
    </div>
  )
}

function NecesidadesPedidoCard({
  data,
  onInsertMessage,
}: {
  data: NecesidadesPedidoData
  onInsertMessage: (msg: Message) => void
}) {
  const [dismissed, setDismissed] = useState<Record<number, boolean>>({})
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true })

  const iconEmail = (
    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  )
  const iconWA = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
    </svg>
  )

  function toggleExpand(i: number) {
    setExpanded(prev => ({ ...prev, [i]: !prev[i] }))
  }

  function handleEmail(grupo: NecesidadGrupo) {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const itemLines = grupo.items.map(it => `  - ${it.nombre}: ${it.cantidad ?? '?'}${it.unidad ? ' ' + it.unidad : ''}`).join('\n')
    const subject = `Pedido ${today} - MarginBites`
    const body = `Estimado equipo de ${grupo.proveedor.nombre},\n\nNecesitamos realizar el siguiente pedido para la próxima entrega:\n\n${itemLines}\n\nPor favor, confirmen disponibilidad y fecha estimada de entrega.\n\nMuchas gracias,\nEquipo MarginBites`
    onInsertMessage({
      role: 'email_proposal',
      content: '',
      emailProposal: {
        proveedor: grupo.proveedor.nombre,
        to: grupo.proveedor.email || '',
        subject,
        body,
        items: grupo.items.map(it => ({ nombre: it.nombre, cantidad: it.cantidad ?? undefined, unidad: it.unidad ?? undefined })),
      },
    })
  }

  function handleWhatsApp(grupo: NecesidadGrupo) {
    const today = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const itemLines = grupo.items.map(it => `• ${it.nombre}${it.cantidad ? ': ' + it.cantidad + (it.unidad ? ' ' + it.unidad : '') : ''}`).join('\n')
    const message = `Hola, soy MarginBites 👋\n\nPedido para el ${today}:\n\n${itemLines}\n\nMuchas gracias 🙏`
    onInsertMessage({
      role: 'whatsapp_proposal',
      content: '',
      whatsappProposal: {
        proveedor: grupo.proveedor.nombre,
        phone: grupo.proveedor.phone || '',
        message,
        items: grupo.items.map(it => ({ nombre: it.nombre, cantidad: it.cantidad ?? undefined, unidad: it.unidad ?? undefined })),
      },
    })
  }

  const active = data.grupos.filter((_, i) => !dismissed[i])

  if (active.length === 0) {
    return (
      <div style={{ backgroundColor: '#d6f9e0', border: '1.5px solid #0fa651', borderRadius: 0, padding: '14px 18px', maxWidth: 580 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#0fa651" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#0fa651' }}>Todos los pedidos gestionados</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 580 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#3d3834', margin: 0 }}>Pedidos pendientes</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.45, margin: 0 }}>{active.length} proveedor{active.length !== 1 ? 'es' : ''} con reposición pendiente</p>
        </div>
      </div>

      {/* Supplier cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.grupos.map((grupo, i) => {
          if (dismissed[i]) return null
          const isExp = expanded[i]
          return (
            <div key={i} style={{ backgroundColor: '#fff', border: '1.5px solid #e8e2db', borderRadius: 0, overflow: 'hidden' }}>
              {/* Supplier header row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', cursor: 'pointer' }} onClick={() => toggleExpand(i)}>
                <span style={{ fontSize: 10, color: '#3d3834', opacity: 0.35, flexShrink: 0, transform: isExp ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13, color: '#3d3834', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{grupo.proveedor.nombre}</p>
                  <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: 0 }}>{grupo.items.length} artículo{grupo.items.length !== 1 ? 's' : ''}</p>
                </div>
              </div>

              {/* Expanded items list */}
              {isExp && (
                <div style={{ borderTop: '1px solid #e8e2db', padding: '8px 14px 10px' }}>
                  {grupo.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '4px 0', borderBottom: j < grupo.items.length - 1 ? '1px solid #f5f2ee' : 'none' }}>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', flex: 1 }}>
                        {item.nombre}
                      </span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.7, flexShrink: 0 }}>
                        {item.cantidad ?? '?'} {item.unidad || 'ud'}
                      </span>
                      <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.35, flexShrink: 0 }}>
                        {item.dias_sin_pedir === 'nunca' ? 'nunca pedido' : `${item.dias_sin_pedir}d`}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div style={{ borderTop: '1px solid #e8e2db', padding: '10px 14px', display: 'flex', gap: 6, flexWrap: 'wrap', backgroundColor: '#faf6ec' }}>
                <button
                  onClick={() => handleEmail(grupo)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', fontWeight: 600 }}
                >
                  {iconEmail} Email
                </button>
                <button
                  onClick={() => handleWhatsApp(grupo)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', backgroundColor: '#d6f9e0', border: '1px solid #0fa651', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', fontWeight: 600 }}
                >
                  {iconWA} WhatsApp
                </button>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setDismissed(prev => ({ ...prev, [i]: true }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.6 }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  Más tarde
                </button>
                <button
                  onClick={() => setDismissed(prev => ({ ...prev, [i]: true }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', backgroundColor: '#fff5f5', border: '1px solid #a83e1e', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#a83e1e', opacity: 0.8 }}
                >
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  Eliminar
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EmailCard({ proposal, onDiscard }: { proposal: EmailProposal; onDiscard: () => void }) {
  const [subject, setSubject] = useState(proposal.subject)
  const [body, setBody] = useState(proposal.body)
  const [sending, setSending] = useState(false)
  const [sentInfo, setSentInfo] = useState<{ to: string; num_order?: string } | null>(null)
  const [error, setError] = useState('')

  async function handleSend() {
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: proposal.to, subject, body, proveedor: proposal.proveedor, items: proposal.items }),
      })
      const json = await res.json()
      if (json.ok) setSentInfo({ to: proposal.to, num_order: json.num_order })
      else setError(json.error || 'Error al enviar')
    } catch { setError('Error de conexión') }
    finally { setSending(false) }
  }

  if (sentInfo) {
    return (
      <div style={{ backgroundColor: '#d6f9e0', border: '1.5px solid #19f973', borderRadius: 0, padding: '14px 18px', maxWidth: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sentInfo.num_order ? 6 : 0 }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#0fa651" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#0fa651' }}>Email enviado a {sentInfo.to}</span>
        </div>
        {sentInfo.num_order && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0fa651', opacity: 0.7, margin: '0 0 0 28px' }}>
            Pedido creado: {sentInfo.num_order} · pendiente de recepción
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#faf6ec', border: '1.5px solid #19f973', borderRadius: 0, padding: 18, maxWidth: '90%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#3d3834', margin: 0 }}>Borrador de pedido — {proposal.proveedor}</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.5, margin: 0 }}>Para: {proposal.to}</p>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.5, display: 'block', marginBottom: 4 }}>Asunto</label>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', backgroundColor: '#f5f2ee', border: '1px solid #e8e2db', borderRadius: 8, padding: '8px 10px', outline: 'none' }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.5, display: 'block', marginBottom: 4 }}>Cuerpo del email</label>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={9}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', backgroundColor: '#f5f2ee', border: '1px solid #e8e2db', borderRadius: 8, padding: '8px 10px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {error && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#a83e1e', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#19f973', border: 'none', borderRadius: 0, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#2a2522', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          {sending ? 'Enviando...' : 'Enviar email'}
        </button>
        <button
          onClick={onDiscard}
          style={{ padding: '10px 16px', backgroundColor: '#f5f2ee', border: '1px solid #e8e2db', borderRadius: 0, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.6 }}
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

function AlbaranGuardadoCard({ data }: { data: AlbaranGuardadoData }) {
  const priceMap: Record<string, AlbaranGuardadoPriceChange> = {}
  for (const pc of data.price_changes) priceMap[pc.nombre] = pc

  const hasFoodCostWarning = data.food_cost_impact && data.food_cost_impact.trim().length > 0

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      {/* Header */}
      <div style={{ backgroundColor: '#3d3834', borderRadius: '16px 16px 0 0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#19f973" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#dfd5c9', margin: 0 }}>Albarán guardado</p>
          </div>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#dfd5c9', opacity: 0.5, margin: '3px 0 0' }}>
            {data.vendor || 'Proveedor'}{data.delivery_num ? ` · #${data.delivery_num}` : ''} · {data.date_delivery}
          </p>
        </div>
        {data.total != null && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#dfd5c9', opacity: 0.45, margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</p>
            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 18, color: '#19f973', margin: 0 }}>{data.total}€</p>
          </div>
        )}
      </div>

      {/* Lines */}
      <div style={{ border: '1px solid #e8e2db', borderTop: 'none', backgroundColor: '#fff' }}>
        {data.lineas.map((l, i) => {
          const pc = priceMap[l.nombre]
          const hasDelta = pc && pc.diff_pct !== null
          const isUp = hasDelta && pc.diff_pct! > 0
          const isDown = hasDelta && pc.diff_pct! < 0
          const deltaBg = isUp ? '#fbeae2' : '#d6f9e0'
          const deltaColor = isUp ? '#a83e1e' : '#0fa651'
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 20px', borderBottom: i < data.lineas.length - 1 ? '1px solid #f5f2ee' : 'none' }}>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</span>
              <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, flexShrink: 0 }}>{l.cantidad != null ? `${l.cantidad}${l.unidad ? ' ' + l.unidad : ''}` : ''}</span>
              {l.precio_unitario != null && (
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', flexShrink: 0 }}>{l.precio_unitario}€</span>
              )}
              {hasDelta && (
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, padding: '2px 5px', borderRadius: 4, backgroundColor: deltaBg, color: deltaColor, fontWeight: 700, flexShrink: 0 }}>
                  {isUp ? '+' : ''}{pc.diff_pct}%
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Price change alerts */}
      {data.price_changes.filter(pc => pc.diff_pct !== null && Math.abs(pc.diff_pct) >= 5).length > 0 && (
        <div style={{ border: '1px solid #c97b3d', borderTop: 'none', backgroundColor: '#fcf2e8', padding: '10px 20px' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#c97b3d', margin: '0 0 4px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Variaciones de precio</p>
          {data.price_changes.filter(pc => pc.diff_pct !== null && Math.abs(pc.diff_pct) >= 5).map((pc, i) => (
            <p key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c97b3d', margin: '2px 0' }}>
              {pc.nombre}: {pc.precio_anterior != null ? `${pc.precio_anterior}€ → ` : ''}{pc.precio_nuevo}€
              {' '}
              <span style={{ fontWeight: 700, color: pc.diff_pct! > 0 ? '#a83e1e' : '#0fa651' }}>
                ({pc.diff_pct! > 0 ? '+' : ''}{pc.diff_pct}%)
              </span>
              {pc.recetas_afectadas.length > 0 && (
                <span style={{ opacity: 0.6 }}> · afecta a: {pc.recetas_afectadas.join(', ')}</span>
              )}
            </p>
          ))}
        </div>
      )}

      {/* Food cost warning */}
      {hasFoodCostWarning && (
        <div style={{ border: '1px solid #a83e1e', borderTop: 'none', backgroundColor: '#fbeae2', padding: '10px 20px', borderRadius: '0 0 16px 16px' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#a83e1e', margin: 0, whiteSpace: 'pre-line' }}>
            {data.food_cost_impact.replace(/^[\n]+/, '')}
          </p>
        </div>
      )}

      {!hasFoodCostWarning && (
        <div style={{ border: '1px solid #e8e2db', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '10px 20px', backgroundColor: '#faf6ec' }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: 0 }}>
            {data.lineas.length} línea{data.lineas.length !== 1 ? 's' : ''} · precios actualizados en ingredientes
          </p>
        </div>
      )}
    </div>
  )
}

function InformeSemanalCard({ data }: { data: InformeSemanalData }) {
  const variacionColor = data.gasto.variacion === null ? '#3d3834' : data.gasto.variacion > 0 ? '#a83e1e' : '#0fa651'
  const variacionLabel = data.gasto.variacion === null ? '—' : `${data.gasto.variacion > 0 ? '+' : ''}${data.gasto.variacion}%`

  function compartirWhatsApp() {
    const lines: string[] = [
      `📊 *Informe semanal MarginBites*`,
      `${data.fecha}`,
      '',
      `💰 Gasto compras: ${data.gasto.total}€ (${data.gasto.pedidos} pedidos)${data.gasto.variacion !== null ? ` ${variacionLabel} vs semana anterior` : ''}`,
      data.merma.total > 0 ? `🗑 Merma: ${data.merma.total}€ (${data.merma.eventos} registros)` : '',
      data.facturas.vencidas_c > 0 ? `⚠️ Facturas vencidas: ${data.facturas.vencidas_c} (${data.facturas.vencidas_t}€)` : '',
      data.facturas.pendientes_c > 0 ? `📄 Facturas pendientes: ${data.facturas.pendientes_c} (${data.facturas.pendientes_t}€)` : '',
      data.precios_subida.length > 0 ? `📈 Subidas precio: ${data.precios_subida.map(p => `${p.nombre} +${p.diff_pct}%`).join(', ')}` : '',
      data.food_cost_critico.length > 0 ? `🔴 Food cost crítico: ${data.food_cost_critico.map(r => `${r.nombre} ${r.pct}%`).join(', ')}` : '',
    ].filter(Boolean)
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`)
  }

  const metricStyle: React.CSSProperties = { backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 0, padding: '12px 14px' }
  const metricLabel: React.CSSProperties = { fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#3d3834', opacity: 0.45, margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }
  const metricValue: React.CSSProperties = { fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 20, color: '#3d3834', margin: 0 }

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      {/* Header */}
      <div style={{ backgroundColor: '#3d3834', borderRadius: '16px 16px 0 0', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#dfd5c9', margin: '0 0 2px' }}>Informe semanal</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#dfd5c9', opacity: 0.5, margin: 0 }}>{data.fecha}</p>
        </div>
        <button
          onClick={compartirWhatsApp}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', backgroundColor: '#19f973', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, color: '#3d3834' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
          Compartir
        </button>
      </div>

      {/* Metrics grid */}
      <div style={{ border: '1px solid #e8e2db', borderTop: 'none', backgroundColor: '#faf6ec', padding: '14px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          {/* Gasto */}
          <div style={metricStyle}>
            <p style={metricLabel}>Gasto semana</p>
            <p style={metricValue}>{data.gasto.total}€</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: variacionColor, margin: '3px 0 0' }}>
              {variacionLabel} vs anterior
            </p>
          </div>
          {/* Merma */}
          <div style={metricStyle}>
            <p style={metricLabel}>Merma</p>
            <p style={{ ...metricValue, color: data.merma.total > 0 ? '#c97b3d' : '#0fa651' }}>{data.merma.total}€</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, margin: '3px 0 0' }}>
              {data.merma.eventos} registro{data.merma.eventos !== 1 ? 's' : ''}
            </p>
          </div>
          {/* Facturas vencidas */}
          <div style={{ ...metricStyle, backgroundColor: data.facturas.vencidas_c > 0 ? '#fbeae2' : '#fff', borderColor: data.facturas.vencidas_c > 0 ? '#a83e1e' : '#e8e2db' }}>
            <p style={metricLabel}>Facturas vencidas</p>
            <p style={{ ...metricValue, color: data.facturas.vencidas_c > 0 ? '#a83e1e' : '#0fa651' }}>
              {data.facturas.vencidas_c > 0 ? `${data.facturas.vencidas_c} (${data.facturas.vencidas_t}€)` : 'Ninguna'}
            </p>
          </div>
          {/* Facturas pendientes */}
          <div style={metricStyle}>
            <p style={metricLabel}>Pendientes pago</p>
            <p style={metricValue}>{data.facturas.pendientes_c}</p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, margin: '3px 0 0' }}>
              {data.facturas.pendientes_t}€ total
            </p>
          </div>
        </div>

        {/* Top proveedores */}
        {data.gasto.top.length > 0 && (
          <div style={{ backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 0, padding: '10px 14px', marginBottom: 8 }}>
            <p style={metricLabel}>Top proveedores</p>
            {data.gasto.top.map((v, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834' }}>{v.vendor}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', fontWeight: 700 }}>{v.t}€</span>
              </div>
            ))}
          </div>
        )}

        {/* Subidas de precio */}
        {data.precios_subida.length > 0 && (
          <div style={{ backgroundColor: '#fcf2e8', border: '1px solid #c97b3d', borderRadius: 0, padding: '10px 14px', marginBottom: 8 }}>
            <p style={{ ...metricLabel, color: '#c97b3d' }}>Subidas de precio esta semana</p>
            {data.precios_subida.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#c97b3d' }}>{p.nombre}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, color: '#a83e1e', backgroundColor: '#fbeae2', padding: '2px 6px', borderRadius: 4 }}>+{p.diff_pct}%</span>
              </div>
            ))}
          </div>
        )}

        {/* Food cost crítico */}
        {data.food_cost_critico.length > 0 && (
          <div style={{ backgroundColor: '#fbeae2', border: '1px solid #a83e1e', borderRadius: 0, padding: '10px 14px' }}>
            <p style={{ ...metricLabel, color: '#a83e1e' }}>Food cost crítico (&gt;35%)</p>
            {data.food_cost_critico.map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#a83e1e' }}>{r.nombre}</span>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, fontWeight: 700, color: '#a83e1e', backgroundColor: '#a83e1e', padding: '2px 6px', borderRadius: 4 }}>{r.pct}%</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ border: '1px solid #e8e2db', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '10px 20px', backgroundColor: '#faf6ec' }}>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.35, margin: 0, textAlign: 'center' }}>
          Datos del periodo: últimos 7 días
        </p>
      </div>
    </div>
  )
}

interface StoredConvo {
  messages: Message[]
  lastUsed: number  // timestamp ms
}

interface Sugerencia {
  label: string
  sub: string
  chat: string
  scan?: boolean
}

interface ChartPoint {
  label: string
  value: number
}

interface ChartData {
  tipo: 'bar' | 'line'
  titulo: string
  datos: ChartPoint[]
  unidad: string
}

interface FacturaPendiente {
  id: number
  invoice_num: string | null
  vendor: string | null
  total: number | null
  date_due: string | null
  date_invoice: string | null
  vencida: boolean
  dias_vencida: number | null
}

interface FacturasPagarData {
  facturas: FacturaPendiente[]
}

interface CompraSemanalItem {
  nombre: string
  cantidad: number
  unidad: string | null
  coste_unitario: number | null
  subtotal: number | null
  recetas: string[]
}

interface CompraSemanalGrupo {
  proveedor: { nombre: string; email: string | null; phone: string | null }
  items: CompraSemanalItem[]
  coste_total: number
}

interface CompraSemanalPlato {
  nombre: string
  raciones: number
  encontrada: boolean
}

interface CompraSemanalData {
  platos: CompraSemanalPlato[]
  grupos: CompraSemanalGrupo[]
  sinProveedor: (CompraSemanalItem & { proveedor: null })[]
  coste_total_estimado: number
}

interface AlertItem {
  id: string
  tipo: 'danger' | 'warning' | 'info'
  titulo: string
  detalle: string
  chat?: string
  href?: string
}

interface AlbaranGuardadoLinea {
  nombre: string
  cantidad: number | null
  unidad: string | null
  precio_unitario: number | null
  total_linea: number | null
}

interface AlbaranGuardadoPriceChange {
  nombre: string
  precio_anterior: number | null
  precio_nuevo: number
  diff_pct: number | null
  recetas_afectadas: string[]
}

interface AlbaranGuardadoData {
  albaran_id: number
  vendor: string | null
  delivery_num: string | null
  date_delivery: string
  base: number | null
  taxes: number | null
  total: number | null
  lineas: AlbaranGuardadoLinea[]
  price_changes: AlbaranGuardadoPriceChange[]
  food_cost_impact: string
}

interface InformeSemanalData {
  fecha: string
  gasto: { total: number; pedidos: number; variacion: number | null; top: { vendor: string; t: number }[] }
  merma: { total: number; eventos: number; top: { nombre: string; t: number }[] }
  facturas: { vencidas_c: number; vencidas_t: number; pendientes_c: number; pendientes_t: number }
  precios_subida: { nombre: string; diff_pct: number; precio: number; vendor: string }[]
  food_cost_critico: { nombre: string; pct: number }[]
}

interface MomentoData {
  momento: string
  sugerencias: Sugerencia[]
}

function getMomento(hour: number): MomentoData {
  if (hour >= 6 && hour < 11) {
    const isMonday = new Date().getDay() === 1
    return {
      momento: isMonday ? 'Lunes · Apertura' : 'Apertura',
      sugerencias: isMonday
        ? [
            { label: 'Informe semanal', sub: 'Resumen de la semana pasada', chat: 'Dame el informe de la semana pasada' },
            { label: '¿Qué tengo que pedir?', sub: 'Análisis de reposición', chat: 'Quiero hacer un pedido' },
            { label: 'Facturas urgentes', sub: 'Vencen esta semana', chat: '¿Qué facturas vencen esta semana?' },
            { label: 'Gasto del mes', sub: 'Vs mes anterior', chat: 'Dame el resumen de gasto de este mes comparado con el anterior' },
          ]
        : [
            { label: '¿Qué tengo que pedir?', sub: 'Análisis de reposición', chat: 'Quiero hacer un pedido' },
            { label: 'Entregas de hoy', sub: 'Albaranes esperados', chat: '¿Qué entregas tengo previstas para hoy?' },
            { label: 'Facturas urgentes', sub: 'Vencen esta semana', chat: '¿Qué facturas vencen esta semana?' },
            { label: 'Gasto del mes', sub: 'Vs mes anterior', chat: 'Dame el resumen de gasto de este mes comparado con el anterior' },
          ],
    }
  }
  if (hour >= 11 && hour < 16) {
    return {
      momento: 'Servicio',
      sugerencias: [
        { label: 'Registrar producción', sub: 'Raciones del servicio', chat: 'Quiero registrar la producción del servicio de hoy' },
        { label: 'Escanear albarán', sub: 'Entrega recibida', chat: '', scan: true },
        { label: 'Registrar merma', sub: 'Producto no aprovechado', chat: 'Quiero registrar una merma' },
        { label: '¿Cómo vamos hoy?', sub: 'Gastos y pedidos', chat: 'Dame un resumen rápido de cómo vamos hoy' },
      ],
    }
  }
  if (hour >= 16 && hour < 20) {
    return {
      momento: 'Entre servicios',
      sugerencias: [
        { label: 'Pedir para mañana', sub: 'Reposición urgente', chat: 'Quiero hacer un pedido para mañana' },
        { label: 'Merma del día', sub: 'Registrar pérdidas', chat: 'Quiero registrar la merma del servicio de hoy' },
        { label: 'Facturas pendientes', sub: 'Control de pagos', chat: '¿Qué facturas tengo pendientes de pagar?' },
        { label: 'Precios que subieron', sub: 'Alertas de coste', chat: '¿Qué ingredientes han subido de precio recientemente?' },
      ],
    }
  }
  return {
    momento: 'Cierre',
    sugerencias: [
      { label: 'Resumen del día', sub: 'Gastos, pedidos y merma', chat: 'Dame el resumen completo del día de hoy' },
      { label: 'Anticipar problemas', sub: 'Predicción a 60 días', chat: 'Hazme el análisis predictivo' },
      { label: 'Merma de cierre', sub: 'Registrar sobras', chat: 'Quiero registrar la merma de cierre' },
      { label: 'Balance del mes', sub: 'Cómo vamos de costes', chat: '¿Cómo vamos de gasto este mes?' },
    ],
  }
}

const STORAGE_KEY = 'mb_chat_history'
const CURRENT_KEY = 'mb_chat_current'
const MAX_HISTORY = 15
const EXPIRY_MS = 15 * 24 * 60 * 60 * 1000 // 15 days

function loadHistory(): StoredConvo[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    const now = Date.now()
    // Filter out expired and ensure format
    return (raw as any[])
      .filter(c => c && c.messages && c.lastUsed && (now - c.lastUsed) < EXPIRY_MS)
      .slice(0, MAX_HISTORY)
  } catch { return [] }
}

function saveHistory(convos: StoredConvo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos.slice(0, MAX_HISTORY)))
  } catch {}
}

function loadCurrent(): Message[] {
  try {
    return JSON.parse(localStorage.getItem(CURRENT_KEY) || '[]')
  } catch { return [] }
}

function saveCurrent(messages: Message[]) {
  try {
    localStorage.setItem(CURRENT_KEY, JSON.stringify(messages.filter(m => m.role !== 'email_proposal' && m.role !== 'brief_cards' && m.role !== 'pedido_selector' && m.role !== 'necesidades_pedido' && (m.role as string) !== 'channel_choice' && (m.role as string) !== 'whatsapp_proposal' && m.role !== 'ingredientes_cards' && m.role !== 'proveedores_cards' && m.role !== 'pedidos_recibir_cards' && m.role !== 'precios_alerta_cards' && m.role !== 'food_cost_cards' && m.role !== 'alertas_predictivas_cards')))
  } catch {}
}

export default function KitchenChat() {
  const [greeting, setGreeting] = useState('')
  const [momento, setMomento] = useState<MomentoData | null>(null)
  const [alerts, setAlerts] = useState<AlertItem[]>([])
  const [dismissedAlerts, setDismissedAlerts] = useState<Record<string, boolean>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<StoredConvo[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const scanRef = useRef<HTMLInputElement>(null)

  // Start fresh on every mount — history accessible via Historial button
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches')
    setMomento(getMomento(h))
    fetch('/api/alerts').then(r => r.json()).then(d => { if (d.alerts) setAlerts(d.alerts) }).catch(() => {})
    // Save any previous conversation to history before starting fresh
    const current = loadCurrent()
    if (current.length > 0) {
      const existing = loadHistory()
      const dedup = existing.filter(c => JSON.stringify(c.messages) !== JSON.stringify(current))
      saveHistory([{ messages: current, lastUsed: Date.now() }, ...dedup])
    }
    setMessages([])
    setHistory(loadHistory())
  }, [])

  // Persist current conversation on every change
  useEffect(() => {
    saveCurrent(messages)
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function newConversation() {
    if (messages.length > 0) {
      const convo: StoredConvo = { messages, lastUsed: Date.now() }
      const updated = [convo, ...history].slice(0, MAX_HISTORY)
      setHistory(updated)
      saveHistory(updated)
    }
    setMessages([])
    saveCurrent([])
    setActionMsg('')
  }

  function loadConversation(convo: StoredConvo) {
    // Save current first
    if (messages.length > 0) {
      const c: StoredConvo = { messages, lastUsed: Date.now() }
      const updated = [c, ...history.filter(h => h !== convo)].slice(0, MAX_HISTORY)
      setHistory(updated)
      saveHistory(updated)
    }
    setMessages(convo.messages)
    saveCurrent(convo.messages)
    setShowHistory(false)
  }

  function deleteConversation(idx: number, e: React.MouseEvent) {
    e.stopPropagation()
    const updated = history.filter((_, i) => i !== idx)
    setHistory(updated)
    saveHistory(updated)
  }

  async function send(text: string, img?: string) {
    const t = text.trim()
    if (!t && !img) return
    const userMsg: Message = { role: 'user', content: t, image: img }
    // Convert special message types for API: brief_cards → assistant placeholder, drop email_proposal/channel_choice/whatsapp_proposal
    const apiMessages = messages.flatMap(m => {
      if (m.role === 'brief_cards') return [{ role: 'assistant' as const, content: '[Brief diario generado y mostrado al usuario]' }]
      if (m.role === 'pedido_selector') return [{ role: 'assistant' as const, content: '[Selector de proveedores mostrado al usuario]' }]
      if (m.role === 'necesidades_pedido') return [{ role: 'assistant' as const, content: '[Análisis de pedidos pendientes mostrado al usuario con opciones por proveedor]' }]
      if (m.role === 'compra_semanal') return [{ role: 'assistant' as const, content: '[Lista de la compra semanal generada y mostrada al usuario, agrupada por proveedor con cantidades y coste estimado]' }]
      if (m.role === 'facturas_pagar') return [{ role: 'assistant' as const, content: '[Lista de facturas pendientes mostrada al usuario con botón para marcar cada una como pagada]' }]
      if (m.role === 'albaran_guardado') return [{ role: 'assistant' as const, content: '[Albarán guardado con todas sus líneas — precios actualizados en el sistema]' }]
      if (m.role === 'informe_semanal') return [{ role: 'assistant' as const, content: '[Informe semanal generado y mostrado al usuario con gasto, merma, facturas y alertas]' }]
      if (m.role === 'ingredientes_cards') return [{ role: 'assistant' as const, content: `[Lista de ${m.ingredientesCards?.ingredientes?.length ?? 0} ingredientes mostrada al usuario en tarjetas]` }]
      if (m.role === 'proveedores_cards') return [{ role: 'assistant' as const, content: `[Lista de ${m.proveedoresCards?.proveedores?.length ?? 0} proveedores mostrada al usuario en tarjetas]` }]
      if (m.role === 'pedidos_recibir_cards') return [{ role: 'assistant' as const, content: `[${m.pedidosRecibirCards?.pedidos?.length ?? 0} pedidos pendientes de recibir mostrados al usuario en tarjetas]` }]
      if (m.role === 'precios_alerta_cards') return [{ role: 'assistant' as const, content: `[${m.preciosAlertaCards?.subidas?.length ?? 0} alertas de subida de precio mostradas al usuario en tarjetas]` }]
      if (m.role === 'food_cost_cards') return [{ role: 'assistant' as const, content: `[Análisis de food cost de ${m.foodCostCards?.recetas?.length ?? 0} recetas mostrado al usuario en tarjetas]` }]
      if (m.role === 'alertas_predictivas_cards') return [{ role: 'assistant' as const, content: '[Análisis predictivo mostrado al usuario: food cost proyectado, ciclos de reposición, aceleración de precios y cash flow]' }]
      if (m.role === 'whatsapp_proposal') return [{ role: 'assistant' as const, content: '[Borrador de WhatsApp generado y mostrado al usuario]' }]
      if (m.role === 'email_proposal' || (m.role as string) === 'channel_choice') return []
      return [m]
    })
    const history2 = [...messages, userMsg]
    setMessages(history2)
    setInput('')
    setPendingImage(null)
    setIsLoading(true)
    setActionMsg('')
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...apiMessages, userMsg].map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          image: img,
        }),
      })
      if (!res.ok) throw new Error('Error')

      const json = await res.json()
      if (json.action) setActionMsg(json.action)
      if (json.briefCards) {
        setMessages(prev => [...prev, { role: 'brief_cards', content: '', briefCards: json.briefCards }])
      } else if (json.pedidoSelector) {
        setMessages(prev => [...prev, { role: 'pedido_selector', content: '', pedidoSelector: json.pedidoSelector }])
      } else if (json.necesidadesPedido) {
        setMessages(prev => [...prev, { role: 'necesidades_pedido', content: '', necesidadesPedido: json.necesidadesPedido }])
      } else if (json.compraSemanal) {
        setMessages(prev => [...prev, { role: 'compra_semanal', content: '', compraSemanal: json.compraSemanal }])
      } else if (json.facturasPagar) {
        setMessages(prev => [...prev, { role: 'facturas_pagar', content: '', facturasPagar: json.facturasPagar }])
      } else if (json.albaranGuardado) {
        setMessages(prev => [...prev, { role: 'albaran_guardado', content: '', albaranGuardado: json.albaranGuardado }])
      } else if (json.informeSemanal) {
        setMessages(prev => [...prev, { role: 'informe_semanal', content: '', informeSemanal: json.informeSemanal }])
      } else if (json.ingredientesCards) {
        setMessages(prev => [...prev, { role: 'ingredientes_cards', content: '', ingredientesCards: json.ingredientesCards }])
      } else if (json.proveedoresCards) {
        setMessages(prev => [...prev, { role: 'proveedores_cards', content: '', proveedoresCards: json.proveedoresCards }])
      } else if (json.pedidosRecibirCards) {
        setMessages(prev => [...prev, { role: 'pedidos_recibir_cards', content: '', pedidosRecibirCards: json.pedidosRecibirCards }])
      } else if (json.preciosAlertaCards) {
        setMessages(prev => [...prev, { role: 'precios_alerta_cards', content: '', preciosAlertaCards: json.preciosAlertaCards }])
      } else if (json.foodCostCards) {
        setMessages(prev => [...prev, { role: 'food_cost_cards', content: '', foodCostCards: json.foodCostCards }])
      } else if (json.alertasPredictivasCards) {
        setMessages(prev => [...prev, { role: 'alertas_predictivas_cards', content: '', alertasPredictivasCards: json.alertasPredictivasCards }])
      } else if (json.whatsappProposal) {
        setMessages(prev => [...prev, { role: 'whatsapp_proposal', content: '', whatsappProposal: json.whatsappProposal }])
      } else {
        const newMsgs: Message[] = []
        if (json.reply) newMsgs.push({ role: 'assistant', content: json.reply, chartData: json.chartData || undefined })
        if (json.emailProposal) newMsgs.push({ role: 'email_proposal', content: '', emailProposal: json.emailProposal })
        if (newMsgs.length) setMessages(prev => [...prev, ...newMsgs])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error al conectar.' }])
    } finally {
      setIsLoading(false)
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      mediaRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('audio', blob, 'voice.webm')
        const r = await fetch('/api/voice', { method: 'POST', body: fd })
        const { text } = await r.json()
        if (text) send(text)
      }
      mr.start()
      setIsRecording(true)
    } catch {
      alert('No se pudo acceder al microfono')
    }
  }

  function stopRecording() {
    mediaRef.current?.stop()
    setIsRecording(false)
  }

  function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPendingImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function handleScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setIsScanning(true)
    const reader = new FileReader()
    reader.onload = () => {
      const img = reader.result as string
      e.target.value = ''
      setIsScanning(false)
      send(
        'Analiza este documento. Extrae todos los datos en una tabla clara. Si es un albarán: proveedor, número, fecha, líneas de productos con cantidades y precios unitarios y totales. Si es una factura: número, proveedor, fecha de factura, fecha de vencimiento, base imponible, IVA, total. Al final pregúntame si quiero guardarlo.',
        img
      )
    }
    reader.readAsDataURL(file)
  }

  const iconAI = (
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  )

  function startBrief() {
    const h = new Date().getHours()
    const saludo = h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches'
    send(`${saludo}, dame el brief completo del día: pedidos pendientes, facturas que vencen, merma reciente, alertas de precio, cómo vamos en general y qué debería priorizar ahora mismo.`)
  }

  return (
    <div style={{ display: 'flex', height: '100%', backgroundColor: '#f5f2ee' }}>

      {/* History panel */}
      {showHistory && (
        <div style={{ width: 280, flexShrink: 0, backgroundColor: '#fff', borderRight: '1px solid #e8e2db', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <div style={{ padding: '20px 16px 12px', borderBottom: '1px solid #e8e2db', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 14, color: '#3d3834' }}>Conversaciones</span>
            <button onClick={() => setShowHistory(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.4, fontSize: 18, lineHeight: 1 }}>x</button>
          </div>
          {history.length === 0 ? (
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, padding: 16 }}>Sin conversaciones guardadas.</p>
          ) : (
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {history.map((convo, i) => {
                const preview = convo.messages.find(m => m.role === 'user')?.content || '...'
                const date = new Date(convo.lastUsed)
                return (
                  <div key={i} onClick={() => loadConversation(convo)} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #f5f2ee', cursor: 'pointer' }}>
                    <div style={{ flex: 1, padding: '12px 16px' }}>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {preview.slice(0, 50)}
                      </p>
                      <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.4, margin: '3px 0 0' }}>
                        {convo.messages.length} mensajes · {date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                    <button onClick={(e) => deleteConversation(i, e)} style={{ padding: '0 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#3d3834', opacity: 0.25, fontSize: 16 }}>x</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Main chat */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
        <div style={{ flexShrink: 0, padding: '16px 40px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setShowHistory(s => !s)} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
            {showHistory ? 'Ocultar historial' : `Historial (${history.length})`}
          </button>
          {messages.length > 0 && (
            <button onClick={newConversation} style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
              Nueva conversacion
            </button>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 40px 16px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>

            {messages.length === 0 && (
              <div style={{ paddingTop: 28, paddingBottom: 24 }}>

                {/* BRIEF BANNER · iron with grid texture */}
                <div style={{
                  background: tk.iron, color: tk.cream,
                  padding: '22px 24px', marginBottom: 14, position: 'relative', overflow: 'hidden',
                }}>
                  <div style={{
                    position: 'absolute', inset: 0, pointerEvents: 'none',
                    backgroundImage:
                      `linear-gradient(to right, rgba(223,213,201,0.06) 1px, transparent 1px),
                       linear-gradient(to bottom, rgba(223,213,201,0.06) 1px, transparent 1px)`,
                    backgroundSize: '14px 14px',
                  }} />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <p style={{
                      fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em',
                      color: tk.apple, margin: '0 0 8px', textTransform: 'uppercase' as const,
                    }}>
                      {(momento?.momento || 'COCINA').toUpperCase()} · {new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).toUpperCase()}
                    </p>
                    <h1 style={{
                      fontFamily: ff.display, fontWeight: 600, fontSize: 24, lineHeight: 1.1,
                      letterSpacing: '-0.015em', margin: '0 0 16px',
                    }}>
                      {greeting || 'Buenos días'}.<br />
                      <span style={{ opacity: 0.55 }}>¿Qué quieres hacer hoy?</span>
                    </h1>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        onClick={startBrief}
                        disabled={isLoading}
                        style={{
                          padding: '8px 14px', background: tk.apple, color: tk.iron,
                          border: 'none', cursor: 'pointer',
                          fontFamily: ff.mono, fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        BRIEF DEL DÍA <span style={{ opacity: 0.5 }}>→</span>
                      </button>
                      <button
                        onClick={() => scanRef.current?.click()}
                        disabled={isLoading || isScanning}
                        style={{
                          padding: '8px 14px', background: 'transparent', color: tk.cream,
                          border: `1.5px solid ${tk.cream}`, cursor: isLoading || isScanning ? 'not-allowed' : 'pointer',
                          fontFamily: ff.mono, fontSize: 11, fontWeight: 600,
                          letterSpacing: '0.06em', opacity: isLoading || isScanning ? 0.5 : 1,
                          display: 'inline-flex', alignItems: 'center', gap: 8,
                        }}
                      >
                        {isScanning ? 'ANALIZANDO…' : 'ESCANEAR ALBARÁN'} <span style={{ opacity: 0.5 }}>↗</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* PROACTIVE ALERT CHIPS · brand-tonal */}
                {alerts.filter(a => !dismissedAlerts[a.id]).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                    {alerts.filter(a => !dismissedAlerts[a.id]).map(alert => {
                      const variant = alert.tipo === 'danger' ? 'crit' : alert.tipo === 'warning' ? 'warn' : 'neutral'
                      const dotColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron20
                      const borderColor = variant === 'crit' ? tk.terra : variant === 'warn' ? tk.clay : tk.iron20
                      const bgColor = variant === 'crit' ? tk.terraSoft : tk.paper
                      const textColor = variant === 'crit' ? tk.terra : tk.iron
                      return (
                        <button
                          key={alert.id}
                          onClick={() => alert.chat ? send(alert.chat) : null}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 8,
                            padding: '7px 11px', background: bgColor,
                            border: `1.5px solid ${borderColor}`, cursor: alert.chat ? 'pointer' : 'default',
                            fontFamily: ff.mono, fontSize: 11, color: textColor,
                          }}
                        >
                          <span style={{ width: 6, height: 6, background: dotColor, flexShrink: 0 }} />
                          <span>{alert.titulo}</span>
                          {alert.detalle && <span style={{ opacity: 0.5, fontSize: 10 }}>· {alert.detalle.length > 40 ? alert.detalle.slice(0, 40) + '…' : alert.detalle}</span>}
                          <span
                            onClick={e => { e.stopPropagation(); setDismissedAlerts(prev => ({ ...prev, [alert.id]: true })) }}
                            style={{ marginLeft: 4, opacity: 0.4, cursor: 'pointer', fontSize: 13, lineHeight: 1 }}
                          >×</span>
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* MOMENT STRIP · 4 cells, one in iron negative */}
                {momento && (
                  <div>
                    <p style={{
                      fontFamily: ff.mono, fontSize: 10, letterSpacing: '0.18em',
                      color: tk.iron40, textTransform: 'uppercase' as const,
                      margin: '0 0 8px',
                    }}>
                      {momento.momento} · {new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <div style={{
                      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 1, background: tk.iron, border: `1.5px solid ${tk.iron}`,
                    }}>
                      {momento.sugerencias.map((s, idx) => {
                        // La acción central (idx 0 ó idx 2 según el set) se destaca en iron negativo
                        const isFeatured = idx === 0 || (s.scan === true)
                        return (
                          <button
                            key={idx}
                            onClick={() => s.scan ? scanRef.current?.click() : send(s.chat)}
                            disabled={isLoading}
                            style={{
                              textAlign: 'left' as const,
                              background: isFeatured ? tk.iron : tk.paper,
                              color: isFeatured ? tk.cream : tk.iron,
                              border: 'none', padding: '14px 14px 16px',
                              cursor: isLoading ? 'not-allowed' : 'pointer',
                              opacity: isLoading ? 0.5 : 1,
                              display: 'flex', flexDirection: 'column' as const, gap: 2,
                              minHeight: 80,
                            }}
                            onMouseEnter={e => { if (!isFeatured) (e.currentTarget as HTMLButtonElement).style.background = tk.creamSoft }}
                            onMouseLeave={e => { if (!isFeatured) (e.currentTarget as HTMLButtonElement).style.background = tk.paper }}
                          >
                            <span style={{
                              fontFamily: ff.display, fontWeight: 600, fontSize: 13,
                              lineHeight: 1.2, letterSpacing: '-0.005em',
                            }}>{s.label}</span>
                            <span style={{
                              fontFamily: ff.mono, fontSize: 10.5,
                              opacity: isFeatured ? 0.55 : 0.6,
                              lineHeight: 1.4, marginTop: 2,
                            }}>{s.sub}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {actionMsg && (
              <div style={{
                background: tk.appleSoft, border: `1.5px solid ${tk.appleDeep}`,
                padding: '8px 14px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ width: 6, height: 6, background: tk.appleDeep, flexShrink: 0 }} />
                <p style={{
                  fontFamily: ff.mono, fontSize: 11, color: tk.appleDeep, margin: 0,
                  letterSpacing: '0.05em',
                }}>
                  ACCIÓN EJECUTADA · <span style={{ color: tk.iron }}>{actionMsg}</span>
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map((msg, i) => {
                // Brief cards
                if (msg.role === 'brief_cards' && msg.briefCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <BriefCards
                        data={msg.briefCards}
                        onAction={(chat) => send(chat)}
                      />
                    </div>
                  )
                }

                // Email proposal card
                if (msg.role === 'email_proposal' && msg.emailProposal) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 38 }}>
                      <EmailCard
                        proposal={msg.emailProposal}
                        onDiscard={() => setMessages(prev => prev.filter((_, idx) => idx !== i))}
                      />
                    </div>
                  )
                }

                // WhatsApp proposal card
                if (msg.role === 'whatsapp_proposal' && msg.whatsappProposal) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 38 }}>
                      <WhatsAppCard
                        proposal={msg.whatsappProposal}
                        onDiscard={() => setMessages(prev => prev.filter((_, idx) => idx !== i))}
                      />
                    </div>
                  )
                }

                // Pedido selector card
                if (msg.role === 'pedido_selector' && msg.pedidoSelector) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <PedidoSelectorCard data={msg.pedidoSelector} onAction={(chat) => send(chat)} />
                    </div>
                  )
                }

                // Necesidades de pedido card
                if (msg.role === 'necesidades_pedido' && msg.necesidadesPedido) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <NecesidadesPedidoCard
                        data={msg.necesidadesPedido}
                        onInsertMessage={(newMsg) => setMessages(prev => [...prev, newMsg])}
                      />
                    </div>
                  )
                }

                if (msg.role === 'facturas_pagar' && msg.facturasPagar) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <FacturasCard data={msg.facturasPagar} />
                    </div>
                  )
                }

                if (msg.role === 'compra_semanal' && msg.compraSemanal) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <CompraSemanalCard
                        data={msg.compraSemanal}
                        onInsertMessage={(newMsg) => setMessages(prev => [...prev, newMsg])}
                      />
                    </div>
                  )
                }

                if (msg.role === 'albaran_guardado' && msg.albaranGuardado) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <AlbaranGuardadoCard data={msg.albaranGuardado} />
                    </div>
                  )
                }

                if (msg.role === 'informe_semanal' && msg.informeSemanal) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <InformeSemanalCard data={msg.informeSemanal} />
                    </div>
                  )
                }

                if (msg.role === 'ingredientes_cards' && msg.ingredientesCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <IngredientesCard data={msg.ingredientesCards} />
                    </div>
                  )
                }

                if (msg.role === 'proveedores_cards' && msg.proveedoresCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <ProveedoresCard data={msg.proveedoresCards} />
                    </div>
                  )
                }

                if (msg.role === 'pedidos_recibir_cards' && msg.pedidosRecibirCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <PedidosRecibirCard data={msg.pedidosRecibirCards} />
                    </div>
                  )
                }

                if (msg.role === 'precios_alerta_cards' && msg.preciosAlertaCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <PreciosAlertaCard data={msg.preciosAlertaCards} />
                    </div>
                  )
                }

                if (msg.role === 'food_cost_cards' && msg.foodCostCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <FoodCostCard data={msg.foodCostCards} />
                    </div>
                  )
                }

                if (msg.role === 'alertas_predictivas_cards' && msg.alertasPredictivasCards) {
                  return (
                    <div key={i} style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ width: 28, height: 28, flexShrink: 0 }} />
                      <AlertasPredictivasCard data={msg.alertasPredictivasCards} onSend={send} />
                    </div>
                  )
                }

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 28, height: 28, flexShrink: 0, backgroundColor: tk.apple, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                        {iconAI}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '78%',
                      padding: '12px 18px',
                      backgroundColor: msg.role === 'user' ? tk.iron : tk.paper,
                      color: msg.role === 'user' ? tk.cream : tk.iron,
                      border: msg.role === 'assistant' ? `1.5px solid ${tk.iron20}` : 'none',
                    }}>
                      {msg.image && <img src={msg.image} alt="" style={{ width: '100%', marginBottom: 10, maxHeight: 200, objectFit: 'cover', display: 'block' }} />}
                      {msg.chartData && <MiniChart data={msg.chartData} />}
                      {msg.role === 'user' ? (
                        <p style={{ fontFamily: ff.mono, fontSize: 13, lineHeight: 1.6, color: tk.cream, margin: 0 }}>{msg.content}</p>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                      {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                        <span style={{ color: tk.apple }}>|</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div ref={bottomRef} />
          </div>
        </div>

        {/* Input */}
        <div style={{ flexShrink: 0, padding: '8px 40px 32px' }}>
          <div style={{ maxWidth: '720px', margin: '0 auto' }}>
            {pendingImage && (
              <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={pendingImage} alt="" style={{ height: 52, objectFit: 'cover', display: 'block', border: `1.5px solid ${tk.iron20}` }} />
                  <button onClick={() => setPendingImage(null)} style={{ position: 'absolute', top: -8, right: -8, width: 18, height: 18, background: tk.iron, color: tk.cream, fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', lineHeight: 1 }}>×</button>
                </div>
                <p style={{ fontFamily: ff.mono, fontSize: 11, color: tk.iron60, margin: 0, letterSpacing: '0.04em' }}>FOTO ADJUNTA</p>
              </div>
            )}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: tk.paper, border: `1.5px solid ${tk.iron}`,
              padding: '8px 10px',
            }}>
              {/* Galería */}
              <button onClick={() => fileRef.current?.click()} title="Subir foto" style={{ width: 32, height: 32, flexShrink: 0, background: tk.creamSoft, border: `1px solid ${tk.iron20}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.iron }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              {/* Cámara */}
              <button onClick={() => scanRef.current?.click()} title="Escanear albarán o factura" style={{ width: 32, height: 32, flexShrink: 0, background: tk.iron, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.apple, opacity: isLoading ? 0.5 : 1 }}>
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImage} />
              <input ref={scanRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleScan} />
              {/* Micro */}
              <button onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Detener' : 'Nota de voz'} style={{ width: 32, height: 32, flexShrink: 0, background: isRecording ? tk.apple : tk.creamSoft, border: `1px solid ${isRecording ? tk.iron : tk.iron20}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.iron }}>
                {isRecording
                  ? <span style={{ width: 10, height: 10, background: tk.iron, display: 'block' }} />
                  : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                }
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, pendingImage || undefined) } }}
                placeholder={isRecording ? 'Grabando nota de voz…' : 'Pregunta algo sobre tu cocina…'}
                disabled={isLoading || isRecording}
                autoFocus
                style={{ flex: 1, outline: 'none', background: 'transparent', border: 'none', fontFamily: ff.mono, fontSize: 13, color: tk.iron, padding: '0 6px' }}
              />
              <button onClick={() => send(input, pendingImage || undefined)} disabled={isLoading || (!input.trim() && !pendingImage)} style={{ width: 36, height: 32, flexShrink: 0, background: tk.apple, border: `1px solid ${tk.iron}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tk.iron, opacity: isLoading || (!input.trim() && !pendingImage) ? 0.4 : 1 }}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, textAlign: 'center', marginTop: 10, letterSpacing: '0.08em' }}>
              ACCEDE A DATOS DETALLADOS DESDE EL MENÚ LATERAL
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
