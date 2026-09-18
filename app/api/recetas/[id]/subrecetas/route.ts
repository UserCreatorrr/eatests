import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { subrecetasDisponibles } from '@/lib/escandallo'

export const dynamic = 'force-dynamic'

// Elaboraciones que esta receta puede usar como línea. Se excluyen ella misma y
// las que ya dependen de ella, para que el desplegable no ofrezca un ciclo.
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const id = Number(params.id)
  const disponibles = subrecetasDisponibles(user.id, Number.isFinite(id) ? id : null)

  return NextResponse.json({
    // Solo tiene sentido ofrecer las que declaran cuánto producen: sin eso no
    // se puede repartir su coste por gramo.
    subrecetas: disponibles.filter(s => (s.cantidad_producida ?? 0) > 0 && s.unidad_producida),
    sin_produccion: disponibles
      .filter(s => !((s.cantidad_producida ?? 0) > 0 && s.unidad_producida))
      .map(s => ({ id: s.id, nombre: s.nombre })),
  })
}
