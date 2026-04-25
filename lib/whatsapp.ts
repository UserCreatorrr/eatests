const BASE_URL  = (process.env.EVOLUTION_API_URL  || '').replace(/\/$/, '')
const API_KEY   = process.env.EVOLUTION_API_KEY  || ''
const INSTANCE  = process.env.EVOLUTION_INSTANCE || ''

export async function sendWhatsAppText(
  phone: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BASE_URL || !API_KEY || !INSTANCE) {
    return { ok: false, error: 'Evolution API no configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE)' }
  }

  // Normalize phone: strip spaces/dashes, ensure it starts with country code digits
  const normalized = phone.replace(/[\s\-().+]/g, '')

  try {
    const res = await fetch(`${BASE_URL}/message/sendText/${INSTANCE}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
      },
      body: JSON.stringify({
        number: normalized,
        text: message,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `Evolution API error ${res.status}: ${body.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (e: any) {
    return { ok: false, error: e.message }
  }
}
