import { useTranslation } from 'react-i18next'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { BusyButton } from './BusyButton'
import { SchemaColumnsEditor, type DraftSchemaColumn } from './SchemaColumnsEditor'
import type { DraftHeaderGroup } from '../utils/schemaHeaderGroups'
import type { SchemaFormState } from '../utils/schemaEditorState'

type Props = {
  title: string
  hint?: string
  schemaForm: SchemaFormState
  onSchemaFormChange: (next: SchemaFormState) => void
  draftColumns: DraftSchemaColumn[]
  onDraftColumnsChange: (next: DraftSchemaColumn[]) => void
  draftHeaderGroups: DraftHeaderGroup[]
  onDraftHeaderGroupsChange: (next: DraftHeaderGroup[]) => void
  onSave: () => void
  onCancel: () => void
  onDelete?: () => void
  showDelete?: boolean
  versionNote?: boolean
  saving?: boolean
}

export function TableSchemaEditorModal({
  title,
  hint,
  schemaForm,
  onSchemaFormChange,
  draftColumns,
  onDraftColumnsChange,
  draftHeaderGroups,
  onDraftHeaderGroupsChange,
  onSave,
  onCancel,
  onDelete,
  showDelete,
  versionNote = true,
  saving = false,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="modalOverlay">
      <div className="modalCard wide schemaModal">
        <h2>{title}</h2>
        {hint ? <p className="muted">{hint}</p> : null}
        {versionNote ? <p className="muted small schemaVersionNote">{t('schemaVersionColumnNote')}</p> : null}
        <section className="schemaTableNameSection">
          <h3 className="schemaSectionTitle">{t('schemaTableNameSection')}</h3>
          <p className="muted schemaTableNameHint">{t('schemaTableNameHint')}</p>
          <div className={`schemaMetaGrid${ENABLE_FR_VALUE_INPUTS ? '' : ' schemaMetaGrid--arOnly'}`}>
            <label>
              <span className="fieldLabel">{t('schemaTableNameAr')}</span>
              <input
                value={schemaForm.name_ar}
                onChange={(e) => onSchemaFormChange({ ...schemaForm, name_ar: e.target.value })}
                placeholder={t('schemaTableNameArPh')}
              />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                <span className="fieldLabel">{t('schemaTableNameFr')}</span>
                <input
                  value={schemaForm.name_fr}
                  onChange={(e) => onSchemaFormChange({ ...schemaForm, name_fr: e.target.value })}
                  placeholder={t('schemaTableNameFrPh')}
                />
              </label>
            ) : null}
          </div>
        </section>
        <SchemaColumnsEditor
          columns={draftColumns}
          onChange={onDraftColumnsChange}
          headerGroups={draftHeaderGroups}
          onHeaderGroupsChange={onDraftHeaderGroupsChange}
        />
        <div className="modalActions">
          {showDelete && onDelete ? (
            <button type="button" className="btn btn-danger schemaDeleteBtn" onClick={onDelete} disabled={saving}>
              {t('deleteSchema')}
            </button>
          ) : null}
          <BusyButton type="button" className="btn btn-primary" onClick={onSave} busy={saving} busyLabel={t('saving')}>
            {t('save')}
          </BusyButton>
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={saving}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
