import { useEffect, useState, type ReactNode } from 'react'
import type { Editor } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { TextColorPicker } from './TextColorPicker'

type Props = {
  editor: Editor
  fontSizes: string[]
  onPickImages: () => void
  onPickVideos: () => void
  onInsertSchemaTable?: () => void
  /** Disables only image/video pick while a media upload is in flight. */
  mediaBusy?: boolean
}

function ToolbarBtn({
  active,
  onClick,
  title,
  children,
  disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`tiptapToolbarBtn${active ? ' active' : ''}`}
      title={title}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function RichTextToolbar({
  editor,
  fontSizes,
  onPickImages,
  onPickVideos,
  onInsertSchemaTable,
  mediaBusy = false,
}: Props) {
  const { t } = useTranslation()
  const [, setSelectionTick] = useState(0)

  useEffect(() => {
    const refresh = () => setSelectionTick((n) => n + 1)
    editor.on('selectionUpdate', refresh)
    editor.on('transaction', refresh)
    return () => {
      editor.off('selectionUpdate', refresh)
      editor.off('transaction', refresh)
    }
  }, [editor])

  const canRemoveBlock =
    editor.isActive('image') || editor.isActive('video') || editor.isActive('schemaTable')

  return (
    <div className="tiptapToolbar" role="toolbar" aria-busy={mediaBusy || undefined}>
      <ToolbarBtn
        title={t('richTextBold')}
        active={editor.isActive('bold')}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <strong>B</strong>
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextItalic')}
        active={editor.isActive('italic')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <em>I</em>
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextUnderline')}
        active={editor.isActive('underline')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <span className="tiptapUnderline">U</span>
      </ToolbarBtn>
      <span className="tiptapToolbarSep" />
      <ToolbarBtn
        title={t('richTextHeading1')}
        active={editor.isActive('heading', { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextHeading2')}
        active={editor.isActive('heading', { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextHeading3')}
        active={editor.isActive('heading', { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarBtn>
      <span className="tiptapToolbarSep" />
      <select
        className="tiptapToolbarSelect"
        title={t('richTextFontSize')}
        value={(editor.getAttributes('textStyle').fontSize as string) || ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) editor.chain().focus().setFontSize(v).run()
          else editor.chain().focus().unsetFontSize().run()
        }}
      >
        <option value="">{t('richTextFontSize')}</option>
        {fontSizes.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <TextColorPicker editor={editor} />
      <span className="tiptapToolbarSep" />
      <ToolbarBtn
        title={t('richTextAlignLeft')}
        active={editor.isActive({ textAlign: 'left' })}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
      >
        <span className="tiptapAlignIcon tiptapAlignIcon-left" aria-hidden>
          ≡
        </span>
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextAlignCenter')}
        active={editor.isActive({ textAlign: 'center' })}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
      >
        <span className="tiptapAlignIcon tiptapAlignIcon-center" aria-hidden>
          ≡
        </span>
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextAlignRight')}
        active={editor.isActive({ textAlign: 'right' })}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
      >
        <span className="tiptapAlignIcon tiptapAlignIcon-right" aria-hidden>
          ≡
        </span>
      </ToolbarBtn>
      <span className="tiptapToolbarSep" />
      <ToolbarBtn
        title={t('richTextBulletList')}
        active={editor.isActive('bulletList')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </ToolbarBtn>
      <ToolbarBtn
        title={t('richTextOrderedList')}
        active={editor.isActive('orderedList')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </ToolbarBtn>
      <span className="tiptapToolbarSep" />
      <ToolbarBtn
        title={t('richTextBorderedBlock')}
        active={editor.isActive('borderedBlock')}
        onClick={() => editor.chain().focus().toggleBorderedBlock().run()}
      >
        ▢
      </ToolbarBtn>
      <span className="tiptapToolbarSep" />
      {onInsertSchemaTable ? (
        <ToolbarBtn title={t('richTextInsertSchemaTable')} onClick={onInsertSchemaTable}>
          ⊞+
        </ToolbarBtn>
      ) : null}
      {canRemoveBlock ? (
        <ToolbarBtn title={t('richTextRemoveBlock')} onClick={() => editor.chain().focus().deleteSelection().run()}>
          🗑
        </ToolbarBtn>
      ) : null}
      <ToolbarBtn title={t('richTextInsertImage')} onClick={onPickImages} disabled={mediaBusy}>
        🖼
      </ToolbarBtn>
      <ToolbarBtn title={t('richTextInsertVideo')} onClick={onPickVideos} disabled={mediaBusy}>
        ▶
      </ToolbarBtn>
      <ToolbarBtn title={t('richTextHorizontalRule')} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        —
      </ToolbarBtn>
    </div>
  )
}
