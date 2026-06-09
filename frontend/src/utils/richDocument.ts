import type { Column } from './tableLayout'

export type RichLocale = 'ar' | 'fr'

export function richHtmlKey(locale: string): 'rich_html_ar' | 'rich_html_fr' {
  return locale === 'fr' ? 'rich_html_fr' : 'rich_html_ar'
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function blockText(block: { text_ar?: string; text_fr?: string; text?: string }, locale: string) {
  return locale === 'fr' ? block.text_fr ?? block.text ?? '' : block.text_ar ?? block.text ?? ''
}

/** Convert legacy paragraph/heading blocks to HTML for Tiptap. */
export function blocksToHtml(blocks: any[] | undefined, locale: string): string {
  if (!blocks?.length) return '<p></p>'
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'media_row') continue
    const text = escapeHtml(blockText(block, locale)).replace(/\n/g, '<br>')
    if (!text && block.type !== 'heading') continue
    const align = block.align === 'center' ? ' style="text-align: center"' : ''
    if (block.type === 'heading') {
      parts.push(`<h2${align}>${text || '&nbsp;'}</h2>`)
    } else {
      parts.push(`<p${align}>${text || '&nbsp;'}</p>`)
    }
  }
  return parts.length ? parts.join('') : '<p></p>'
}

export function getRichHtml(
  data: { rich_html_ar?: string; rich_html_fr?: string; blocks?: any[] } | null | undefined,
  locale: string,
): string {
  if (!data) return '<p></p>'
  const key = richHtmlKey(locale)
  if (data[key]?.trim()) return data[key]!
  return blocksToHtml(data.blocks, locale)
}

export function buildSchemaTableHtml(columns: Column[], locale: string, rows = 1): string {
  const headers = columns.map((c) => (locale === 'fr' ? c.label_fr : c.label_ar) || c.key)
  let html =
    '<table><thead><tr>' + headers.map((h) => `<th><p>${escapeHtml(h)}</p></th>`).join('') + '</tr></thead><tbody>'
  for (let r = 0; r < rows; r++) {
    html += '<tr>' + columns.map(() => '<td><p></p></td>').join('') + '</tr>'
  }
  html += '</tbody></table><p></p>'
  return html
}

export function mergeRichHtmlIntoData(
  data: Record<string, unknown>,
  locale: string,
  html: string,
): Record<string, unknown> {
  const key = richHtmlKey(locale)
  return { ...data, [key]: html }
}
