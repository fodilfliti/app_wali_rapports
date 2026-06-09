export function blockText(block: { text_ar?: string; text_fr?: string; text?: string }, locale: string) {
  return locale === 'fr' ? block.text_fr ?? block.text ?? '' : block.text_ar ?? block.text ?? ''
}

export function defaultCommuneBlocks(municipality: { name_ar?: string; name_fr?: string }) {
  return [
    {
      type: 'heading',
      align: 'center',
      bold: true,
      text_ar: municipality.name_ar || '',
      text_fr: municipality.name_fr || '',
    },
    { type: 'paragraph', text_ar: '', text_fr: '' },
  ]
}
