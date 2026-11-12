import { NextResponse } from 'next/server'
import { route } from '@/server/http/route'
import { oauthClient, storeGmailTokens } from '@/server/services/messaging'

export const dynamic = 'force-dynamic'

export const GET = route({}, async ({ ctx, req }) => {
  const code = req.nextUrl.searchParams.get('code')
  if (!code || req.nextUrl.searchParams.get('error')) return NextResponse.redirect(new URL('/dashboard/perfil?gmail=error', req.url))
  try {
    const { client } = oauthClient()
    const { tokens } = await client.getToken(code)
    storeGmailTokens(ctx.db, tokens)
    return NextResponse.redirect(new URL('/dashboard/perfil?gmail=ok', req.url))
  } catch (e) {
    console.error('[gmail oauth]', e)
    return NextResponse.redirect(new URL('/dashboard/perfil?gmail=error', req.url))
  }
})
