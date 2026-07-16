/**
 * In-memory access token + single-flight refresh via HttpOnly cookie.
 * Access JWT is never written to localStorage.
 */

import { getApiBase } from "../utils/apiBase";
import type { SessionUser } from "../api";

const API_BASE = getApiBase();

export type RefreshResponse = { token: string; user: SessionUser };

let accessToken: string | null = null;
let refreshPromise: Promise<RefreshResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let accessTokenHandler: ((token: string) => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) accessTokenHandler?.(token);
}

export function onAccessTokenChange(handler: ((token: string) => void) | null) {
  accessTokenHandler = handler;
}

export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired() {
  accessToken = null;
  sessionExpiredHandler?.();
}

/** Single-flight refresh using the HttpOnly cookie. */
export async function refreshSession(): Promise<RefreshResponse | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        accessToken = null;
        return null;
      }
      const data = (await res.json()) as RefreshResponse;
      accessToken = data.token;
      accessTokenHandler?.(data.token);
      return data;
    } catch {
      accessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function logoutRemote(token?: string | null) {
  try {
    const headers: Record<string, string> = {};
    const t = token ?? accessToken;
    if (t) headers.Authorization = `Bearer ${t}`;
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers,
    });
  } catch {
    /* ignore network errors on logout */
  } finally {
    accessToken = null;
  }
}
