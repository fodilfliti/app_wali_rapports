import { getApiBase } from "./utils/apiBase";

const API_BASE = getApiBase();

/** Build an authenticated file URL (Bearer header not sent by `<a>` / `window.open`). */
export function apiFileUrl(filePath: string, token: string) {
  const path = filePath.startsWith("http")
    ? filePath
    : filePath.startsWith("/")
      ? filePath
      : `/${filePath}`;
  if (path.startsWith("http")) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${API_BASE}${path}${sep}access_token=${encodeURIComponent(token)}`;
}

export type UserCredentials = { code8: string; pdf_url: string };

export class ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    error: string,
    fieldErrors?: Record<string, string>,
  ) {
    super(error);
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.body && !(opts.body instanceof FormData))
    headers["Content-Type"] = "application/json";
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data.error || "errorGeneric",
      data.fieldErrors,
    );
  }
  return data as T;
}

export type UserRole = "ADMIN" | "OFFICE_USER" | "CHEF_CABINET" | "WALI";

export type SessionUser = {
  id: number;
  username: string;
  name: string | null;
  role: UserRole;
  is_blocked: boolean;
  job_title?: string | null;
  effective_permissions: Record<string, string>;
};

export type LoginResponse = { token: string; user: SessionUser };

export function login(username: string, password: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: SessionUser }>("/auth/me", { token });
}

export function changePassword(
  token: string,
  body: { current_code: string; new_code: string },
) {
  return request<{ success: boolean }>("/auth/change-password", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function listMunicipalities(
  token: string,
  params: { page?: number; q?: string },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.q) q.set("q", params.q);
  return request<{
    municipalities: any[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/municipalities?${q}`, { token });
}

export function createMunicipality(
  token: string,
  body: { name_ar: string; name_fr: string; code: string; daira_id: number },
) {
  return request<{ municipality: any }>("/admin/municipalities", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchMunicipality(
  token: string,
  id: number,
  body: Partial<{ name_ar: string; name_fr: string; code: string; daira_id: number }>,
) {
  return request<{ municipality: any }>(`/admin/municipalities/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function listDairas(
  token: string,
  params: { page?: number; q?: string; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.q) q.set("q", params.q);
  return request<{ dairas: any[]; total: number; page: number; pageSize: number }>(
    `/admin/dairas?${q}`,
    { token },
  );
}

export function createDaira(
  token: string,
  body: { name_ar: string; name_fr: string; code: string },
) {
  return request<{ daira: any }>("/admin/dairas", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchDaira(
  token: string,
  id: number,
  body: Partial<{ name_ar: string; name_fr: string; code: string }>,
) {
  return request<{ daira: any }>(`/admin/dairas/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function listModiriyat(
  token: string,
  params: { page?: number; q?: string; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.q) q.set("q", params.q);
  return request<{ modiriyat: any[]; total: number; page: number; pageSize: number }>(
    `/admin/modiriyat?${q}`,
    { token },
  );
}

export function createModiriya(
  token: string,
  body: { name_ar: string; name_fr: string; code?: string },
) {
  return request<{ modiriya: any }>("/admin/modiriyat", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchModiriya(
  token: string,
  id: number,
  body: Partial<{ name_ar: string; name_fr: string; code: string }>,
) {
  return request<{ modiriya: any }>(`/admin/modiriyat/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function listUsers(
  token: string,
  params: { page?: number; q?: string; role?: string },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.q) q.set("q", params.q);
  if (params.role) q.set("role", params.role);
  return request<{
    users: any[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/users?${q}`, { token });
}

export function createUser(
  token: string,
  body: { username: string; name: string; role: UserRole; job_title?: string },
) {
  return request<{
    user: any;
    initialPassword: string;
    credentials: UserCredentials;
  }>("/admin/users", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchUser(
  token: string,
  id: number,
  body: { name?: string; job_title?: string | null },
) {
  return request<{ user: any }>(`/admin/users/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function toggleBlockUser(token: string, id: number) {
  return request<{ user: any }>(`/admin/users/${id}/block`, {
    method: "POST",
    token,
  });
}

export function resetUserPassword(token: string, id: number) {
  return request<{
    user: any;
    newPassword: string;
    credentials: UserCredentials;
  }>(`/admin/users/${id}/reset-password`, { method: "POST", token });
}

export function listOfficeRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: number;
    rapport_type_id?: number;
    content_kind?: string;
    search?: string;
    has_version?: boolean;
    importable?: boolean;
    include_hidden?: boolean;
    hidden_only?: boolean;
  },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.rapport_type_id)
    q.set("rapport_type_id", String(params.rapport_type_id));
  if (params.content_kind) q.set("content_kind", params.content_kind);
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.has_version) q.set("has_version", "1");
  if (params.importable) q.set("importable", "1");
  if (params.include_hidden) q.set("include_hidden", "1");
  if (params.hidden_only) q.set("hidden_only", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/office/rapports?${q}`, { token });
}

export function listAdminRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: number;
    search?: string;
    hidden_only?: boolean;
    include_hidden?: boolean;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.hidden_only) q.set("hidden_only", "1");
  if (params.include_hidden) q.set("include_hidden", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/admin/rapports?${q}`, { token });
}

export function getRapportTableSnapshot(token: string, rapportId: number) {
  return request<{
    snapshot: import("./types/embeddedTable").TableImportSnapshot;
  }>(`/office/rapports/${rapportId}/table-snapshot`, { token });
}

export function listWaliRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: number;
    rapport_type_id?: number;
    search?: string;
    unread_discussion?: boolean;
  },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.rapport_type_id)
    q.set("rapport_type_id", String(params.rapport_type_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.unread_discussion) q.set("unread_discussion", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/wali/rapports?${q}`, { token });
}

export function listChefRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: number;
    rapport_type_id?: number;
    search?: string;
    unread_discussion?: boolean;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.rapport_type_id)
    q.set("rapport_type_id", String(params.rapport_type_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.unread_discussion) q.set("unread_discussion", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/chef/rapports?${q}`, { token });
}

export function listOfficeServices(token: string) {
  return request<{ services: any[] }>("/office/services", { token });
}

export function createRapport(
  token: string,
  body: { service_id: number; rapport_type_id: number; title: string },
) {
  return request<{ rapport: any }>("/office/rapports", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchOfficeRapport(
  token: string,
  id: number,
  body: { title?: string; reference_date?: string | null },
) {
  return request<{ rapport: any }>(`/office/rapports/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function submitRapport(token: string, id: number) {
  return request<{ rapport: any }>(`/office/rapports/${id}/submit`, {
    method: "POST",
    token,
  });
}

export function finishRapport(token: string, id: number) {
  return request<{ rapport: any }>(`/office/rapports/${id}/finish`, {
    method: "POST",
    token,
  });
}

export function restoreRapport(token: string, id: number) {
  return request<{ rapport: any }>(`/office/rapports/${id}/restore`, {
    method: "POST",
    token,
  });
}

export function waliRespond(
  token: string,
  id: number,
  body: { decision: string; follow_up_status?: string; body_text?: string },
) {
  return request<{ rapport: any }>(`/wali/rapports/${id}/respond`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function chefRespond(
  token: string,
  id: number,
  body: { decision: string; follow_up_status?: string; body_text?: string },
) {
  return request<{ rapport: any }>(`/chef/rapports/${id}/respond`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function listWaliOfficeUsers(token: string) {
  return request<{ officeUsers: any[] }>("/wali/office-users", { token });
}

export function listChefOfficeUsers(token: string) {
  return request<{ officeUsers: any[] }>("/chef/office-users", { token });
}

export function listWaliUserServices(token: string, userId: number) {
  return request<{ services: any[] }>(`/wali/office-users/${userId}/services`, {
    token,
  });
}

export function listChefUserServices(token: string, userId: number) {
  return request<{ services: any[] }>(`/chef/office-users/${userId}/services`, {
    token,
  });
}

export function listOfficeNotifications(token: string, unreadOnly = false) {
  const q = unreadOnly ? "?unread=1" : "";
  return request<{ notifications: any[] }>(`/office/notifications${q}`, {
    token,
  });
}

export type OfficeHubCounts = {
  unread_notifications: number;
  changes_requested_rapports: number;
  unread_shared_files: number;
  unread_instructions: number;
  services_action_count: number;
};

export type WaliHubCounts = {
  inbox_pending: number;
  office_users_pending: number;
  unread_discussion: number;
};

export type ChefHubCounts = {
  inbox_pending: number;
  office_users_pending: number;
  unread_discussion: number;
};

export function getOfficeHubCounts(token: string) {
  return request<OfficeHubCounts>("/office/hub-counts", { token });
}

export function getWaliHubCounts(token: string) {
  return request<WaliHubCounts>("/wali/hub-counts", { token });
}

export function getChefHubCounts(token: string) {
  return request<ChefHubCounts>("/chef/hub-counts", { token });
}

export function markNotificationRead(token: string, id: number) {
  return request<{ notification: any }>(`/office/notifications/${id}/read`, {
    method: "PATCH",
    token,
  });
}

export function markRapportNotificationsRead(token: string, rapportId: number) {
  return request<{ ok: boolean }>(
    `/office/rapports/${rapportId}/mark-notifications-read`,
    {
      method: "POST",
      token,
    },
  );
}

export function getRapportVersion(
  token: string,
  rapportId: number,
  versionId: number,
) {
  return request<{ version: any }>(
    `/office/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function listWaliRapportVersions(token: string, rapportId: number) {
  return request<{ versions: any[] }>(
    `/wali/rapports/${rapportId}/versions`,
    { token },
  );
}

export function listChefRapportVersions(token: string, rapportId: number) {
  return request<{ versions: any[] }>(
    `/chef/rapports/${rapportId}/versions`,
    { token },
  );
}

export function getWaliRapportVersion(
  token: string,
  rapportId: number,
  versionId: number,
) {
  return request<{ version: any }>(
    `/wali/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function getChefRapportVersion(
  token: string,
  rapportId: number,
  versionId: number,
) {
  return request<{ version: any }>(
    `/chef/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function getCommuneWorkspace(
  token: string,
  serviceId: number,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/office/services/${serviceId}/commune-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function getCommuneBulkWorkspace(
  token: string,
  serviceId: number,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/office/services/${serviceId}/commune-bulk-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function saveCommuneBulkData(
  token: string,
  rapportId: number,
  payload: any,
) {
  return request<{ rapport: any }>(
    `/office/rapports/${rapportId}/commune-bulk-data`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function patchIncludedEntities(
  token: string,
  rapportId: number,
  keys: string[] | null,
) {
  return request<{ rapport: any }>(
    `/office/rapports/${rapportId}/included-entities`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({ keys }),
    },
  );
}

export function getCommuneRows(
  token: string,
  rapportId: number,
  municipalityCode: string,
) {
  return request<any>(
    `/office/rapports/${rapportId}/communes/${encodeURIComponent(municipalityCode)}`,
    { token },
  );
}

export function saveCommuneData(
  token: string,
  rapportId: number,
  body: {
    municipality_code: string;
    rows?: any[];
    rich_html_ar?: string;
    rich_html_fr?: string;
    embedded_tables?: unknown[];
    calendar_events?: unknown[];
    media_rows?: { items: { file_id: number }[] }[];
    title_ar?: string;
    title_fr?: string;
    subtitle_ar?: string;
    subtitle_fr?: string;
  },
) {
  return request<{ rapport: any }>(
    `/office/rapports/${rapportId}/commune-data`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function listRapportVersions(token: string, rapportId: number) {
  return request<{ versions: any[] }>(
    `/office/rapports/${rapportId}/versions`,
    { token },
  );
}

export function listOfficeServiceTree(token: string) {
  return request<{ services: any[] }>("/office/services/tree", { token });
}

export function getTableWorkspace(
  token: string,
  serviceId: number,
  opts?: { rapportTypeId?: number; rapportId?: number },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/office/services/${serviceId}/table-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function saveTableData(
  token: string,
  rapportId: number,
  body: {
    rows: any[];
    table_key?: string;
    title_ar?: string;
    title_fr?: string;
    subtitle_ar?: string;
    subtitle_fr?: string;
    merge_column_keys?: string[];
    media_rows?: { items: { file_id: number }[] }[];
  },
) {
  return request<{ rapport: any }>(`/office/rapports/${rapportId}/table-data`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function getDocumentList(
  token: string,
  serviceId: number,
  opts?: {
    contentKind?: string;
    rapportTypeId?: number;
    page?: number;
    pageSize?: number;
    hidden_only?: boolean;
    include_hidden?: boolean;
  },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  else q.set("content_kind", opts?.contentKind || "document_compose");
  if (opts?.page) q.set("page", String(opts.page));
  if (opts?.pageSize) q.set("pageSize", String(opts.pageSize));
  if (opts?.hidden_only) q.set("hidden_only", "1");
  if (opts?.include_hidden) q.set("include_hidden", "1");
  return request<any>(`/office/services/${serviceId}/documents?${q}`, {
    token,
  });
}

export function getServiceContentHub(
  token: string,
  serviceId: number,
  params: { include_hidden?: boolean; hidden_only?: boolean } = {},
) {
  const q = new URLSearchParams()
  if (params.include_hidden) q.set('include_hidden', '1')
  if (params.hidden_only) q.set('hidden_only', '1')
  const qs = q.toString()
  return request<any>(
    `/office/services/${serviceId}/content${qs ? `?${qs}` : ''}`,
    { token },
  )
}

export function hideRapportType(token: string, rapportTypeId: number) {
  return request<{ rapportType: any }>(`/office/rapport-types/${rapportTypeId}/hide`, {
    method: 'POST',
    token,
  })
}

export function restoreRapportType(token: string, rapportTypeId: number) {
  return request<{ rapportType: any }>(`/office/rapport-types/${rapportTypeId}/restore`, {
    method: 'POST',
    token,
  })
}

export function getWaliServiceContentHub(
  token: string,
  userId: number,
  serviceId: number,
) {
  return request<any>(
    `/wali/office-users/${userId}/services/${serviceId}/content`,
    { token },
  );
}

export function getChefServiceContentHub(
  token: string,
  userId: number,
  serviceId: number,
) {
  return request<any>(
    `/chef/office-users/${userId}/services/${serviceId}/content`,
    { token },
  );
}

export function listTableSchemas(
  token: string,
  params?: {
    q?: string;
    serviceId?: number;
    page?: number;
    limit?: number;
    includeShared?: boolean;
  },
) {
  const qs = new URLSearchParams();
  if (params?.q) qs.set("q", params.q);
  if (params?.serviceId) qs.set("service_id", String(params.serviceId));
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.includeShared) qs.set("include_shared", "1");
  const query = qs.toString();
  return request<{
    schemas: any[];
    total: number;
    page: number;
    totalPages: number;
  }>(`/admin/table-schemas${query ? `?${query}` : ""}`, { token });
}

export function createTableSchema(
  token: string,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>("/admin/table-schemas", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchTableSchema(
  token: string,
  id: number,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/admin/table-schemas/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteTableSchema(token: string, id: number) {
  return request<{ ok: boolean }>(`/admin/table-schemas/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listServiceRapportTypes(token: string, serviceId: number) {
  return request<{ service: any; rapportTypes: any[] }>(
    `/admin/services/${serviceId}/rapport-types`,
    { token },
  );
}

export function createRapportType(
  token: string,
  serviceId: number,
  body: Record<string, unknown>,
) {
  return request<{ rapportType: any }>(
    `/admin/services/${serviceId}/rapport-types`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function listAdminDepartments(token: string) {
  return request<{ departments: any[] }>("/admin/departments", { token });
}

export function createAdminDepartment(
  token: string,
  body: { name_ar: string; name_fr: string; sort_order?: number },
) {
  return request<{ department: any }>("/admin/departments", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchAdminDepartment(
  token: string,
  id: number,
  body: {
    name_ar?: string;
    name_fr?: string;
    sort_order?: number;
    is_active?: boolean;
  },
) {
  return request<{ department: any }>(`/admin/departments/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteAdminDepartment(token: string, id: number) {
  return request<{ ok: boolean }>(`/admin/departments/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listAdminServices(token: string) {
  return request<{ services: any[] }>("/admin/services", { token });
}

export function createAdminService(
  token: string,
  body: Record<string, unknown>,
) {
  return request<{ service: any }>("/admin/services", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchAdminService(
  token: string,
  id: number,
  body: {
    name_ar?: string;
    name_fr?: string;
    sort_order?: number;
    department_id?: number | null;
  },
) {
  return request<{ service: any }>(`/admin/services/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteAdminService(token: string, id: number) {
  return request<{ ok: boolean }>(`/admin/services/${id}`, {
    method: "DELETE",
    token,
  });
}

export function deleteAdminRapport(token: string, id: number) {
  return request<{ ok: boolean }>(`/admin/rapports/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listAdminOfficeUsers(token: string) {
  return request<{ users: any[] }>("/admin/office-users", { token });
}

export function listServiceGrants(token: string, serviceId: number) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, {
    token,
  });
}

export function saveServiceGrants(
  token: string,
  serviceId: number,
  grants: { user_id: number; access_level: string }[],
) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, {
    method: "PUT",
    token,
    body: JSON.stringify({ grants }),
  });
}

export function createDocument(
  token: string,
  serviceId: number,
  rapportTypeId: number,
  opts?: { templateId?: number | null; skipDefault?: boolean },
) {
  return request<{ rapport: any }>(`/office/services/${serviceId}/documents`, {
    method: "POST",
    token,
    body: JSON.stringify({
      rapport_type_id: rapportTypeId,
      template_id: opts?.templateId ?? undefined,
      skip_default: opts?.skipDefault ?? false,
    }),
  });
}

export function listOfficeDocumentTemplates(token: string, serviceId: number) {
  return request<{ templates: any[] }>(
    `/office/services/${serviceId}/document-templates`,
    { token },
  );
}

export function listDocumentTemplatesForCreate(
  token: string,
  serviceId: number,
  rapportTypeId: number,
) {
  const q = new URLSearchParams({ rapport_type_id: String(rapportTypeId) });
  return request<{ templates: any[] }>(
    `/office/services/${serviceId}/document-templates/for-create?${q}`,
    { token },
  );
}

export function createOfficeDocumentTemplate(
  token: string,
  serviceId: number,
  body: Record<string, unknown>,
) {
  return request<{ template: any }>(
    `/office/services/${serviceId}/document-templates`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function patchOfficeDocumentTemplate(
  token: string,
  templateId: number,
  body: Record<string, unknown>,
) {
  return request<{ template: any }>(
    `/office/document-templates/${templateId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function deleteOfficeDocumentTemplate(
  token: string,
  templateId: number,
) {
  return request<{ ok: boolean }>(`/office/document-templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}

export function applyDocumentTemplate(
  token: string,
  rapportId: number,
  templateId: number,
  mode: "replace" | "append" = "replace",
) {
  return request<{ rapport: any }>(
    `/office/rapports/${rapportId}/document/apply-template`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ template_id: templateId, mode }),
    },
  );
}

export function getRapport(token: string, id: number) {
  return request<{ rapport: any; accessLevel?: string }>(
    `/office/rapports/${id}`,
    { token },
  );
}

export function saveDocument(
  token: string,
  rapportId: number,
  payload: {
    blocks?: any[];
    rich_html_ar?: string;
    rich_html_fr?: string;
    embedded_tables?: unknown[];
    media_rows?: { items: { file_id: number }[] }[];
  },
) {
  return request<{ rapport: any }>(`/office/rapports/${rapportId}/document`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function getAdminRapportView(
  token: string,
  rapportId: number,
  showHidden = false,
  versionId: number | null = null,
) {
  const q = new URLSearchParams();
  if (showHidden) q.set("showHidden", "1");
  if (versionId) q.set("versionId", String(versionId));
  const qs = q.toString();
  return request<any>(`/admin/rapports/${rapportId}/view${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export function getWaliRapportView(
  token: string,
  rapportId: number,
  showHidden = false,
  versionId: number | null = null,
) {
  const q = new URLSearchParams();
  if (showHidden) q.set("showHidden", "1");
  if (versionId) q.set("versionId", String(versionId));
  const qs = q.toString();
  return request<any>(`/wali/rapports/${rapportId}/view${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export function getChefRapportView(
  token: string,
  rapportId: number,
  showHidden = false,
  versionId: number | null = null,
) {
  const q = new URLSearchParams();
  if (showHidden) q.set("showHidden", "1");
  if (versionId) q.set("versionId", String(versionId));
  const qs = q.toString();
  return request<any>(`/chef/rapports/${rapportId}/view${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export function listPermissionsCatalog(token: string) {
  return request<{ permissions: any[] }>("/admin/access/permissions-catalog", {
    token,
  });
}

export function listOfficeServiceSchemas(token: string, serviceId: number) {
  return request<{ schemas: any[]; templates: any[] }>(
    `/office/services/${serviceId}/schemas`,
    { token },
  );
}

export function createOfficeServiceSchema(
  token: string,
  serviceId: number,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/office/services/${serviceId}/schemas`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchOfficeSchema(
  token: string,
  schemaId: number,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/office/schemas/${schemaId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function duplicateOfficeServiceSchema(
  token: string,
  serviceId: number,
  body: { source_schema_id: number; slug?: string },
) {
  return request<{ schema: any }>(
    `/office/services/${serviceId}/schemas/duplicate`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function listOfficeServiceRapportTypes(
  token: string,
  serviceId: number,
) {
  return request<{ service: any; rapportTypes: any[] }>(
    `/office/services/${serviceId}/rapport-types`,
    { token },
  );
}

export function createOfficeServiceRapportType(
  token: string,
  serviceId: number,
  body: Record<string, unknown>,
) {
  return request<{ rapportType: any }>(
    `/office/services/${serviceId}/rapport-types`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function patchOfficeRapportType(
  token: string,
  rapportTypeId: number,
  body: Record<string, unknown>,
) {
  return request<{ rapportType: any }>(
    `/office/rapport-types/${rapportTypeId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function uploadRapportFile(
  token: string,
  rapportId: number,
  file: File,
) {
  const fd = new FormData();
  fd.append("file", file);
  return request<{ file: any }>(`/office/rapports/${rapportId}/uploads`, {
    method: "POST",
    token,
    body: fd,
  });
}

export function getRapportMediaFiles(token: string, rapportId: number) {
  return request<{ files: Record<number, any> }>(
    `/office/rapports/${rapportId}/media`,
    { token },
  );
}

export function getCalendarEvents(token: string, rapportId: number) {
  return request<{ events: any[] }>(
    `/office/rapports/${rapportId}/calendar-events`,
    { token },
  );
}

export function saveCalendarEvents(
  token: string,
  rapportId: number,
  events: any[],
) {
  return request<{ events: any[] }>(
    `/office/rapports/${rapportId}/calendar-events`,
    {
      method: "PUT",
      token,
      body: JSON.stringify({ events }),
    },
  );
}

export function getWaliCalendar(
  token: string,
  params: { from?: string; to?: string; week?: string },
) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.week) q.set("week", params.week);
  return request<any>(`/wali/calendar?${q}`, { token });
}

export function getChefCalendar(
  token: string,
  params: { from?: string; to?: string; week?: string },
) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.week) q.set("week", params.week);
  return request<any>(`/chef/calendar?${q}`, { token });
}

export function listWaliBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>("/wali/broadcasts", { token });
}

export function getWaliBroadcast(token: string, id: number) {
  return request<{ broadcast: any }>(`/wali/broadcasts/${id}`, { token });
}

export function listWaliShareUsers(token: string) {
  return request<{ users: any[] }>("/wali/office-users-for-share", { token });
}

export function createWaliBroadcast(
  token: string,
  file: File,
  body: Record<string, unknown>,
) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("payload", JSON.stringify(body));
  return request<{ broadcast: any }>("/wali/broadcasts", {
    method: "POST",
    token,
    body: fd,
  });
}

export function addWaliBroadcastComment(
  token: string,
  id: number,
  body_text: string,
) {
  return request<{ broadcast: any }>(`/wali/broadcasts/${id}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function remindBroadcastUnread(token: string, id: number) {
  return request<{ reminded: number }>(`/wali/broadcasts/${id}/remind`, {
    method: "POST",
    token,
  });
}

export function listOfficeBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>("/office/broadcasts", { token });
}

export function getOfficeBroadcast(token: string, id: number) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}`, { token });
}

export function markOfficeBroadcastRead(token: string, id: number) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}/read`, {
    method: "POST",
    token,
  });
}

export function addOfficeBroadcastComment(
  token: string,
  id: number,
  body_text: string,
) {
  return request<{ broadcast: any }>(`/office/broadcasts/${id}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function listWaliInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/wali/instructions?${q}`,
    { token },
  );
}

export function getWaliInstruction(token: string, id: number) {
  return request<{ instruction: any }>(`/wali/instructions/${id}`, { token });
}

export function createWaliInstruction(
  token: string,
  files: File[],
  body: Record<string, unknown>,
) {
  const fd = new FormData();
  for (const file of files) fd.append("files", file);
  fd.append("payload", JSON.stringify(body));
  return request<{ instruction: any }>("/wali/instructions", {
    method: "POST",
    token,
    body: fd,
  });
}

export function listOfficeInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/office/instructions?${q}`,
    { token },
  );
}

export function getOfficeInstruction(token: string, id: number) {
  return request<{ instruction: any }>(`/office/instructions/${id}`, { token });
}

export function listChefInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/chef/instructions?${q}`,
    { token },
  );
}

export function getChefInstruction(token: string, id: number) {
  return request<{ instruction: any }>(`/chef/instructions/${id}`, { token });
}

export type RapportExportOpts = {
  locale?: string;
  wali?: boolean;
  chef?: boolean;
  showHidden?: boolean;
  rowFilter?: "active" | "with_finished" | "finished_only";
  /** Export a specific archived version snapshot (read-only). */
  versionId?: number;
};

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback;
  const utf8 = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      return fallback;
    }
  }
  const quoted = header.match(/filename="([^"]+)"/i);
  if (quoted) return quoted[1];
  const plain = header.match(/filename=([^;]+)/i);
  if (plain) return plain[1].trim();
  return fallback;
}

async function fetchRapportExport(
  token: string,
  rapportId: number,
  kind: "pdf" | "docx" | "xlsx",
  opts: RapportExportOpts = {},
) {
  const q = new URLSearchParams();
  if (opts.locale === "fr") q.set("locale", "fr");
  if (opts.showHidden) q.set("showHidden", "1");
  if (opts.rowFilter && opts.rowFilter !== "active") q.set("rowFilter", opts.rowFilter);
  if (opts.versionId) q.set("versionId", String(opts.versionId));
  const base = opts.chef
    ? `/chef/rapports/${rapportId}/export.${kind}`
    : opts.wali
      ? `/wali/rapports/${rapportId}/export.${kind}`
      : `/office/rapports/${rapportId}/export.${kind}`;
  const res = await fetch(`${API_BASE}${base}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      data.error || "errorGeneric",
      data.fieldErrors,
    );
  }
  const filename = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    `rapport-${rapportId}.${kind}`,
  );
  return { blob: await res.blob(), filename };
}

export async function fetchRapportPdfBlob(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "pdf", opts);
  return blob;
}

export async function fetchRapportDocxBlob(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "docx", opts);
  return blob;
}

export async function fetchRapportExcelBlob(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "xlsx", opts);
  return blob;
}

export async function downloadRapportPdf(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob, filename } = await fetchRapportExport(
    token,
    rapportId,
    "pdf",
    opts,
  );
  downloadBlob(blob, filename);
}

export async function downloadRapportDocx(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob, filename } = await fetchRapportExport(
    token,
    rapportId,
    "docx",
    opts,
  );
  downloadBlob(blob, filename);
}

export async function downloadRapportExcel(
  token: string,
  rapportId: number,
  opts: RapportExportOpts = {},
) {
  const { blob, filename } = await fetchRapportExport(
    token,
    rapportId,
    "xlsx",
    opts,
  );
  downloadBlob(blob, filename);
}

export function listOfficeRapportComments(
  token: string,
  rapportId: number,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
  }>(`/office/rapports/${rapportId}/comments?${q}`, { token });
}

export function createOfficeRapportComment(
  token: string,
  rapportId: number,
  body_text: string,
) {
  return request<{ comment: any }>(`/office/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function listChefRapportComments(
  token: string,
  rapportId: number,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
  }>(`/chef/rapports/${rapportId}/comments?${q}`, { token });
}

export function createChefRapportComment(
  token: string,
  rapportId: number,
  body_text: string,
) {
  return request<{ comment: any }>(`/chef/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function listWaliRapportComments(
  token: string,
  rapportId: number,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
  }>(`/wali/rapports/${rapportId}/comments?${q}`, { token });
}

export function createWaliRapportComment(
  token: string,
  rapportId: number,
  body_text: string,
) {
  return request<{ comment: any }>(`/wali/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
