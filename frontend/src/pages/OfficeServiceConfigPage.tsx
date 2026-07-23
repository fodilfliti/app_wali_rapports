import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ApiError, type EntityIdParam } from "../api";
import { BackButton } from "../components/BackButton";
import { BusyButton } from "../components/BusyButton";
import { TableSchemaEditorModal } from "../components/TableSchemaEditorModal";
import { DocumentTemplatesSection } from "../components/DocumentTemplatesSection";
import { ENABLE_DOCUMENT_TEMPLATES, ENABLE_FR_VALUE_INPUTS } from "../config/features";
import { ExpandableHelp } from "../components/ExpandableHelp";
import { TablePagination } from "../components/TablePagination";
import {
  validateDraftColumns,
  type DraftSchemaColumn,
} from "../components/SchemaColumnsEditor";
import { localizedName } from "../utils/schemaColumns";
import {
  buildSchemaSaveBody,
  emptySchemaEditorState,
  loadSchemaEditorState,
  type SchemaFormState,
} from "../utils/schemaEditorState";
import {
  defaultDraftHeaderGroups,
  validateDraftHeaderGroups,
  type DraftHeaderGroup,
} from "../utils/schemaHeaderGroups";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "../utils/pagination";
import { bilingualPairForSave, hasBilingualText } from "../utils/bilingual";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { EntityTargetKindsField } from "../components/EntityTargetKindsField";
import { defaultEntityTargetKinds } from "../utils/entityTargets";
import { needsLinkedTableSchema } from "../utils/rapportTypeSchema";
import { SchemaListPanel } from "../components/SchemaListPanel";
import { ConfirmActionModal } from "../components/ConfirmActionModal";
import { RapportKindsExplainer } from "../components/RapportKindsExplainer";
import { notifyHubCountsRefresh } from "../utils/hubCountsRefresh";

type Props = { token: string };

type ConfigPanel = "schemas" | "rapportTypes" | "templates";

/** Hidden for now — re-enable when template-duplicate UX ships. */
const ENABLE_SCHEMA_DUPLICATE = false;

const CONTENT_KINDS = ["table_grid", "document_compose", "commune_list"];

function linkedSchemaSlug(rt: any) {
  return rt?.schema_json?.table_schema_slug as string | undefined;
}

export function OfficeServiceConfigPage({ token }: Props) {
  const { serviceId } = useParams();
  const sid = (serviceId || "") as import("../api").EntityIdParam;
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const [schemas, setSchemas] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [rapportTypes, setRapportTypes] = useState<any[]>([]);
  const [service, setService] = useState<any>(null);
  const [activePanel, setActivePanel] = useState<ConfigPanel>("schemas");
  const [schemaModal, setSchemaModal] = useState(false);
  const [editingSchemaId, setEditingSchemaId] = useState<EntityIdParam | null>(
    null,
  );
  const [typeModal, setTypeModal] = useState(false);
  const [autoOpenTemplate, setAutoOpenTemplate] = useState(false);
  const [editTypeModal, setEditTypeModal] = useState(false);
  const [editingType, setEditingType] = useState<any>(null);
  const [editTypeSchemaSlug, setEditTypeSchemaSlug] = useState("");
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [schemaForm, setSchemaForm] = useState<SchemaFormState>({
    name_ar: "",
    name_fr: "",
  });
  const [draftHeaderGroups, setDraftHeaderGroups] = useState<
    DraftHeaderGroup[]
  >(() => defaultDraftHeaderGroups());
  const [draftColumns, setDraftColumns] = useState<DraftSchemaColumn[]>(
    () => emptySchemaEditorState().draftColumns,
  );
  const [typeForm, setTypeForm] = useState({
    name_ar: "",
    name_fr: "",
    content_kind: "table_grid",
    versioning_mode: "versioned",
    commune_content_kind: "complex",
    entity_target_kinds: defaultEntityTargetKinds(),
    table_schema_slug: "",
  });
  const [dupForm, setDupForm] = useState({ source_schema_id: "" });
  const [typePage, setTypePage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [pendingDeleteType, setPendingDeleteType] = useState<any>(null);
  const [deletingType, setDeletingType] = useState(false);

  const load = useCallback(async () => {
    if (!sid) return;
    try {
      const [schemaRes, typeRes] = await Promise.all([
        api.listOfficeServiceSchemas(token, sid),
        api.listOfficeServiceRapportTypes(token, sid),
      ]);
      setSchemas(schemaRes.schemas);
      setTemplates(schemaRes.templates);
      setRapportTypes(typeRes.rapportTypes);
      setService(typeRes.service);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }, [token, sid, snack, t]);

  useEffect(() => {
    load();
  }, [load]);

  const allSchemas = [...schemas, ...templates];

  function closeSchemaModal() {
    setSchemaModal(false);
    setEditingSchemaId(null);
  }

  async function saveSchema() {
    const colErr = validateDraftColumns(draftColumns);
    if (colErr) {
      snack.show(t(colErr), "error");
      return;
    }
    const groupErr = validateDraftHeaderGroups(draftHeaderGroups, draftColumns);
    if (groupErr) {
      snack.show(t(groupErr), "error");
      return;
    }
    if (!hasBilingualText(schemaForm.name_ar, schemaForm.name_fr)) {
      snack.show(t("bilingualLabelRequired"), "error");
      return;
    }
    const body = buildSchemaSaveBody(
      schemaForm,
      draftColumns,
      draftHeaderGroups,
    );
    setSaving(true);
    try {
      if (editingSchemaId) {
        await api.patchOfficeSchema(token, editingSchemaId, body);
      } else {
        await api.createOfficeServiceSchema(token, sid, body);
      }
      closeSchemaModal();
      load();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setSaving(false);
    }
  }

  function openSchemaModal() {
    const empty = emptySchemaEditorState();
    setEditingSchemaId(null);
    setSchemaForm(empty.schemaForm);
    setDraftColumns(empty.draftColumns);
    setDraftHeaderGroups(empty.draftHeaderGroups);
    setSchemaModal(true);
  }

  useEffect(() => {
    const createNew = searchParams.get("new");
    if (!createNew || !sid || !service) return;
    if (createNew === "schema") {
      setActivePanel("schemas");
      openSchemaModal();
    } else if (createNew === "type") {
      setActivePanel("rapportTypes");
      setTypeModal(true);
    } else if (createNew === "template") {
      if (ENABLE_DOCUMENT_TEMPLATES) {
        setActivePanel("templates");
        setAutoOpenTemplate(true);
      }
    } else {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    setSearchParams(next, { replace: true });
  }, [searchParams, sid, service, setSearchParams]);

  function openEditSchemaModal(schema: any) {
    const loaded = loadSchemaEditorState(schema);
    setEditingSchemaId(schema.id);
    setSchemaForm(loaded.schemaForm);
    setDraftColumns(loaded.draftColumns);
    setDraftHeaderGroups(loaded.draftHeaderGroups);
    setSchemaModal(true);
  }

  async function saveRapportType() {
    if (!hasBilingualText(typeForm.name_ar, typeForm.name_fr)) {
      snack.show(t("bilingualLabelRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      const names = bilingualPairForSave(typeForm.name_ar, typeForm.name_fr);
      await api.createOfficeServiceRapportType(token, sid, {
        name_ar: names.ar,
        name_fr: names.fr,
        content_kind: typeForm.content_kind,
        versioning_mode: typeForm.versioning_mode,
        commune_content_kind:
          typeForm.content_kind === "commune_list"
            ? typeForm.commune_content_kind
            : undefined,
        entity_target_kinds:
          typeForm.content_kind === "commune_list"
            ? typeForm.entity_target_kinds
            : undefined,
        table_schema_slug: needsLinkedTableSchema(
          typeForm.content_kind,
          typeForm.commune_content_kind,
        )
          ? typeForm.table_schema_slug
          : undefined,
      });
      setTypeModal(false);
      load();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setSaving(false);
    }
  }

  function openEditTypeModal(rt: any) {
    setEditingType(rt);
    setEditTypeSchemaSlug(linkedSchemaSlug(rt) || "");
    setEditTypeModal(true);
  }

  async function saveEditTypeSchema() {
    if (!editingType) return;
    if (!editTypeSchemaSlug) {
      snack.show(t("tableSchemaSlugRequired"), "error");
      return;
    }
    setSaving(true);
    try {
      await api.patchOfficeRapportType(token, editingType.id, {
        table_schema_slug: editTypeSchemaSlug,
      });
      setEditTypeModal(false);
      setEditingType(null);
      load();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setSaving(false);
    }
  }

  async function duplicateSchema() {
    if (!dupForm.source_schema_id) return;
    try {
      await api.duplicateOfficeServiceSchema(token, sid, {
        source_schema_id: dupForm.source_schema_id,
      });
      setDuplicateModal(false);
      load();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function deleteSchema(schemaId: EntityIdParam) {
    try {
      await api.deleteOfficeSchema(token, schemaId);
      snack.show(t("deleteUnusedSchemaDone"), "success");
      await load();
      notifyHubCountsRefresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
      throw e;
    }
  }

  async function confirmDeleteRapportType() {
    if (!pendingDeleteType) return;
    setDeletingType(true);
    try {
      await api.deleteRapportType(token, pendingDeleteType.id);
      snack.show(t("deleteUnusedRapportTypeDone"), "success");
      setPendingDeleteType(null);
      await load();
      notifyHubCountsRefresh();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setDeletingType(false);
    }
  }

  const label = service
    ? localizedName(service, i18n.language)
    : t("serviceConfig");
  const pagedRapportTypes = paginateSlice(
    rapportTypes,
    typePage,
    DEFAULT_PAGE_SIZE,
  );

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>
          {label} — {t("serviceConfig")}
        </h1>
        <BackButton fallbackTo={`/cabinet/services/${sid}`} />
      </div>
      <p className="muted">{t("officeConfigHelp")}</p>
      <ol className="schemasPageSteps muted small">
        <li>{t("serviceConfigStep1")}</li>
        <li>{t("serviceConfigStep2")}</li>
        {ENABLE_DOCUMENT_TEMPLATES ? <li>{t("serviceConfigStep3")}</li> : null}
      </ol>

      <div className="schemasPanelTabs" role="tablist" aria-label={t("serviceConfig")}>
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === "schemas"}
          className={`schemasPanelTab${activePanel === "schemas" ? " active" : ""}`}
          onClick={() => setActivePanel("schemas")}
        >
          {t("schemasTabSchemas")}
          {schemas.length ? (
            <span className="serviceConfigTabCount"> {schemas.length}</span>
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activePanel === "rapportTypes"}
          className={`schemasPanelTab${activePanel === "rapportTypes" ? " active" : ""}`}
          onClick={() => setActivePanel("rapportTypes")}
        >
          {t("schemasTabRapportTypes")}
          {rapportTypes.length ? (
            <span className="serviceConfigTabCount"> {rapportTypes.length}</span>
          ) : null}
        </button>
        {ENABLE_DOCUMENT_TEMPLATES ? (
          <button
            type="button"
            role="tab"
            aria-selected={activePanel === "templates"}
            className={`schemasPanelTab${activePanel === "templates" ? " active" : ""}`}
            onClick={() => setActivePanel("templates")}
          >
            {t("documentTemplates")}
          </button>
        ) : null}
      </div>

      {activePanel === "schemas" ? (
        <div className="section schemasPanelSection">
          <div className="pageHeader row">
            <h2>{t("tableSchemas")}</h2>
            <button
              type="button"
              className="btn btn-accent"
              onClick={openSchemaModal}
            >
              {t("createSchema")}
            </button>
            {ENABLE_SCHEMA_DUPLICATE ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDuplicateModal(true)}
              >
                {t("duplicateTemplate")}
              </button>
            ) : null}
          </div>
          <p className="muted small">{t("schemaBrowserHint")}</p>
          <div className="card schemasPanelBody">
            <SchemaListPanel
              schemas={schemas}
              templates={templates}
              includeTemplates
              onEditColumns={openEditSchemaModal}
              onSaveNames={async (schemaId, names) => {
                try {
                  await api.patchOfficeSchema(token, schemaId, names);
                  await load();
                } catch (e) {
                  const msg = e instanceof ApiError ? e.message : "errorGeneric";
                  snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
                  throw e;
                }
              }}
              onDelete={deleteSchema}
            />
          </div>
        </div>
      ) : null}

      {activePanel === "rapportTypes" ? (
        <div className="section schemasPanelSection">
          <div className="pageHeader row">
            <h2>{t("rapportTypes")}</h2>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setTypeModal(true)}
            >
              {t("createRapportType")}
            </button>
          </div>
          <p className="muted small">{t("serviceConfigTypesHelp")}</p>
          <div className="card tableWrap">
            <table>
              <thead>
                <tr>
                  <th>{t("rapportTitle")}</th>
                  <th>{t("status")}</th>
                  <th>{t("linkedSchema")}</th>
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRapportTypes.map((rt) => {
                  const slug = linkedSchemaSlug(rt);
                  const missingSchema =
                    needsLinkedTableSchema(
                      rt.content_kind,
                      rt.commune_content_kind,
                    ) && !slug;
                  return (
                    <tr key={rt.id}>
                      <td>{localizedName(rt, i18n.language)}</td>
                      <td>{t(`contentKind_${rt.content_kind}`)}</td>
                      <td className={missingSchema ? "muted" : undefined}>
                        {needsLinkedTableSchema(
                          rt.content_kind,
                          rt.commune_content_kind,
                        )
                          ? slug
                            ? allSchemas.find((s) => s.slug === slug)
                              ? localizedName(
                                  allSchemas.find((s) => s.slug === slug),
                                  i18n.language,
                                )
                              : slug
                            : t("tableSchemaNotConfigured")
                          : "—"}
                      </td>
                      <td>
                        <div className="tableRowActions">
                          {needsLinkedTableSchema(
                            rt.content_kind,
                            rt.commune_content_kind,
                          ) ? (
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => openEditTypeModal(rt)}
                            >
                              {t("edit")}
                            </button>
                          ) : null}
                          {rt.can_delete ? (
                            <button
                              type="button"
                              className="btn btn-danger"
                              onClick={() => setPendingDeleteType(rt)}
                            >
                              {t("deleteUnusedRapportType")}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!rapportTypes.length ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      {t("noResults")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={typePage}
            total={rapportTypes.length}
            onPageChange={setTypePage}
            compact
          />
        </div>
      ) : null}

      {ENABLE_DOCUMENT_TEMPLATES && activePanel === "templates" ? (
        <div className="schemasPanelSection">
          <DocumentTemplatesSection
            token={token}
            serviceId={sid}
            rapportTypes={rapportTypes}
            autoOpenCreate={autoOpenTemplate}
            onAutoOpenHandled={() => setAutoOpenTemplate(false)}
          />
        </div>
      ) : null}

      <RapportKindsExplainer />

      {schemaModal ? (
        <TableSchemaEditorModal
          title={editingSchemaId ? t("editSchema") : t("createSchema")}
          hint={t("createSchemaHint")}
          schemaForm={schemaForm}
          onSchemaFormChange={setSchemaForm}
          draftColumns={draftColumns}
          onDraftColumnsChange={setDraftColumns}
          draftHeaderGroups={draftHeaderGroups}
          onDraftHeaderGroupsChange={setDraftHeaderGroups}
          onSave={saveSchema}
          onCancel={closeSchemaModal}
          saving={saving}
        />
      ) : null}

      {ENABLE_SCHEMA_DUPLICATE && duplicateModal ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t("duplicateTemplate")}</h2>
            <p className="muted">{t("duplicateTemplateHint")}</p>
            <label>
              {t("selectTemplate")}
              <select
                value={dupForm.source_schema_id}
                onChange={(e) =>
                  setDupForm({ source_schema_id: e.target.value })
                }
              >
                <option value="">{t("selectSchema")}</option>
                {templates.map((s) => (
                  <option key={s.id} value={s.id}>
                    {localizedName(s, i18n.language)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modalActions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={duplicateSchema}
              >
                {t("save")}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDuplicateModal(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {typeModal ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t("createRapportType")}</h2>
            <label>
              {t("rapportTypeNameAr")}
              <input
                value={typeForm.name_ar}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, name_ar: e.target.value })
                }
              />
            </label>
            {ENABLE_FR_VALUE_INPUTS ? (
              <label>
                {t("rapportTypeNameFr")}
                <input
                  value={typeForm.name_fr}
                  onChange={(e) =>
                    setTypeForm({ ...typeForm, name_fr: e.target.value })
                  }
                />
              </label>
            ) : null}
            <label>
              {t("contentKind")}
              <select
                value={typeForm.content_kind}
                onChange={(e) =>
                  setTypeForm({ ...typeForm, content_kind: e.target.value })
                }
              >
                {CONTENT_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`contentKind_${k}`)}
                  </option>
                ))}
              </select>
            </label>
            <ExpandableHelp
              title={t("schemaHelpContentKind")}
              className="schemaColTypeHintExpand contentKindHelpExpand"
            >
              <p className="muted small">
                {t(`contentKindHint_${typeForm.content_kind}`)}
              </p>
            </ExpandableHelp>
            {typeForm.content_kind === "commune_list" ? (
              <>
              <label>
                {t("communeContentKind")}
                <select
                  value={typeForm.commune_content_kind}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      commune_content_kind: e.target.value,
                    })
                  }
                >
                  <option value="complex">
                    {t("communeContentKind_complex")}
                  </option>
                  <option value="table">{t("communeContentKind_table")}</option>
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
                {t("linkedSchema")}
                <select
                  value={typeForm.table_schema_slug}
                  onChange={(e) =>
                    setTypeForm({
                      ...typeForm,
                      table_schema_slug: e.target.value,
                    })
                  }
                >
                  <option value="">{t("selectSchema")}</option>
                  {allSchemas.map((s) => (
                    <option key={s.id} value={s.slug}>
                      {localizedName(s, i18n.language)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="modalActions">
              <BusyButton
                type="button"
                className="btn btn-primary"
                onClick={saveRapportType}
                busy={saving}
                busyLabel={t("saving")}
              >
                {t("save")}
              </BusyButton>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setTypeModal(false)}
                disabled={saving}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editTypeModal && editingType ? (
        <div className="modalOverlay">
          <div className="modalCard">
            <h2>{t("linkTableSchema")}</h2>
            <p className="muted">{localizedName(editingType, i18n.language)}</p>
            <label>
              {t("linkedSchema")}
              <select
                value={editTypeSchemaSlug}
                onChange={(e) => setEditTypeSchemaSlug(e.target.value)}
              >
                <option value="">{t("selectSchema")}</option>
                {allSchemas.map((s) => (
                  <option key={s.id} value={s.slug}>
                    {localizedName(s, i18n.language)}
                  </option>
                ))}
              </select>
            </label>
            <div className="modalActions">
              <BusyButton
                type="button"
                className="btn btn-primary"
                onClick={saveEditTypeSchema}
                busy={saving}
                busyLabel={t("saving")}
              >
                {t("save")}
              </BusyButton>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setEditTypeModal(false);
                  setEditingType(null);
                }}
                disabled={saving}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmActionModal
        open={Boolean(pendingDeleteType)}
        title={t("deleteUnusedRapportTypeConfirmTitle")}
        message={t("deleteUnusedRapportTypeConfirmMessage", {
          name: pendingDeleteType
            ? localizedName(pendingDeleteType, i18n.language)
            : "",
        })}
        confirmLabel={t("deleteUnusedRapportType")}
        variant="danger"
        loading={deletingType}
        onConfirm={() => void confirmDeleteRapportType()}
        onClose={() => setPendingDeleteType(null)}
      />
    </div>
  );
}
