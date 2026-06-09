import { useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'

const PRESET_TEXT_COLORS = [
  '#000000',
  '#374151',
  '#6b7280',
  '#991b1b',
  '#b45309',
  '#0d6b63',
  '#1d4ed8',
  '#166534',
  '#7c3aed',
  '#db2777',
]

function toHexColor(value: string | undefined, fallback = '#000000') {
  if (!value) return fallback
  const v = value.trim()
  if (/^#[0-9a-f]{6}$/i.test(v)) return v.toLowerCase()
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const r = v[1]
    const g = v[2]
    const b = v[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return fallback
}

type Props = {
  editor: Editor
}

export function TextColorPicker({ editor }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [, setSelectionTick] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const rawColor = editor.getAttributes('textStyle').color as string | undefined
  const currentColor = toHexColor(rawColor, '#000000')
  const hasCustomColor = Boolean(rawColor)

  useEffect(() => {
    const refresh = () => setSelectionTick((n) => n + 1)
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
    }
  }, [editor])

  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  function applyColor(color: string) {
    editor.chain().focus().setColor(color).run()
  }

  function clearColor() {
    editor.chain().focus().unsetColor().run()
    setOpen(false)
  }

  return (
    <div className="tiptapColorPicker" ref={rootRef}>
      <button
        type="button"
        className={`tiptapColorPickerTrigger tiptapToolbarBtn${open ? ' active' : ''}`}
        title={t('richTextColor')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="tiptapColorPickerLetter">A</span>
        <span
          className="tiptapColorPickerBar"
          style={{ backgroundColor: hasCustomColor ? currentColor : '#000000' }}
        />
      </button>
      {open ? (
        <div className="tiptapColorPickerPanel" role="dialog" aria-label={t('richTextColor')}>
          <div className="tiptapColorPickerGrid">
            <button
              type="button"
              className={`tiptapColorSwatch tiptapColorSwatch-default${!hasCustomColor ? ' active' : ''}`}
              title={t('richTextColorDefault')}
              onClick={clearColor}
            />
            {PRESET_TEXT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className={`tiptapColorSwatch${hasCustomColor && currentColor === color ? ' active' : ''}`}
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  applyColor(color)
                  setOpen(false)
                }}
              />
            ))}
          </div>
          <label className="tiptapColorPickerCustom">
            <span>{t('richTextColorCustom')}</span>
            <input
              type="color"
              className="tiptapColorInput"
              value={currentColor}
              title={t('richTextColorCustom')}
              onChange={(e) => applyColor(e.target.value)}
            />
          </label>
        </div>
      ) : null}
    </div>
  )
}
