import { NextResponse } from 'next/server'
import { ForbiddenError } from '@/server/domain/errors'
import { route } from '@/server/http/route'
import { oauthClient } from '@/server/services/messaging'

export const dynamic = 'force-dynamic'

// Solo el propietario conecta la cuenta de Gmail de la organizacion.
export const GET = route({}, ({ ctx }) => {
  if (ctx.role !== 'owner') throw new ForbiddenError('Solo el propietario puede conectar Gmail')
  const { client } = oauthClient()
  return NextResponse.redirect(client.generateAuthUrl({ access_type: 'offline', scope: ['https://www.googleapis.com/auth/gmail.send'], prompt: 'consent' }))
})
