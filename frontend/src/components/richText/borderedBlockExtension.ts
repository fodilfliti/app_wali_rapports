import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    borderedBlock: {
      insertBorderedBlock: () => ReturnType
      toggleBorderedBlock: () => ReturnType
    }
  }
}

export const BorderedBlock = Node.create({
  name: 'borderedBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.editor-bordered-block' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { class: 'editor-bordered-block' }), 0]
  },

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addCommands() {
    return {
      insertBorderedBlock:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({
              type: this.name,
              content: [{ type: 'paragraph' }],
            })
            .run(),
      toggleBorderedBlock:
        () =>
        ({ editor, chain }) => {
          if (editor.isActive(this.name)) {
            return chain().focus().lift(this.name).run()
          }
          const { empty } = editor.state.selection
          if (!empty) {
            return chain().focus().wrapIn(this.name).run()
          }
          return chain().focus().insertBorderedBlock().run()
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.toggleBorderedBlock(),
      Backspace: ({ editor }) => {
        const { $from } = editor.state.selection
        if (!editor.isActive(this.name)) return false
        if ($from.parentOffset !== 0) return false
        if ($from.depth < 2) return false
        return editor.commands.lift(this.name)
      },
    }
  },
})
