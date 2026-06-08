import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type SnackbarState = { message: string; tone: 'error' | 'success' | 'info' } | null

const SnackbarContext = createContext<{
  show: (message: string, tone?: 'error' | 'success' | 'info') => void
} | null>(null)

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SnackbarState>(null)

  const show = useCallback((message: string, tone: 'error' | 'success' | 'info' = 'info') => {
    setState({ message, tone })
    window.setTimeout(() => setState(null), 4000)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      {state ? (
        <div className={`snackbar snackbar-${state.tone}`} role="status">
          {state.message}
        </div>
      ) : null}
    </SnackbarContext.Provider>
  )
}

export function useSnackbar() {
  const ctx = useContext(SnackbarContext)
  if (!ctx) throw new Error('SnackbarProvider required')
  return ctx
}
