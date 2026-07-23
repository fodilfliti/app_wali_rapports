import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import * as api from '../api'
import { ApiError } from '../api'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { bilingualPairForSave, hasBilingualText } from '../utils/bilingual'
import { defaultEntityTargetKinds } from '../utils/entityTargets'
import { localizedName } from '../utils/schemaColumns'
import {
  buildSchemaSaveBody,
  emptySchemaEditorState,
  type SchemaFormState,
} from '../utils/schemaEditorState'
import {
  defaultDraftHeaderGroups,
  validateDraftHeaderGroups,
  type DraftHeaderGroup,
} from '../utils/schemaHeaderGroups'
import { BusyButton } from './BusyButton'
import { EntityTargetKindsField } from './EntityTargetKindsField'
import {
  SchemaColumnsEditor,
  validateDraftColumns,
  type DraftSchemaColumn,
} from './SchemaColumnsEditor'
import { useSnackbar } from '../snackbar/SnackbarContext'

export type GuidedContentKind = 'document_compose' | 'table_grid' | 'commune_list'

type Props = {
  token: string
  serviceId: EntityIdParam
  contentKind: GuidedContentKind
  open: boolean
  onClose: () => void
  onCreated: () => void
}

type ListeSchemaMode = 'new' | 'existing'
/** Table add path — chosen first so users know what they are creating. */
type TablePath = 'new_columns' | 'existing' | 'schema_only' | null

export function CreateContentKindTypeModal({
  token,
  serviceId,
  contentKind,
  open,
  onClose,
  onCreated,
}: Props) {
  const { t, i18n } = useTranslation()
  const snack = useSnackbar()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [nameAr, setNameAr] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [communeContentKind, setCommuneContentKind] = useState<'complex' | 'table'>('complex')
  const [entityTargetKinds, setEntityTargetKinds] = useState(defaultEntityTargetKinds())
  const [listeSchemaMode, setListeSchemaMode] = useState<ListeSchemaMode>('new')
  const [tablePath, setTablePath] = useState<TablePath>(null)
  const [existingSchemaSlug, setExistingSchemaSlug] = useState('')
  const [schemas, setSchemas] = useState<any[]>([])
  const [schemaForm, setSchemaForm] = useState<SchemaFormState>({ name_ar: '', name_fr: '' })
  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(
    () => emptySchemaEditorState().draftColumns,
  )
  const [draftHeaderGroups, setDraftHeaderGroups] = useState<DraftHeaderGroup[]>(() =>
    defaultDraftHeaderGroups(),
  )

  useEffect(() => {
    if (!open) return
    setStep(0)
    setNameAr('')
    setNameFr('')
    setCommuneContentKind('complex')
    setEntityTargetKinds(defaultEntityTargetKinds())
    setListeSchemaMode('new')
    setTablePath(null)
    setExistingSchemaSlug('')
    const empty = emptySchemaEditorState()
    setSchemaForm(empty.schemaForm)
    setDraftColumns(empty.draftColumns)
    setDraftHeaderGroups(empty.draftHeaderGroups)
    setSaving(false)
  }, [open, contentKind])

  useEffect(() => {
    if (!open) return
    if (contentKind !== 'commune_list' && contentKind !== 'table_grid') return
    api
      .listOfficeServiceSchemas(token, serviceId)
      .then((res) => {
        setSchemas([...(res.schemas || []), ...(res.templates || [])])
      })
      .catch(() => setSchemas([]))
  }, [open, contentKind, token, serviceId])

  if (!open) return null

  const titleKey =
    contentKind === 'table_grid'
      ? 'hubAddTable'
      : contentKind === 'document_compose'
        ? 'hubAddDocument'
        : 'hubAddListe'

  const needsColumnsStep =
    (contentKind === 'table_grid' &&
      (tablePath === 'new_columns' || tablePath === 'schema_only') &&
      step >= 2) ||
    (contentKind === 'commune_list' &&
      communeContentKind === 'table' &&
      listeSchemaMode === 'new' &&
      step === 2)

  const maxStep =
    contentKind === 'document_compose'
      ? 0
      : contentKind === 'table_grid'
        ? !tablePath
          ? 0
          : tablePath === 'existing'
            ? 1
            : 2
        : communeContentKind === 'table'
          ? listeSchemaMode === 'existing'
            ? 1
            : 2
          : 1

  async function createSchemaOnly() {
    const colErr = validateDraftColumns(draftColumns)
    if (colErr) {
      snack.show(t(colErr), 'error')
      return false
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)
    if (groupErr) {
      snack.show(t(groupErr), 'error')
      return false
    }
    if (!hasBilingualText(nameAr, nameFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return false
    }
    const schemaNames = bilingualPairForSave(nameAr, nameFr)
    const body = buildSchemaSaveBody(
      { name_ar: schemaNames.ar, name_fr: schemaNames.fr },
      draftColumns,
      draftHeaderGroups,
    )
    await api.createOfficeServiceSchema(token, serviceId, body)
    return true
  }

  async function createWithNewSchema(typeNames: { ar: string; fr: string }) {
    if (!hasBilingualText(schemaForm.name_ar, schemaForm.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return false
    }
    const colErr = validateDraftColumns(draftColumns)
    if (colErr) {
      snack.show(t(colErr), 'error')
      return false
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)
    if (groupErr) {
      snack.show(t(groupErr), 'error')
      return false
    }
    const schemaNames = bilingualPairForSave(schemaForm.name_ar, schemaForm.name_fr)
    const body = buildSchemaSaveBody(
      { name_ar: schemaNames.ar, name_fr: schemaNames.fr },
      draftColumns,
      draftHeaderGroups,
    )
    const { schema } = await api.createOfficeServiceSchema(token, serviceId, body)
    await api.createOfficeServiceRapportType(token, serviceId, {
      name_ar: typeNames.ar,
      name_fr: typeNames.fr,
      content_kind: contentKind,
      versioning_mode: contentKind === 'table_grid' ? 'versioned' : 'standalone',
      commune_content_kind:
        contentKind === 'commune_list' ? communeContentKind : undefined,
      entity_target_kinds:
        contentKind === 'commune_list' ? entityTargetKinds : undefined,
      table_schema_slug: schema.slug,
    })
    return true
  }

  async function createDocumentOrComplexListe(typeNames: { ar: string; fr: string }) {
    await api.createOfficeServiceRapportType(token, serviceId, {
      name_ar: typeNames.ar,
      name_fr: typeNames.fr,
      content_kind: contentKind,
      versioning_mode: 'standalone',
      commune_content_kind:
        contentKind === 'commune_list' ? communeContentKind : undefined,
      entity_target_kinds:
        contentKind === 'commune_list' ? entityTargetKinds : undefined,
    })
    return true
  }

  async function createTypeWithExistingSchema(
    typeNames: { ar: string; fr: string },
    kind: 'table_grid' | 'commune_list',
  ) {
    if (!existingSchemaSlug) {
      snack.show(t('tableSchemaSlugRequired'), 'error')
      return false
    }
    await api.createOfficeServiceRapportType(token, serviceId, {
      name_ar: typeNames.ar,
      name_fr: typeNames.fr,
      content_kind: kind,
      versioning_mode: kind === 'table_grid' ? 'versioned' : 'standalone',
      commune_content_kind: kind === 'commune_list' ? 'table' : undefined,
      entity_target_kinds: kind === 'commune_list' ? entityTargetKinds : undefined,
      table_schema_slug: existingSchemaSlug,
    })
    return true
  }

  async function submit() {
    setSaving(true)
    try {
      let ok = false
      let successKey = 'hubTypeCreated'

      if (contentKind === 'document_compose') {
        if (!hasBilingualText(nameAr, nameFr)) {
          snack.show(t('bilingualLabelRequired'), 'error')
          return
        }
        ok = await createDocumentOrComplexListe(bilingualPairForSave(nameAr, nameFr))
      } else if (contentKind === 'table_grid') {
        if (!tablePath) {
          snack.show(t('hubTablePathSelectRequired'), 'error')
          return
        }
        if (tablePath === 'schema_only') {
          ok = await createSchemaOnly()
          successKey = 'hubSchemaCreated'
        } else if (tablePath === 'existing') {
          if (!hasBilingualText(nameAr, nameFr)) {
            snack.show(t('bilingualLabelRequired'), 'error')
            return
          }
          ok = await createTypeWithExistingSchema(
            bilingualPairForSave(nameAr, nameFr),
            'table_grid',
          )
        } else {
          if (!hasBilingualText(nameAr, nameFr)) {
            snack.show(t('bilingualLabelRequired'), 'error')
            return
          }
          ok = await createWithNewSchema(bilingualPairForSave(nameAr, nameFr))
        }
      } else if (communeContentKind === 'complex') {
        if (!hasBilingualText(nameAr, nameFr)) {
          snack.show(t('bilingualLabelRequired'), 'error')
          return
        }
        ok = await createDocumentOrComplexListe(bilingualPairForSave(nameAr, nameFr))
      } else if (listeSchemaMode === 'existing') {
        if (!hasBilingualText(nameAr, nameFr)) {
          snack.show(t('bilingualLabelRequired'), 'error')
          return
        }
        ok = await createTypeWithExistingSchema(
          bilingualPairForSave(nameAr, nameFr),
          'commune_list',
        )
      } else {
        if (!hasBilingualText(nameAr, nameFr)) {
          snack.show(t('bilingualLabelRequired'), 'error')
          return
        }
        ok = await createWithNewSchema(bilingualPairForSave(nameAr, nameFr))
      }

      if (ok) {
        snack.show(t(successKey), 'success')
        onCreated()
        onClose()
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'errorGeneric'
      snack.show(t(msg, { defaultValue: t('errorGeneric') }), 'error')
    } finally {
      setSaving(false)
    }
  }

  function goNext() {
    if (contentKind === 'table_grid') {
      if (step === 0) {
        if (!tablePath) {
          snack.show(t('hubTablePathSelectRequired'), 'error')
          return
        }
        setStep(1)
        return
      }
      if (step === 1) {
        if (!hasBilingualText(nameAr, nameFr)) {
          snack.show(t('bilingualLabelRequired'), 'error')
          return
        }
        if (tablePath === 'existing') {
          if (!existingSchemaSlug) {
            snack.show(t('tableSchemaSlugRequired'), 'error')
            return
          }
          void submit()
          return
        }
        // schema_only: nameAr/nameFr = schema name. new_columns: type name already set;
        // schema gets its own fields on the columns step.
        setStep(2)
        return
      }
      void submit()
      return
    }

    if (step === 0 && !hasBilingualText(nameAr, nameFr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    if (contentKind === 'commune_list' && step === 0) {
      setStep(1)
      return
    }
    if (
      contentKind === 'commune_list' &&
      step === 1 &&
      communeContentKind === 'table' &&
      listeSchemaMode === 'new'
    ) {
      setStep(2)
      return
    }
    void submit()
  }

  const showOwnSchemaNameFields =
    (contentKind === 'table_grid' && tablePath === 'new_columns' && step === 2) ||
    (contentKind === 'commune_list' &&
      communeContentKind === 'table' &&
      listeSchemaMode === 'new' &&
      step === 2)

  function goBack() {
    if (step > 0) setStep((s) => s - 1)
    else onClose()
  }

  const showFinalActions = Boolean(tablePath) && step >= maxStep
  const nameLabelKey =
    contentKind === 'table_grid' && tablePath === 'schema_only'
      ? 'schemaTableNameAr'
      : 'rapportTypeNameAr'
  const nameLabelFrKey =
    contentKind === 'table_grid' && tablePath === 'schema_only'
      ? 'schemaTableNameFr'
      : 'rapportTypeNameFr'

  function renderPathCard(
    path: Exclude<TablePath, null>,
    titleKey: string,
    hintKey: string,
    opts?: { secondary?: boolean },
  ) {
    const selected = tablePath === path
    return (
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        className={`hubModeChoiceCard${selected ? ' isSelected' : ''}${
          opts?.secondary ? ' hubModeChoiceCard--secondary' : ''
        }`}
        onClick={() => setTablePath(path)}
      >
        <span className="hubModeChoiceCardTop">
          <span className={`hubModeChoiceRadio${selected ? ' isOn' : ''}`} aria-hidden />
          <strong>{t(titleKey)}</strong>
          {selected ? <span className="hubModeChoiceSelectedTag">{t('hubTablePathSelected')}</span> : null}
        </span>
        <span className="muted small hubModeChoiceCardHint">{t(hintKey)}</span>
      </button>
    )
  }

  const showWideModal =
    needsColumnsStep ||
    (contentKind === 'table_grid' && step === 0) ||
    (contentKind === 'commune_list' && step === 1)

  return (
    <div className="modalOverlay">
      <div className={`modalCard${showWideModal ? ' wide schemaModal' : ''}`}>
        <h2>{t(titleKey)}</h2>
        <p className="muted small">
          {contentKind === 'table_grid' && step === 0
            ? t('hubAddTablePathHint')
            : t(`hubAddHint_${contentKind}`)}
        </p>

        {/* —— Table: path choice — type creators vs schema-only —— */}
        {contentKind === 'table_grid' && step === 0 ? (
          <div className="hubTablePathChooser">
            <p className="hubTablePathSelectPrompt" role="status">
              {t('hubTablePathSelectPrompt')}
            </p>

            <section className="hubTablePathGroup">
              <h3 className="hubTablePathGroupTitle">{t('hubTablePathGroupCreateType')}</h3>
              <p className="muted small hubTablePathGroupHint">{t('hubTablePathGroupCreateTypeHint')}</p>
              <div className="hubModeChoiceGrid" role="radiogroup" aria-label={t('hubTablePathGroupCreateType')}>
                {renderPathCard('new_columns', 'hubTablePath_new_columns', 'hubTablePathHint_new_columns')}
                {renderPathCard('existing', 'hubTablePath_existing', 'hubTablePathHint_existing')}
              </div>
            </section>

            <div className="hubTablePathDivider" role="separator">
              <span>{t('hubTablePathOr')}</span>
            </div>

            <section className="hubTablePathGroup hubTablePathGroup--secondary">
              <h3 className="hubTablePathGroupTitle">{t('hubTablePathGroupSchemaOnly')}</h3>
              <p className="muted small hubTablePathGroupHint">{t('hubTablePathGroupSchemaOnlyHint')}</p>
              <div role="radiogroup" aria-label={t('hubTablePathGroupSchemaOnly')}>
                {renderPathCard(
                  'schema_only',
                  'hubTablePath_schema_only',
                  'hubTablePathHint_schema_only',
                  { secondary: true },
                )}
              </div>
            </section>
          </div>
        ) : null}

        {/* —— Name step (document, or table after path, or liste) —— */}
        {(contentKind === 'document_compose' && step === 0) ||
        (contentKind === 'table_grid' && step === 1) ||
        (contentKind === 'commune_list' && step === 0) ? (
          <>
            <label>
              {t(nameLabelKey)}
              <input value={nameAr} onChange={(e) => setNameAr(e.target.value)} autoFocus />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                {t(nameLabelFrKey)}
                <input value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
              </label>
            ) : null}
            {contentKind === 'table_grid' && tablePath === 'existing' ? (
              <label>
                {t('linkedSchema')}
                <select
                  value={existingSchemaSlug}
                  onChange={(e) => setExistingSchemaSlug(e.target.value)}
                >
                  <option value="">{t('selectSchema')}</option>
                  {schemas.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {localizedName(s, i18n.language)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {contentKind === 'table_grid' && step === 1 ? (
              <button
                type="button"
                className="btnLink hubSwitchPathLink"
                onClick={() => setStep(0)}
              >
                {t('hubTableChangePath')}
              </button>
            ) : null}
          </>
        ) : null}

        {contentKind === 'commune_list' && step === 1 ? (
          <>
            <p className="fieldLabel">{t('communeContentKind')}</p>
            <div className="hubModeChoiceGrid">
              <button
                type="button"
                className={`hubModeChoiceCard${communeContentKind === 'complex' ? ' isSelected' : ''}`}
                onClick={() => setCommuneContentKind('complex')}
              >
                <strong>{t('communeContentKind_complex')}</strong>
                <span className="muted small">{t('communeContentKindHint_complex')}</span>
              </button>
              <button
                type="button"
                className={`hubModeChoiceCard${communeContentKind === 'table' ? ' isSelected' : ''}`}
                onClick={() => setCommuneContentKind('table')}
              >
                <strong>{t('communeContentKind_table')}</strong>
                <span className="muted small">{t('communeContentKindHint_table')}</span>
              </button>
            </div>
            <EntityTargetKindsField value={entityTargetKinds} onChange={setEntityTargetKinds} />
            {communeContentKind === 'table' ? (
              <div className="hubListeSchemaMode">
                <label className="radioLabel">
                  <input
                    type="radio"
                    name="listeSchemaMode"
                    checked={listeSchemaMode === 'new'}
                    onChange={() => setListeSchemaMode('new')}
                  />
                  {t('hubListeNewColumns')}
                </label>
                <label className="radioLabel">
                  <input
                    type="radio"
                    name="listeSchemaMode"
                    checked={listeSchemaMode === 'existing'}
                    onChange={() => setListeSchemaMode('existing')}
                  />
                  {t('hubListeReuseSchema')}
                </label>
                {listeSchemaMode === 'existing' ? (
                  <label>
                    {t('linkedSchema')}
                    <select
                      value={existingSchemaSlug}
                      onChange={(e) => setExistingSchemaSlug(e.target.value)}
                    >
                      <option value="">{t('selectSchema')}</option>
                      {schemas.map((s) => (
                        <option key={s.id} value={s.slug}>
                          {localizedName(s, i18n.language)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {needsColumnsStep ? (
          <>
            {showOwnSchemaNameFields ? (
              <div className="hubSchemaNameBlock">
                <p className="fieldLabel">{t('schemaTableNameSection')}</p>
                <p className="muted small">{t('hubSchemaNameOwnHint')}</p>
                <label>
                  {t('schemaTableNameAr')}
                  <input
                    value={schemaForm.name_ar}
                    onChange={(e) =>
                      setSchemaForm((prev) => ({ ...prev, name_ar: e.target.value }))
                    }
                    placeholder={t('schemaTableNameArPh')}
                    autoFocus
                  />
                </label>
                {ENABLE_FR_VALUE_INPUTS ? (
                  <label>
                    {t('schemaTableNameFr')}
                    <input
                      value={schemaForm.name_fr}
                      onChange={(e) =>
                        setSchemaForm((prev) => ({ ...prev, name_fr: e.target.value }))
                      }
                      placeholder={t('schemaTableNameFrPh')}
                    />
                  </label>
                ) : null}
              </div>
            ) : null}
            <p className="muted">{t('hubDefineColumnsHint')}</p>
            <SchemaColumnsEditor
              columns={draftColumns}
              onChange={setDraftColumns}
              headerGroups={draftHeaderGroups}
              onHeaderGroupsChange={setDraftHeaderGroups}
            />
          </>
        ) : null}

        <div className="modalActions">
          {showFinalActions ? (
            <BusyButton
              type="button"
              className="btn btn-primary"
              onClick={() => void submit()}
              busy={saving}
              busyLabel={t('saving')}
            >
              {t('save')}
            </BusyButton>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              disabled={saving || (contentKind === 'table_grid' && step === 0 && !tablePath)}
            >
              {contentKind === 'table_grid' && step === 0
                ? t('hubTablePathContinue')
                : t('wizardNext')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={goBack} disabled={saving}>
            {step === 0 ? t('cancel') : t('back')}
          </button>
        </div>
      </div>
    </div>
  )
}
