import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ApiError } from "../api";
import { DocumentTemplatePickModal } from "../components/DocumentTemplatePickModal";
import { BackButton } from "../components/BackButton";
import { WaliRespondModal } from "../components/WaliRespondModal";
import { WaliResponsesSection } from "../components/WaliResponsesSection";
import {
  TableGridView,
  TableMergeToolbar,
  TableWorkspace,
  TableTitleBlock,
} from "../components/TableGridView";
import { emptyRowsForColumns } from "../types/embeddedTable";
import {
  countFinishedRows,
  type TableRowFilterMode,
} from "../utils/tableRowMeta";
import { useSnackbar } from "../snackbar/SnackbarContext";
import type { Column, LayoutJson, TableMeta } from "../utils/tableLayout";
import {
  CalendarEventsEditor,
  CalendarEventsView,
  type CalendarEvent,
} from "../components/CalendarEventsEditor";
import {
  DocumentBlocksView,
  MediaRowsEditor,
  MediaRowsView,
} from "../components/MediaBlocks";
import {
  RichDocumentEditor,
  RichDocumentView,
} from "../components/RichDocumentEditor";
import { RapportExportButtons } from "../components/ExportPdfButton";
import {
  RapportTitleField,
  patchRapportTitle,
} from "../components/RapportTitleField";
import { TablePagination } from "../components/TablePagination";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "../utils/pagination";
import { HubTile } from "../components/HubTile";
import { ArchiveVersionsLink, WaliArchiveVersionsLink } from "./RapportVersionsArchivePage";
import { RapportOfficeStatusBanner } from "../components/RapportOfficeStatusBanner";
import { RapportVersionHeaderActions } from "../components/RapportVersionHeaderActions";
import { ServiceRapportTypesHub } from "../components/ServiceRapportTypesHub";
import { ServiceContentKindsHub } from "../components/ServiceContentKindsHub";
import {
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  canFinishRapport,
  officeRapportTypeListPath,
  officeRapportTypeWorkspacePath,
  officeServiceHubPath,
  rapportTypesForContentKind,
} from "../utils/rapportNavigation";
import { RapportListScopeFilter } from "../components/RapportListScopeFilter";
import { RapportRowHideActions } from "../components/RapportRowHideActions";
import { RapportTypeHideActions } from "../components/RapportTypeHideActions";
import {
  notifyHubCountsRefresh,
  HUB_COUNTS_REFRESH_EVENT,
} from "../utils/hubCountsRefresh";
import { reorderRowsArray } from "../utils/tableRowReorder";
import type { MediaFile, MediaRow } from "../utils/media";
import { readBackTarget } from "../utils/navigationBack";
import {
  rowsWithCommuneNames,
  sortRowsByCommune,
  withCommuneNameColumn,
} from "../utils/communeBulkTable";
import { markOfficeRapportOpened } from "../utils/officeRapportList";

type Props = { token: string };

export function OfficeTableGridPage({ token }: Props) {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const rapportTypeId = searchParams.get("rapport_type_id")
    ? Number(searchParams.get("rapport_type_id"))
    : undefined;
  const rapportId = searchParams.get("rapport_id")
    ? Number(searchParams.get("rapport_id"))
    : undefined;
  const sid = Number(serviceId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [title, setTitle] = useState("");
  const [tableMeta, setTableMeta] = useState<TableMeta>({});
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowFilterMode, setRowFilterMode] =
    useState<TableRowFilterMode>("active");
  const [finishing, setFinishing] = useState(false);

  const load = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ws = await api.getTableWorkspace(token, sid, {
        rapportTypeId,
        rapportId,
      });
      setWorkspace(ws);
      setTitle(ws.rapport?.title || "");
      const table = ws.tableData?.tables?.[0] || {};
      setRows(table.rows || []);
      setMediaRows(table.media_rows || []);
      if (ws.rapport?.id) {
        void markOfficeRapportOpened(token, ws.rapport.id);
        api
          .getRapportMediaFiles(token, ws.rapport.id)
          .then((r) => setMediaFiles(r.files || {}))
          .catch(() => {});
        api
          .getCalendarEvents(token, ws.rapport.id)
          .then((r) => setCalendarEvents(r.events || []))
          .catch(() => {});
      }
      setTableMeta({
        title_ar: table.title_ar,
        title_fr: table.title_fr,
        subtitle_ar: table.subtitle_ar,
        subtitle_fr: table.subtitle_fr,
        merge_column_keys: table.merge_column_keys || [],
      });
    } catch (e) {
      setWorkspace(null);
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      setLoadError(msg);
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setLoading(false);
    }
  }, [token, sid, rapportTypeId, rapportId, snack, t]);

  useEffect(() => {
    load();
  }, [load]);

  const pageTitle = workspace?.rapportType
    ? localizedRapportTypeName(workspace.rapportType, i18n.language)
    : workspace?.service
      ? i18n.language === "fr"
        ? workspace.service.name_fr
        : workspace.service.name_ar
      : t("navRapports");

  async function saveForPreview() {
    if (!workspace?.rapport?.id) return;
    const patched = await patchRapportTitle(token, workspace.rapport.id, title);
    setTitle(patched.title);
    await api.saveTableData(token, workspace.rapport.id, {
      rows,
      table_key: "main",
      media_rows: mediaRows,
      ...tableMeta,
    });
    await api.saveCalendarEvents(token, workspace.rapport.id, calendarEvents);
  }

  async function save() {
    if (!workspace?.rapport?.id) return;
    setSaving(true);
    try {
      await saveForPreview();
      snack.show(t("save"), "success");
      load();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!workspace?.rapport?.id) return;
    try {
      await saveForPreview();
      await api.submitRapport(token, workspace.rapport.id);
      notifyHubCountsRefresh();
      snack.show(t("submitRapport"), "success");
      load();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    }
  }

  async function finishCurrentRapport() {
    if (!workspace?.rapport?.id) return;
    setFinishing(true);
    try {
      await api.finishRapport(token, workspace.rapport.id);
      notifyHubCountsRefresh();
      snack.show(t("finishRapportDone"), "success");
      const typeId = rapportTypeId ?? workspace.rapport.rapport_type_id;
      navigate(typeId ? `/office/services/${sid}/rapports/${typeId}` : `/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setFinishing(false);
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      notifyHubCountsRefresh();
      snack.show(t("hideRapportTypeDone"), "success");
      navigate(`/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      notifyHubCountsRefresh();
      snack.show(t("restoreRapportTypeDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  const columns: Column[] = workspace?.schema?.columns || [];
  const layoutJson: LayoutJson | null = workspace?.schema?.layout_json || null;
  const isEditable = workspace?.editable === true;
  const mergeKeys = tableMeta.merge_column_keys || [];
  const versionRows = workspace?.versions || [];
  const finishedRowCount = countFinishedRows(rows);

  function updateRow(idx: number, key: string, value: unknown) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)),
    );
  }

  function updateCellColor(
    rowIdx: number,
    colKey: string,
    color: string | null,
  ) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const cellColors = {
          ...((r._cell_colors as Record<string, string>) || {}),
        };
        if (!color || color === "none") delete cellColors[colKey];
        else cellColors[colKey] = color;
        return { ...r, _cell_colors: cellColors };
      }),
    );
  }

  function setAllWaliVisible(visible: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, _wali_visible: visible })));
  }

  function addRow() {
    setRows((prev) => [...prev, ...emptyRowsForColumns(columns, 1)]);
  }

  function deleteRow(idx: number) {
    setRows((prev) =>
      prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev,
    );
  }

  function reorderRow(fromIdx: number, toIdx: number) {
    setRows((prev) => reorderRowsArray(prev, fromIdx, toIdx));
  }

  const editorBackPath = officeServiceHubPath(sid);

  return (
    <div className="page">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!isEditable}
          fallback={pageTitle}
        />
        {isEditable ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {t("save")}
            </button>
            <button type="button" className="btn btn-accent" onClick={submit}>
              {t("submitRapport")}
            </button>
          </>
        ) : null}
        {workspace?.rapport?.id ? (
          <RapportVersionHeaderActions
            rapportId={workspace.rapport.id}
            rapportType={workspace.rapportType}
            versions={versionRows}
            showSentVersion={!isEditable}
          />
        ) : null}
        {workspace?.rapport?.id ? (
          <RapportExportButtons
            token={token}
            rapportId={workspace.rapport.id}
            onPreparePreview={isEditable ? saveForPreview : undefined}
          />
        ) : null}
        {workspace?.accessLevel === "manage" && workspace?.rapportType ? (
          <div className="pageHeaderActionsMenu">
            <RapportTypeHideActions
              rapportType={workspace.rapportType}
              canManage
              onHideType={hideTypeFromPage}
              onRestoreType={restoreTypeFromPage}
              variant="page"
            />
          </div>
        ) : null}
        <BackButton fallbackTo={editorBackPath} />
      </div>

      {loading ? <p className="muted communeStatus">{t("loading")}</p> : null}
      {loadError ? (
        <div className="communeError card">
          <p>
            {loadError === "tableSchemaNotConfigured"
              ? t("tableSchemaNotConfigured")
              : t("tableWorkspaceError")}
          </p>
          {loadError === "tableSchemaNotConfigured" ? (
            <Link
              className="btn btn-primary"
              to={`/office/services/${sid}/config`}
            >
              {t("goToServiceConfig")}
            </Link>
          ) : (
            <button type="button" className="btn btn-secondary" onClick={load}>
              {t("refresh")}
            </button>
          )}
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <RapportOfficeStatusBanner
            rapport={workspace.rapport}
            editable={isEditable}
            onFinish={finishCurrentRapport}
            finishing={finishing}
          />

          <TableTitleBlock
            tableMeta={tableMeta}
            editable={isEditable}
            onTableMetaChange={(patch) =>
              setTableMeta((prev) => ({ ...prev, ...patch }))
            }
          />

          <TableWorkspace
            columns={columns}
            rows={rows}
            layoutJson={layoutJson}
            tableMeta={tableMeta}
            editable={isEditable}
            showRowMeta
            onUpdateRow={updateRow}
            onSetAllWaliVisible={setAllWaliVisible}
            onUpdateCellColor={updateCellColor}
            onDeleteRow={isEditable ? deleteRow : undefined}
            onReorderRows={isEditable ? reorderRow : undefined}
            rowCount={rows.length}
            finishedCount={finishedRowCount}
            filterMode={rowFilterMode}
            onFilterModeChange={setRowFilterMode}
            onAddRow={isEditable ? addRow : undefined}
          />

          <TableMergeToolbar
            columns={columns}
            mergeKeys={mergeKeys}
            editable={isEditable}
            onMergeToggle={(colKey, checked) =>
              setTableMeta((prev) => ({
                ...prev,
                merge_column_keys: checked
                  ? [...(prev.merge_column_keys || []), colKey]
                  : (prev.merge_column_keys || []).filter((k) => k !== colKey),
              }))
            }
          />

          <MediaRowsEditor
            rows={mediaRows}
            files={mediaFiles}
            token={token}
            editable={isEditable}
            onChange={setMediaRows}
            onUpload={async (file) => {
              const res = await api.uploadRapportFile(
                token,
                workspace!.rapport!.id,
                file,
              );
              setMediaFiles((prev) => ({ ...prev, [res.file.id]: res.file }));
              return res.file;
            }}
          />

          <CalendarEventsEditor
            events={calendarEvents}
            editable={isEditable}
            onChange={setCalendarEvents}
          />

          <WaliResponsesSection
            responses={workspace?.rapport?.waliResponses || []}
          />
        </>
      ) : null}
    </div>
  );
}

export function OfficeServiceContentHubPage({ token }: Props) {
  const { serviceId } = useParams();
  const sid = Number(serviceId);
  const { t } = useTranslation();
  const snack = useSnackbar();
  const [hub, setHub] = useState<any>(null);
  const [showHiddenTypes, setShowHiddenTypes] = useState(false);

  const loadHub = useCallback(() => {
    if (!sid) return;
    api
      .getServiceContentHub(token, sid, { hidden_only: showHiddenTypes })
      .then(setHub)
      .catch(() => {});
  }, [sid, token, showHiddenTypes]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub);
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub);
  }, [loadHub]);

  async function hideType(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      snack.show(t("hideRapportTypeDone"), "success");
      loadHub();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreType(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      snack.show(t("restoreRapportTypeDone"), "success");
      loadHub();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  if (!hub?.service) {
    return (
      <div className="page">
        <p className="muted">…</p>
      </div>
    );
  }

  return (
    <ServiceContentKindsHub
      service={hub.service}
      summaries={hub.contentKindSummaries || []}
      contentKinds={hub.contentKinds}
      accessLevel={hub.accessLevel}
      backTo="/office/services"
      rapportTypePath={(rt) =>
        isDirectWorkspaceKind(rt.content_kind)
          ? officeRapportTypeWorkspacePath(sid, rt)
          : officeRapportTypeListPath(sid, rt.id)
      }
      mode="office"
      showConfig={hub.accessLevel === "manage"}
      manageTypes={hub.accessLevel === "manage"}
      showHiddenTypes={showHiddenTypes}
      onShowHiddenTypesChange={setShowHiddenTypes}
      onHideType={hideType}
      onRestoreType={restoreType}
    />
  );
}

export function OfficeServiceKindRapportTypesPage({ token }: Props) {
  const { serviceId, contentKind } = useParams();
  const sid = Number(serviceId);
  const kind = contentKind || "";
  const { t } = useTranslation();
  const snack = useSnackbar();
  const [hub, setHub] = useState<any>(null);
  const [showHiddenTypes, setShowHiddenTypes] = useState(false);

  const loadHub = useCallback(() => {
    if (!sid) return;
    api
      .getServiceContentHub(token, sid, { hidden_only: showHiddenTypes })
      .then(setHub)
      .catch(() => {});
  }, [sid, token, showHiddenTypes]);

  useEffect(() => {
    loadHub();
  }, [loadHub]);

  useEffect(() => {
    window.addEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub);
    return () => window.removeEventListener(HUB_COUNTS_REFRESH_EVENT, loadHub);
  }, [loadHub]);

  async function hideType(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      snack.show(t("hideRapportTypeDone"), "success");
      loadHub();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreType(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      snack.show(t("restoreRapportTypeDone"), "success");
      loadHub();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  if (!hub?.service) {
    return (
      <div className="page">
        <p className="muted">…</p>
      </div>
    );
  }

  const types = rapportTypesForContentKind(hub, kind);

  return (
    <ServiceRapportTypesHub
      service={hub.service}
      rapportTypes={types}
      accessLevel={hub.accessLevel}
      backTo={`/office/services/${sid}`}
      mode="office"
      showConfig={hub.accessLevel === "manage"}
      pageTitle={t(`contentKind_${kind}`, { defaultValue: kind })}
      manageTypes={hub.accessLevel === "manage"}
      showHiddenTypes={showHiddenTypes}
      onShowHiddenTypesChange={setShowHiddenTypes}
      onHideType={hideType}
      onRestoreType={restoreType}
    />
  );
}

export function OfficeDocumentsPage({
  token,
  contentKind = "document_compose",
}: Props & { contentKind?: string }) {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const rapportTypeId = searchParams.get("rapport_type_id")
    ? Number(searchParams.get("rapport_type_id"))
    : undefined;
  const sid = Number(serviceId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [createPickOpen, setCreatePickOpen] = useState(false);
  const [importFor, setImportFor] = useState<{
    rapportId: number;
    typeId: number;
  } | null>(null);
  const [listPage, setListPage] = useState(1);
  const [listTotal, setListTotal] = useState(0);
  const [showHidden, setShowHidden] = useState(false);

  useEffect(() => {
    setListPage(1);
  }, [sid, contentKind, rapportTypeId, showHidden]);

  const load = useCallback(async () => {
    if (!sid) return;
    try {
      const listOpts = {
        page: listPage,
        pageSize: DEFAULT_PAGE_SIZE,
        hidden_only: showHidden,
      };
      const res = await api.getDocumentList(
        token,
        sid,
        rapportTypeId
          ? { rapportTypeId, ...listOpts }
          : { contentKind, ...listOpts },
      );
      setData(res);
      setListTotal(res.total ?? res.rapports?.length ?? 0);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }, [token, sid, contentKind, rapportTypeId, listPage, showHidden, snack, t]);

  async function finishDoc(id: number) {
    try {
      await api.finishRapport(token, id);
      snack.show(t("finishRapportDone"), "success");
      load();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreDoc(id: number) {
    try {
      await api.restoreRapport(token, id);
      snack.show(t("restoreRapportDone"), "success");
      load();
      notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      notifyHubCountsRefresh();
      snack.show(t("hideRapportTypeDone"), "success");
      navigate(`/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      notifyHubCountsRefresh();
      snack.show(t("restoreRapportTypeDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  useEffect(() => {
    load();
  }, [load]);

  async function createDoc(
    typeId: number,
    templateId: number | null,
    skipDefault = false,
  ) {
    try {
      const res = await api.createDocument(token, sid, typeId, {
        templateId,
        skipDefault: templateId == null && skipDefault,
      });
      navigate(`/office/rapports/${res.rapport.id}/document`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  const canEdit = data?.accessLevel === "manage";
  const activeType = data?.documentTypes?.[0];
  const pageTitle = activeType
    ? localizedRapportTypeName(activeType, i18n.language)
    : data?.service
      ? i18n.language === "fr"
        ? data.service.name_fr
        : data.service.name_ar
      : t("navRapports");

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{pageTitle}</h1>
        {data?.accessLevel === "view" ? (
          <span className="badge">{t("accessView")}</span>
        ) : null}
        {canEdit && activeType ? (
          <div className="pageHeaderActionsMenu">
            <RapportTypeHideActions
              rapportType={activeType}
              canManage={canEdit}
              onHideType={hideTypeFromPage}
              onRestoreType={restoreTypeFromPage}
              variant="page"
            />
          </div>
        ) : null}
        <BackButton fallbackTo={`/office/services/${sid}`} />
      </div>

      {canEdit && activeType ? (
        <div className="section">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setCreatePickOpen(true)}
          >
            {t("createRapport")}
          </button>
        </div>
      ) : null}

      {createPickOpen && activeType ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={activeType.id}
          open={createPickOpen}
          mode="create"
          onClose={() => setCreatePickOpen(false)}
          onSelect={(templateId) => {
            setCreatePickOpen(false);
            createDoc(activeType.id, templateId, templateId == null);
          }}
        />
      ) : null}

      {importFor ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={sid}
          rapportTypeId={importFor.typeId}
          open={!!importFor}
          mode="import"
          onClose={() => setImportFor(null)}
          onSelect={async (templateId, mode) => {
            if (!templateId || !importFor) return;
            const { rapportId } = importFor;
            setImportFor(null);
            try {
              await api.applyDocumentTemplate(
                token,
                rapportId,
                templateId,
                mode || "replace",
              );
              snack.show(t("documentTemplateImported"), "success");
              load();
            } catch {
              snack.show(t("errorGeneric"), "error");
            }
          }}
        />
      ) : null}

      {canEdit ? (
        <div className="rapportListToolbar">
          <RapportListScopeFilter showHidden={showHidden} onChange={setShowHidden} />
        </div>
      ) : null}

      <div className="section">
        <h2>{t("navRapports")}</h2>
        <div className="card tableWrap">
          <table>
            <thead>
              <tr>
                <th>{t("rapportTitle")}</th>
                <th>{t("rapportStatus")}</th>
                <th>{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.rapports || []).map((r: any) => (
                <tr key={r.id}>
                  <td>{r.title}</td>
                  <td>{r.status}</td>
                  <td>
                    <Link
                      className="btn btn-ghost"
                      to={`/office/rapports/${r.id}/document`}
                    >
                      {canEdit ? t("edit") : t("details")}
                    </Link>
                    {canEdit &&
                    ["draft", "changes_requested"].includes(r.status) ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setImportFor({
                              rapportId: r.id,
                              typeId: r.rapport_type_id || activeType?.id,
                            })
                          }
                        >
                          {t("documentTemplateImport")}
                        </button>
                      </>
                    ) : null}
                    <RapportRowHideActions
                      rapport={r}
                      canManage={canEdit}
                      showHidden={showHidden}
                      onHide={() => finishDoc(r.id)}
                      onRestore={() => restoreDoc(r.id)}
                    />
                  </td>
                </tr>
              ))}
              {!data?.rapports?.length ? (
                <tr>
                  <td colSpan={3} className="muted">
                    {t("noResults")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <TablePagination
          page={listPage}
          total={listTotal}
          pageSize={DEFAULT_PAGE_SIZE}
          onPageChange={setListPage}
        />
      </div>
    </div>
  );
}

export function OfficeDocumentEditorPage({ token }: Props) {
  const { rapportId } = useParams();
  const rid = Number(rapportId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [rapport, setRapport] = useState<any>(null);
  const [title, setTitle] = useState("");
  const [docData, setDocData] = useState<{
    rich_html_ar?: string;
    rich_html_fr?: string;
    blocks?: any[];
    embedded_tables?: import("../types/embeddedTable").EmbeddedTable[];
  }>({});
  const [embeddedTables, setEmbeddedTables] = useState<
    import("../types/embeddedTable").EmbeddedTable[]
  >([]);
  const [canEdit, setCanEdit] = useState(true);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [importPickOpen, setImportPickOpen] = useState(false);
  const [waliResponses, setWaliResponses] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({});

  const applyDocumentJson = useCallback((dj: any) => {
    const tables = dj?.embedded_tables || [];
    setDocData({
      rich_html_ar: dj?.rich_html_ar,
      rich_html_fr: dj?.rich_html_fr,
      blocks: dj?.blocks,
      embedded_tables: tables,
    });
    setEmbeddedTables(tables);
    setCalendarEvents(dj?.calendar_events || []);
    setMediaRows(dj?.media_rows || []);
  }, []);

  const loadCurrent = useCallback(() => {
    if (!rid) return;
    void markOfficeRapportOpened(token, rid);
    api
      .getRapport(token, rid)
      .then((r) => {
        setRapport(r.rapport);
        setTitle(r.rapport?.title || "");
        setCanEdit(r.accessLevel === "manage");
        setWaliResponses(r.rapport?.waliResponses || []);
        const dj =
          r.rapport?.currentVersion?.data_json ||
          r.rapport?.versions?.[0]?.data_json ||
          {};
        applyDocumentJson(dj);
      })
      .catch(() => snack.show(t("errorGeneric"), "error"));
    api
      .getRapportMediaFiles(token, rid)
      .then((r) => setMediaFiles(r.files || {}))
      .catch(() => {});
    api
      .getCalendarEvents(token, rid)
      .then((r) => setCalendarEvents(r.events || []))
      .catch(() => {});
    api
      .listRapportVersions(token, rid)
      .then((r) => setVersions(r.versions || []))
      .catch(() => {});
  }, [rid, token, snack, t, applyDocumentJson]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  async function saveForPreview() {
    const patched = await patchRapportTitle(token, rid, title);
    setTitle(patched.title);
    setRapport(patched.rapport);
    await api.saveDocument(token, rid, {
      rich_html_ar: docData.rich_html_ar,
      rich_html_fr: docData.rich_html_fr,
      blocks: docData.blocks,
      embedded_tables: embeddedTables,
      media_rows: mediaRows,
    });
    await api.saveCalendarEvents(token, rid, calendarEvents);
  }

  async function save() {
    try {
      await saveForPreview();
      snack.show(t("save"), "success");
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    }
  }

  async function submit() {
    try {
      await saveForPreview();
      await api.submitRapport(token, rid);
      notifyHubCountsRefresh();
      snack.show(t("submitRapport"), "success");
      loadCurrent();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    }
  }

  async function importTemplate(
    templateId: number,
    mode: "replace" | "append",
  ) {
    try {
      const res = await api.applyDocumentTemplate(token, rid, templateId, mode);
      const dj = res.rapport?.currentVersion?.data_json || {};
      const tables = dj.embedded_tables || [];
      setDocData({
        rich_html_ar: dj.rich_html_ar,
        rich_html_fr: dj.rich_html_fr,
        blocks: dj.blocks,
        embedded_tables: tables,
      });
      setEmbeddedTables(tables);
      snack.show(t("documentTemplateImported"), "success");
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  const editable =
    canEdit &&
    rapport &&
    ["draft", "changes_requested"].includes(rapport.status);
  const docBackPath = rapport?.service_id
    ? officeServiceHubPath(rapport.service_id)
    : "/office/services";

  async function finishCurrentRapport() {
    setFinishing(true);
    try {
      await api.finishRapport(token, rid);
      notifyHubCountsRefresh();
      snack.show(t("finishRapportDone"), "success");
      navigate(
        rapport?.service_id && rapport?.rapport_type_id
          ? `/office/services/${rapport.service_id}/rapports/${rapport.rapport_type_id}`
          : "/office/rapports",
      );
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="page">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={t("navRapports")}
        />
        {!canEdit ? <span className="badge">{t("accessView")}</span> : null}
        <RapportVersionHeaderActions
          rapportId={rid}
          rapportType={rapport?.rapportType}
          versions={versions}
          showSentVersion={!editable}
        />
        {editable ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setImportPickOpen(true)}
            >
              {t("documentTemplateImport")}
            </button>
            <button type="button" className="btn btn-primary" onClick={save}>
              {t("save")}
            </button>
            <button type="button" className="btn btn-accent" onClick={submit}>
              {t("submitRapport")}
            </button>
          </>
        ) : null}
        <RapportExportButtons
          token={token}
          rapportId={rid}
          onPreparePreview={editable ? saveForPreview : undefined}
        />
        <BackButton fallbackTo={docBackPath} />
      </div>

      <RapportOfficeStatusBanner
        rapport={rapport}
        editable={!!editable}
        onFinish={finishCurrentRapport}
        finishing={finishing}
      />

      {editable ? (
        <RichDocumentEditor
          data={{ ...docData, embedded_tables: embeddedTables }}
          editable
          token={token}
          rapportId={rid}
          serviceId={rapport?.service_id}
          onEmbeddedTablesChange={setEmbeddedTables}
          onChange={(locale, html) =>
            setDocData((prev) => ({
              ...prev,
              ...(locale === "fr"
                ? { rich_html_fr: html }
                : { rich_html_ar: html }),
            }))
          }
        />
      ) : (
        <RichDocumentView
          data={docData}
          locale={i18n.language}
          token={token}
          serviceId={rapport?.service_id}
        />
      )}

      {editable ? (
        <MediaRowsEditor
          rows={mediaRows}
          files={mediaFiles}
          token={token}
          editable
          onChange={setMediaRows}
          onUpload={async (file) => {
            const res = await api.uploadRapportFile(token, rid, file);
            setMediaFiles((prev) => ({ ...prev, [res.file.id]: res.file }));
            return res.file;
          }}
        />
      ) : (
        <MediaRowsView rows={mediaRows} files={mediaFiles} token={token} />
      )}

      {importPickOpen && rapport?.service_id && rapport?.rapport_type_id ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={Number(rapport.service_id)}
          rapportTypeId={Number(rapport.rapport_type_id)}
          open={importPickOpen}
          mode="import"
          onClose={() => setImportPickOpen(false)}
          onSelect={(templateId, mode) => {
            setImportPickOpen(false);
            if (templateId) importTemplate(templateId, mode || "replace");
          }}
        />
      ) : null}

      <CalendarEventsEditor
        events={calendarEvents}
        editable={!!editable}
        onChange={setCalendarEvents}
      />

      <WaliResponsesSection responses={waliResponses} />
    </div>
  );
}

export function WaliRapportViewPage({
  token,
  audience = "wali",
}: Props & { audience?: "wali" | "admin" }) {
  const { rapportId } = useParams();
  const rid = Number(rapportId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const [view, setView] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [waliCommuneCode, setWaliCommuneCode] = useState<string | null>(null);
  const [waliCommunePage, setWaliCommunePage] = useState(1);
  const [waliCommuneViewMode, setWaliCommuneViewMode] = useState<"commune" | "all">("commune");
  const location = useLocation();
  const isWali = audience === "wali";
  const listBack = isWali ? "/wali/rapports" : "/admin/rapports";
  const viewBackTarget = readBackTarget(location, listBack);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      setView(
        isWali
          ? await api.getWaliRapportView(token, rid, showHidden)
          : await api.getAdminRapportView(token, rid, showHidden),
      );
      if (isWali) notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }, [token, rid, showHidden, snack, t, isWali]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendResponse(payload: {
    decision: string;
    follow_up_status?: string;
    body_text?: string;
  }) {
    try {
      await api.waliRespond(token, rid, payload);
      notifyHubCountsRefresh();
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
      throw new Error("respond failed");
    }
  }

  const columns: Column[] = view?.schema?.columns || [];
  const layoutJson: LayoutJson | null = view?.schema?.layout_json || null;
  const tableMeta: TableMeta = view?.tableMeta || {};
  const isTableCommuneMode =
    view?.content_kind === "commune_list" &&
    view?.rapport?.rapportType?.commune_content_kind === "table";

  const waliCommunesWithData = (view?.municipalities || []).filter((m: any) => {
    const entry = view?.communes?.[m.code];
    if (!entry) return false;
    if (entry.rich_html_ar || entry.rich_html_fr) return true;
    if (entry.blocks?.length) return true;
    return (entry.rows || []).length > 0;
  });
  const waliSelected =
    waliCommunesWithData.find(
      (m: any) => m.code === (waliCommuneCode || waliCommunesWithData[0]?.code),
    ) || null;
  const waliCommuneEntry = waliSelected
    ? view?.communes?.[waliSelected.code]
    : null;
  const pagedWaliCommunes = paginateSlice(
    waliCommunesWithData,
    waliCommunePage,
    DEFAULT_PAGE_SIZE,
  );
  const waliResponses = view?.waliResponses || [];
  const documentDataJson = view?.rapport?.currentVersion?.data_json || {};
  const documentViewData = {
    rich_html_ar: documentDataJson.rich_html_ar,
    rich_html_fr: documentDataJson.rich_html_fr,
    blocks: view?.blocks ?? documentDataJson.blocks,
    embedded_tables: documentDataJson.embedded_tables,
  };
  const documentMediaRows = view?.media_rows ?? documentDataJson.media_rows ?? [];

  const allCommuneTableRows = useMemo(() => {
    if (!isTableCommuneMode || !view?.communes) return [];
    const allRows: Record<string, unknown>[] = [];
    for (const m of view.municipalities || []) {
      const entry = view.communes[m.code];
      if (!entry?.rows?.length) continue;
      for (const r of entry.rows) {
        allRows.push({
          ...r,
          municipality_code: m.code,
          _municipality_name_ar: m.name_ar,
          _municipality_name_fr: m.name_fr,
        });
      }
    }
    return rowsWithCommuneNames(sortRowsByCommune(allRows), i18n.language);
  }, [isTableCommuneMode, view?.communes, view?.municipalities, i18n.language]);

  useEffect(() => {
    setWaliCommunePage(1);
  }, [rid, waliCommunesWithData.length, waliResponses.length]);

  useEffect(() => {
    setWaliCommuneViewMode("commune");
    setWaliCommuneCode(null);
  }, [rid]);

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{view?.rapport?.title || t("navInbox")}</h1>
        <div className="pageHeaderActions">
          {view?.versions?.length > 0 ? (
            isWali ? (
              <WaliArchiveVersionsLink rapportId={rid} />
            ) : (
              <ArchiveVersionsLink rapportId={rid} />
            )
          ) : null}
          {isWali ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setRespondOpen(true)}
            >
              {t("respondRapport")}
            </button>
          ) : null}
          {view?.content_kind === "table_grid" ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowHidden((v) => !v)}
            >
              {showHidden ? t("hideHiddenRows") : t("showHiddenRows")}
            </button>
          ) : null}
          <RapportExportButtons
            token={token}
            rapportId={rid}
            wali={isWali}
            showHidden={showHidden}
          />
          <BackButton to={viewBackTarget} fallbackTo={viewBackTarget} />
        </div>
      </div>

      {view?.content_kind === "table_grid" ? (
        <div className="card tableWrap excelTable">
          <TableTitleBlock tableMeta={tableMeta} editable={false} />
          <TableGridView
            columns={columns}
            rows={view.rows || []}
            layoutJson={layoutJson}
            tableMeta={tableMeta}
            editable={false}
          />
          <MediaRowsView
            rows={view.media_rows || []}
            files={view.files || {}}
            token={token}
          />
        </div>
      ) : view?.content_kind === "commune_list" ? (
        <>
          <p className="muted communeListIntro">{t("communeListIntro")}</p>
          {isTableCommuneMode ? (
            <div className="communeViewModeBar">
              <button
                type="button"
                className={`btn btn-secondary btn-sm${waliCommuneViewMode === "commune" ? " active" : ""}`}
                onClick={() => setWaliCommuneViewMode("commune")}
              >
                {t("communeViewByCommune")}
              </button>
              <button
                type="button"
                className={`btn btn-secondary btn-sm${waliCommuneViewMode === "all" ? " active" : ""}`}
                onClick={() => setWaliCommuneViewMode("all")}
              >
                {t("communeViewAll")}
              </button>
            </div>
          ) : null}
          {waliCommuneViewMode === "all" && isTableCommuneMode ? (
            <div className="card tableWrap excelTable communeWaliPanel">
              <TableTitleBlock
                tableMeta={{
                  title_ar: view?.rapport?.title,
                  title_fr: view?.rapport?.title,
                }}
                editable={false}
              />
              <TableGridView
                columns={withCommuneNameColumn(columns)}
                rows={allCommuneTableRows}
                layoutJson={layoutJson}
                editable={false}
              />
            </div>
          ) : (
            <>
              <div className="hubGrid communeHubGrid">
                {pagedWaliCommunes.map((m: any) => (
                  <HubTile
                    key={m.code}
                    icon="communes"
                    title={i18n.language === "fr" ? m.name_fr : m.name_ar}
                    subtitle={
                      m.is_changed ? t("communeChanged") : t("communeFilled")
                    }
                    className={`${waliSelected?.code === m.code ? "communeHubTileFilled" : ""} ${
                      m.is_changed ? "communeHubTileChanged" : ""
                    }`}
                    onClick={() => setWaliCommuneCode(m.code)}
                    badge={
                      m.is_changed ? (
                        <span className="badge badge-accent">{t("new")}</span>
                      ) : null
                    }
                  />
                ))}
              </div>
              <TablePagination
                page={waliCommunePage}
                total={waliCommunesWithData.length}
                onPageChange={setWaliCommunePage}
              />
              {waliSelected && waliCommuneEntry ? (
                <div className="card communeWaliPanel">
                  <h2 className="communeWaliPanelTitle">
                    {i18n.language === "fr"
                      ? waliSelected.name_fr
                      : waliSelected.name_ar}
                  </h2>
                  <RichDocumentView
                    data={{
                      rich_html_ar: waliCommuneEntry.rich_html_ar,
                      rich_html_fr: waliCommuneEntry.rich_html_fr,
                      blocks: waliCommuneEntry.blocks,
                      embedded_tables: waliCommuneEntry.embedded_tables,
                    }}
                    locale={i18n.language}
                    token={token}
                    serviceId={view?.rapport?.service_id}
                  />
                  {(waliCommuneEntry.rows || []).length ? (
                    <div className="tableWrap excelTable">
                      <TableGridView
                        columns={columns}
                        rows={waliCommuneEntry.rows || []}
                        layoutJson={layoutJson}
                        editable={false}
                      />
                    </div>
                  ) : null}
                  {(waliCommuneEntry.calendar_events || []).length ? (
                    <CalendarEventsView events={waliCommuneEntry.calendar_events} />
                  ) : null}
                  <MediaRowsView
                    rows={waliCommuneEntry.media_rows || []}
                    files={view?.files || {}}
                    token={token}
                  />
                </div>
              ) : (
                <p className="muted communeEmptyHint">{t("noResults")}</p>
              )}
            </>
          )}
        </>
      ) : (
        <RichDocumentView
          data={documentViewData}
          locale={i18n.language}
          token={token}
          serviceId={view?.rapport?.service_id}
        />
      )}

      {view?.content_kind === "document_compose" ||
      view?.content_kind === "fiche_lecture" ? (
        <MediaRowsView
          rows={documentMediaRows}
          files={view?.files || {}}
          token={token}
        />
      ) : null}

      <CalendarEventsView events={view?.calendarEvents || []} />

      {isWali ? <WaliResponsesSection responses={waliResponses} /> : null}

      {isWali ? (
        <WaliRespondModal
          open={respondOpen}
          onClose={() => setRespondOpen(false)}
          onSubmit={sendResponse}
        />
      ) : null}
    </div>
  );
}

export function OfficeFichesPage({ token }: Props) {
  return <OfficeDocumentsPage token={token} contentKind="fiche_lecture" />;
}
