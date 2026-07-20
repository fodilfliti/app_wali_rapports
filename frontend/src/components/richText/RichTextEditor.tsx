import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TextAlign from '@tiptap/extension-text-align'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import HorizontalRule from '@tiptap/extension-horizontal-rule'
import { useTranslation } from 'react-i18next'
import { FontSize } from './fontSizeExtension'
import { Video } from './videoExtension'
import { SchemaTable } from './schemaTableExtension'
import { BorderedBlock } from './borderedBlockExtension'
import { RichTextToolbar } from './RichTextToolbar'
import { ImageLightbox, useImageLightbox } from '../ImageLightbox'
import { UploadProgressBar } from '../UploadProgressBar'
import { MediaUploadError, prepareFileForUpload } from '../../utils/media'
import { blendedBatchPercent, runUploadQueue } from '../../utils/uploadQueue'
import type { UploadProgress } from '../../utils/uploadFile'
import './richText.css'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px']
const IMAGE_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000
const VIDEO_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000

type UploadPhase = 'idle' | 'preparing' | 'uploading'

type UploadOpts = {
  onProgress?: (p: UploadProgress) => void
  signal?: AbortSignal
  timeoutMs?: number
}

function isEmptyRichHtml(html: string | null | undefined): boolean {
  if (!html) return true
  const trimmed = html.trim()
  return (
    trimmed === '' ||
    trimmed === '<p></p>' ||
    trimmed === '<p><br></p>' ||
    trimmed === '<p><br/></p>'
  )
}

type Props = {
  value: string
  onChange: (html: string) => void
  editable?: boolean
  placeholder?: string
  onUpload?: (file: File, opts?: UploadOpts) => Promise<{ id: number; url: string }>
  onUploadError?: (err: unknown) => void
  locale?: string
  insertTableId?: string | null
  onInsertTableDone?: () => void
  onOpenSchemaTablePick?: () => void
  enableSchemaTables?: boolean
}

const CustomImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-file-id'),
        renderHTML: (attrs) => (attrs.fileId ? { 'data-file-id': String(attrs.fileId) } : {}),
      },
    }
  },
})

export function RichTextEditor({
  value,
  onChange,
  editable = true,
  placeholder,
  onUpload,
  onUploadError,
  locale = 'ar',
  insertTableId,
  onInsertTableDone,
  onOpenSchemaTablePick,
  enableSchemaTables = false,
}: Props) {
  const { t } = useTranslation()
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const skipNextUpdate = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const perFileProgressRef = useRef<number[]>([])
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [uploadPercent, setUploadPercent] = useState(0)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [preparingVideo, setPreparingVideo] = useState(false)
  const lightbox = useImageLightbox()
  const openVideoRef = useRef(lightbox.openVideo)
  openVideoRef.current = lightbox.openVideo

  const mediaBusy = phase !== 'idle'

  const resetUploadState = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    perFileProgressRef.current = []
    setPhase('idle')
    setUploadPercent(0)
    setPreparingVideo(false)
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      Color,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false }),
      HorizontalRule,
      BorderedBlock,
      CustomImage.configure({ inline: false, allowBase64: false, HTMLAttributes: { class: 'editor-image' } }),
      Video.configure({
        onOpen: (src) => openVideoRef.current(src),
      }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      ...(enableSchemaTables ? [SchemaTable] : []),
      Placeholder.configure({ placeholder: placeholder || t('richTextPlaceholder') }),
    ],
    content: value || '<p></p>',
    editable,
    onUpdate: ({ editor: ed }) => {
      skipNextUpdate.current = true
      onChange(ed.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    editor.setEditable(editable)
  }, [editor, editable])

  useEffect(() => {
    if (!editor || skipNextUpdate.current) {
      skipNextUpdate.current = false
      return
    }
    if (mediaBusy) return
    const current = editor.getHTML()
    const next = value || '<p></p>'
    const currentLooksEmpty = isEmptyRichHtml(current)
    const nextLooksEmpty = isEmptyRichHtml(next)
    if (nextLooksEmpty && !currentLooksEmpty) return
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
  }, [editor, value, mediaBusy])

  useEffect(() => {
    if (!editor || !insertTableId) return
    const id = insertTableId
    const timer = window.setTimeout(() => {
      if (editor.isDestroyed) return
      editor.chain().focus().insertSchemaTable(id).run()
      onInsertTableDone?.()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [editor, insertTableId, onInsertTableDone])

  useEffect(() => () => abortRef.current?.abort(), [])

  const insertUploadedMedia = useCallback(
    async (
      file: File,
      kind: 'image' | 'video',
      fileIndex: number,
      totalFiles: number,
      signal: AbortSignal,
    ) => {
      if (!editor || !onUpload) return
      const timeoutMs = kind === 'video' ? VIDEO_UPLOAD_TIMEOUT_MS : IMAGE_UPLOAD_TIMEOUT_MS
      const uploaded = await onUpload(file, {
        signal,
        timeoutMs,
        onProgress: (p) => {
          perFileProgressRef.current[fileIndex] = p.percent
          setUploadPercent(blendedBatchPercent(perFileProgressRef.current, totalFiles))
        },
      })
      perFileProgressRef.current[fileIndex] = 100
      setUploadPercent(blendedBatchPercent(perFileProgressRef.current, totalFiles))
      if (kind === 'image') {
        editor.chain().focus().setImage({ src: uploaded.url, fileId: uploaded.id } as any).run()
      } else {
        editor.chain().focus().setVideo({ src: uploaded.url, fileId: uploaded.id }).run()
      }
    },
    [editor, onUpload],
  )

  async function onFilesSelected(files: FileList | null, kind: 'image' | 'video') {
    if (!files?.length || !onUpload || mediaBusy) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const list = Array.from(files)
    const totalFiles = list.length
    perFileProgressRef.current = new Array(totalFiles).fill(0)

    setPhase('preparing')
    setUploadPercent(0)
    setUploadError(null)
    setPreparingVideo(kind === 'video')

    try {
      const prepared = await Promise.all(
        list.map((file) =>
          prepareFileForUpload(file, { onCompressing: () => setPhase('preparing') }),
        ),
      )

      setPhase('uploading')
      setPreparingVideo(false)

      await runUploadQueue(
        prepared.map((file, fileIndex) => () =>
          insertUploadedMedia(file, kind, fileIndex, totalFiles, controller.signal),
        ),
        3,
      )
      setUploadPercent(100)
    } catch (err) {
      if (controller.signal.aborted && !(err instanceof MediaUploadError)) {
        setUploadError(t('mediaUploadFailed'))
      } else {
        const key =
          err instanceof MediaUploadError
            ? err.key
            : err instanceof Error && err.message === 'rapportTitleRequired'
              ? 'rapportTitleRequired'
              : 'mediaUploadFailed'
        setUploadError(t(key, err instanceof MediaUploadError ? err.params : undefined))
      }
      onUploadError?.(err)
    } finally {
      resetUploadState()
    }
  }

  if (!editor) return null

  const statusHint =
    phase === 'preparing'
      ? preparingVideo
        ? t('mediaVideoPreparing')
        : t('mediaCompressing')
      : phase === 'uploading'
        ? t('mediaUploading')
        : null

  return (
    <div
      className={`tiptapShell richTextEditorWrap${editable ? '' : ' tiptapShell-readonly'}${
        mediaBusy ? ' isUploading' : ''
      }`}
    >
      {editable ? (
        <RichTextToolbar
          editor={editor}
          fontSizes={FONT_SIZES}
          mediaBusy={mediaBusy}
          onPickImages={() => imageInputRef.current?.click()}
          onPickVideos={() => videoInputRef.current?.click()}
          onInsertSchemaTable={enableSchemaTables && onOpenSchemaTablePick ? onOpenSchemaTablePick : undefined}
        />
      ) : null}
      {mediaBusy ? (
        <>
          {statusHint ? <p className="muted richTextUploadingHint">{statusHint}</p> : null}
          <UploadProgressBar
            percent={uploadPercent}
            label={t('mediaUploadProgress', { percent: uploadPercent })}
          />
        </>
      ) : null}
      {uploadError ? <p className="formErrorBlock">{uploadError}</p> : null}
      <EditorContent editor={editor} className="tiptapEditorWrap" dir={locale === 'ar' ? 'rtl' : 'ltr'} />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="srOnly"
        disabled={mediaBusy}
        onChange={(e) => {
          void onFilesSelected(e.target.files, 'image')
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="srOnly"
        disabled={mediaBusy}
        onChange={(e) => {
          void onFilesSelected(e.target.files, 'video')
          e.target.value = ''
        }}
      />
      <ImageLightbox
        src={lightbox.state?.src || ''}
        alt={lightbox.state?.alt}
        kind={lightbox.state?.kind}
        open={lightbox.isOpen}
        onClose={lightbox.close}
      />
    </div>
  )
}
