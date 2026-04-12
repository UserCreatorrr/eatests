import { google } from 'googleapis'
import db from './db'

export function getOAuth2Client() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001').replace(/\/$/, '')
  const redirectUri = `${base}/api/email/callback`
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  )
}

export function getStoredTokens(): any | null {
  try {
    const row = db.prepare("SELECT value FROM app_settings WHERE key='gmail_tokens'").get() as any
    return row ? JSON.parse(row.value) : null
  } catch { return null }
}

export function storeTokens(tokens: any) {
  db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('gmail_tokens', ?)").run(JSON.stringify(tokens))
}

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  const oauth2Client = getOAuth2Client()
  const tokens = getStoredTokens()
  if (!tokens?.refresh_token) {
    throw new Error('Gmail no configurado. Visita /api/email/auth para autenticar la cuenta de Google.')
  }

  oauth2Client.setCredentials(tokens)

  // Refresh access token silently if expired
  if (tokens.expiry_date && Date.now() > tokens.expiry_date - 60_000) {
    const { credentials } = await oauth2Client.refreshAccessToken()
    const merged = { ...tokens, ...credentials }
    storeTokens(merged)
    oauth2Client.setCredentials(merged)
  }

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

  const raw = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ].join('\r\n')

  const encoded = Buffer.from(raw).toString('base64url')
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encoded } })
}
