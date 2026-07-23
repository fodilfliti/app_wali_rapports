import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from 'react-i18next'

import * as api from '../api'
import type { EntityIdParam } from '../api'
import { BackButton } from '../components/BackButton'
import { BusyButton } from '../components/BusyButton'

import { TableSchemaEditorModal } from '../components/TableSchemaEditorModal'

import { ExpandableHelp } from '../components/ExpandableHelp'

import { TablePagination } from '../components/TablePagination'

import { validateDraftColumns, type DraftSchemaColumn } from '../components/SchemaColumnsEditor'

import { localizedName } from '../utils/schemaColumns'

import {

  buildSchemaSaveBody,

  emptySchemaEditorState,

  loadSchemaEditorState,

  type SchemaFormState,

} from '../utils/schemaEditorState'

import {

  defaultDraftHeaderGroups,

  validateDraftHeaderGroups,

  type DraftHeaderGroup,

} from '../utils/schemaHeaderGroups'

import { useSnackbar } from '../snackbar/SnackbarContext'

import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'
import { ENABLE_FR_VALUE_INPUTS } from '../config/features'
import { bilingualPairForSave, hasBilingualText } from '../utils/bilingual'
import { EntityTargetKindsField } from '../components/EntityTargetKindsField'
import { defaultEntityTargetKinds } from '../utils/entityTargets'
import { needsLinkedTableSchema } from '../utils/rapportTypeSchema'
import { notifyHubCountsRefresh } from '../utils/hubCountsRefresh'



type Props = { token: string }



const CONTENT_KINDS = ['table_grid', 'document_compose', 'fiche_lecture', 'commune_list']
const SCHEMA_PAGE_SIZE = 10

type SchemasPanel = 'schemas' | 'rapportTypes'



export function AdminSchemasPage({ token }: Props) {

  const { t, i18n } = useTranslation()

  const snack = useSnackbar()

  const [schemas, setSchemas] = useState<any[]>([])
  const [schemasTotal, setSchemasTotal] = useState(0)
  const [schemaPage, setSchemaPage] = useState(1)
  const [typePage, setTypePage] = useState(1)
  const [schemaSearch, setSchemaSearch] = useState('')
  const [includeSharedTemplates, setIncludeSharedTemplates] = useState(false)
  const [activePanel, setActivePanel] = useState<SchemasPanel>('schemas')

  const [services, setServices] = useState<any[]>([])

  const [selectedServiceId, setSelectedServiceId] = useState<string>('')

  const [rapportTypes, setRapportTypes] = useState<any[]>([])

  const [schemaModal, setSchemaModal] = useState(false)

  const [editingSchemaId, setEditingSchemaId] = useState<EntityIdParam | null>(null)

  const [editingIsSystem, setEditingIsSystem] = useState(false)

  const [typeModal, setTypeModal] = useState(false)

  const [schemaForm, setSchemaForm] = useState<SchemaFormState>({ name_ar: '', name_fr: '' })

  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(() => emptySchemaEditorState().draftColumns)

  const [draftHeaderGroups, setDraftHeaderGroups] = useState<DraftHeaderGroup[]>(() => defaultDraftHeaderGroups())

  const [typeForm, setTypeForm] = useState({

    name_ar: '',

    name_fr: '',

    content_kind: 'table_grid',

    versioning_mode: 'versioned',

    commune_content_kind: 'complex',

    entity_target_kinds: defaultEntityTargetKinds(),

    table_schema_slug: '',

  })

  const [saving, setSaving] = useState(false)

  const loadSchemas = useCallback(async () => {
    if (!selectedServiceId) {
      setSchemas([])
      setSchemasTotal(0)
      return
    }
    try {
      const res = await api.listTableSchemas(token, {
        serviceId: selectedServiceId,
        q: schemaSearch.trim() || undefined,
        page: schemaPage,
        limit: SCHEMA_PAGE_SIZE,
        includeShared: includeSharedTemplates,
      })
      setSchemas(res.schemas)
      setSchemasTotal(res.total)
    } catch {
      snack.show(t('errorGeneric'), 'error')
    }
  }, [token, selectedServiceId, schemaSearch, schemaPage, includeSharedTemplates, snack, t])



  const loadServices = useCallback(async () => {

    try {

      const res = await api.listAdminServices(token)

      setServices(res.services.filter((s: any) => !s.is_folder))

    } catch {

      snack.show(t('errorGeneric'), 'error')

    }

  }, [token, snack, t])



  const loadRapportTypes = useCallback(async () => {

    if (!selectedServiceId) {

      setRapportTypes([])

      return

    }

    try {

      const res = await api.listServiceRapportTypes(token, selectedServiceId)

      setRapportTypes(res.rapportTypes)

    } catch {

      snack.show(t('errorGeneric'), 'error')

    }

  }, [token, selectedServiceId, snack, t])



  useEffect(() => {
    loadServices()
  }, [loadServices])

  useEffect(() => {
    loadSchemas()
  }, [loadSchemas])



  useEffect(() => {

    loadRapportTypes()

  }, [loadRapportTypes])



  function closeSchemaModal() {

    setSchemaModal(false)

    setEditingSchemaId(null)

    setEditingIsSystem(false)

  }



  function openCreateSchemaModal() {
    if (!selectedServiceId) {
      snack.show(t('schemasServiceRequired'), 'error')
      return
    }
    const empty = emptySchemaEditorState()

    setEditingSchemaId(null)

    setEditingIsSystem(false)

    setSchemaForm(empty.schemaForm)

    setDraftColumns(empty.draftColumns)

    setDraftHeaderGroups(empty.draftHeaderGroups)

    setSchemaModal(true)

  }



  function openEditSchemaModal(schema: any) {

    const loaded = loadSchemaEditorState(schema)

    setEditingSchemaId(schema.id)

    setEditingIsSystem(Boolean(schema.is_system))

    setSchemaForm(loaded.schemaForm)

    setDraftColumns(loaded.draftColumns)

    setDraftHeaderGroups(loaded.draftHeaderGroups)

    setSchemaModal(true)

  }



  function openTypeModal() {

    setTypeForm({

      name_ar: '',

      name_fr: '',

      content_kind: 'table_grid',

      versioning_mode: 'versioned',

      commune_content_kind: 'complex',

      entity_target_kinds: defaultEntityTargetKinds(),

      table_schema_slug: '',

    })

    setTypeModal(true)

  }



  async function saveSchema() {

    const colErr = validateDraftColumns(draftColumns)

    if (colErr) {

      snack.show(t(colErr), 'error')

      return

    }

    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns)

    if (groupErr) {

      snack.show(t(groupErr), 'error')

      return

    }

    if (!hasBilingualText(schemaForm.name_ar, schemaForm.name_fr)) {
      snack.show(t('bilingualLabelRequired'), 'error')
      return
    }
    if (!editingSchemaId && !selectedServiceId) {
      snack.show(t('schemasServiceRequired'), 'error')
      return
    }

    const body = {
      ...buildSchemaSaveBody(schemaForm, draftColumns, draftHeaderGroups),
      ...(editingSchemaId ? {} : { service_id: selectedServiceId }),
    }

    setSaving(true)
    try {

      if (editingSchemaId) {

        await api.patchTableSchema(token, editingSchemaId, body)

      } else {

        await api.createTableSchema(token, body)

      }

      closeSchemaModal()

      loadSchemas()

      notifyHubCountsRefresh()

      snack.show(t('save'), 'success')

    } catch {

      snack.show(t('errorGeneric'), 'error')

    } finally {
      setSaving(false)
    }

  }



  async function deleteSchema() {

    if (!editingSchemaId || editingIsSystem) return

    if (!window.confirm(t('deleteSchemaConfirm'))) return

    try {

      await api.deleteTableSchema(token, editingSchemaId)

      closeSchemaModal()

      loadSchemas()

      notifyHubCountsRefresh()

      snack.show(t('save'), 'success')

    } catch {

      snack.show(t('errorGeneric'), 'error')

    }

  }



  async function saveRapportType() {

    if (!selectedServiceId) return

    if (!hasBilingualText(typeForm.name_ar, typeForm.name_fr)) {

      snack.show(t('bilingualLabelRequired'), 'error')

      return

    }

    setSaving(true)
    try {

      const names = bilingualPairForSave(typeForm.name_ar, typeForm.name_fr)

      await api.createRapportType(token, selectedServiceId, {

        name_ar: names.ar,

        name_fr: names.fr,

        content_kind: typeForm.content_kind,

        versioning_mode: typeForm.versioning_mode,

        commune_content_kind:
          typeForm.content_kind === 'commune_list' ? typeForm.commune_content_kind : undefined,

        entity_target_kinds:
          typeForm.content_kind === 'commune_list' ? typeForm.entity_target_kinds : undefined,

        table_schema_slug: needsLinkedTableSchema(typeForm.content_kind, typeForm.commune_content_kind)
          ? typeForm.table_schema_slug
          : undefined,

      })

      setTypeModal(false)

      loadRapportTypes()

      notifyHubCountsRefresh()

      snack.show(t('save'), 'success')

    } catch {

      snack.show(t('errorGeneric'), 'error')

    } finally {
      setSaving(false)
    }

  }

  const pagedRapportTypes = paginateSlice(rapportTypes, typePage, DEFAULT_PAGE_SIZE)

  return (

    <div className="page">

      <div className="pageHeader row">

        <h1>{t('navSchemas')}</h1>

        <BackButton fallbackTo="/" />

      </div>

      <p className="muted">{t('schemasHelp')}</p>

      <div className="schemasPageIntro card">
        <p className="schemasPageIntroLead">{t('schemasPageIntro')}</p>
        <ol className="schemasPageSteps muted small">
          <li>{t('schemasPageStep1')}</li>
          <li>{t('schemasPageStep2')}</li>
        </ol>
      </div>

      <div className={`schemasServicePick card${selectedServiceId ? '' : ' schemasServicePickRequired'}`}>
        <label className="schemasServicePickLabel">
          <span className="fieldLabel">{t('schemasPickService')}</span>
          <select
            value={selectedServiceId}
            onChange={(e) => {
              setSelectedServiceId(e.target.value)
              setSchemaPage(1)
              setTypePage(1)
            }}
          >
            <option value="">{t('selectService')}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {localizedName(s, i18n.language)}
              </option>
            ))}
          </select>
        </label>
        {!selectedServiceId ? (
          <p className="schemasServicePickHint">{t('schemasServiceRequired')}</p>
        ) : (
          <p className="muted small schemasServiceScopeHelp">{t('schemasServiceScopeHelp')}</p>
        )}
      </div>

      {!selectedServiceId ? (
        <p className="muted schemasEmptyState">{t('schemasNoServiceSelected')}</p>
      ) : (
        <>
          <div className="schemasPanelTabs" role="tablist" aria-label={t('navSchemas')}>
            <button
              type="button"
              role="tab"
              aria-selected={activePanel === 'schemas'}
              className={`schemasPanelTab${activePanel === 'schemas' ? ' active' : ''}`}
              onClick={() => setActivePanel('schemas')}
            >
              {t('schemasTabSchemas')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activePanel === 'rapportTypes'}
              className={`schemasPanelTab${activePanel === 'rapportTypes' ? ' active' : ''}`}
              onClick={() => setActivePanel('rapportTypes')}
            >
              {t('schemasTabRapportTypes')}
            </button>
          </div>

          {activePanel === 'schemas' ? (
            <div className="section schemasPanelSection">
              <div className="pageHeader row">
                <h2>{t('tableSchemas')}</h2>
                <button type="button" className="btn btn-primary" onClick={openCreateSchemaModal}>
                  {t('createSchema')}
                </button>
              </div>
              <p className="muted small">{t('schemasStep1Help')}</p>
              <p className="muted small">{t('schemasDocumentServiceNote')}</p>

              <div className="schemasListToolbar">
                <label className="schemasSearchField">
                  <span className="fieldLabel">{t('search')}</span>
                  <input
                    value={schemaSearch}
                    onChange={(e) => {
                      setSchemaSearch(e.target.value)
                      setSchemaPage(1)
                    }}
                    placeholder={t('schemasSearchPlaceholder')}
                  />
                </label>
                <label className="schemaColumnCheck schemasSharedToggle">
                  <input
                    type="checkbox"
                    checked={includeSharedTemplates}
                    onChange={(e) => {
                      setIncludeSharedTemplates(e.target.checked)
                      setSchemaPage(1)
                    }}
                  />
                  <span>{t('schemasIncludeShared')}</span>
                </label>
              </div>

              <div className="card tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('rapportTitle')}</th>
                      <th>{t('columnsCount')}</th>
                      <th>{t('schemasScopeLabel')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schemas.length ? (
                      schemas.map((s) => (
                        <tr key={s.id} className="clickableRow" onClick={() => openEditSchemaModal(s)}>
                          <td>{localizedName(s, i18n.language)}</td>
                          <td>{(s.columns_json || []).length}</td>
                          <td>
                            {String(s.service_id) === String(selectedServiceId) ? (
                              t('schemasScopeService')
                            ) : s.is_system ? (
                              t('schemasScopeSystem')
                            ) : (
                              t('schemasScopeLinked')
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="schemasEmptyRow muted">
                          {t('schemasNoSchemasForService')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <TablePagination
                page={schemaPage}
                total={schemasTotal}
                pageSize={SCHEMA_PAGE_SIZE}
                onPageChange={setSchemaPage}
              />
            </div>
          ) : (
            <div className="section schemasPanelSection">
              <div className="pageHeader row schemasRapportTypeActions">
                <h2>{t('rapportTypes')}</h2>
                <button type="button" className="btn btn-primary" onClick={openTypeModal}>
                  {t('createRapportType')}
                </button>
              </div>
              <p className="muted small">{t('schemasStep2Help')}</p>

              <div className="card tableWrap">
                <table>
                  <thead>
                    <tr>
                      <th>{t('rapportTitle')}</th>
                      <th>{t('contentKind')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRapportTypes.length ? (
                      pagedRapportTypes.map((rt) => (
                        <tr key={rt.id}>
                          <td>{localizedName(rt, i18n.language)}</td>
                          <td>{t(`contentKind_${rt.content_kind}`)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="schemasEmptyRow muted">
                          {t('schemasNoRapportTypes')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <TablePagination page={typePage} total={rapportTypes.length} onPageChange={setTypePage} />
            </div>
          )}
        </>
      )}



      {schemaModal ? (

        <TableSchemaEditorModal

          title={editingSchemaId ? t('editSchema') : t('createSchema')}

          hint={t('createSchemaHint')}

          schemaForm={schemaForm}

          onSchemaFormChange={setSchemaForm}

          draftColumns={draftColumns}

          onDraftColumnsChange={setDraftColumns}

          draftHeaderGroups={draftHeaderGroups}

          onDraftHeaderGroupsChange={setDraftHeaderGroups}

          onSave={saveSchema}

          onCancel={closeSchemaModal}

          onDelete={deleteSchema}

          showDelete={Boolean(editingSchemaId && !editingIsSystem)}

          saving={saving}

        />

      ) : null}



      {typeModal ? (

        <div className="modalOverlay">

          <div className="modalCard">

            <h2>{t('createRapportType')}</h2>

            <label>

              {t('municipalityNameAr')}

              <input value={typeForm.name_ar} onChange={(e) => setTypeForm({ ...typeForm, name_ar: e.target.value })} />

            </label>

            {ENABLE_FR_VALUE_INPUTS ? (
            <label>

              {t('municipalityNameFr')}

              <input value={typeForm.name_fr} onChange={(e) => setTypeForm({ ...typeForm, name_fr: e.target.value })} />

            </label>
            ) : null}

            <label>

              {t('contentKind')}

              <select

                value={typeForm.content_kind}

                onChange={(e) => setTypeForm({ ...typeForm, content_kind: e.target.value })}

              >

                {CONTENT_KINDS.map((k) => (

                  <option key={k} value={k}>

                    {t(`contentKind_${k}`)}

                  </option>

                ))}

              </select>

            </label>

            <ExpandableHelp title={t('schemaHelpContentKind')} className="schemaColTypeHintExpand contentKindHelpExpand">

              <p className="muted small">{t(`contentKindHint_${typeForm.content_kind}`)}</p>

            </ExpandableHelp>

            {typeForm.content_kind === 'commune_list' ? (
              <>
              <label>
                {t('communeContentKind')}
                <select
                  value={typeForm.commune_content_kind}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, commune_content_kind: e.target.value })
                  }
                >
                  <option value="complex">{t('communeContentKind_complex')}</option>
                  <option value="table">{t('communeContentKind_table')}</option>
                </select>
              </label>
              <EntityTargetKindsField
                value={typeForm.entity_target_kinds}
                onChange={(entity_target_kinds) =>
                  setTypeForm({ ...typeForm, entity_target_kinds })
                }
              />
              </>
            ) : null}

            {needsLinkedTableSchema(typeForm.content_kind, typeForm.commune_content_kind) ? (
              <label>
                {t('linkedSchema')}
                <select
                  value={typeForm.table_schema_slug}
                  onChange={(e) => setTypeForm({ ...typeForm, table_schema_slug: e.target.value })}
                >
                  <option value="">{t('selectSchema')}</option>
                  {schemas
                    .filter(
                      (s) =>
                        String(s.service_id) === String(selectedServiceId) ||
                        s.is_system ||
                        rapportTypes.some((rt) => rt.schema_json?.table_schema_slug === s.slug),
                    )
                    .map((s) => (
                      <option key={s.id} value={s.slug}>
                        {localizedName(s, i18n.language)}
                        {String(s.service_id) === String(selectedServiceId) ? '' : ` (${t('schemasScopeLinked')})`}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <div className="modalActions">

              <BusyButton type="button" className="btn btn-primary" onClick={saveRapportType} busy={saving} busyLabel={t('saving')}>

                {t('save')}

              </BusyButton>

              <button type="button" className="btn btn-secondary" onClick={() => setTypeModal(false)} disabled={saving}>

                {t('cancel')}

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </div>

  )

}


