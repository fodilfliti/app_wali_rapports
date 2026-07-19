import { useRef, type MouseEvent, type PointerEvent } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'

const DRAG_THRESHOLD_PX = 8

export function VideoNodeView({ node, selected, extension }: NodeViewProps) {
  const { t } = useTranslation()
  const src = String(node.attrs.src || '')
  const onOpen = extension.options.onOpen as undefined | ((src: string) => void)
  const pointerStart = useRef<{ x: number; y: number } | null>(null)
  const didDrag = useRef(false)

  function openIfNotDrag(e: MouseEvent | PointerEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (didDrag.current || !src) return
    onOpen?.(src)
  }

  return (
    <NodeViewWrapper
      className={`editorVideoThumbWrap${selected ? ' is-selected' : ''}`}
      data-drag-handle
    >
      <button
        type="button"
        className="editorVideoThumb"
        disabled={!src}
        onPointerDown={(e) => {
          pointerStart.current = { x: e.clientX, y: e.clientY }
          didDrag.current = false
        }}
        onPointerMove={(e) => {
          const start = pointerStart.current
          if (!start || didDrag.current) return
          const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y)
          if (dist > DRAG_THRESHOLD_PX) didDrag.current = true
        }}
        onPointerUp={() => {
          pointerStart.current = null
        }}
        onPointerCancel={() => {
          pointerStart.current = null
          didDrag.current = true
        }}
        onClick={openIfNotDrag}
        aria-label={t('mediaVideoPreview')}
      >
        <video
          className="editor-video"
          src={src || undefined}
          preload="metadata"
          muted
          playsInline
          controls={false}
          draggable={false}
          onPlay={(e) => {
            e.currentTarget.pause()
          }}
        />
        <span className="editorVideoPlay" aria-hidden>
          ▶
        </span>
      </button>
    </NodeViewWrapper>
  )
}
