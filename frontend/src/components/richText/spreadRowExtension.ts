import { Node, mergeAttributes, type Editor } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { TextSelection } from '@tiptap/pm/state'

export type SpreadCols = 2 | 3

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    spreadRow: {
      insertSpreadRow: (cols?: SpreadCols) => ReturnType
      /** Insert, or unwrap this row when the same cols tool is clicked again. */
      toggleSpreadRow: (cols?: SpreadCols) => ReturnType
      unwrapSpreadRow: () => ReturnType
    }
  }
}

type SpreadRowOptions = {
  HTMLAttributes: Record<string, unknown>
  /** Content locale — Arabic focuses/aligns start cell to the right. */
  locale: string
}

function para(textAlign: 'left' | 'center' | 'right') {
  return { type: 'paragraph', attrs: { textAlign } }
}

function cellsForCols(cols: SpreadCols, locale: string) {
  const isAr = locale === 'ar'
  const startAlign = isAr ? 'right' : 'left'
  const endAlign = isAr ? 'left' : 'right'
  if (cols === 2) {
    return [
      { type: 'spreadCell', attrs: { slot: 'start' }, content: [para(startAlign)] },
      { type: 'spreadCell', attrs: { slot: 'end' }, content: [para(endAlign)] },
    ]
  }
  return [
    { type: 'spreadCell', attrs: { slot: 'start' }, content: [para(startAlign)] },
    { type: 'spreadCell', attrs: { slot: 'middle' }, content: [para('center')] },
    { type: 'spreadCell', attrs: { slot: 'end' }, content: [para(endAlign)] },
  ]
}

function findSpreadAround($from: Editor['state']['selection']['$from']): {
  pos: number
  node: ProseMirrorNode
  depth: number
} | null {
  for (let d = $from.depth; d > 0; d -= 1) {
    const node = $from.node(d)
    if (node.type.name === 'spreadRow') {
      return { pos: $from.before(d), node, depth: d }
    }
  }
  return null
}

/** Flatten spread cells into normal paragraphs (one line flow again). */
function flattenSpreadToParagraphs(spreadNode: ProseMirrorNode, schema: Editor['schema']) {
  const out: ProseMirrorNode[] = []
  spreadNode.forEach((cell) => {
    cell.forEach((child) => {
      if (child.type.name === 'paragraph') {
        out.push(child.copy(child.content))
      } else if (child.isTextblock) {
        out.push(schema.nodes.paragraph.create(null, child.content))
      }
    })
  })
  if (!out.length) out.push(schema.nodes.paragraph.create())
  return out
}

/** Place caret at the start of the first cell (start slot = right side in Arabic). */
function focusFirstSpreadCell(tr: Editor['state']['tr'], spreadPos: number, spreadNode: ProseMirrorNode) {
  if (!spreadNode.childCount) return
  // spreadPos → open spread → open first cell → open first paragraph → content start
  let pos = spreadPos + 1
  const firstCell = spreadNode.child(0)
  pos += 1
  if (firstCell.childCount) {
    pos += 1
  }
  tr.setSelection(TextSelection.create(tr.doc, pos))
}

export const SpreadCell = Node.create({
  name: 'spreadCell',
  group: 'spreadCell',
  content: 'paragraph+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      slot: {
        default: 'start',
        parseHTML: (el) => el.getAttribute('data-spread-slot') || 'start',
        renderHTML: (attrs) =>
          attrs.slot ? { 'data-spread-slot': String(attrs.slot) } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div.editor-spread-cell' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'editor-spread-cell',
      }),
      0,
    ]
  },

  addOptions() {
    return { HTMLAttributes: {} }
  },
})

export const SpreadRow = Node.create<SpreadRowOptions>({
  name: 'spreadRow',
  group: 'block',
  content: 'spreadCell{2,3}',
  defining: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      locale: 'ar',
    }
  },

  addAttributes() {
    return {
      cols: {
        default: 3,
        parseHTML: (el) => {
          const n = Number(el.getAttribute('data-spread-cols') || 3)
          return n === 2 ? 2 : 3
        },
        renderHTML: (attrs) => ({
          'data-spread-cols': String(attrs.cols === 2 ? 2 : 3),
        }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div.editor-spread-row' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'editor-spread-row',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      unwrapSpreadRow:
        () =>
        ({ state, dispatch, tr }) => {
          const found = findSpreadAround(state.selection.$from)
          if (!found) return false
          const paragraphs = flattenSpreadToParagraphs(found.node, state.schema)
          if (dispatch) {
            tr.replaceWith(found.pos, found.pos + found.node.nodeSize, paragraphs)
            dispatch(tr)
          }
          return true
        },

      insertSpreadRow:
        (cols: SpreadCols = 3) =>
        ({ state, dispatch, tr }) => {
          const wanted = cols === 2 ? 2 : 3
          const locale = this.options.locale || 'ar'
          const cellNodes = cellsForCols(wanted, locale).map((cellJson) => {
            const paraJson = cellJson.content[0]
            const paraNode = state.schema.nodes.paragraph.create(paraJson.attrs || null)
            return state.schema.nodes.spreadCell.create(cellJson.attrs, paraNode)
          })
          const node = state.schema.nodes.spreadRow.create({ cols: wanted }, cellNodes)
          if (!dispatch) return true
          const { from, to } = state.selection
          tr.replaceWith(from, to, node)
          focusFirstSpreadCell(tr, from, node)
          dispatch(tr.scrollIntoView())
          return true
        },

      toggleSpreadRow:
        (cols: SpreadCols = 3) =>
        ({ editor, chain, commands }) => {
          const wanted = cols === 2 ? 2 : 3
          const found = findSpreadAround(editor.state.selection.$from)
          if (found) {
            const currentCols = found.node.attrs.cols === 2 ? 2 : 3
            if (currentCols === wanted) {
              return commands.unwrapSpreadRow()
            }
            return chain().focus().unwrapSpreadRow().insertSpreadRow(wanted).run()
          }
          return commands.insertSpreadRow(wanted)
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        if (!editor.isActive(this.name)) return false
        const { $from } = editor.state.selection
        if ($from.parentOffset !== 0) return false
        const cell = $from.node(-1)
        if (cell?.type?.name !== 'spreadCell') return false
        if (cell.textContent.trim()) return false
        return editor.commands.unwrapSpreadRow()
      },
    }
  },
})
