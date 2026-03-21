import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'EatEsts - Gestión Gastronómica',
  description: 'Plataforma de gestión para restaurantes y hostelería',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
