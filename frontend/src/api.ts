import { getApiBase } from './utils/apiBase'

const API_BASE = getApiBase()

/** Build an authenticated file URL (Bearer header not sent by `<a>` / `window.open`). */
export function apiFileUrl(filePath: string, token: string) {
  const path = filePath.startsWith('http')
    ? filePath
    : filePath.startsWith('/')
      ? filePath
      : `/${filePath}`
  if (path.startsWith('http')) return path
  const sep = path.includes('?') ? '&' : '?'
  return `${API_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`
}

export type UserCredentials = { code8: string; pdf_url: string }

export class ApiError extends Error {
  status: number
  fieldErrors?: Record<string, string>

  constructor(status: number, error: string, fieldErrors?: Record<string, string>) {
    super(error)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

async function request<T>(path: string, opts: RequestInit & { token?: string | null } = {}): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  }
  if (opts.body && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers })
  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new ApiError(res.status, data.error || 'errorGeneric', data.fieldErrors)
  }
  return data as T
}

export type UserRole = 'ADMIN' | 'OFFICE_USER' | 'WALI'

export type SessionUser = {
  id: number
  username: string
  name: string | null
  role: UserRole
  is_blocked: boolean
  job_title?: string | null
  effective_permissions: Record<string, string>
}

export type LoginResponse = { token: string; user: SessionUser }

export function login(username: string, password: string) {
  return request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

export function fetchMe(token: string) {
  return request<{ user: SessionUser }>('/auth/me', { token })
}

export function changePassword(token: string, body: { current_code: string; new_code: string }) {
  return request<{ success: boolean }>('/auth/change-password', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function listMunicipalities(token: string, params: { page?: number; q?: string }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.q) q.set('q', params.q)
  return request<{ municipalities: any[]; total: number; page: number; pageSize: number }>(
    `/admin/municipalities?${q}`,
    { token },
  )
}

export function createMunicipality(token: string, body: { name_ar: string; name_fr: string; code: string }) {
  return request<{ municipality: any }>('/admin/municipalities', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function patchMunicipality(token: string, id: number, body: Partial<{ name_ar: string; name_fr: string; code: string }>) {
  return request<{ municipality: any }>(`/admin/municipalities/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function listUsers(token: string, params: { page?: number; q?: string; role?: string }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.q) q.set('q', params.q)
  if (params.role) q.set('role', params.role)
  return request<{ users: any[]; total: number; page: number; pageSize: number }>(`/admin/users?${q}`, { token })
}

export function createUser(
  token: string,
  body: { username: string; name: string; role: UserRole; job_title?: string },
) {
  return request<{ user: any; initialPassword: string; credentials: UserCredentials }>('/admin/users', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function patchUser(token: string, id: number, body: { name?: string; job_title?: string | null }) {
  return request<{ user: any }>(`/admin/users/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function toggleBlockUser(token: string, id: number) {
  return request<{ user: any }>(`/admin/users/${id}/block`, { method: 'POST', token })
}

export function resetUserPassword(token: string, id: number) {
  return request<{ user: any; newPassword: string; credentials: UserCredentials }>(
    `/admin/users/${id}/reset-password`,
    { method: 'POST', token },
  )
}

export function listOfficeRapports(token: string, params: { page?: number; service_id?: number }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  if (params.service_id) q.set('service_id', String(params.service_id))
  return request<{ rapports: any[]; total: number }>(`/office/rapports?${q}`, { token })
}

export function listWaliRapports(token: string, params: { page?: number }) {
  const q = new URLSearchParams()
  if (params.page) q.set('page', String(params.page))
  return request<{ rapports: any[]; total: number }>(`/wali/rapports?${q}`, { token })
}

export function listOfficeServices(token: string) {
  return request<{ services: any[] }>('/office/services', { token })
}

export function createRapport(
  token: string,
  body: { service_id: number; rapport_type_id: number; title: string },
) {
  return request<{ rapport: any }>('/office/rapports', { method: 'POST', token, body: JSON.stringify(body) })
}

export function submitRapport(token: string, id: number) {
  return request<{ rapport: any }>(`/office/rapports/${id}/submit`, { method: 'POST', token })
}

export function waliRespond(
  token: string,
  id: number,
  body: { decision: string; body_text?: string },
) {
  return request<{ rapport: any }>(`/wali/rapports/${id}/respond`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function listWaliOfficeUsers(token: string) {
  return request<{ officeUsers: any[] }>('/wali/office-users', { token })
}

export function listWaliUserServices(token: string, userId: number) {
  return request<{ services: any[] }>(`/wali/office-users/${userId}/services`, { token })
}

export function listOfficeNotifications(token: string, unreadOnly = false) {
  const q = unreadOnly ? '?unread=1' : ''
  return request<{ notifications: any[] }>(`/office/notifications${q}`, { token })
}

export function markNotificationRead(token: string, id: number) {
  return request<{ notification: any }>(`/office/notifications/${id}/read`, { method: 'PATCH', token })
}

export function getRapportVersion(token: string, rapportId: number, versionId: number) {
  return request<{ version: any }>(`/office/rapports/${rapportId}/versions/${versionId}`, { token })
}

export function getCommuneWorkspace(token: string, serviceId: number) {
  return request<any>(`/office/services/${serviceId}/commune-workspace`, { token })
}

export function getCommuneRows(token: string, rapportId: number, municipalityCode: string) {
  return request<any>(`/office/rapports/${rapportId}/communes/${encodeURIComponent(municipalityCode)}`, { token })
}

export function saveCommuneData(
  token: string,
  rapportId: number,
  body: { municipality_code: string; rows: any[] },
) {
  return request<{ rapport: any }>(`/office/rapports/${rapportId}/commune-data`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function listRapportVersions(token: string, rapportId: number) {
  return request<{ versions: any[] }>(`/office/rapports/${rapportId}/versions`, { token })
}

export function listOfficeServiceTree(token: string) {
  return request<{ services: any[] }>('/office/services/tree', { token })
}

export function getTableWorkspace(token: string, serviceId: number) {
  return request<any>(`/office/services/${serviceId}/table-workspace`, { token })
}

export function saveTableData(
  token: string,
  rapportId: number,
  body: {
    rows: any[]
    table_key?: string
    title_ar?: string
    title_fr?: string
    subtitle_ar?: string
    subtitle_fr?: string
    merge_column_keys?: string[]
    media_rows?: { items: { file_id: number }[] }[]
  },
) {
  return request<{ rapport: any }>(`/office/rapports/${rapportId}/table-data`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function getDocumentList(token: string, serviceId: number, contentKind = 'document_compose') {
  return request<any>(`/office/services/${serviceId}/documents?content_kind=${contentKind}`, { token })
}

export function getServiceContentHub(token: string, serviceId: number) {
  return request<any>(`/office/services/${serviceId}/content`, { token })
}

export function listTableSchemas(
  token: string,
  params?: { q?: string; serviceId?: number; page?: number; limit?: number; includeShared?: boolean },
) {
  const qs = new URLSearchParams()
  if (params?.q) qs.set('q', params.q)
  if (params?.serviceId) qs.set('service_id', String(params.serviceId))
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.includeShared) qs.set('include_shared', '1')
  const query = qs.toString()
  return request<{ schemas: any[]; total: number; page: number; totalPages: number }>(
    `/admin/table-schemas${query ? `?${query}` : ''}`,
    { token },
  )
}

export function createTableSchema(token: string, body: Record<string, unknown>) {
  return request<{ schema: any }>('/admin/table-schemas', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function patchTableSchema(token: string, id: number, body: Record<string, unknown>) {
  return request<{ schema: any }>(`/admin/table-schemas/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function deleteTableSchema(token: string, id: number) {
  return request<{ ok: boolean }>(`/admin/table-schemas/${id}`, { method: 'DELETE', token })
}

export function listServiceRapportTypes(token: string, serviceId: number) {
  return request<{ service: any; rapportTypes: any[] }>(`/admin/services/${serviceId}/rapport-types`, { token })
}

export function createRapportType(token: string, serviceId: number, body: Record<string, unknown>) {
  return request<{ rapportType: any }>(`/admin/services/${serviceId}/rapport-types`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function listAdminDepartments(token: string) {
  return request<{ departments: any[] }>('/admin/departments', { token })
}

export function createAdminDepartment(token: string, body: { name_ar: string; name_fr: string; sort_order?: number }) {
  return request<{ department: any }>('/admin/departments', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function patchAdminDepartment(
  token: string,
  id: number,
  body: { name_ar?: string; name_fr?: string; sort_order?: number; is_active?: boolean },
) {
  return request<{ department: any }>(`/admin/departments/${id}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function listAdminServices(token: string) {
  return request<{ services: any[] }>('/admin/services', { token })
}

export function createAdminService(token: string, body: Record<string, unknown>) {
  return request<{ service: any }>('/admin/services', {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function listAdminOfficeUsers(token: string) {
  return request<{ users: any[] }>('/admin/office-users', { token })
}

export function listServiceGrants(token: string, serviceId: number) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, { token })
}

export function saveServiceGrants(token: string, serviceId: number, grants: { user_id: number; access_level: string }[]) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ grants }),
  })
}

export function createDocument(token: string, serviceId: number, rapportTypeId: number) {
  return request<{ rapport: any }>(`/office/services/${serviceId}/documents`, {
    method: 'POST',
    token,
    body: JSON.stringify({ rapport_type_id: rapportTypeId }),
  })
}

export function getRapport(token: string, id: number) {
  return request<{ rapport: any; accessLevel?: string }>(`/office/rapports/${id}`, { token })
}

export function saveDocument(token: string, rapportId: number, blocks: any[]) {
  return request<{ rapport: any }>(`/office/rapports/${rapportId}/document`, {
    method: 'PATCH',
    token,
    body: JSON.stringify({ blocks }),
  })
}

export function getWaliRapportView(token: string, rapportId: number, showHidden = false) {
  const q = showHidden ? '?showHidden=1' : ''
  return request<any>(`/wali/rapports/${rapportId}/view${q}`, { token })
}

export function listPermissionsCatalog(token: string) {
  return request<{ permissions: any[] }>('/admin/access/permissions-catalog', { token })
}

export function listOfficeServiceSchemas(token: string, serviceId: number) {
  return request<{ schemas: any[]; templates: any[] }>(`/office/services/${serviceId}/schemas`, { token })
}

export function createOfficeServiceSchema(token: string, serviceId: number, body: Record<string, unknown>) {
  return request<{ schema: any }>(`/office/services/${serviceId}/schemas`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function patchOfficeSchema(token: string, schemaId: number, body: Record<string, unknown>) {
  return request<{ schema: any }>(`/office/schemas/${schemaId}`, {
    method: 'PATCH',
    token,
    body: JSON.stringify(body),
  })
}

export function duplicateOfficeServiceSchema(
  token: string,
  serviceId: number,
  body: { source_schema_id: number; slug?: string },
) {
  return request<{ schema: any }>(`/office/services/${serviceId}/schemas/duplicate`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function listOfficeServiceRapportTypes(token: string, serviceId: number) {
  return request<{ service: any; rapportTypes: any[] }>(`/office/services/${serviceId}/rapport-types`, { token })
}

export function createOfficeServiceRapportType(token: string, serviceId: number, body: Record<string, unknown>) {
  return request<{ rapportType: any }>(`/office/services/${serviceId}/rapport-types`, {
    method: 'POST',
    token,
    body: JSON.stringify(body),
  })
}

export function uploadRapportFile(token: string, rapportId: number, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  return request<{ file: any }>(`/office/rapports/${rapportId}/uploads`, { method: 'POST', token, body: fd })
}

export function getRapportMediaFiles(token: string, rapportId: number) {
  return request<{ files: Record<number, any> }>(`/office/rapports/${rapportId}/media`, { token })
}

export function getCalendarEvents(token: string, rapportId: number) {
  return request<{ events: any[] }>(`/office/rapports/${rapportId}/calendar-events`, { token })
}

export function saveCalendarEvents(token: string, rapportId: number, events: any[]) {
  return request<{ events: any[] }>(`/office/rapports/${rapportId}/calendar-events`, {
    method: 'PUT',
    token,
    body: JSON.stringify({ events }),
  })
}

export function getWaliCalendar(token: string, params: { from?: string; to?: string; week?: string }) {
  const q = new URLSearchParams()
  if (params.from) q.set('from', params.from)
  if (params.to) q.set('to', params.to)
  if (params.week) q.set('week', params.week)
  return request<any>(`/wali/calendar?${q}`, { token })
}

export function listWaliBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>('/wali/broadcasts', { token })
}

export function getWaliBroadcast(token: string, id: number) {
  return request<{ broadcast: any }>(`/wali/broadcasts/${id}`, { token })
}

export function listWaliShareUsers(token: string) {
  return request<{ users: any[] }>('/wali/office-users-for-share', { token })
}

export function createWaliBroadcast(token: string, file: File, body: Record<string, unknown>) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('payload', JSON.stringify(body))
  return request<{ broadcast: any }>('/wali/broadcasts', { method: 'POST', token, body: fd })
}

export function addWaliBroadcastComment(token: string, id: number, body_text: string) {
  return request<{ broadcast: any }>(`/wali/broadcasts/${id}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body_text }),
  })
}

export function remindBroadcastUnread(token: string, id: number) {
  return request<{ reminded: number }>(`/wali/broadcasts/${id}/remind`, { method: 'POST', token })
}

export function listOfficeBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>('/office/broadcasts', { token })
}

export function getOfficeBroadcast(token: string, id: number) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}`, { token })
}

export function markOfficeBroadcastRead(token: string, id: number) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}/read`, { method: 'POST', token })
}

export function addOfficeBroadcastComment(token: string, id: number, body_text: string) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}/comments`, {
    method: 'POST',
    token,
    body: JSON.stringify({ body_text }),
  })
}

export async function downloadRapportPdf(
  token: string,
  rapportId: number,
  opts: { locale?: string; wali?: boolean; showHidden?: boolean } = {},
) {
  const q = new URLSearchParams()
  if (opts.locale === 'fr') q.set('locale', 'fr')
  if (opts.showHidden) q.set('showHidden', '1')
  const base = opts.wali ? `/wali/rapports/${rapportId}/export.pdf` : `/office/rapports/${rapportId}/export.pdf`
  const res = await fetch(`${API_BASE}${base}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error || 'errorGeneric', data.fieldErrors)
  }
  const blob = await res.blob()
  downloadBlob(blob, `rapport-${rapportId}.pdf`)
}

export async function downloadRapportDocx(
  token: string,
  rapportId: number,
  opts: { locale?: string; wali?: boolean; showHidden?: boolean } = {},
) {
  const q = new URLSearchParams()
  if (opts.locale === 'fr') q.set('locale', 'fr')
  if (opts.showHidden) q.set('showHidden', '1')
  const base = opts.wali ? `/wali/rapports/${rapportId}/export.docx` : `/office/rapports/${rapportId}/export.docx`
  const res = await fetch(`${API_BASE}${base}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new ApiError(res.status, data.error || 'errorGeneric', data.fieldErrors)
  }
  const blob = await res.blob()
  downloadBlob(blob, `rapport-${rapportId}.docx`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
