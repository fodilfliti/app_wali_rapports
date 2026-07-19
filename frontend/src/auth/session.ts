/**
 * In-memory access token + single-flight refresh via HttpOnly cookie.
 * Access JWT is never written to localStorage.
 * Multi-tab: Web Locks serialize refresh; BroadcastChannel shares access / expiry.
 */

import { getApiBase } from "../utils/apiBase";
import type { SessionUser } from "../api";

const API_BASE = getApiBase();
const AUTH_LOCK_NAME = "wr-auth-refresh";
const AUTH_CHANNEL_NAME = "wr-auth";

export type RefreshResponse = { token: string; user: SessionUser };

type AuthChannelMessage =
  | { type: "access"; token: string }
  | { type: "expired" };

let accessToken: string | null = null;
let refreshPromise: Promise<RefreshResponse | null> | null = null;
let sessionExpiredHandler: (() => void) | null = null;
let accessTokenHandler: ((token: string) => void) | null = null;
/** Avoid re-broadcasting messages we received from another tab. */
let applyingRemote = false;
/** Only fire session-expired UX once until the next successful login/refresh. */
let sessionExpiredFired = false;

let authChannel: BroadcastChannel | null = null;

function getAuthChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === "undefined") return null;
  if (!authChannel) {
    authChannel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    authChannel.onmessage = (event: MessageEvent<AuthChannelMessage>) => {
      const data = event.data;
      if (!data || typeof data !== "object") return;
      if (data.type === "access" && typeof data.token === "string") {
        applyingRemote = true;
        try {
          setAccessToken(data.token);
        } finally {
          applyingRemote = false;
        }
      } else if (data.type === "expired") {
        applyingRemote = true;
        try {
          notifySessionExpired();
        } finally {
          applyingRemote = false;
        }
      }
    };
  }
  return authChannel;
}

function broadcast(message: AuthChannelMessage) {
  if (applyingRemote) return;
  try {
    getAuthChannel()?.postMessage(message);
  } catch {
    /* ignore BroadcastChannel errors */
  }
}

/** Ensure channel listener is registered (call on module init / first use). */
getAuthChannel();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (token) {
    sessionExpiredFired = false;
    accessTokenHandler?.(token);
    broadcast({ type: "access", token });
  }
}

export function onAccessTokenChange(handler: ((token: string) => void) | null) {
  accessTokenHandler = handler;
}

export function onSessionExpired(handler: (() => void) | null) {
  sessionExpiredHandler = handler;
}

export function notifySessionExpired() {
  if (sessionExpiredFired) return;
  sessionExpiredFired = true;
  accessToken = null;
  broadcast({ type: "expired" });
  sessionExpiredHandler?.();
}

async function doRefreshFetch(): Promise<RefreshResponse | null> {
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
    setAccessToken(data.token);
    return data;
  } catch {
    accessToken = null;
    return null;
  }
}

async function runRefreshWithLock(): Promise<RefreshResponse | null> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (locks?.request) {
    return locks.request(AUTH_LOCK_NAME, () => doRefreshFetch());
  }
  return doRefreshFetch();
}

/** Single-flight refresh using the HttpOnly cookie (cross-tab via Web Locks). */
export async function refreshSession(): Promise<RefreshResponse | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      return await runRefreshWithLock();
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
