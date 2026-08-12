import type { EntityId } from "@wali/access-policy";
import {
  HUB_SEGMENTS,
  LISTE_ENTITY_DATA_SEGMENT,
  LISTE_PATH_SEGMENT,
} from "@wali/routes";
import { getApiBase } from "./utils/apiBase";
import { ApiError } from "./utils/apiError";
import type { UploadOptions } from "./utils/uploadFile";
import { uploadFormData } from "./utils/uploadFile";
import {
  getAccessToken,
  notifySessionExpired,
  refreshSession,
  setAccessToken,
} from "./auth/session";

/** Accept UUID strings or legacy numeric ids during BIGINT→UUID transition. */
export type EntityIdParam = EntityId | number;

const API_BASE = getApiBase();

const signCache = new Map<string, { url: string; exp: number }>();
const SIGN_CACHE_MS = 55_000;

function normalizeFileClientPath(filePath: string): string {
  let path = filePath.trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) {
    try {
      const u = new URL(path);
      path = u.pathname;
    } catch {
      return path;
    }
  }
  if (!path.startsWith("/")) path = `/${path}`;
  return path.split("#")[0].replace(/\?.*$/, "");
}

function toAbsoluteFileUrl(relativeUrl: string): string {
  if (/^https?:\/\//i.test(relativeUrl)) return relativeUrl;
  return `${API_BASE}${relativeUrl.startsWith("/") ? relativeUrl : `/${relativeUrl}`}`;
}

/** Short-lived signed URL for `<img>` / `<a>` (no access JWT in query). */
export async function signFileUrl(filePath: string): Promise<string> {
  const path = normalizeFileClientPath(filePath);
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const cached = signCache.get(path);
  if (cached && cached.exp > Date.now() + 5000) return cached.url;

  const data = await request<{ url: string }>("/files/sign", {
    method: "POST",
    body: JSON.stringify({ path }),
  });
  const url = toAbsoluteFileUrl(data.url);
  signCache.set(path, { url, exp: Date.now() + SIGN_CACHE_MS });
  return url;
}

/** Batch sign for rich HTML with many embedded /files/ URLs. */
export async function signFileUrlsBatch(
  filePaths: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const pending: string[] = [];

  for (const raw of filePaths) {
    const path = normalizeFileClientPath(raw);
    if (!path || /^https?:\/\//i.test(path)) continue;
    const cached = signCache.get(path);
    if (cached && cached.exp > Date.now() + 5000) {
      out.set(raw.replace(/\?.*$/, "").replace(/#.*$/, ""), cached.url);
      continue;
    }
    pending.push(path);
  }

  if (pending.length) {
    const data = await request<{ urls: Record<string, string> }>(
      "/files/sign-batch",
      {
        method: "POST",
        body: JSON.stringify({ paths: [...new Set(pending)] }),
      },
    );
    for (const [key, relUrl] of Object.entries(data.urls || {})) {
      const url = toAbsoluteFileUrl(relUrl);
      const norm = normalizeFileClientPath(key);
      if (norm) signCache.set(norm, { url, exp: Date.now() + SIGN_CACHE_MS });
      out.set(key.replace(/\?.*$/, "").replace(/#.*$/, ""), url);
    }
  }

  return out;
}

export type UserCredentials = { code8: string; pdf_url: string };

export { ApiError } from "./utils/apiError";

function isAuthPath(path: string) {
  return (
    path.startsWith("/auth/login") ||
    path.startsWith("/auth/refresh") ||
    path.startsWith("/auth/logout")
  );
}

async function request<T>(
  path: string,
  opts: RequestInit & { token?: string | null; _retried?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(opts.headers as Record<string, string>),
  };
  if (opts.body && !(opts.body instanceof FormData))
    headers["Content-Type"] = "application/json";

  const token =
    opts.token === null ? null : getAccessToken() || opts.token || null;
  if (token) headers.Authorization = `Bearer ${token}`;

  const { token: _t, _retried, ...fetchOpts } = opts;
  const res = await fetch(`${API_BASE}${path}`, {
    ...fetchOpts,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !_retried && !isAuthPath(path) && opts.token !== null) {
    const refreshed = await refreshSession();
    if (refreshed?.token) {
      return request<T>(path, {
        ...opts,
        token: refreshed.token,
        _retried: true,
      });
    }
    notifySessionExpired();
  }

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
  id: EntityId;
  username: string;
  name: string | null;
  role: UserRole;
  is_blocked: boolean;
  is_super_admin?: boolean;
  job_title?: string | null;
  effective_permissions: Record<string, string>;
};

export type LoginResponse = { token: string; user: SessionUser };

export function login(username: string, password: string) {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
    token: null,
  }).then((res) => {
    setAccessToken(res.token);
    return res;
  });
}

export function fetchMe(token: string) {
  return request<{ user: SessionUser }>("/auth/me", { token });
}

export function patchMyProfile(
  token: string,
  body: { name: string; job_title?: string | null },
) {
  return request<{ user: SessionUser }>("/auth/me", {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
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

export type NotificationPreferences = {
  enabled: boolean
  push_enabled: boolean
  rapport_inbox: boolean
  rapport_feedback: boolean
  discussion: boolean
  instructions: boolean
  chef_instructions: boolean
  broadcasts: boolean
  calendar: boolean
}

export function getNotificationPreferences(token: string) {
  return request<{ preferences: NotificationPreferences }>(
    "/auth/me/notification-preferences",
    { token },
  )
}

export function updateNotificationPreferences(
  token: string,
  body: Partial<NotificationPreferences>,
) {
  return request<{ preferences: NotificationPreferences }>(
    "/auth/me/notification-preferences",
    {
      method: "PUT",
      token,
      body: JSON.stringify(body),
    },
  )
}

export function getVapidPublicKey(token: string) {
  return request<{ publicKey: string }>("/auth/push/vapid-public-key", { token })
}

export function subscribePush(
  token: string,
  body: { endpoint: string; keys: { p256dh: string; auth: string } },
) {
  return request<{ ok: boolean }>("/auth/push/subscribe", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  })
}

export function unsubscribePush(token: string, endpoint: string) {
  return request<{ ok: boolean }>("/auth/push/subscribe", {
    method: "DELETE",
    token,
    body: JSON.stringify({ endpoint }),
  })
}

export function listMunicipalities(
  token: string,
  params: { page?: number; q?: string; hidden_only?: boolean } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.q) q.set("q", params.q);
  if (params.hidden_only) q.set("hidden_only", "1");
  return request<{
    municipalities: any[];
    total: number;
    page: number;
    pageSize: number;
  }>(`/admin/municipalities?${q}`, { token });
}

export function createMunicipality(
  token: string,
  body: { name_ar: string; name_fr: string; code: string; daira_id: EntityIdParam },
) {
  return request<{ municipality: any }>("/admin/municipalities", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchMunicipality(
  token: string,
  id: EntityIdParam,
  body: Partial<{ name_ar: string; name_fr: string; code: string; daira_id: EntityIdParam }>,
) {
  return request<{ municipality: any }>(`/admin/municipalities/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function hideMunicipality(token: string, id: EntityIdParam) {
  return request<{ municipality: any }>(`/admin/municipalities/${id}/hide`, {
    method: "POST",
    token,
  });
}

export function restoreMunicipality(token: string, id: EntityIdParam) {
  return request<{ municipality: any }>(`/admin/municipalities/${id}/restore`, {
    method: "POST",
    token,
  });
}

export function listDairas(
  token: string,
  params: { page?: number; q?: string; pageSize?: number; hidden_only?: boolean } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.q) q.set("q", params.q);
  if (params.hidden_only) q.set("hidden_only", "1");
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
  id: EntityIdParam,
  body: Partial<{ name_ar: string; name_fr: string; code: string }>,
) {
  return request<{ daira: any }>(`/admin/dairas/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function hideDaira(token: string, id: EntityIdParam) {
  return request<{ daira: any }>(`/admin/dairas/${id}/hide`, {
    method: "POST",
    token,
  });
}

export function restoreDaira(token: string, id: EntityIdParam) {
  return request<{ daira: any }>(`/admin/dairas/${id}/restore`, {
    method: "POST",
    token,
  });
}

export function listDirections(
  token: string,
  params: { page?: number; q?: string; pageSize?: number; hidden_only?: boolean } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.q) q.set("q", params.q);
  if (params.hidden_only) q.set("hidden_only", "1");
  return request<{ directions: any[]; total: number; page: number; pageSize: number }>(
    `/admin/directions?${q}`,
    { token },
  );
}

export function createDirection(
  token: string,
  body: { name_ar: string; name_fr: string; code?: string },
) {
  return request<{ direction: any }>("/admin/directions", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchDirection(
  token: string,
  id: EntityIdParam,
  body: Partial<{ name_ar: string; name_fr: string; code: string }>,
) {
  return request<{ direction: any }>(`/admin/directions/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function hideDirection(token: string, id: EntityIdParam) {
  return request<{ direction: any }>(`/admin/directions/${id}/hide`, {
    method: "POST",
    token,
  });
}

export function restoreDirection(token: string, id: EntityIdParam) {
  return request<{ direction: any }>(`/admin/directions/${id}/restore`, {
    method: "POST",
    token,
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
  id: EntityIdParam,
  body: { name?: string; job_title?: string | null },
) {
  return request<{ user: any }>(`/admin/users/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function toggleBlockUser(token: string, id: EntityIdParam) {
  return request<{ user: any }>(`/admin/users/${id}/block`, {
    method: "POST",
    token,
  });
}

export function resetUserPassword(token: string, id: EntityIdParam) {
  return request<{
    user: any;
    newPassword: string;
    credentials: UserCredentials;
  }>(`/admin/users/${id}/reset-password`, { method: "POST", token });
}

export function softDeleteUser(token: string, id: EntityIdParam) {
  return request<{ ok: boolean; user_id: EntityIdParam }>(`/admin/users/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listOfficeRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: EntityIdParam;
    rapport_type_id?: EntityIdParam;
    content_kind?: string;
    search?: string;
    status_group?: string;
    sort?: string;
    has_version?: boolean;
    importable?: boolean;
    include_hidden?: boolean;
    hidden_only?: boolean;
    unread_discussion?: boolean;
    has_discussion?: boolean;
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
  if (params.status_group && params.status_group !== "all") {
    q.set("status_group", params.status_group);
  }
  if (params.sort === "updated_at") q.set("sort", "updated_at");
  if (params.has_version) q.set("has_version", "1");
  if (params.importable) q.set("importable", "1");
  if (params.include_hidden) q.set("include_hidden", "1");
  if (params.hidden_only) q.set("hidden_only", "1");
  if (params.unread_discussion) q.set("unread_discussion", "1");
  if (params.has_discussion) q.set("has_discussion", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/cabinet/rapports?${q}`, { token });
}

export function listAdminRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: EntityIdParam;
    search?: string;
    status_group?: string;
    sort?: string;
    hidden_only?: boolean;
    include_hidden?: boolean;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status_group && params.status_group !== "all") {
    q.set("status_group", params.status_group);
  }
  if (params.sort === "updated_at") q.set("sort", "updated_at");
  if (params.hidden_only) q.set("hidden_only", "1");
  if (params.include_hidden) q.set("include_hidden", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/admin/rapports?${q}`, { token });
}

export function getRapportTableSnapshot(token: string, rapportId: EntityIdParam) {
  return request<{
    snapshot: import("./types/embeddedTable").TableImportSnapshot;
  }>(`/cabinet/rapports/${rapportId}/table-snapshot`, { token });
}

export function listWaliRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: EntityIdParam;
    rapport_type_id?: EntityIdParam;
    office_user_id?: EntityIdParam;
    search?: string;
    status_group?: string;
    sort?: string;
    unread_discussion?: boolean;
    has_discussion?: boolean;
  },
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.rapport_type_id)
    q.set("rapport_type_id", String(params.rapport_type_id));
  if (params.office_user_id)
    q.set("office_user_id", String(params.office_user_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status_group && params.status_group !== "all") {
    q.set("status_group", params.status_group);
  }
  if (params.sort === "updated_at") q.set("sort", "updated_at");
  if (params.unread_discussion) q.set("unread_discussion", "1");
  if (params.has_discussion) q.set("has_discussion", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/governor/rapports?${q}`, { token });
}

export function listChefRapports(
  token: string,
  params: {
    page?: number;
    pageSize?: number;
    service_id?: EntityIdParam;
    rapport_type_id?: EntityIdParam;
    office_user_id?: EntityIdParam;
    search?: string;
    status_group?: string;
    sort?: string;
    unread_discussion?: boolean;
    has_discussion?: boolean;
  } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.service_id) q.set("service_id", String(params.service_id));
  if (params.rapport_type_id)
    q.set("rapport_type_id", String(params.rapport_type_id));
  if (params.office_user_id)
    q.set("office_user_id", String(params.office_user_id));
  if (params.search?.trim()) q.set("search", params.search.trim());
  if (params.status_group && params.status_group !== "all") {
    q.set("status_group", params.status_group);
  }
  if (params.sort === "updated_at") q.set("sort", "updated_at");
  if (params.unread_discussion) q.set("unread_discussion", "1");
  if (params.has_discussion) q.set("has_discussion", "1");
  return request<{
    rapports: any[];
    total: number;
    page?: number;
    pageSize?: number;
  }>(`/chief/rapports?${q}`, { token });
}

export function listOfficeServices(token: string) {
  return request<{ services: any[] }>("/cabinet/services", { token });
}

export function createRapport(
  token: string,
  body: {
    service_id: EntityIdParam;
    rapport_type_id: EntityIdParam;
    title: string;
    reference_date?: string | null;
    data_json?: Record<string, unknown>;
  },
) {
  return request<{ rapport: any }>("/cabinet/rapports", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchOfficeRapport(
  token: string,
  id: EntityIdParam,
  body: { title?: string; reference_date?: string | null },
) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function submitRapport(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}/submit`, {
    method: "POST",
    token,
  });
}

export function returnRapportToDraft(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}/return-to-draft`, {
    method: "POST",
    token,
  });
}

export function startOfficeNewVersion(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}/new-version`, {
    method: "POST",
    token,
  });
}

export function officeDeleteRapport(token: string, id: EntityIdParam) {
  return request<{
    mode:
      | "instant"
      | "discard_draft_version"
      | "reset_fresh_v1"
      | "requested";
    ok?: boolean;
    rapport_id?: EntityIdParam;
    rapport?: any;
  }>(`/cabinet/rapports/${id}/delete`, {
    method: "POST",
    token,
  });
}

export function cancelRapportDeleteRequest(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(
    `/cabinet/rapports/${id}/cancel-delete-request`,
    {
      method: "POST",
      token,
    },
  );
}

export function chefDeleteDecision(
  token: string,
  id: EntityIdParam,
  decision: "approved" | "rejected",
) {
  return request<{
    decision: string;
    mode?: "restored_previous" | "deleted";
    ok?: boolean;
    rapport_id?: EntityIdParam;
    rapport?: any;
  }>(`/chief/rapports/${id}/delete-decision`, {
    method: "POST",
    token,
    body: JSON.stringify({ decision }),
  });
}

export function finishRapport(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}/finish`, {
    method: "POST",
    token,
  });
}

export function restoreRapport(token: string, id: EntityIdParam) {
  return request<{ rapport: any }>(`/cabinet/rapports/${id}/restore`, {
    method: "POST",
    token,
  });
}

export function waliRespond(
  token: string,
  id: EntityIdParam,
  body: { decision: string; follow_up_status?: string; body_text?: string },
) {
  return request<{ rapport: any }>(`/governor/rapports/${id}/respond`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function chefRespond(
  token: string,
  id: EntityIdParam,
  body: { decision: string; follow_up_status?: string; body_text?: string },
) {
  return request<{ rapport: any }>(`/chief/rapports/${id}/respond`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function listWaliOfficeUsers(token: string) {
  return request<{ officeUsers: any[] }>("/governor/office-users", { token });
}

export function listChefOfficeUsers(token: string) {
  return request<{ officeUsers: any[] }>("/chief/office-users", { token });
}

export function listWaliUserServices(token: string, userId: EntityIdParam) {
  return request<{ services: any[] }>(`/governor/office-users/${userId}/services`, {
    token,
  });
}

export function listChefUserServices(token: string, userId: EntityIdParam) {
  return request<{ services: any[] }>(`/chief/office-users/${userId}/services`, {
    token,
  });
}

export function listOfficeNotifications(token: string, unreadOnly = false) {
  const q = unreadOnly ? "?unread=1" : "";
  return request<{ notifications: any[] }>(`/cabinet/notifications${q}`, {
    token,
  });
}

export type WaliHubCounts = {
  inbox_pending: number;
  office_users_pending: number;
  unread_discussion: number;
  unread_shared_files?: number;
  unread_chef_instructions?: number;
};

export type ChefHubCounts = {
  inbox_pending: number;
  office_users_pending: number;
  unread_discussion: number;
  unread_shared_files: number;
  delete_pending: number;
  unread_chef_instructions?: number;
};

export type OfficeHubCounts = {
  unread_notifications: number;
  changes_requested_rapports: number;
  unread_shared_files: number;
  unread_instructions: number;
  unread_chef_instructions?: number;
  unread_discussion: number;
  services_action_count: number;
};

export function getOfficeHubCounts(token: string) {
  return request<OfficeHubCounts>("/cabinet/hub-counts", { token });
}

export function getWaliHubCounts(token: string) {
  return request<WaliHubCounts>("/governor/hub-counts", { token });
}

export function getChefHubCounts(token: string) {
  return request<ChefHubCounts>("/chief/hub-counts", { token });
}

export function markNotificationRead(token: string, id: EntityIdParam) {
  return request<{ notification: any }>(`/cabinet/notifications/${id}/read`, {
    method: "PATCH",
    token,
  });
}

export function markRapportNotificationsRead(token: string, rapportId: EntityIdParam) {
  return request<{ ok: boolean }>(
    `/cabinet/rapports/${rapportId}/mark-notifications-read`,
    {
      method: "POST",
      token,
    },
  );
}

export function getRapportVersion(
  token: string,
  rapportId: EntityIdParam,
  versionId: EntityIdParam,
) {
  return request<{ version: any }>(
    `/cabinet/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function listWaliRapportVersions(token: string, rapportId: EntityIdParam) {
  return request<{ versions: any[] }>(
    `/governor/rapports/${rapportId}/versions`,
    { token },
  );
}

export function listChefRapportVersions(token: string, rapportId: EntityIdParam) {
  return request<{ versions: any[] }>(
    `/chief/rapports/${rapportId}/versions`,
    { token },
  );
}

export function getWaliRapportVersion(
  token: string,
  rapportId: EntityIdParam,
  versionId: EntityIdParam,
) {
  return request<{ version: any }>(
    `/governor/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function getChefRapportVersion(
  token: string,
  rapportId: EntityIdParam,
  versionId: EntityIdParam,
) {
  return request<{ version: any }>(
    `/chief/rapports/${rapportId}/versions/${versionId}`,
    { token },
  );
}

export function getCommuneWorkspace(
  token: string,
  serviceId: EntityIdParam,
  opts?: { rapportTypeId?: EntityIdParam; rapportId?: EntityIdParam },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/cabinet/services/${serviceId}/commune-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function getCommuneBulkWorkspace(
  token: string,
  serviceId: EntityIdParam,
  opts?: { rapportTypeId?: EntityIdParam; rapportId?: EntityIdParam },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/cabinet/services/${serviceId}/commune-bulk-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function saveCommuneBulkData(
  token: string,
  rapportId: EntityIdParam,
  payload: any,
) {
  return request<{ rapport: any }>(
    `/cabinet/rapports/${rapportId}/commune-bulk-data`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(payload),
    },
  );
}

export function patchIncludedEntities(
  token: string,
  rapportId: EntityIdParam,
  keys: string[] | null,
) {
  return request<{ rapport: any }>(
    `/cabinet/rapports/${rapportId}/included-entities`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify({ keys }),
    },
  );
}

export function getCommuneRows(
  token: string,
  rapportId: EntityIdParam,
  municipalityCode: string,
) {
  return request<any>(
    `/${HUB_SEGMENTS.office}/rapports/${rapportId}/${LISTE_PATH_SEGMENT}/${encodeURIComponent(municipalityCode)}`,
    { token },
  );
}

export function saveCommuneData(
  token: string,
  rapportId: EntityIdParam,
  body: {
    municipality_code: string;
    rows?: any[];
    rich_html_ar?: string;
    rich_html_fr?: string;
    embedded_tables?: unknown[];
    calendar_events?: unknown[];
    media_rows?: { items: { file_id: EntityIdParam }[] }[];
    title_ar?: string;
    title_fr?: string;
    subtitle_ar?: string;
    subtitle_fr?: string;
  },
) {
  return request<{ rapport: any }>(
    `/${HUB_SEGMENTS.office}/rapports/${rapportId}/${LISTE_ENTITY_DATA_SEGMENT}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function clearCommuneEntityData(
  token: string,
  rapportId: EntityIdParam,
  municipalityCode: string,
) {
  return request<{ rapport: any; mode: string }>(
    `/${HUB_SEGMENTS.office}/rapports/${rapportId}/${LISTE_PATH_SEGMENT}/${encodeURIComponent(municipalityCode)}/clear`,
    {
      method: "POST",
      token,
    },
  );
}

export function listRapportVersions(token: string, rapportId: EntityIdParam) {
  return request<{ versions: any[] }>(
    `/cabinet/rapports/${rapportId}/versions`,
    { token },
  );
}

export function listOfficeServiceTree(token: string) {
  return request<{ services: any[] }>("/cabinet/services/tree", { token });
}

export function getTableWorkspace(
  token: string,
  serviceId: EntityIdParam,
  opts?: { rapportTypeId?: EntityIdParam; rapportId?: EntityIdParam },
) {
  const q = new URLSearchParams();
  if (opts?.rapportTypeId) q.set("rapport_type_id", String(opts.rapportTypeId));
  if (opts?.rapportId) q.set("rapport_id", String(opts.rapportId));
  const qs = q.toString();
  return request<any>(
    `/cabinet/services/${serviceId}/table-workspace${qs ? `?${qs}` : ""}`,
    { token },
  );
}

export function saveTableData(
  token: string,
  rapportId: EntityIdParam,
  body: {
    rows: any[];
    table_key?: string;
    title_ar?: string;
    title_fr?: string;
    subtitle_ar?: string;
    subtitle_fr?: string;
    merge_column_keys?: string[];
    media_rows?: { items: { file_id: EntityIdParam }[] }[];
  },
) {
  return request<{ rapport: any }>(`/cabinet/rapports/${rapportId}/table-data`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function getDocumentList(
  token: string,
  serviceId: EntityIdParam,
  opts?: {
    contentKind?: string;
    rapportTypeId?: EntityIdParam;
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
  return request<any>(`/cabinet/services/${serviceId}/documents?${q}`, {
    token,
  });
}

export function getServiceContentHub(
  token: string,
  serviceId: EntityIdParam,
  params: { include_hidden?: boolean; hidden_only?: boolean } = {},
) {
  const q = new URLSearchParams()
  if (params.include_hidden) q.set('include_hidden', '1')
  if (params.hidden_only) q.set('hidden_only', '1')
  const qs = q.toString()
  return request<any>(
    `/cabinet/services/${serviceId}/content${qs ? `?${qs}` : ''}`,
    { token },
  )
}

export function hideRapportType(token: string, rapportTypeId: EntityIdParam) {
  return request<{ rapportType: any }>(`/cabinet/rapport-types/${rapportTypeId}/hide`, {
    method: 'POST',
    token,
  })
}

export function restoreRapportType(token: string, rapportTypeId: EntityIdParam) {
  return request<{ rapportType: any }>(`/cabinet/rapport-types/${rapportTypeId}/restore`, {
    method: 'POST',
    token,
  })
}

export function deleteRapportType(token: string, rapportTypeId: EntityIdParam) {
  return request<{ ok: boolean }>(`/cabinet/rapport-types/${rapportTypeId}`, {
    method: 'DELETE',
    token,
  })
}

export function getWaliServiceContentHub(
  token: string,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
) {
  return request<any>(
    `/governor/office-users/${userId}/services/${serviceId}/content`,
    { token },
  );
}

export function getChefServiceContentHub(
  token: string,
  userId: EntityIdParam,
  serviceId: EntityIdParam,
) {
  return request<any>(
    `/chief/office-users/${userId}/services/${serviceId}/content`,
    { token },
  );
}

export function listTableSchemas(
  token: string,
  params?: {
    q?: string;
    serviceId?: EntityIdParam;
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
  id: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/admin/table-schemas/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteTableSchema(token: string, id: EntityIdParam) {
  return request<{ ok: boolean }>(`/admin/table-schemas/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listServiceRapportTypes(token: string, serviceId: EntityIdParam) {
  return request<{ service: any; rapportTypes: any[] }>(
    `/admin/services/${serviceId}/rapport-types`,
    { token },
  );
}

export function createRapportType(
  token: string,
  serviceId: EntityIdParam,
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
  id: EntityIdParam,
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

export function deleteAdminDepartment(token: string, id: EntityIdParam) {
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
  id: EntityIdParam,
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

export function deleteAdminService(token: string, id: EntityIdParam) {
  return request<{ ok: boolean }>(`/admin/services/${id}`, {
    method: "DELETE",
    token,
  });
}

export function deleteAdminRapport(token: string, id: EntityIdParam) {
  return request<{ ok: boolean }>(`/admin/rapports/${id}`, {
    method: "DELETE",
    token,
  });
}

export function listAdminOfficeUsers(token: string) {
  return request<{ users: any[] }>("/admin/office-users", { token });
}

export function listServiceGrants(token: string, serviceId: EntityIdParam) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, {
    token,
  });
}

export function saveServiceGrants(
  token: string,
  serviceId: EntityIdParam,
  grants: { user_id: EntityIdParam; access_level: string }[],
) {
  return request<{ grants: any[] }>(`/admin/services/${serviceId}/grants`, {
    method: "PUT",
    token,
    body: JSON.stringify({ grants }),
  });
}

export function createDocument(
  token: string,
  serviceId: EntityIdParam,
  rapportTypeId: EntityIdParam,
  opts?: {
    templateId?: EntityIdParam | null;
    skipDefault?: boolean;
    title?: string;
    reference_date?: string | null;
    data_json?: Record<string, unknown>;
  },
) {
  return request<{ rapport: any }>(`/cabinet/services/${serviceId}/documents`, {
    method: "POST",
    token,
    body: JSON.stringify({
      rapport_type_id: rapportTypeId,
      template_id: opts?.templateId ?? undefined,
      skip_default: opts?.skipDefault ?? false,
      title: opts?.title ?? undefined,
      reference_date: opts?.reference_date ?? undefined,
      data_json: opts?.data_json ?? undefined,
    }),
  });
}

export function previewDocumentCreate(
  token: string,
  serviceId: EntityIdParam,
  opts: {
    rapportTypeId: EntityIdParam;
    templateId?: EntityIdParam | null;
    skipDefault?: boolean;
  },
) {
  const q = new URLSearchParams({
    rapport_type_id: String(opts.rapportTypeId),
  });
  if (opts.templateId != null) q.set("template_id", String(opts.templateId));
  if (opts.skipDefault) q.set("skip_default", "1");
  return request<{
    service: any;
    rapportType: any;
    suggestedTitle: string;
    data_json: any;
  }>(`/cabinet/services/${serviceId}/documents/draft-init?${q}`, { token });
}

export function listOfficeDocumentTemplates(token: string, serviceId: EntityIdParam) {
  return request<{ templates: any[] }>(
    `/cabinet/services/${serviceId}/document-templates`,
    { token },
  );
}

export function listDocumentTemplatesForCreate(
  token: string,
  serviceId: EntityIdParam,
  rapportTypeId: EntityIdParam,
) {
  const q = new URLSearchParams({ rapport_type_id: String(rapportTypeId) });
  return request<{ templates: any[] }>(
    `/cabinet/services/${serviceId}/document-templates/for-create?${q}`,
    { token },
  );
}

export function createOfficeDocumentTemplate(
  token: string,
  serviceId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ template: any }>(
    `/cabinet/services/${serviceId}/document-templates`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function patchOfficeDocumentTemplate(
  token: string,
  templateId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ template: any }>(
    `/cabinet/document-templates/${templateId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function deleteOfficeDocumentTemplate(
  token: string,
  templateId: EntityIdParam,
) {
  return request<{ ok: boolean }>(`/cabinet/document-templates/${templateId}`, {
    method: "DELETE",
    token,
  });
}

export function applyDocumentTemplate(
  token: string,
  rapportId: EntityIdParam,
  templateId: EntityIdParam,
  mode: "replace" | "append" = "replace",
) {
  return request<{ rapport: any }>(
    `/cabinet/rapports/${rapportId}/document/apply-template`,
    {
      method: "POST",
      token,
      body: JSON.stringify({ template_id: templateId, mode }),
    },
  );
}

export function getRapport(token: string, id: EntityIdParam) {
  return request<{ rapport: any; accessLevel?: string }>(
    `/cabinet/rapports/${id}`,
    { token },
  );
}

export function saveDocument(
  token: string,
  rapportId: EntityIdParam,
  payload: {
    blocks?: any[];
    rich_html_ar?: string;
    rich_html_fr?: string;
    embedded_tables?: unknown[];
    media_rows?: { items: { file_id: EntityIdParam }[] }[];
  },
) {
  return request<{ rapport: any }>(`/cabinet/rapports/${rapportId}/document`, {
    method: "PATCH",
    token,
    body: JSON.stringify(payload),
  });
}

export function getAdminRapportView(
  token: string,
  rapportId: EntityIdParam,
  showHidden = false,
  versionId: EntityIdParam | null = null,
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
  rapportId: EntityIdParam,
  showHidden = false,
  versionId: EntityIdParam | null = null,
) {
  const q = new URLSearchParams();
  if (showHidden) q.set("showHidden", "1");
  if (versionId) q.set("versionId", String(versionId));
  const qs = q.toString();
  return request<any>(`/governor/rapports/${rapportId}/view${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export function getChefRapportView(
  token: string,
  rapportId: EntityIdParam,
  showHidden = false,
  versionId: EntityIdParam | null = null,
) {
  const q = new URLSearchParams();
  if (showHidden) q.set("showHidden", "1");
  if (versionId) q.set("versionId", String(versionId));
  const qs = q.toString();
  return request<any>(`/chief/rapports/${rapportId}/view${qs ? `?${qs}` : ""}`, {
    token,
  });
}

export function listPermissionsCatalog(token: string) {
  return request<{ permissions: any[] }>("/admin/access/permissions-catalog", {
    token,
  });
}

export function listOfficeServiceSchemas(token: string, serviceId: EntityIdParam) {
  return request<{ schemas: any[]; templates: any[] }>(
    `/cabinet/services/${serviceId}/schemas`,
    { token },
  );
}

export function createOfficeServiceSchema(
  token: string,
  serviceId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/cabinet/services/${serviceId}/schemas`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchOfficeSchema(
  token: string,
  schemaId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ schema: any }>(`/cabinet/schemas/${schemaId}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteOfficeSchema(token: string, schemaId: EntityIdParam) {
  return request<{ ok: boolean }>(`/cabinet/schemas/${schemaId}`, {
    method: "DELETE",
    token,
  });
}

export function duplicateOfficeServiceSchema(
  token: string,
  serviceId: EntityIdParam,
  body: { source_schema_id: EntityIdParam; slug?: string },
) {
  return request<{ schema: any }>(
    `/cabinet/services/${serviceId}/schemas/duplicate`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function listOfficeServiceRapportTypes(
  token: string,
  serviceId: EntityIdParam,
) {
  return request<{ service: any; rapportTypes: any[] }>(
    `/cabinet/services/${serviceId}/rapport-types`,
    { token },
  );
}

export function createOfficeServiceRapportType(
  token: string,
  serviceId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ rapportType: any }>(
    `/cabinet/services/${serviceId}/rapport-types`,
    {
      method: "POST",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function patchOfficeRapportType(
  token: string,
  rapportTypeId: EntityIdParam,
  body: Record<string, unknown>,
) {
  return request<{ rapportType: any }>(
    `/cabinet/rapport-types/${rapportTypeId}`,
    {
      method: "PATCH",
      token,
      body: JSON.stringify(body),
    },
  );
}

export function uploadRapportFile(
  token: string,
  rapportId: EntityIdParam,
  file: File,
  opts: UploadOptions = {},
) {
  return uploadFormData<{ file: any }>(
    `/cabinet/rapports/${rapportId}/uploads`,
    () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    },
    { ...opts, token, method: "POST" },
  );
}

export function uploadAdminFile(token: string, file: File, opts: UploadOptions = {}) {
  return uploadFormData<{ file: any }>(
    "/admin/uploads",
    () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    },
    { ...opts, token, method: "POST" },
  );
}

export function uploadWaliFile(token: string, file: File, opts: UploadOptions = {}) {
  return uploadFormData<{ file: any }>(
    "/governor/uploads",
    () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    },
    { ...opts, token, method: "POST" },
  );
}

export function uploadChefFile(token: string, file: File, opts: UploadOptions = {}) {
  return uploadFormData<{ file: any }>(
    "/chief/uploads",
    () => {
      const fd = new FormData();
      fd.append("file", file);
      return fd;
    },
    { ...opts, token, method: "POST" },
  );
}

export function getRapportMediaFiles(token: string, rapportId: EntityIdParam) {
  return request<{ files: Record<string, any> }>(
    `/cabinet/rapports/${rapportId}/media`,
    { token },
  );
}

export function getCalendarEvents(token: string, rapportId: EntityIdParam) {
  return request<{ events: any[] }>(
    `/cabinet/rapports/${rapportId}/calendar-events`,
    { token },
  );
}

export function saveCalendarEvents(
  token: string,
  rapportId: EntityIdParam,
  events: any[],
) {
  return request<{ events: any[] }>(
    `/cabinet/rapports/${rapportId}/calendar-events`,
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
  return request<any>(`/governor/calendar?${q}`, { token });
}

export function getChefCalendar(
  token: string,
  params: { from?: string; to?: string; week?: string },
) {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (params.week) q.set("week", params.week);
  return request<any>(`/chief/calendar?${q}`, { token });
}

export function listWaliBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>("/governor/broadcasts", { token });
}

export function getWaliBroadcast(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/governor/broadcasts/${id}`, { token });
}

export function listWaliShareUsers(token: string) {
  return request<{ users: any[] }>("/governor/office-users-for-share", { token });
}

export function listChefShareUsers(token: string) {
  return request<{ users: any[] }>("/chief/office-users-for-share", { token });
}

export function createWaliBroadcast(
  token: string,
  body: Record<string, unknown>,
  file?: File | null,
  opts: UploadOptions = {},
) {
  if (file) {
    return uploadFormData<{ broadcast: any }>(
      "/governor/broadcasts",
      () => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "POST" },
    );
  }
  return request<{ broadcast: any }>("/governor/broadcasts", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function createChefBroadcast(
  token: string,
  body: Record<string, unknown>,
  file?: File | null,
  opts: UploadOptions = {},
) {
  if (file) {
    return uploadFormData<{ broadcast: any }>(
      "/chief/broadcasts",
      () => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "POST" },
    );
  }
  return request<{ broadcast: any }>("/chief/broadcasts", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function markWaliBroadcastRead(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/governor/broadcasts/${id}/read`, {
    method: "POST",
    token,
  });
}

export function addWaliBroadcastComment(
  token: string,
  id: EntityIdParam,
  body_text: string,
) {
  return request<{ broadcast: any }>(`/governor/broadcasts/${id}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function remindBroadcastUnread(token: string, id: EntityIdParam) {
  return request<{ reminded: number }>(`/governor/broadcasts/${id}/remind`, {
    method: "POST",
    token,
  });
}

export function remindChefBroadcastUnread(token: string, id: EntityIdParam) {
  return request<{ reminded: number }>(`/chief/broadcasts/${id}/remind`, {
    method: "POST",
    token,
  });
}

export function listOfficeBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>("/cabinet/broadcasts", { token });
}

export function getOfficeBroadcast(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/cabinet/broadcasts/${id}`, { token });
}

export function markOfficeBroadcastRead(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/cabinet/broadcasts/${id}/read`, {
    method: "POST",
    token,
  });
}

export function addOfficeBroadcastComment(
  token: string,
  id: EntityIdParam,
  body_text: string,
) {
  return request<{ broadcast: any }>(`/cabinet/broadcasts/${id}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({ body_text }),
  });
}

export function listChefBroadcasts(token: string) {
  return request<{ broadcasts: any[] }>("/chief/broadcasts", { token });
}

export function getChefBroadcast(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/chief/broadcasts/${id}`, { token });
}

export function markChefBroadcastRead(token: string, id: EntityIdParam) {
  return request<{ broadcast: any }>(`/chief/broadcasts/${id}/read`, {
    method: "POST",
    token,
  });
}

export function addChefBroadcastComment(
  token: string,
  id: EntityIdParam,
  body_text: string,
) {
  return request<{ broadcast: any }>(`/chief/broadcasts/${id}/comments`, {
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
    `/governor/instructions?${q}`,
    { token },
  );
}

export function getWaliInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/governor/instructions/${id}`, { token });
}

export function deleteWaliInstruction(token: string, id: EntityIdParam) {
  return request<{ ok: boolean; id: EntityIdParam }>(`/governor/instructions/${id}`, {
    method: "DELETE",
    token,
  });
}

export function createWaliInstruction(
  token: string,
  body: Record<string, unknown>,
  files: File[] = [],
  opts: UploadOptions = {},
) {
  if (files.length) {
    return uploadFormData<{ instruction: any }>(
      "/governor/instructions",
      () => {
        const fd = new FormData();
        for (const file of files) fd.append("files", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "POST" },
    );
  }
  return request<{ instruction: any }>("/governor/instructions", {
    method: "POST",
    token,
    body: JSON.stringify(body),
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
    `/cabinet/instructions?${q}`,
    { token },
  );
}

export function getOfficeInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/cabinet/instructions/${id}`, { token });
}

export function listChefInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/chief/instructions?${q}`,
    { token },
  );
}

export function getChefInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/chief/instructions/${id}`, { token });
}

export function listChefAuthoredInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/chief/chef-instructions?${q}`,
    { token },
  );
}

export function getChefAuthoredInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/chief/chef-instructions/${id}`, { token });
}

export function deleteChefInstruction(token: string, id: EntityIdParam) {
  return request<{ ok: boolean; id: EntityIdParam }>(`/chief/chef-instructions/${id}`, {
    method: "DELETE",
    token,
  });
}

export function createChefInstruction(
  token: string,
  body: Record<string, unknown>,
  files: File[] = [],
  opts: UploadOptions = {},
) {
  if (files.length) {
    return uploadFormData<{ instruction: any }>(
      "/chief/chef-instructions",
      () => {
        const fd = new FormData();
        for (const file of files) fd.append("files", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "POST" },
    );
  }
  return request<{ instruction: any }>("/chief/chef-instructions", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function listChefInstructionOfficeUsers(token: string) {
  return request<{ users: any[] }>("/chief/chef-instructions-office-users", { token });
}

export function listOfficeChefInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/cabinet/chef-instructions?${q}`,
    { token },
  );
}

export function getOfficeChefInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/cabinet/chef-instructions/${id}`, { token });
}

export function listWaliChefInstructions(
  token: string,
  params: { page?: number; pageSize?: number } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  return request<{ instructions: any[]; total: number; page: number; pageSize: number }>(
    `/governor/chef-instructions?${q}`,
    { token },
  );
}

export function getWaliChefInstruction(token: string, id: EntityIdParam) {
  return request<{ instruction: any }>(`/governor/chef-instructions/${id}`, { token });
}

export type RapportExportOpts = {
  locale?: string;
  wali?: boolean;
  chef?: boolean;
  showHidden?: boolean;
  rowFilter?: "active" | "with_finished" | "finished_only";
  /** Export a specific archived version snapshot (read-only). */
  versionId?: EntityIdParam;
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
  rapportId: EntityIdParam,
  kind: "pdf" | "docx" | "xlsx",
  opts: RapportExportOpts = {},
) {
  const q = new URLSearchParams();
  if (opts.locale === "fr") q.set("locale", "fr");
  if (opts.showHidden) q.set("showHidden", "1");
  if (opts.rowFilter && opts.rowFilter !== "active") q.set("rowFilter", opts.rowFilter);
  if (opts.versionId) q.set("versionId", String(opts.versionId));
  const base = opts.chef
    ? `/chief/rapports/${rapportId}/export.${kind}`
    : opts.wali
      ? `/governor/rapports/${rapportId}/export.${kind}`
      : `/cabinet/rapports/${rapportId}/export.${kind}`;
  const res = await fetch(`${API_BASE}${base}?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: "include",
  });
  if (!res.ok) {
    if (res.status === 401) {
      const refreshed = await refreshSession();
      if (refreshed?.token) {
        return fetchRapportExport(refreshed.token, rapportId, kind, opts);
      }
      notifySessionExpired();
    }
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
  rapportId: EntityIdParam,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "pdf", opts);
  return blob;
}

export async function fetchRapportDocxBlob(
  token: string,
  rapportId: EntityIdParam,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "docx", opts);
  return blob;
}

export async function fetchRapportExcelBlob(
  token: string,
  rapportId: EntityIdParam,
  opts: RapportExportOpts = {},
) {
  const { blob } = await fetchRapportExport(token, rapportId, "xlsx", opts);
  return blob;
}

export async function downloadRapportPdf(
  token: string,
  rapportId: EntityIdParam,
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
  rapportId: EntityIdParam,
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
  rapportId: EntityIdParam,
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
  rapportId: EntityIdParam,
  params: { page?: number; pageSize?: number; versionId?: EntityIdParam } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.versionId) q.set("versionId", String(params.versionId));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
    can_comment?: boolean;
    rapport_version_id?: number | null;
  }>(`/cabinet/rapports/${rapportId}/comments?${q}`, { token });
}

export function createOfficeRapportComment(
  token: string,
  rapportId: EntityIdParam,
  body_text: string,
  versionId?: EntityIdParam,
) {
  return request<{ comment: any }>(`/cabinet/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({
      body_text,
      ...(versionId != null ? { versionId } : {}),
    }),
  });
}

export function listChefRapportComments(
  token: string,
  rapportId: EntityIdParam,
  params: { page?: number; pageSize?: number; versionId?: EntityIdParam } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.versionId) q.set("versionId", String(params.versionId));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
    can_comment?: boolean;
    rapport_version_id?: number | null;
  }>(`/chief/rapports/${rapportId}/comments?${q}`, { token });
}

export function createChefRapportComment(
  token: string,
  rapportId: EntityIdParam,
  body_text: string,
  versionId?: EntityIdParam,
) {
  return request<{ comment: any }>(`/chief/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({
      body_text,
      ...(versionId != null ? { versionId } : {}),
    }),
  });
}

export function listWaliRapportComments(
  token: string,
  rapportId: EntityIdParam,
  params: { page?: number; pageSize?: number; versionId?: EntityIdParam } = {},
) {
  const q = new URLSearchParams();
  if (params.page) q.set("page", String(params.page));
  if (params.pageSize) q.set("pageSize", String(params.pageSize));
  if (params.versionId) q.set("versionId", String(params.versionId));
  return request<{
    comments: any[];
    total: number;
    page: number;
    pageSize: number;
    discussion_available?: boolean;
    can_comment?: boolean;
    rapport_version_id?: number | null;
  }>(`/governor/rapports/${rapportId}/comments?${q}`, { token });
}

export function createWaliRapportComment(
  token: string,
  rapportId: EntityIdParam,
  body_text: string,
  versionId?: EntityIdParam,
) {
  return request<{ comment: any }>(`/governor/rapports/${rapportId}/comments`, {
    method: "POST",
    token,
    body: JSON.stringify({
      body_text,
      ...(versionId != null ? { versionId } : {}),
    }),
  });
}

export type { UploadOptions, UploadProgress, UploadPhase } from "./utils/uploadFile";

export type GuideVideoAudience =
  | "general"
  | "ADMIN"
  | "OFFICE_USER"
  | "CHEF_CABINET"
  | "WALI";

export type GuideVideoListRole = "admin" | "office" | "wali" | "chef";

function guideVideosBase(role: GuideVideoListRole) {
  if (role === "admin") return "/admin/guide-videos";
  if (role === "office") return "/cabinet/guide-videos";
  if (role === "chef") return "/chief/guide-videos";
  return "/governor/guide-videos";
}

export function listGuideVideos(
  token: string,
  role: GuideVideoListRole,
  params?: { page?: number; pageSize?: number; audience?: string },
) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  if (params?.audience) q.set("audience", params.audience);
  const qs = q.toString();
  return request<{
    videos: any[];
    total: number;
    page: number;
    pageSize: number;
  }>(`${guideVideosBase(role)}${qs ? `?${qs}` : ""}`, { token });
}

export function createGuideVideo(
  token: string,
  body: Record<string, unknown>,
  file?: File | null,
  opts: UploadOptions = {},
) {
  if (file) {
    return uploadFormData<{ video: any }>(
      "/admin/guide-videos",
      () => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "POST" },
    );
  }
  return request<{ video: any }>("/admin/guide-videos", {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });
}

export function patchGuideVideo(
  token: string,
  id: EntityIdParam,
  body: Record<string, unknown>,
  file?: File | null,
  opts: UploadOptions = {},
) {
  if (file) {
    return uploadFormData<{ video: any }>(
      `/admin/guide-videos/${id}`,
      () => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("payload", JSON.stringify(body));
        return fd;
      },
      { ...opts, token, method: "PATCH" },
    );
  }
  return request<{ video: any }>(`/admin/guide-videos/${id}`, {
    method: "PATCH",
    token,
    body: JSON.stringify(body),
  });
}

export function deleteGuideVideo(token: string, id: EntityIdParam) {
  return request<{ ok: boolean }>(`/admin/guide-videos/${id}`, {
    method: "DELETE",
    token,
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
