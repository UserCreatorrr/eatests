'use client'

import Link from 'next/link'
import { tk, ff } from '@/lib/design'

// Estado vacío guiado (feedback RP-02): no basta con "sin datos". Explica QUÉ
// falta, el periodo consultado si aplica, y ofrece la ACCIÓN directa para
// resolverlo (importar, crear, etc.) con enlace al módulo correspondiente.
export default function EmptyState({
  titulo,
  detalle,
  periodo,
  accionLabel,
  accionHref,
  ayuda,
}: {
  titulo: string
  detalle: string
  periodo?: string | null
  accionLabel?: string
  accionHref?: string
  ayuda?: string
}) {
  return (
    <div style={{ padding: '34px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 34, height: 34, border: `1.5px solid ${tk.iron20}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={tk.iron40} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2h7M9 9h6M9 13h4" /></svg>
      </div>
      <div style={{ fontFamily: ff.display, fontWeight: 600, fontSize: 15, color: tk.iron }}>{titulo}</div>
      <div style={{ fontFamily: ff.mono, fontSize: 11.5, color: tk.iron60, maxWidth: 420, lineHeight: 1.5 }}>{detalle}</div>
      {periodo && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, letterSpacing: '0.06em' }}>Periodo consultado: {periodo}</div>}
      {accionLabel && accionHref && (
        <Link href={accionHref} style={{ marginTop: 8, padding: '8px 16px', background: tk.apple, border: `1.5px solid ${tk.iron}`, fontFamily: ff.mono, fontSize: 11, fontWeight: 600, color: tk.iron, letterSpacing: '0.06em', textDecoration: 'none' }}>
          {accionLabel} →
        </Link>
      )}
      {ayuda && <div style={{ fontFamily: ff.mono, fontSize: 10, color: tk.iron40, marginTop: 2, maxWidth: 380 }}>{ayuda}</div>}
    </div>
  )
}
