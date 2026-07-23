import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { VideoNodeView } from './VideoNodeView'

export type VideoOptions = {
  HTMLAttributes: Record<string, unknown>
  onOpen: ((src: string) => void) | null
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; fileId?: string | number }) => ReturnType
    }
  }
}

export const Video = Node.create<VideoOptions>({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: { class: 'editor-video' },
      onOpen: null,
    }
  },

  addAttributes() {
    return {
      src: { default: null },
      fileId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-file-id'),
        renderHTML: (attrs) => (attrs.fileId ? { 'data-file-id': String(attrs.fileId) } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'video[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNodeView)
  },

  addCommands() {
    return {
      setVideo:
        (options) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: options,
          }),
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => (editor.isActive(this.name) ? editor.commands.deleteSelection() : false),
      Delete: ({ editor }) => (editor.isActive(this.name) ? editor.commands.deleteSelection() : false),
    }
  },
})
