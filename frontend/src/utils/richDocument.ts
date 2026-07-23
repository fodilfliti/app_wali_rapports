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

/** True when HTML has no visible text and no media/tables. */
export function richHtmlIsEmpty(html?: string | null): boolean {
  if (!html || typeof html !== 'string') return true
  const stripped = html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .trim()
  if (stripped.length > 0) return false
  return !/<img\b/i.test(html) && !/<video\b/i.test(html) && !/<table\b/i.test(html)
}

function blockText(block: { text_ar?: string; text_fr?: string; text?: string }, locale: string) {
  const ar = block.text_ar ?? block.text ?? ''
  const fr = block.text_fr ?? block.text ?? ''
  return locale === 'fr' ? fr || ar : ar || fr
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
      const level = block.level === 3 || block.level === 1 ? block.level : 2
      parts.push(`<h${level}${align}>${text || '&nbsp;'}</h${level}>`)
    } else {
      // Official letterhead uses bold centered paragraphs (body size).
      const inner = block.bold ? `<strong>${text || '&nbsp;'}</strong>` : text || '&nbsp;'
      parts.push(`<p${align}>${inner}</p>`)
    }
  }
  return parts.length ? parts.join('') : '<p></p>'
}

export function getRichHtml(
  data: { rich_html_ar?: string; rich_html_fr?: string; blocks?: any[] } | null | undefined,
  locale: string,
): string {
  if (!data) return '<p></p>'
  const preferred = richHtmlKey(locale)
  const other = preferred === 'rich_html_ar' ? 'rich_html_fr' : 'rich_html_ar'
  // Prefer requested locale, then the other (office often saves AR only while UI is FR).
  if (!richHtmlIsEmpty(data[preferred])) return data[preferred]!
  if (!richHtmlIsEmpty(data[other])) return data[other]!
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
