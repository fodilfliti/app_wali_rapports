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
import './richText.css'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px']

type Props = {
  value: string
  onChange: (html: string) => void
  editable?: boolean
  placeholder?: string
  onUpload?: (file: File) => Promise<{ id: number; url: string }>
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
  const [uploading, setUploading] = useState(false)

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
      Video,
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
    const current = editor.getHTML()
    if (value !== current) {
      editor.commands.setContent(value || '<p></p>', { emitUpdate: false })
    }
  }, [editor, value])

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

  const insertUploadedMedia = useCallback(
    async (file: File, kind: 'image' | 'video') => {
      if (!editor || !onUpload) return
      const uploaded = await onUpload(file)
      if (kind === 'image') {
        editor.chain().focus().setImage({ src: uploaded.url, fileId: uploaded.id } as any).run()
      } else {
        editor.chain().focus().setVideo({ src: uploaded.url, fileId: uploaded.id }).run()
      }
    },
    [editor, onUpload],
  )

  async function onFilesSelected(files: FileList | null, kind: 'image' | 'video') {
    if (!files?.length || !onUpload || uploading) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        await insertUploadedMedia(file, kind)
      }
    } finally {
      setUploading(false)
    }
  }

  if (!editor) return null

  return (
    <div
      className={`tiptapShell richTextEditorWrap${editable ? '' : ' tiptapShell-readonly'}${
        uploading ? ' isUploading' : ''
      }`}
    >
      {editable ? (
        <RichTextToolbar
          editor={editor}
          fontSizes={FONT_SIZES}
          uploading={uploading}
          onPickImages={() => imageInputRef.current?.click()}
          onPickVideos={() => videoInputRef.current?.click()}
          onInsertSchemaTable={enableSchemaTables && onOpenSchemaTablePick ? onOpenSchemaTablePick : undefined}
        />
      ) : null}
      {uploading ? <p className="muted richTextUploadingHint">{t('mediaUploading')}</p> : null}
      <EditorContent editor={editor} className="tiptapEditorWrap" dir={locale === 'ar' ? 'rtl' : 'ltr'} />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="srOnly"
        disabled={uploading}
        onChange={(e) => {
          onFilesSelected(e.target.files, 'image').catch(() => {})
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        multiple
        className="srOnly"
        disabled={uploading}
        onChange={(e) => {
          onFilesSelected(e.target.files, 'video').catch(() => {})
          e.target.value = ''
        }}
      />
    </div>
  )
}
