import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'

export type ActionsMenuItem = {
  key: string
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}

type Props = {
  items: ActionsMenuItem[]
  className?: string
  buttonClassName?: string
  menuClassName?: string
  align?: 'start' | 'end'
  icon?: ReactNode
  /** Render menu in a portal with fixed position — avoids card hover / link overlap bugs. */
  portal?: boolean
}

function DotsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable="false">
      <circle cx="12" cy="5" r="1.75" fill="currentColor" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
      <circle cx="12" cy="19" r="1.75" fill="currentColor" />
    </svg>
  )
}

function menuFixedStyle(anchor: DOMRect): CSSProperties {
  const isRtl = typeof document !== 'undefined' && document.documentElement.dir === 'rtl'
  return {
    position: 'fixed',
    top: `${anchor.bottom + 6}px`,
    zIndex: 1200,
    minWidth: '11rem',
    ...(isRtl
      ? { left: `${anchor.left}px`, right: 'auto' }
      : { right: `${window.innerWidth - anchor.right}px`, left: 'auto' }),
  }
}

export function ActionsMenuButton({
  items,
  className = '',
  buttonClassName = '',
  menuClassName = '',
  align = 'end',
  icon,
  portal = false,
}: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const wrapRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const updateMenuPosition = useCallback(() => {
    if (!portal || !buttonRef.current) return
    setMenuStyle(menuFixedStyle(buttonRef.current.getBoundingClientRect()))
  }, [portal])

  function toggleMenu() {
    if (open) {
      setOpen(false)
      return
    }
    if (portal && buttonRef.current) {
      setMenuStyle(menuFixedStyle(buttonRef.current.getBoundingClientRect()))
    }
    setOpen(true)
  }

  const menuPosReady = !portal || typeof menuStyle.top === 'string'

  useLayoutEffect(() => {
    if (!open || !portal) return
    updateMenuPosition()
  }, [open, portal, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    if (!portal) return
    const onResize = () => updateMenuPosition()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, portal, updateMenuPosition])

  useEffect(() => {
    if (!open) return
    function onDocPointer(e: PointerEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      if (!portal && wrapRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDocPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDocPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, portal])

  if (!items.length) return null

  const menuEl = open && menuPosReady ? (
    <div
      ref={menuRef}
      className={`actionsMenuDropdown ${menuClassName}`.trim()}
      role="menu"
      style={portal ? menuStyle : undefined}
    >
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          className={`actionsMenuItem${item.danger ? ' actionsMenuItem--danger' : ''}`}
          disabled={item.disabled}
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setOpen(false)
            item.onClick()
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  ) : null

  return (
    <div
      ref={wrapRef}
      className={`actionsMenuWrap actionsMenuWrap--${align}${open ? ' actionsMenuWrap--open' : ''} ${className}`.trim()}
      data-menu-open={open ? 'true' : undefined}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`actionsMenuBtn ${buttonClassName}`.trim()}
        aria-label={t('moreActions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggleMenu()
        }}
      >
        {icon || <DotsIcon />}
      </button>
      {!portal && menuEl}
      {portal && menuEl ? createPortal(menuEl, document.body) : null}
    </div>
  )
}
