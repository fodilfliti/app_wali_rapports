import { useEffect, useState } from 'react'

import { createPortal } from 'react-dom'

import { useTranslation } from 'react-i18next'
import { contentLocale, ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { hasBilingualText } from '../utils/bilingual'

import { RichTextEditor } from './richText/RichTextEditor'



type TemplateForm = {

  name_ar: string

  name_fr: string

  content_kind: '' | 'document_compose' | 'fiche_lecture'

  rapport_type_ids: string[]

  is_default: boolean

  rich_html_ar: string

  rich_html_fr: string

}



type Props = {

  open: boolean

  title: string

  rapportTypes: any[]

  initial?: Partial<TemplateForm> & { id?: number; rapport_type_id?: string }

  onClose: () => void

  onSave: (form: TemplateForm) => Promise<void>

}



const emptyForm = (): TemplateForm => ({

  name_ar: '',

  name_fr: '',

  content_kind: '',

  rapport_type_ids: [],

  is_default: false,

  rich_html_ar: '<p></p>',

  rich_html_fr: '<p></p>',

})



export function DocumentTemplateEditModal({ open, title, rapportTypes, initial, onClose, onSave }: Props) {

  const { t, i18n } = useTranslation()

  const [form, setForm] = useState<TemplateForm>(emptyForm)

  const [saving, setSaving] = useState(false)

  const locale = contentLocale(i18n.language)



  useEffect(() => {

    if (!open) return

    const typeIds =

      initial?.rapport_type_ids?.map(String) ||

      (initial?.rapport_type_id ? [String(initial.rapport_type_id)] : [])

    setForm({

      ...emptyForm(),

      ...initial,

      content_kind: (initial?.content_kind as TemplateForm['content_kind']) || '',

      rapport_type_ids: typeIds,

    })

  }, [open, initial])



  if (!open) return null



  const documentTypes = rapportTypes.filter((rt) =>

    ['document_compose', 'fiche_lecture'].includes(rt.content_kind),

  )



  const filteredDocumentTypes = form.content_kind

    ? documentTypes.filter((rt) => rt.content_kind === form.content_kind)

    : documentTypes



  function toggleType(typeId: number, checked: boolean) {

    const id = String(typeId)

    setForm((f) => ({

      ...f,

      rapport_type_ids: checked

        ? [...new Set([...f.rapport_type_ids, id])]

        : f.rapport_type_ids.filter((x) => x !== id),

    }))

  }



  async function handleSave() {

    if (!hasBilingualText(form.name_ar, form.name_fr)) return

    setSaving(true)

    try {

      await onSave(form)

    } finally {

      setSaving(false)

    }

  }



  const editorHtml = locale === 'fr' ? form.rich_html_fr : form.rich_html_ar



  return createPortal(

    <div className="modalOverlay documentTemplateModalOverlay">

      <div className="modalCard documentTemplateModalCard">

        <div className="documentTemplateModalHeader">

          <div>

            <h2>{title}</h2>

            <p className="muted small">{t('documentTemplateEditHint')}</p>

          </div>

        </div>

        <div className="documentTemplateModalMeta formStack">

          <label>

            {t('documentTemplateNameAr')}

            <input value={form.name_ar} onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))} />

          </label>

          {ENABLE_FR_VALUE_INPUTS ? (
          <label>

            {t('documentTemplateNameFr')}

            <input value={form.name_fr} onChange={(e) => setForm((f) => ({ ...f, name_fr: e.target.value }))} />

          </label>
          ) : null}

          <label>

            {t('documentTemplateScope')}

            <select

              value={form.content_kind}

              onChange={(e) => {

                const content_kind = e.target.value as TemplateForm['content_kind']

                setForm((f) => ({

                  ...f,

                  content_kind,

                  rapport_type_ids: f.rapport_type_ids.filter((id) => {

                    const rt = documentTypes.find((row) => String(row.id) === id)

                    return !content_kind || rt?.content_kind === content_kind

                  }),

                }))

              }}

            >

              <option value="">{t('documentTemplateScopeAll')}</option>

              <option value="document_compose">{t('contentKind_document_compose')}</option>

              <option value="fiche_lecture">{t('contentKind_fiche_lecture')}</option>

            </select>

          </label>

          <fieldset className="documentTemplateTypePick">

            <legend>{t('documentTemplateRapportTypes')}</legend>

            <p className="muted small">{t('documentTemplateRapportTypesHint')}</p>

            <div className="documentTemplateTypePickList">

              {filteredDocumentTypes.map((rt) => (

                <label key={rt.id} className="checkboxRow documentTemplateTypeCheck">

                  <input

                    type="checkbox"

                    checked={form.rapport_type_ids.includes(String(rt.id))}

                    onChange={(e) => toggleType(rt.id, e.target.checked)}

                  />

                  <span>{i18n.language === 'fr' ? rt.name_fr : rt.name_ar}</span>

                </label>

              ))}

            </div>

          </fieldset>

          <label className="checkboxRow documentTemplateDefaultCheck">

            <input

              type="checkbox"

              checked={form.is_default}

              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}

            />

            <span>{t('documentTemplateDefault')}</span>

          </label>

          {form.is_default ? (
            <p className="muted small documentTemplateDefaultHint">{t('documentTemplateDefaultHint')}</p>
          ) : null}

        </div>

        <div className="documentTemplateModalEditor">

          <RichTextEditor

            key={`${initial?.id || 'new'}-${locale}`}

            value={editorHtml}

            locale={locale}

            editable

            onChange={(html) =>

              setForm((f) =>

                locale === 'fr' ? { ...f, rich_html_fr: html } : { ...f, rich_html_ar: html },

              )

            }

          />

        </div>

        <div className="modalActions">

          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>

            {t('save')}

          </button>

          <button type="button" className="btn btn-secondary" onClick={onClose}>

            {t('cancel')}

          </button>

        </div>

      </div>

    </div>,

    document.body,

  )

}


