const BASE_URL = process.env.TSPOONLAB_BASE_URL || 'https://app.tspoonlab.com/recipes/api'

export interface TSpoonLabAuth {
  token: string
  costCenters: CostCenter[]
}

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

export interface PurchaseOrder {
  id: string
  date?: string
  total?: number
  status?: string
  vendorId?: string
  vendorName?: string
  lines?: unknown[]
  [key: string]: unknown
}

export interface PurchaseDelivery {
  id: string
  date?: string
  total?: number
  status?: string
  vendorId?: string
  vendorName?: string
  lines?: unknown[]
  [key: string]: unknown
}

export interface PurchaseInvoice {
  id: string
  date?: string
  total?: number
  status?: string
  vendorId?: string
  vendorName?: string
  lines?: unknown[]
  [key: string]: unknown
}

export interface SalesDelivery {
  id: string
  date?: string
  total?: number
  status?: string
  lines?: unknown[]
  [key: string]: unknown
}

export interface SalesInvoice {
  id: string
  date?: string
  total?: number
  status?: string
  lines?: unknown[]
  [key: string]: unknown
}

function buildHeaders(token: string, costCenterId?: string): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
  if (costCenterId) {
    headers['idOrderCenter'] = costCenterId
  }
  return headers
}

export async function tspoonlabLogin(username: string, password: string): Promise<string> {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Login failed (${response.status}): ${text}`)
  }

  const data = await response.json()
  // Token may be in different fields depending on API response
  return data.token || data.access_token || data.authToken || data.jwt || JSON.stringify(data)
}

export async function getCostCenters(token: string): Promise<CostCenter[]> {
  const response = await fetch(`${BASE_URL}/costCenters`, {
    headers: buildHeaders(token),
  })

  if (!response.ok) {
    // Try alternative endpoints
    const alt = await fetch(`${BASE_URL}/orderCenters`, {
      headers: buildHeaders(token),
    })
    if (!alt.ok) return []
    const data = await alt.json()
    return Array.isArray(data) ? data : data.data || data.items || []
  }

  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}

export async function getVendors(token: string, costCenterId: string, page = 0): Promise<Vendor[]> {
  const response = await fetch(`${BASE_URL}/listVendorsPaged?page=${page}&size=200`, {
    headers: buildHeaders(token, costCenterId),
  })

  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.content || data.data || data.items || []
}

// ---- PURCHASES ----

export async function getPurchaseOrders(
  token: string,
  costCenterId: string,
  startDate: string,
  endDate: string
): Promise<PurchaseOrder[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true' })
  const response = await fetch(`${BASE_URL}/integration/purchases/orders/pending?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}

export async function getPurchaseDeliveries(
  token: string,
  costCenterId: string,
  startDate: string,
  endDate: string
): Promise<PurchaseDelivery[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true' })
  const response = await fetch(`${BASE_URL}/integration/purchases/deliveries/pending?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}

export async function getPurchaseInvoices(
  token: string,
  costCenterId: string,
  startDate: string,
  endDate: string
): Promise<PurchaseInvoice[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true', onlyValidated: 'false' })
  const response = await fetch(`${BASE_URL}/integration/purchases/invoices/pending?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}

// ---- SALES ----

export async function getSalesDeliveries(
  token: string,
  costCenterId: string,
  startDate: string,
  endDate: string
): Promise<SalesDelivery[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true' })
  const response = await fetch(`${BASE_URL}/integration/sales/deliveries/pending?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}

export async function getSalesInvoices(
  token: string,
  costCenterId: string,
  startDate: string,
  endDate: string
): Promise<SalesInvoice[]> {
  const params = new URLSearchParams({ startDate, endDate, includeInternal: 'true' })
  const response = await fetch(`${BASE_URL}/integration/sales/invoices/pending?${params}`, {
    headers: buildHeaders(token, costCenterId),
  })
  if (!response.ok) return []
  const data = await response.json()
  return Array.isArray(data) ? data : data.data || data.items || []
}
