'use client'

import { useState, useRef, useEffect } from 'react'

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
  descr_type: string
  mail: string
  phone: string
  canal_preferido: 'email' | 'whatsapp' | null
}

interface PedidoSelectorData {
  pendientes: PedidoPendiente[]
  proveedores: ProveedorSelectorItem[]
}

interface Message {
  role: 'user' | 'assistant' | 'email_proposal' | 'whatsapp_proposal' | 'brief_cards' | 'pedido_selector'
  content: string
  image?: string
  emailProposal?: EmailProposal
  whatsappProposal?: WhatsAppProposal
  briefCards?: BriefData
  pedidoSelector?: PedidoSelectorData
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
  normal:  { bg: '#f8f7f5', border: '#e8e2db', icon: '#3d3834', badge: null },
  warning: { bg: '#fffbeb', border: '#fcd34d', icon: '#92400e', badge: '#f59e0b' },
  danger:  { bg: '#fff1f2', border: '#fca5a5', icon: '#991b1b', badge: '#ef4444' },
}

function parseInline(text: string): (JSX.Element | string)[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} style={{ fontWeight: 700, color: 'inherit' }}>{part.slice(2, -2)}</strong>
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} style={{ fontFamily: 'DM Mono, monospace', backgroundColor: '#f0ece8', padding: '1px 5px', borderRadius: 4, fontSize: '0.9em' }}>{part.slice(1, -1)}</code>
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
        <div key={i} style={{ overflowX: 'auto', margin: '10px 0', borderRadius: 10, border: '1px solid #e8e2db' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'DM Mono, monospace', fontSize: 12 }}>
            <thead>
              <tr>{parseCells(dataRows[0]).map((cell, j) => (
                <th key={j} style={{ padding: '8px 14px', backgroundColor: '#f5f2ee', borderBottom: '1px solid #e8e2db', color: '#3d3834', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' }}>{parseInline(cell)}</th>
              ))}</tr>
            </thead>
            <tbody>
              {dataRows.slice(1).map((row, ri) => (
                <tr key={ri} style={{ borderBottom: ri < dataRows.length - 2 ? '1px solid #f0ece8' : 'none' }}>
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
  return (
    <div style={{ width: '100%', maxWidth: 620 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#3d3834', margin: 0 }}>{data.saludo}</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4, margin: 0 }}>Brief del {data.fecha}</p>
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.cards.map(card => {
          const colors = URGENCIA_COLORS[card.urgencia]
          return (
            <div key={card.id} style={{ backgroundColor: colors.bg, border: `1.5px solid ${colors.border}`, borderRadius: 14, padding: '14px 16px' }}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ color: colors.icon, display: 'flex', alignItems: 'center' }}>{CARD_ICONS[card.icon]}</span>
                <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#3d3834', flex: 1 }}>{card.titulo}</span>
                {colors.badge && (
                  <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: colors.badge, flexShrink: 0 }} />
                )}
              </div>

              {/* Items */}
              <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {card.items.map((item, i) => (
                  <p key={i} style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.8, margin: 0, lineHeight: 1.5 }}>
                    {renderBriefText(item)}
                  </p>
                ))}
              </div>

              {/* Action buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {card.acciones.map((accion, i) => (
                  accion.href ? (
                    <a
                      key={i}
                      href={accion.href}
                      style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      {accion.label} →
                    </a>
                  ) : (
                    <button
                      key={i}
                      onClick={() => onAction(accion.chat!)}
                      style={{ padding: '6px 12px', backgroundColor: '#fff', border: '1px solid #e8e2db', borderRadius: 8, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834' }}
                    >
                      {accion.label}
                    </button>
                  )
                ))}
              </div>
            </div>
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
      <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 16, padding: '14px 18px', maxWidth: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#166534' }}>
            WhatsApp enviado a {phone}
          </span>
        </div>
        {sentInfo.num_order && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#166534', opacity: 0.7, margin: '6px 0 0 28px' }}>
            Pedido registrado: {sentInfo.num_order}
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 16, padding: 18, maxWidth: '90%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
          </svg>
        </div>
        <div>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 14, color: '#166534', margin: 0 }}>
            WhatsApp — {proposal.proveedor}
          </p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#166534', opacity: 0.6, margin: 0 }}>
            Revisa y envía con un clic
          </p>
        </div>
      </div>

      {/* Phone */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#166534', opacity: 0.6, display: 'block', marginBottom: 4 }}>Teléfono</label>
        <input
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+34 645 966 701"
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 10px', outline: 'none' }}
        />
      </div>

      {/* Message */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#166534', opacity: 0.6, display: 'block', marginBottom: 4 }}>Mensaje</label>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={8}
          style={{ width: '100%', boxSizing: 'border-box', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#166534', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: 8, padding: '8px 10px', outline: 'none', resize: 'vertical', lineHeight: 1.6 }}
        />
      </div>

      {error && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#22c55e', border: 'none', borderRadius: 10, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#fff', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.854L0 24l6.303-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.8 9.8 0 01-5.003-1.368l-.36-.214-3.733.979 1.001-3.64-.234-.374A9.786 9.786 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
          </svg>
          {sending ? 'Enviando...' : 'Enviar por WhatsApp'}
        </button>
        <button
          onClick={onDiscard}
          style={{ padding: '10px 16px', backgroundColor: '#dcfce7', border: '1px solid #86efac', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#166534', opacity: 0.7 }}
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

function PedidoSelectorCard({ data, onAction }: { data: PedidoSelectorData; onAction: (chat: string) => void }) {
  const [showOtro, setShowOtro] = useState(false)
  const [otroText, setOtroText] = useState('')

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

  return (
    <div style={{ width: '100%', maxWidth: 560 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#3d3834', margin: 0 }}>
          ¿A qué proveedor quieres hacer el pedido?
        </p>
      </div>

      {/* Pedidos pendientes */}
      {data.pendientes.length > 0 && (
        <div style={{ backgroundColor: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 12, padding: '10px 14px', marginBottom: 10 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#92400e', fontWeight: 600, margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Pendientes de enviar
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.pendientes.map(lp => (
              <div key={lp.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', flex: 1 }}>
                  📋 {lp.descr}
                  {lp.data && <span style={{ opacity: 0.45, marginLeft: 6 }}>{lp.data}</span>}
                </span>
                <button
                  onClick={() => onAction(`Gestiona el pedido pendiente "${lp.descr}": ayúdame a decidir qué necesito pedir y a qué proveedor enviarlo`)}
                  style={{ padding: '4px 10px', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 6, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#92400e', whiteSpace: 'nowrap' }}
                >
                  Gestionar →
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Proveedores list */}
      <div style={{ backgroundColor: '#fff', border: '1.5px solid #e8e2db', borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.5, fontWeight: 600, margin: 0, padding: '8px 14px 6px', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0ece8' }}>
          Selecciona proveedor
        </p>
        <div style={{ maxHeight: 280, overflowY: 'auto' }}>
          {data.proveedores.map((p, i) => (
            <div
              key={p.id}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderBottom: i < data.proveedores.length - 1 ? '1px solid #f0ece8' : 'none' }}
            >
              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 13, color: '#3d3834', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.descr}</p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.45, margin: 0 }}>{p.descr_type || ''}</p>
              </div>
              {/* Buttons */}
              <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
                <button
                  onClick={() => onAction(`Preparar pedido por email a ${p.descr}`)}
                  title={p.mail || 'Email'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
                    backgroundColor: p.canal_preferido === 'email' ? '#19f973' : '#f5f2ee',
                    border: `1px solid ${p.canal_preferido === 'email' ? '#19f973' : '#e8e2db'}`,
                    borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11,
                    color: p.canal_preferido === 'email' ? '#1a3a2a' : '#3d3834',
                    fontWeight: p.canal_preferido === 'email' ? 600 : 400,
                  }}
                >
                  {iconEmail} Email
                </button>
                <button
                  onClick={() => onAction(`Preparar pedido por WhatsApp a ${p.descr}`)}
                  title={p.phone || 'WhatsApp'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 9px',
                    backgroundColor: p.canal_preferido === 'whatsapp' ? '#dcfce7' : '#f5f2ee',
                    border: `1px solid ${p.canal_preferido === 'whatsapp' ? '#86efac' : '#e8e2db'}`,
                    borderRadius: 7, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 11,
                    color: p.canal_preferido === 'whatsapp' ? '#166534' : '#3d3834',
                    fontWeight: p.canal_preferido === 'whatsapp' ? 600 : 400,
                  }}
                >
                  {iconWA} WA
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Otro */}
      {!showOtro ? (
        <button
          onClick={() => setShowOtro(true)}
          style={{ width: '100%', padding: '8px 14px', backgroundColor: 'transparent', border: '1.5px dashed #d4cec8', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.5, textAlign: 'center' }}
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
      <div style={{ backgroundColor: '#f0fdf4', border: '1.5px solid #19f973', borderRadius: 16, padding: '14px 18px', maxWidth: '90%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: sentInfo.num_order ? 6 : 0 }}>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#16a34a" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#166534' }}>Email enviado a {sentInfo.to}</span>
        </div>
        {sentInfo.num_order && (
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#166534', opacity: 0.7, margin: '0 0 0 28px' }}>
            Pedido creado: {sentInfo.num_order} · pendiente de recepción
          </p>
        )}
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: '#fafffe', border: '1.5px solid #19f973', borderRadius: 16, padding: 18, maxWidth: '90%' }}>
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

      {error && <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#dc2626', margin: '0 0 10px' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={handleSend}
          disabled={sending}
          style={{ flex: 1, padding: '10px 16px', backgroundColor: '#19f973', border: 'none', borderRadius: 10, cursor: sending ? 'not-allowed' : 'pointer', fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#2a2522', opacity: sending ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
        >
          <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
          {sending ? 'Enviando...' : 'Enviar email'}
        </button>
        <button
          onClick={onDiscard}
          style={{ padding: '10px 16px', backgroundColor: '#f5f2ee', border: '1px solid #e8e2db', borderRadius: 10, cursor: 'pointer', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.6 }}
        >
          Descartar
        </button>
      </div>
    </div>
  )
}

interface StoredConvo {
  messages: Message[]
  lastUsed: number  // timestamp ms
}

const SUGGESTIONS = [
  'Ingredientes sin coste registrado',
  'Ultimos pedidos de compra',
  'Proveedores principales',
  'Resumen de costes',
]

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
    localStorage.setItem(CURRENT_KEY, JSON.stringify(messages.filter(m => m.role !== 'email_proposal' && m.role !== 'brief_cards' && m.role !== 'pedido_selector' && (m.role as string) !== 'channel_choice' && (m.role as string) !== 'whatsapp_proposal')))
  } catch {}
}

export default function KitchenChat() {
  const [greeting, setGreeting] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [history, setHistory] = useState<StoredConvo[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [pendingImage, setPendingImage] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState('')
  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  // Start fresh on every mount — history accessible via Historial button
  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 13 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches')
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

      const contentType = res.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const json = await res.json()
        if (json.action) setActionMsg(json.action)
        if (json.briefCards) {
          setMessages(prev => [...prev, { role: 'brief_cards', content: '', briefCards: json.briefCards }])
        } else if (json.pedidoSelector) {
          setMessages(prev => [...prev, { role: 'pedido_selector', content: '', pedidoSelector: json.pedidoSelector }])
        } else if (json.whatsappProposal) {
          setMessages(prev => [...prev, { role: 'whatsapp_proposal', content: '', whatsappProposal: json.whatsappProposal }])
        } else if (json.reply) {
          const newMsgs: Message[] = [{ role: 'assistant', content: json.reply }]
          if (json.emailProposal) {
            newMsgs.push({ role: 'email_proposal', content: '', emailProposal: json.emailProposal })
          }
          setMessages(prev => [...prev, ...newMsgs])
        }
      } else {
        const reader = res.body!.getReader()
        const decoder = new TextDecoder()
        let reply = ''
        setMessages(prev => [...prev, { role: 'assistant', content: '' }])
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          reply += decoder.decode(value)
          setMessages(prev => {
            const u = [...prev]
            u[u.length - 1] = { role: 'assistant', content: reply }
            return u
          })
        }
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
              <div style={{ paddingTop: 40, paddingBottom: 24 }}>
                <div style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                  <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 20, color: '#3d3834', textAlign: 'center', margin: '0 0 6px' }}>
                  En que te ayudo hoy?
                </p>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', opacity: 0.4, textAlign: 'center', margin: '0 0 28px' }}>
                  Pregunta sobre tu cocina, sube una foto de albaran o graba una nota de voz
                </p>

                {/* Brief button */}
                <button
                  onClick={startBrief}
                  disabled={isLoading}
                  style={{ width: '100%', marginBottom: 16, padding: '16px 20px', backgroundColor: '#19f973', border: 'none', borderRadius: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="#2a2522" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 15, color: '#2a2522' }}>
                    {greeting || 'Buenos días'} — Brief del día
                  </span>
                </button>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)} style={{ textAlign: 'left', backgroundColor: '#ffffff', border: '1px solid #e8e2db', borderRadius: 14, padding: '14px 16px', fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#3d3834', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {actionMsg && (
              <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '10px 16px', marginBottom: 12 }}>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 12, color: '#166534', margin: 0 }}>Accion ejecutada: {actionMsg}</p>
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

                return (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-start', gap: 10 }}>
                    {msg.role === 'assistant' && (
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                        {iconAI}
                      </div>
                    )}
                    <div style={{ maxWidth: '78%', borderRadius: 18, padding: '12px 18px', backgroundColor: msg.role === 'user' ? '#3d3834' : '#ffffff', color: msg.role === 'user' ? '#dfd5c9' : '#3d3834', border: msg.role === 'assistant' ? '1px solid #e8e2db' : 'none' }}>
                      {msg.image && <img src={msg.image} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 10, maxHeight: 200, objectFit: 'cover' }} />}
                      {msg.role === 'user' ? (
                        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 13, lineHeight: 1.65, color: '#dfd5c9', margin: 0 }}>{msg.content}</p>
                      ) : (
                        <MarkdownContent content={msg.content} />
                      )}
                      {msg.role === 'assistant' && isLoading && i === messages.length - 1 && !msg.content && (
                        <span style={{ color: '#19f973' }}>|</span>
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
                  <img src={pendingImage} alt="" style={{ height: 52, borderRadius: 10, objectFit: 'cover' }} />
                  <button onClick={() => setPendingImage(null)} style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#dc2626', color: 'white', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer' }}>x</button>
                </div>
                <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#3d3834', opacity: 0.4 }}>Foto adjunta</p>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#ffffff', border: '1.5px solid #e8e2db', borderRadius: 18, padding: '8px 10px' }}>
              {/* Galería */}
              <button onClick={() => fileRef.current?.click()} title="Subir foto" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3834', opacity: 0.55 }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              {/* Cámara */}
              <button onClick={() => cameraRef.current?.click()} title="Abrir camara" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3d3834', opacity: 0.55 }}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImage} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleImage} />
              {/* Micro */}
              <button onClick={isRecording ? stopRecording : startRecording} title={isRecording ? 'Detener' : 'Nota de voz'} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: isRecording ? '#19f973' : '#f5f2ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isRecording ? '#2a2522' : '#3d3834', opacity: isRecording ? 1 : 0.55 }}>
                {isRecording
                  ? <span style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#2a2522', display: 'block' }} />
                  : <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                }
              </button>
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input, pendingImage || undefined) } }}
                placeholder={isRecording ? 'Grabando nota de voz...' : 'Pregunta algo sobre tu cocina...'}
                disabled={isLoading || isRecording}
                autoFocus
                style={{ flex: 1, outline: 'none', background: 'transparent', border: 'none', fontFamily: 'DM Mono, monospace', fontSize: 13, color: '#3d3834' }}
              />
              <button onClick={() => send(input, pendingImage || undefined)} disabled={isLoading || (!input.trim() && !pendingImage)} style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, backgroundColor: '#19f973', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2a2522', opacity: isLoading || (!input.trim() && !pendingImage) ? 0.3 : 1 }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#3d3834', opacity: 0.28, textAlign: 'center', marginTop: 8 }}>
              Accede a datos detallados desde el menu lateral
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
