'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useCallback } from 'react'
import NotificationBell from './NotificationBell'

// ─── Geometría del menú lateral ──────────────────────────────────────────
// Rail comprimido (solo iconos) que se despliega lateralmente en overlay al
// pasar el ratón — el contenido conserva todo el ancho. El pin lo deja fijo
// expandido. Grupos en acordeón; el de la ruta activa se abre solo.
const RAIL = 64
const PANEL = 250

// Icons (1.5px stroke, no fill)
const I = {
  kitchen: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  ingr:    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>,
  list:    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
  cart:    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  vendor:  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  recipe:  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  chart:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V6"/></svg>,
  bell:    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  sales:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  people:  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  clock:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  gauge:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 12a9 9 0 1118 0M12 12l4-4"/></svg>,
  report:  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  merma:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  almacen: <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 21V8l9-5 9 5v13M3 21h18M3 21h4m14 0h-4m-10 0v-6a1 1 0 011-1h4a1 1 0 011 1v6m-6 0h6"/></svg>,
  spark:   <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>,
}

const Chevron = ({ open }: { open: boolean }) => (
  <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
    style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .18s', flexShrink: 0 }}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
)

type NavItem = { href: string; label: string; icon: JSX.Element; children?: { href: string; label: string }[] }
type NavGroup = { title: string; items: NavItem[] }

const sidebarGroups: NavGroup[] = [
  {
    title: 'INICIO',
    items: [
      { href: '/dashboard', label: 'Cocina', icon: I.kitchen },
    ],
  },
  {
    title: 'FOOD COST',
    items: [
      { href: '/dashboard/ingredientes', label: 'Ingredientes', icon: I.ingr },
      { href: '/dashboard/almacenes', label: 'Almacenes', icon: I.almacen },
      { href: '/dashboard/lista-pedidos', label: 'Plantillas de pedido', icon: I.list },
      {
        href: '/dashboard/compras', label: 'Compras', icon: I.cart,
        children: [
          { href: '/dashboard/compras/escaneo', label: 'Escanear + validar' },
          { href: '/dashboard/compras/pedidos', label: 'Pedidos' },
          { href: '/dashboard/compras/albaranes', label: 'Albaranes' },
          { href: '/dashboard/compras/facturas', label: 'Facturas' },
        ],
      },
      {
        href: '/dashboard/proveedores', label: 'Proveedores', icon: I.vendor,
        children: [
          { href: '/dashboard/proveedores', label: 'Lista' },
          { href: '/dashboard/proveedores/detalles', label: 'Fichas' },
        ],
      },
      {
        href: '/dashboard/sangrado', label: 'Escandallo / Sangrado', icon: I.recipe,
        children: [
          { href: '/dashboard/sangrado', label: 'Recetas' },
          { href: '/dashboard/sangrado/importar', label: 'Importar recetario' },
        ],
      },
      { href: '/dashboard/merma', label: 'Merma / Desperdicio', icon: I.merma },
    ],
  },
  {
    title: 'LABOR COST',
    items: [
      { href: '/dashboard/labor', label: 'Visión general', icon: I.chart },
      { href: '/dashboard/labor/empleados', label: 'Empleados', icon: I.people },
      { href: '/dashboard/labor/turnos', label: 'Horarios (Plan)', icon: I.clock },
      { href: '/dashboard/labor/turno-ideal', label: 'Turno ideal', icon: I.gauge },
    ],
  },
  {
    title: 'PRODUCTIVITY',
    items: [
      { href: '/dashboard/productivity', label: 'Visión general', icon: I.chart },
      { href: '/dashboard/productivity/franjas', label: 'Por franja', icon: I.clock },
    ],
  },
  {
    title: 'ANALYTICS',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: I.chart },
      { href: '/dashboard/alertas', label: 'Alertas', icon: I.bell },
      {
        href: '/dashboard/ventas', label: 'Ventas', icon: I.sales,
        children: [
          { href: '/dashboard/ventas/albaranes', label: 'Albaranes' },
          { href: '/dashboard/ventas/facturas', label: 'Facturas' },
        ],
      },
    ],
  },
  {
    title: 'REPORTS',
    items: [
      { href: '/dashboard/reports/daily-brief', label: 'Daily Ops Brief', icon: I.report },
    ],
  },
]

const CREAM = '#dfd5c9'
const APPLE = '#19f973'
const mono = 'DM Mono, monospace'
const display = 'Chillax, sans-serif'

function groupOfPath(pathname: string): string | null {
  for (const g of sidebarGroups) {
    for (const it of g.items) {
      if (pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href))) return g.title
    }
  }
  return null
}

export default function Sidebar() {
  const pathname = usePathname()
  const [pinned, setPinned] = useState(false)          // fijado expandido (empuja contenido)
  const [hovered, setHovered] = useState(false)        // expansión temporal en overlay
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({})
  const [hydrated, setHydrated] = useState(false)

  // Restaurar preferencias
  useEffect(() => {
    try {
      const p = localStorage.getItem('mb_sb_pinned')
      if (p != null) setPinned(p === '1')
      const g = localStorage.getItem('mb_sb_groups')
      if (g) setOpenGroups(JSON.parse(g))
    } catch {}
    setHydrated(true)
  }, [])

  // El grupo y el item de la ruta activa se abren solos al navegar
  useEffect(() => {
    const active = groupOfPath(pathname)
    if (active) setOpenGroups(prev => (prev[active] ? prev : { ...prev, [active]: true }))
    for (const g of sidebarGroups) for (const it of g.items) {
      if (it.children && pathname.startsWith(it.href)) {
        setOpenItems(prev => (prev[it.href] ? prev : { ...prev, [it.href]: true }))
      }
    }
  }, [pathname])

  const togglePin = useCallback(() => {
    setPinned(p => {
      try { localStorage.setItem('mb_sb_pinned', p ? '0' : '1') } catch {}
      return !p
    })
  }, [])

  function toggleGroup(title: string) {
    setOpenGroups(prev => {
      const next = { ...prev, [title]: !prev[title] }
      try { localStorage.setItem('mb_sb_groups', JSON.stringify(next)) } catch {}
      return next
    })
  }

  const open = pinned || hovered
  const overlaying = open && !pinned

  return (
    <aside style={{ width: pinned ? PANEL : RAIL, flexShrink: 0, height: '100vh', position: 'relative', zIndex: 50, transition: hydrated ? 'width .22s cubic-bezier(.4,0,.2,1)' : 'none' }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: open ? PANEL : RAIL,
          transition: hydrated ? 'width .22s cubic-bezier(.4,0,.2,1), box-shadow .22s' : 'none',
          backgroundColor: '#3d3834',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          boxShadow: overlaying ? '10px 0 42px rgba(20,16,12,0.45)' : 'none',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Cabecera: icono en rail, logo completo expandido + pin */}
        <div style={{ height: 64, display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingLeft: 14, paddingRight: 12 }}>
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', flexShrink: 0, width: open ? 0 : 36, opacity: open ? 0 : 1, overflow: 'hidden', transition: 'width .22s, opacity .15s' }}>
            <Image src="/logos/ICON_GREEN.svg" alt="MarginBite" width={30} height={30} priority style={{ width: 30, height: 30 }} />
          </Link>
          <div style={{ ...fadeStyle(open), display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 8 }}>
            <Link href="/dashboard" style={{ display: 'flex', flexShrink: 0 }}>
              <Image src="/logos/COMPLETE_BICOLOR_NEGATIVE.svg" alt="MarginBite" width={118} height={26} style={{ height: 22, width: 'auto', marginLeft: 2 }} />
            </Link>
            <button
              onClick={togglePin}
              title={pinned ? 'Contraer menú' : 'Fijar menú abierto'}
              style={{
                marginLeft: 'auto', flexShrink: 0, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: pinned ? 'rgba(25,249,115,0.14)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${pinned ? 'rgba(25,249,115,0.5)' : 'rgba(255,255,255,0.12)'}`,
                color: pinned ? APPLE : CREAM, cursor: 'pointer', padding: 0,
              }}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ transform: pinned ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M4 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Navegación */}
        <nav className="mb-scroll-subtle" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0 6px' }}>
          {sidebarGroups.map((group) => {
            const gOpen = openGroups[group.title] ?? false
            const gActive = groupOfPath(pathname) === group.title
            return (
              <div key={group.title} style={{ marginBottom: 4 }}>
                {/* Cabecera de grupo: acordeón expandido / separador en rail */}
                <button
                  onClick={() => open ? toggleGroup(group.title) : setHovered(true)}
                  style={{
                    display: 'flex', alignItems: 'center', width: '100%', border: 'none', cursor: 'pointer',
                    background: 'transparent', padding: '7px 12px 7px 14px', gap: 8,
                    color: CREAM, opacity: open ? (gActive ? 0.85 : 0.4) : 0.25,
                  }}
                >
                  {open ? (
                    <>
                      <span style={{ fontFamily: mono, fontSize: 9, letterSpacing: '0.18em', whiteSpace: 'nowrap' }}>{group.title}</span>
                      {gActive && !gOpen && <span style={{ width: 5, height: 5, background: APPLE, flexShrink: 0 }} />}
                      <span style={{ flex: 1 }} />
                      <span style={{ color: CREAM, opacity: 0.6 }}><Chevron open={gOpen} /></span>
                    </>
                  ) : (
                    <span style={{ height: 1, width: 36, background: gActive ? APPLE : 'rgba(255,255,255,0.14)', display: 'block' }} />
                  )}
                </button>

                {/* Items del grupo. En rail se muestran siempre (iconos); expandido, según acordeón */}
                <div style={{
                  overflow: 'hidden',
                  maxHeight: (!open || gOpen) ? group.items.length * 96 : 0,
                  opacity: (!open || gOpen) ? 1 : 0,
                  transition: 'max-height .24s cubic-bezier(.4,0,.2,1), opacity .18s',
                }}>
                  {group.items.map((item) => {
                    const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                    const iOpen = openItems[item.href] ?? false
                    return (
                      <div key={item.href}>
                        <div style={{ display: 'flex', alignItems: 'stretch', margin: '1px 8px' }}>
                          <Link
                            href={item.href}
                            title={open ? undefined : item.label}
                            style={{
                              display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, gap: 0,
                              padding: '8px 0', textDecoration: 'none',
                              background: isActive ? 'rgba(25,249,115,0.10)' : 'transparent',
                              borderLeft: `2px solid ${isActive ? APPLE : 'transparent'}`,
                              color: isActive ? APPLE : CREAM,
                            }}
                            onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                            onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
                          >
                            <span style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0, opacity: isActive ? 1 : 0.75 }}>{item.icon}</span>
                            <span style={{ ...fadeStyle(open), fontFamily: mono, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.label}
                            </span>
                          </Link>
                          {item.children && open && (
                            <button
                              onClick={() => setOpenItems(prev => ({ ...prev, [item.href]: !prev[item.href] }))}
                              title={iOpen ? 'Contraer' : 'Desplegar'}
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: CREAM, opacity: 0.5, padding: '0 10px', display: 'flex', alignItems: 'center' }}
                            >
                              <Chevron open={iOpen} />
                            </button>
                          )}
                        </div>
                        {/* Subitems */}
                        {item.children && (
                          <div style={{
                            overflow: 'hidden',
                            maxHeight: open && iOpen ? item.children.length * 40 : 0,
                            opacity: open && iOpen ? 1 : 0,
                            transition: 'max-height .22s cubic-bezier(.4,0,.2,1), opacity .16s',
                          }}>
                            {item.children.map((child) => {
                              const cActive = pathname === child.href
                              return (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  style={{
                                    display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
                                    margin: '1px 8px 1px 8px', padding: '6px 10px 6px 46px',
                                    fontFamily: mono, fontSize: 11.5, whiteSpace: 'nowrap',
                                    color: cActive ? APPLE : CREAM, opacity: cActive ? 1 : 0.55,
                                    background: cActive ? 'rgba(25,249,115,0.08)' : 'transparent',
                                  }}
                                  onMouseEnter={e => { if (!cActive) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' } }}
                                  onMouseLeave={e => { if (!cActive) { e.currentTarget.style.opacity = '0.55'; e.currentTarget.style.background = 'transparent' } }}
                                >
                                  <span style={{ width: 4, height: 4, background: cActive ? APPLE : 'rgba(255,255,255,0.25)', flexShrink: 0 }} />
                                  {child.label}
                                </Link>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </nav>

        {/* CTA onboarding */}
        <div style={{ padding: '8px 8px 0', flexShrink: 0 }}>
          <Link
            href="/onboarding"
            title={open ? undefined : 'Configurar con IA'}
            style={{
              display: 'flex', alignItems: 'center', textDecoration: 'none',
              background: 'rgba(25,249,115,0.06)', border: '1px solid rgba(25,249,115,0.30)',
              padding: '8px 0', minHeight: 44, boxSizing: 'border-box',
            }}
          >
            <span style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0, color: APPLE }}>{I.spark}</span>
            <div style={{ ...fadeStyle(open), minWidth: 0 }}>
              <p style={{ fontFamily: display, fontWeight: 600, fontSize: 11.5, color: CREAM, margin: 0, whiteSpace: 'nowrap' }}>Configurar con IA</p>
              <p style={{ fontFamily: mono, fontSize: 9, color: CREAM, opacity: 0.55, margin: '1px 0 0', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Carta + facturas → escandallo</p>
            </div>
          </Link>
        </div>

        {/* Usuario */}
        <div style={{ padding: '10px 8px 12px', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
          <SidebarUser open={open} />
        </div>
      </div>
    </aside>
  )
}

// Los textos aparecen/desaparecen con la expansión sin descolocar los iconos
function fadeStyle(open: boolean): React.CSSProperties {
  return {
    opacity: open ? 1 : 0,
    transition: 'opacity .18s',
    pointerEvents: open ? 'auto' : 'none',
  }
}

function SidebarUser({ open }: { open: boolean }) {
  const pathname = usePathname()
  const [user, setUser] = useState<{ name: string | null; email: string; avatar: string | null } | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(d => { if (d.user) setUser(d.user) }).catch(() => {})
  }, [])

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }

  const initials = user ? (user.name || user.email)[0].toUpperCase() : '?'
  const isActive = pathname === '/dashboard/perfil'

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <Link
        href="/dashboard/perfil"
        title={open ? undefined : 'Mi perfil'}
        style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, textDecoration: 'none', padding: '5px 0', backgroundColor: isActive ? 'rgba(25,249,115,0.08)' : 'transparent' }}
      >
        <span style={{ width: 46, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ width: 30, height: 30, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {user?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.avatar} alt="" width={30} height={30} style={{ objectFit: 'cover' }} />
            ) : (
              <span style={{ fontFamily: display, fontWeight: 700, fontSize: 13, color: '#2a2522' }}>{initials}</span>
            )}
          </span>
        </span>
        <div style={{ ...fadeStyle(open), minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: display, fontWeight: 600, fontSize: 11.5, color: CREAM, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email || '—'}</p>
          <p style={{ fontFamily: mono, fontSize: 9, color: CREAM, opacity: 0.45, margin: '1px 0 0', whiteSpace: 'nowrap' }}>Mi perfil</p>
        </div>
      </Link>
      <div style={{ ...fadeStyle(open), display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <NotificationBell />
        <button onClick={signOut} title="Cerrar sesión" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: CREAM, opacity: 0.4, padding: 4 }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
        </button>
      </div>
    </div>
  )
}
