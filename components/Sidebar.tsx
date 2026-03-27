'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navItems = [
  {
    href: '/dashboard',
    label: 'Resumen',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/proveedores',
    label: 'Proveedores',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    href: '/dashboard/compras',
    label: 'Compras',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    href: '/dashboard/ventas',
    label: 'Ventas',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    children: [
      { href: '/dashboard/ventas/albaranes', label: 'Albaranes' },
      { href: '/dashboard/ventas/facturas', label: 'Facturas' },
    ],
  },
  {
    href: '/dashboard/ingredientes',
    label: 'Ingredientes',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
      </svg>
    ),
  },
  {
    href: '/dashboard/herramientas',
    label: 'Herramientas',
    icon: (
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
      <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M4 6h16M4 10h16M4 14h16M4 18h16" />
      </svg>
    ),
  },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-[220px] flex flex-col min-h-screen flex-shrink-0" style={{ backgroundColor: '#3d3834' }}>

      {/* Brand header */}
      <div className="px-5 pt-6 pb-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {/* BICOLOR NEGATIVE logo: M in green, text in cream */}
        <img
          src="/logos/logo-bicolor-negative.svg"
          alt="MarginBite"
          style={{ height: '26px', width: 'auto' }}
        />
        <p style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          color: 'rgba(223,213,201,0.35)',
          marginTop: '6px',
          letterSpacing: '0.05em',
        }}>
          Gestión Gastronómica
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4" style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <div key={item.href}>
              <Link href={item.href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                {item.icon}
                <span>{item.label}</span>
              </Link>

              {/* Submenu */}
              {item.children && isActive && (
                <div style={{ marginLeft: '28px', marginTop: '2px', marginBottom: '4px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                  {item.children.map((child) => {
                    const childActive = pathname === child.href
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        style={{
                          display: 'block',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontFamily: "'DM Mono', monospace",
                          fontSize: '11px',
                          transition: 'all 0.15s',
                          background: childActive ? 'rgba(25,249,115,0.1)' : 'transparent',
                          color: childActive ? '#19f973' : 'rgba(223,213,201,0.4)',
                        }}
                      >
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer: brand grid strip */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Green grid decorative strip */}
        <div style={{ overflow: 'hidden', height: '8px' }}>
          <img src="/logos/expanded-green-grid.svg" alt="" style={{ width: '100%', height: 'auto', opacity: 0.4 }} />
        </div>
        <div className="px-4 py-3">
          <Link
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
            gap: '6px',
              fontFamily: "'DM Mono', monospace",
              fontSize: '10px',
              color: 'rgba(223,213,201,0.3)',
              transition: 'color 0.15s',
            }}
          >
            <svg style={{ width: '11px', height: '11px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Importar datos
          </Link>
        </div>
      </div>
    </aside>
  )
}
