import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { SchemaTableNodeView } from './SchemaTableNodeView'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    schemaTable: {
      insertSchemaTable: (tableId: string) => ReturnType
    }
  }
}

export const SchemaTable = Node.create({
  name: 'schemaTable',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tableId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-schema-table-id'),
        renderHTML: (attrs) => (attrs.tableId ? { 'data-schema-table-id': attrs.tableId } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-schema-table-id]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'schema-table-embed' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SchemaTableNodeView)
  },

  addCommands() {
    return {
      insertSchemaTable:
        (tableId) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { tableId } }),
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => (editor.isActive(this.name) ? editor.commands.deleteSelection() : false),
      Delete: ({ editor }) => (editor.isActive(this.name) ? editor.commands.deleteSelection() : false),
    }
  },
})
