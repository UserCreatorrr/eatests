import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MarginBite — Gestión Gastronómica',
  description: 'Plataforma de gestión para restaurantes y hostelería',
  icons: {
    icon: '/favicon.png',
    apple: '/logos/profile.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
