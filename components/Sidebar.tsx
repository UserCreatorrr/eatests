'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import NotificationBell from './NotificationBell'

// Icons (1.5px stroke, no fill)
const I = {
  kitchen: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>,
  ingr:    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"/></svg>,
  tools:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  list:    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>,
  cart:    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  vendor:  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  recipe:  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  chart:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 3v18h18M7 16v-4M11 16V8M15 16v-6M19 16V6"/></svg>,
  bell:    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>,
  sales:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  people:  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>,
  clock:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  gauge:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 12a9 9 0 1118 0M12 12l4-4"/></svg>,
  report:  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  merma:   <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>,
  almacen: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M3 21V8l9-5 9 5v13M3 21h18M3 21h4m14 0h-4m-10 0v-6a1 1 0 011-1h4a1 1 0 011 1v6m-6 0h6"/></svg>,
}

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
      { href: '/dashboard/herramientas', label: 'Herramientas', icon: I.tools },
      { href: '/dashboard/lista-pedidos', label: 'Lista Pedidos', icon: I.list },
      {
        href: '/dashboard/compras', label: 'Compras', icon: I.cart,
        children: [
          { href: '/dashboard/compras/pedidos', label: 'Pedidos' },
          { href: '/dashboard/compras/albaranes', label: 'Albaranes' },
          { href: '/dashboard/compras/facturas', label: 'Facturas' },
        ],
      },
      {
        href: '/dashboard/proveedores', label: 'Proveedores', icon: I.vendor,
        children: [
          { href: '/dashboard/proveedores', label: 'Lista' },
          { href: '/dashboard/proveedores/detalles', label: 'Detalles' },
        ],
      },
      { href: '/dashboard/sangrado', label: 'Escandallo / Sangrado', icon: I.recipe },
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

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex flex-col flex-shrink-0" style={{ backgroundColor: '#3d3834', height: '100vh', overflow: 'hidden' }}>
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Image
          src="/logos/COMPLETE_BICOLOR_NEGATIVE.svg"
          alt="MarginBite"
          width={140}
          height={36}
          className="h-7 w-auto"
          priority
        />
        <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#dfd5c9', opacity: 0.45, marginTop: 8, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          KITCHEN OS
        </p>
      </div>

      <nav className="mb-scroll-subtle" style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 6px' }}>
        {sidebarGroups.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 12 }}>
            <div style={{
              fontFamily: 'DM Mono, monospace', fontSize: 9, letterSpacing: '0.18em',
              color: '#dfd5c9', opacity: 0.35, padding: '4px 8px 6px',
            }}>{group.title}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <div key={item.href}>
                    <Link href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                    {item.children && isActive && (
                      <div className="ml-7 mt-0.5 space-y-0.5 mb-1">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={`block px-3 py-2 text-xs rounded-lg transition-colors font-mono ${
                              pathname === child.href
                                ? 'text-brand-green bg-brand-green/10 font-medium'
                                : 'text-brand-cream/50 hover:text-brand-cream hover:bg-white/5'
                            }`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 pt-2">
        <Link
          href="/onboarding"
          style={{
            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
            background: 'rgba(25,249,115,0.06)',
            border: '1px solid rgba(25,249,115,0.30)',
            textDecoration: 'none',
            borderRadius: 0,
          }}
        >
          <span style={{ width: 16, height: 16, background: '#19F973', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ width: 6, height: 6, background: '#3D3834', display: 'block' }} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 11.5, color: '#dfd5c9', margin: 0, letterSpacing: '-0.005em' }}>
              Configurar con IA
            </p>
            <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#dfd5c9', opacity: 0.55, margin: '1px 0 0', letterSpacing: '0.04em' }}>
              Carta + facturas → escandallo
            </p>
          </div>
        </Link>
      </div>

      <div className="px-4 py-4 mt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <SidebarUser />
      </div>
    </aside>
  )
}

function SidebarUser() {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Link href="/dashboard/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textDecoration: 'none', padding: '6px 8px', borderRadius: 0, backgroundColor: isActive ? 'rgba(25,249,115,0.08)' : 'transparent' }}>
        <div style={{ width: 30, height: 30, backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" width={30} height={30} style={{ objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#2a2522' }}>{initials}</span>
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 600, fontSize: 11.5, color: '#dfd5c9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name || user?.email || '—'}</p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#dfd5c9', opacity: 0.45, margin: '1px 0 0' }}>Mi perfil</p>
        </div>
      </Link>
      <NotificationBell />
      <button onClick={signOut} title="Cerrar sesión" style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#dfd5c9', opacity: 0.4, padding: 4 }}>
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
      </button>
    </div>
  )
}
