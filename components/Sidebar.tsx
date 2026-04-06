'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

const navItems = [
  {
    href: '/dashboard',
    label: 'Cocina',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ingredientes',
    label: 'Ingredientes',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/herramientas',
    label: 'Herramientas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/lista-pedidos',
    label: 'Lista Pedidos',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    href: '/dashboard/compras',
    label: 'Compras',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
    children: [
      { href: '/dashboard/compras/pedidos', label: 'Pedidos' },
      { href: '/dashboard/compras/albaranes', label: 'Albaranes' },
      { href: '/dashboard/compras/facturas', label: 'Facturas' },
    ],
  },
  {
    href: '/dashboard/proveedores',
    label: 'Proveedores',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    children: [
      { href: '/dashboard/proveedores', label: 'Lista' },
      { href: '/dashboard/proveedores/detalles', label: 'Detalles' },
    ],
  },
  {
    href: '/dashboard/sangrado',
    label: 'Sangrado',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/alertas',
    label: 'Alertas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    href: '/dashboard/ventas',
    label: 'Ventas',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    children: [
      { href: '/dashboard/ventas/albaranes', label: 'Albaranes' },
      { href: '/dashboard/ventas/facturas', label: 'Facturas' },
    ],
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 flex flex-col min-h-screen flex-shrink-0" style={{ backgroundColor: '#3d3834' }}>
      <div className="px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <Image
          src="/logos/logo-bicolor-negative.svg"
          alt="MarginBite"
          width={140}
          height={36}
          className="h-7 w-auto"
          priority
        />
        <p className="text-xs mt-2 font-mono" style={{ color: '#dfd5c9', opacity: 0.4 }}>
          Gestión Gastronómica
        </p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map((item) => {
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
      </nav>

      <div className="px-4 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
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
      <Link href="/dashboard/perfil" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, textDecoration: 'none', padding: '6px 8px', borderRadius: 10, backgroundColor: isActive ? 'rgba(25,249,115,0.08)' : 'transparent' }}>
        <div style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#19f973', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {user?.avatar ? (
            <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontFamily: 'Chillax, sans-serif', fontWeight: 700, fontSize: 13, color: '#2a2522' }}>{initials}</span>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: isActive ? '#19f973' : '#dfd5c9', margin: 0, opacity: isActive ? 1 : 0.8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name || user?.email || 'Perfil'}
          </p>
          <p style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#dfd5c9', margin: '1px 0 0', opacity: 0.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ? user.email : 'Ajustes'}
          </p>
        </div>
      </Link>
      <button
        onClick={signOut}
        title="Cerrar sesion"
        style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, backgroundColor: 'rgba(255,255,255,0.04)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#dfd5c9', opacity: 0.4 }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      </button>
    </div>
  )
}
