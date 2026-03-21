const BASE_URL = process.env.TSPOONLAB_BASE_URL || 'https://app.tspoonlab.com/recipes/api'

export interface CostCenter {
  id: string
  name: string
  [key: string]: unknown
}

export interface Vendor {
  id: string
  name: string
  email?: string
  phone?: string
  address?: string
  [key: string]: unknown
}

type DataItem = Record<string, unknown>

function buildHeaders(token: string, costCenterId?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'rememberme': token,
  }
  if (costCenterId) {
    headers['order'] = costCenterId
  }
  return headers
}

export async function tspoonlabLogin(username: string, password: string): Promise<string> {
  // TSpoonLab login uses form-encoded body, not JSON
  const body = new URLSearchParams({ username, password })

  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Login failed (${response.status}): ${text}`)
  }

  // Token is returned in the response header as "rememberme"
  const token = response.headers.get('rememberme')
  if (!token) {
    // Fallback: try to parse from body
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      const t = data.token || data.rememberme || data.access_token
      if (t) return t
    } catch { /* ignore */ }
    throw new Error('Login succeeded but no token found in response headers')
  }

  return token
}

export async function getCostCenters(token: string): Promise<CostCenter[]> {
  const endpoints = ['/costCenters', '/orderCenters', '/centers', '/user/centers']

  for (const ep of endpoints) {
    try {
      const response = await fetch(`${BASE_URL}${ep}`, {
        headers: buildHeaders(token),
      })
      if (response.ok) {
        const data = await response.json()
        const list = Array.isArray(data) ? data : data.data || data.items || data.content || []
        if (list.length > 0) return list
      }
    } catch { /* try next */ }
  }
  return []
}

export async function getVendors(token: string, costCenterId: string, page = 0): Promise<Vendor[]> {
  const response = await fetch(`${BASE_URL}/listVendorsPaged?page=${page}&size=200`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.content || data.data || data.items || []
}

async function fetchPending(token: string, costCenterId: string, path: string, startDate: string, endDate: string): Promise<DataItem[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true' })
  const response = await fetch(`${BASE_URL}${path}?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || data.content || []
}

export const getPurchaseOrders = (token: string, costCenterId: string, startDate: string, endDate: string) =>
  fetchPending(token, costCenterId, '/integration/purchases/orders/pending', startDate, endDate)

export const getPurchaseDeliveries = (token: string, costCenterId: string, startDate: string, endDate: string) =>
  fetchPending(token, costCenterId, '/integration/purchases/deliveries/pending', startDate, endDate)

export const getPurchaseInvoices = (token: string, costCenterId: string, startDate: string, endDate: string) =>
  fetchPending(token, costCenterId, '/integration/purchases/invoices/pending', startDate, endDate)

export const getSalesDeliveries = (token: string, costCenterId: string, startDate: string, endDate: string) =>
  fetchPending(token, costCenterId, '/integration/sales/deliveries/pending', startDate, endDate)

export const getSalesInvoices = (token: string, costCenterId: string, startDate: string, endDate: string) =>
  fetchPending(token, costCenterId, '/integration/sales/invoices/pending', startDate, endDate)
