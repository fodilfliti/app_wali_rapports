import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SessionUser } from '../api'
import * as session from '../auth/session'
import { canAction, type ActionKey, type ActionContext } from '@wali/access-policy'
import { hubHome, hubKeyFromRole } from '@wali/routes'

type AuthState = {
  token: string | null
  me: SessionUser | null
  setSession: (token: string | null, user: SessionUser | null) => void
  clearSession: () => void
  can: (action: ActionKey, resource?: Partial<ActionContext>) => boolean
  hubHomePath: string
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({
  children,
  me,
  token,
  setMe,
}: {
  children: ReactNode
  me: SessionUser | null
  token: string | null
  setMe: (u: SessionUser | null) => void
}) {
  const [accessToken, setAccessTokenState] = useState<string | null>(token)

  useEffect(() => {
    setAccessTokenState(token)
  }, [token])

  useEffect(() => {
    session.onAccessTokenChange((t) => setAccessTokenState(t))
    return () => session.onAccessTokenChange(null)
  }, [])

  const setSession = useCallback(
    (t: string | null, user: SessionUser | null) => {
      session.setAccessToken(t)
      setAccessTokenState(t)
      setMe(user)
      if (user) {
        try {
          localStorage.setItem('me', JSON.stringify(user))
        } catch {
          /* ignore */
        }
      } else {
        try {
          localStorage.removeItem('me')
        } catch {
          /* ignore */
        }
      }
    },
    [setMe],
  )

  const clearSession = useCallback(() => {
    session.setAccessToken(null)
    setAccessTokenState(null)
    setMe(null)
    try {
      localStorage.removeItem('me')
    } catch {
      /* ignore */
    }
  }, [setMe])

  const can = useCallback(
    (action: ActionKey, resource: Partial<ActionContext> = {}) => {
      if (!me) return false
      return canAction(
        {
          role: me.role,
          effectivePermissions: me.effective_permissions,
          ...resource,
        },
        action,
      )
    },
    [me],
  )

  const hubHomePath = useMemo(() => {
    const key = me?.role ? hubKeyFromRole(me.role) : null
    return key ? hubHome(key) : '/'
  }, [me?.role])

  const value = useMemo(
    () => ({
      token: accessToken,
      me,
      setSession,
      clearSession,
      can,
      hubHomePath,
    }),
    [accessToken, me, setSession, clearSession, can, hubHomePath],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Optional — returns null outside provider (for gradual migration). */
export function useAuthOptional(): AuthState | null {
  return useContext(AuthContext)
}
