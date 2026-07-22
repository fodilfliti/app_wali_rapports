import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ENABLE_DOCUMENT_TEMPLATES } from "../config/features";
import { BackButton } from "../components/BackButton";
import { WaliRespondModal } from "../components/WaliRespondModal";
import { WaliResponsesSection } from "../components/WaliResponsesSection";
import type { ReviewResponseRow } from "../components/WaliResponsesSection";
import {
  RapportDiscussionSection,
  isDiscussionEnabledByStatus,
} from "../components/RapportDiscussionSection";
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
import { BusyButton } from "../components/BusyButton";
import { PageLoading } from "../components/PageLoading";
import type { Column, LayoutJson, TableMeta } from "../utils/tableLayout";
import {
  CalendarEventsEditor,
  CalendarEventsView,
  type CalendarEvent,
} from "../components/CalendarEventsEditor";
import {
  MediaRowsEditor,
  MediaRowsView,
} from "../components/MediaBlocks";
import {
  RichDocumentEditor,
  RichDocumentView,
} from "../components/RichDocumentEditor";
import { RapportExportButtons } from "../components/ExportPdfButton";
import {
  ChefDeleteRequestBanner,
  OfficeRapportDeleteControls,
} from "../components/RapportDeleteControls";
import { RapportOfficeStatusBanner } from "../components/RapportOfficeStatusBanner";
import {
  RapportTitleField,
  patchRapportTitle,
} from "../components/RapportTitleField";
import { TablePagination } from "../components/TablePagination";
import { DEFAULT_PAGE_SIZE } from "../utils/pagination";
import { ArchiveVersionsLink, ChefArchiveVersionsLink, WaliArchiveVersionsLink } from "./RapportVersionsArchivePage";
import { RapportVersionHeaderActions } from "../components/RapportVersionHeaderActions";
import { ServiceRapportTypesHub } from "../components/ServiceRapportTypesHub";
import { ServiceContentKindsHub } from "../components/ServiceContentKindsHub";
import {
  CreateContentKindTypeModal,
  type GuidedContentKind,
} from "../components/CreateContentKindTypeModal";
import { SchemaBrowserModal } from "../components/SchemaBrowserModal";
import {
  isDirectWorkspaceKind,
  localizedRapportTypeName,
  officeNewDocumentPath,
  officeRapportTypeListPath,
  officeRapportTypeWorkspacePath,
  officeServiceHubPath,
  rapportTypesForContentKind,
  supportsRapportVersionArchive,
} from "../utils/rapportNavigation";
import {
  activeRemarksVersionId,
  filterResponsesByVersionId,
} from "../utils/reviewResponses";
import { RapportListScopeFilter } from "../components/RapportListScopeFilter";
import { RapportRowHideActions } from "../components/RapportRowHideActions";
import { RapportTypeHideActions } from "../components/RapportTypeHideActions";
import {
  notifyHubCountsRefresh,
} from "../utils/hubCountsRefresh";
import { useInvalidateAppQueries } from "../hooks/useInvalidateAppQueries";
import { useOfficeServiceHubQuery } from "../hooks/queries/useListQueries";
import { QueryListShell } from "../components/QueryListShell";
import { ListRefreshIndicator } from "../components/ListRefreshIndicator";
import { reorderRowsArray } from "../utils/tableRowReorder";
import type { MediaFile, MediaRow } from "../utils/media";
import { readBackTarget } from "../utils/navigationBack";
import { markOfficeRapportOpened } from "../utils/officeRapportList";
import { CommuneListVersionView } from "../components/CommuneListVersionView";

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
  const location = useLocation();
  const [workspace, setWorkspace] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({});
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [title, setTitle] = useState("");
  const [tableMeta, setTableMeta] = useState<TableMeta>({});
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rowFilterMode, setRowFilterMode] =
    useState<TableRowFilterMode>("active");
  const [finishing, setFinishing] = useState(false);
  const [returningToDraft, setReturningToDraft] = useState(false);
  const [startingNewVersion, setStartingNewVersion] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingDelete, setCancellingDelete] = useState(false);

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
      setTitle(ws.rapport?.title || ws.suggestedTitle || "");
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
      } else {
        setMediaFiles({});
        setCalendarEvents([]);
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

  async function ensureTableRapportId(): Promise<number> {
    if (workspace?.rapport?.id) return workspace.rapport.id;
    if (!workspace?.rapportType?.id) {
      throw new Error("errorGeneric");
    }
    const trimmed = title.trim();
    if (!trimmed) {
      const err = new Error("rapportTitleRequired");
      throw err;
    }
    const { rapport } = await api.createRapport(token, {
      service_id: Number(sid),
      rapport_type_id: Number(workspace.rapportType.id),
      title: trimmed,
      data_json: {
        tables: [
          {
            key: "main",
            rows,
            media_rows: mediaRows,
            ...tableMeta,
          },
        ],
      },
    });
    setWorkspace((prev: any) => (prev ? { ...prev, rapport } : prev));
    const next = new URLSearchParams(searchParams);
    next.set("rapport_id", String(rapport.id));
    if (workspace.rapportType.id) {
      next.set("rapport_type_id", String(workspace.rapportType.id));
    }
    navigate(
      { pathname: location.pathname, search: `?${next.toString()}` },
      { replace: true },
    );
    return rapport.id as number;
  }

  async function saveForPreview(): Promise<void> {
    const rid = await ensureTableRapportId();
    const patched = await patchRapportTitle(token, rid, title);
    setTitle(patched.title);
    await api.saveTableData(token, rid, {
      rows,
      table_key: "main",
      media_rows: mediaRows,
      ...tableMeta,
    });
    await api.saveCalendarEvents(token, rid, calendarEvents);
  }

  async function save() {
    if (!workspace?.editable) return;
    setSaving(true);
    try {
      await saveForPreview();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
      await load();
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
    if (!workspace?.editable) return;
    setSubmitting(true);
    try {
      const id = await ensureTableRapportId();
      const patched = await patchRapportTitle(token, id, title);
      setTitle(patched.title);
      await api.saveTableData(token, id, {
        rows,
        table_key: "main",
        media_rows: mediaRows,
        ...tableMeta,
      });
      await api.saveCalendarEvents(token, id, calendarEvents);
      await api.submitRapport(token, id);
      await notifyHubCountsRefresh();
      snack.show(t("submitRapport"), "success");
      await load();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function finishCurrentRapport() {
    if (!workspace?.rapport?.id) return;
    setFinishing(true);
    try {
      await api.finishRapport(token, workspace.rapport.id);
      await notifyHubCountsRefresh();
      snack.show(t("finishRapportDone"), "success");
      const typeId = rapportTypeId ?? workspace.rapport.rapport_type_id;
      navigate(typeId ? `/office/services/${sid}/rapports/${typeId}` : `/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setFinishing(false);
    }
  }

  async function returnCurrentToDraft() {
    if (!workspace?.rapport?.id) return;
    setReturningToDraft(true);
    try {
      await api.returnRapportToDraft(token, workspace.rapport.id);
      await notifyHubCountsRefresh();
      snack.show(t("returnToDraftDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setReturningToDraft(false);
    }
  }

  async function startNewVersionFromCurrent() {
    if (!workspace?.rapport?.id) return;
    setStartingNewVersion(true);
    try {
      await api.startOfficeNewVersion(token, workspace.rapport.id);
      await notifyHubCountsRefresh();
      snack.show(t("startNewVersionDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setStartingNewVersion(false);
    }
  }

  async function deleteCurrentRapport() {
    if (!workspace?.rapport?.id) return;
    setDeleting(true);
    try {
      const result = await api.officeDeleteRapport(token, workspace.rapport.id);
      await notifyHubCountsRefresh();
      if (result.mode === "requested") {
        snack.show(t("deleteRapportRequestSent"), "success");
        load();
      } else if (result.mode === "discard_draft_version") {
        snack.show(t("deleteRapportDiscardVersionDone"), "success");
        load();
      } else if (result.mode === "reset_fresh_v1") {
        snack.show(t("deleteRapportResetV1Done"), "success");
        load();
      } else {
        snack.show(t("deleteRapportDone"), "success");
        const typeId = rapportTypeId ?? workspace.rapport.rapport_type_id;
        navigate(
          typeId
            ? `/office/services/${sid}/rapports/${typeId}`
            : `/office/services/${sid}`,
          { replace: true },
        );
      }
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function cancelCurrentDeleteRequest() {
    if (!workspace?.rapport?.id) return;
    setCancellingDelete(true);
    try {
      await api.cancelRapportDeleteRequest(token, workspace.rapport.id);
      await notifyHubCountsRefresh();
      snack.show(t("cancelDeleteRequestDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setCancellingDelete(false);
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      await notifyHubCountsRefresh();
      snack.show(t("hideRapportTypeDone"), "success");
      navigate(`/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      await notifyHubCountsRefresh();
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
  const tableRemarksVersionId = useMemo(() => {
    const chef = workspace?.rapport?.chefResponses || [];
    const wali = workspace?.rapport?.waliResponses || [];
    return activeRemarksVersionId(workspace?.rapport, versionRows, [
      ...chef,
      ...wali,
    ]);
  }, [workspace?.rapport, versionRows]);
  const tableChefResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        (workspace?.rapport?.chefResponses || []) as ReviewResponseRow[],
        tableRemarksVersionId,
      ),
    [workspace?.rapport?.chefResponses, tableRemarksVersionId],
  );
  const tableWaliResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        (workspace?.rapport?.waliResponses || []) as ReviewResponseRow[],
        tableRemarksVersionId,
      ),
    [workspace?.rapport?.waliResponses, tableRemarksVersionId],
  );

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
            <BusyButton
              type="button"
              className="btn btn-primary"
              onClick={save}
              busy={saving}
              busyLabel={t("saving")}
              disabled={submitting}
            >
              {t("save")}
            </BusyButton>
            <BusyButton
              type="button"
              className="btn btn-accent"
              onClick={submit}
              busy={submitting}
              busyLabel={t("submitting")}
              disabled={saving}
            >
              {t("submitRapport")}
            </BusyButton>
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
        {workspace?.rapport?.id ? (
          <OfficeRapportDeleteControls
            rapport={workspace.rapport}
            canManage={workspace?.accessLevel === "manage"}
            deleting={deleting}
            cancelling={cancellingDelete}
            onDelete={deleteCurrentRapport}
            onCancelRequest={cancelCurrentDeleteRequest}
            size="md"
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

      {loading ? <PageLoading className="communeStatus" /> : null}
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
            versioningMode={workspace.rapportType?.versioning_mode}
            editable={isEditable}
            canManage={workspace?.accessLevel === "manage"}
            onReturnToDraft={returnCurrentToDraft}
            returning={returningToDraft}
            onStartNewVersion={startNewVersionFromCurrent}
            startingNewVersion={startingNewVersion}
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
            onUpload={async (file, opts) => {
              const res = await api.uploadRapportFile(
                token,
                workspace!.rapport!.id,
                file,
                { onProgress: opts?.onProgress },
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
            chefResponses={tableChefResponses}
            responses={tableWaliResponses}
          />
          {workspace?.rapport?.id ? (
            <RapportDiscussionSection
              token={token}
              rapportId={Number(workspace.rapport.id)}
              mode="office"
              enabled={isDiscussionEnabledByStatus(workspace.rapport.status)}
              versionId={workspace.rapport.current_version_id ?? null}
            />
          ) : null}
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
  const invalidate = useInvalidateAppQueries();
  const [showHiddenTypes, setShowHiddenTypes] = useState(false);
  const [createKind, setCreateKind] = useState<GuidedContentKind | null>(null);
  const [schemaBrowserOpen, setSchemaBrowserOpen] = useState(false);

  const hubQuery = useOfficeServiceHubQuery(token, sid, { hidden_only: showHiddenTypes });
  const hub = hubQuery.data;
  const isInitialLoading = hubQuery.isLoading && !hub;
  const isRefreshing = hubQuery.isFetching && !hubQuery.isLoading;

  async function invalidateHub() {
    await invalidate({
      hubCounts: "office",
      serviceTrees: true,
      serviceHub: { scope: "office", serviceId: sid },
      rapports: true,
    });
  }

  async function hideType(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      snack.show(t("hideRapportTypeDone"), "success");
      await invalidateHub();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreType(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      snack.show(t("restoreRapportTypeDone"), "success");
      await invalidateHub();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function deleteType(typeId: number) {
    try {
      await api.deleteRapportType(token, typeId);
      snack.show(t("deleteUnusedRapportTypeDone"), "success");
      await invalidateHub();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    }
  }

  if (isInitialLoading || !hub?.service) {
    return (
      <div className="page">
        <QueryListShell isInitialLoading={isInitialLoading}>
          <span />
        </QueryListShell>
      </div>
    );
  }

  return (
    <>
      <ListRefreshIndicator show={isRefreshing} />
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
        onDeleteType={deleteType}
        onAddKind={
          hub.accessLevel === "manage" ? (kind) => setCreateKind(kind) : undefined
        }
        onBrowseSchemas={
          hub.accessLevel === "manage" ? () => setSchemaBrowserOpen(true) : undefined
        }
      />
      {createKind ? (
        <CreateContentKindTypeModal
          token={token}
          serviceId={sid}
          contentKind={createKind}
          open={Boolean(createKind)}
          onClose={() => setCreateKind(null)}
          onCreated={() => void invalidateHub()}
        />
      ) : null}
      <SchemaBrowserModal
        token={token}
        serviceId={sid}
        open={schemaBrowserOpen}
        onClose={() => setSchemaBrowserOpen(false)}
      />
    </>
  );
}

export function OfficeServiceKindRapportTypesPage({ token }: Props) {
  const { serviceId, contentKind } = useParams();
  const sid = Number(serviceId);
  const kind = contentKind || "";
  const { t } = useTranslation();
  const snack = useSnackbar();
  const invalidate = useInvalidateAppQueries();
  const [showHiddenTypes, setShowHiddenTypes] = useState(false);

  const hubQuery = useOfficeServiceHubQuery(token, sid, { hidden_only: showHiddenTypes });
  const hub = hubQuery.data;
  const isInitialLoading = hubQuery.isLoading && !hub;
  const isRefreshing = hubQuery.isFetching && !hubQuery.isLoading;

  async function invalidateHub() {
    await invalidate({
      hubCounts: "office",
      serviceTrees: true,
      serviceHub: { scope: "office", serviceId: sid },
      rapports: true,
    });
  }

  async function hideType(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      snack.show(t("hideRapportTypeDone"), "success");
      await invalidateHub();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreType(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      snack.show(t("restoreRapportTypeDone"), "success");
      await invalidateHub();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function deleteType(typeId: number) {
    try {
      await api.deleteRapportType(token, typeId);
      snack.show(t("deleteUnusedRapportTypeDone"), "success");
      await invalidateHub();
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    }
  }

  if (isInitialLoading || !hub?.service) {
    return (
      <div className="page">
        <QueryListShell isInitialLoading={isInitialLoading}>
          <span />
        </QueryListShell>
      </div>
    );
  }

  const types = rapportTypesForContentKind(hub, kind);

  return (
    <>
      <ListRefreshIndicator show={isRefreshing} />
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
      onDeleteType={deleteType}
    />
    </>
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
      await notifyHubCountsRefresh();
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreDoc(id: number) {
    try {
      await api.restoreRapport(token, id);
      snack.show(t("restoreRapportDone"), "success");
      await notifyHubCountsRefresh();
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function hideTypeFromPage(typeId: number) {
    try {
      await api.hideRapportType(token, typeId);
      await notifyHubCountsRefresh();
      snack.show(t("hideRapportTypeDone"), "success");
      navigate(`/office/services/${sid}`);
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }

  async function restoreTypeFromPage(typeId: number) {
    try {
      await api.restoreRapportType(token, typeId);
      await notifyHubCountsRefresh();
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
    navigate(
      officeNewDocumentPath(sid, {
        rapportTypeId: typeId,
        templateId,
        skipDefault: templateId == null && skipDefault,
      }),
    );
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
            onClick={() =>
              ENABLE_DOCUMENT_TEMPLATES
                ? setCreatePickOpen(true)
                : createDoc(activeType.id, null, true)
            }
          >
            {t("createRapport")}
          </button>
          <p className="muted small">{t("createRapportUnderTypeHint")}</p>
        </div>
      ) : null}

      {ENABLE_DOCUMENT_TEMPLATES && createPickOpen && activeType ? (
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

      {ENABLE_DOCUMENT_TEMPLATES && importFor ? (
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
                      className={`btn btn-sm ${canEdit ? 'btn-primary' : 'btn-secondary'}`}
                      to={`/office/rapports/${r.id}/document`}
                    >
                      {canEdit ? t("edit") : t("details")}
                    </Link>
                    {ENABLE_DOCUMENT_TEMPLATES &&
                    canEdit &&
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
  const { rapportId, serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const ridParam = rapportId ? Number(rapportId) : NaN;
  const sid = serviceId ? Number(serviceId) : NaN;
  const isNewDraft = !Number.isFinite(ridParam) && Number.isFinite(sid);
  const newTypeId = searchParams.get("rapport_type_id")
    ? Number(searchParams.get("rapport_type_id"))
    : undefined;
  const newTemplateId = searchParams.get("template_id")
    ? Number(searchParams.get("template_id"))
    : null;
  const newSkipDefault =
    searchParams.get("skip_default") === "1" ||
    searchParams.get("skip_default") === "true";

  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [rapport, setRapport] = useState<any>(null);
  const [persistedId, setPersistedId] = useState<number | null>(
    Number.isFinite(ridParam) ? ridParam : null,
  );
  const rid = persistedId ?? (Number.isFinite(ridParam) ? ridParam : 0);
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
  const [chefResponses, setChefResponses] = useState<any[]>([]);
  const [versions, setVersions] = useState<any[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [returningToDraft, setReturningToDraft] = useState(false);
  const [startingNewVersion, setStartingNewVersion] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingDelete, setCancellingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({});
  const [newDraftMeta, setNewDraftMeta] = useState<{
    service: any;
    rapportType: any;
  } | null>(null);
  const [loadingNew, setLoadingNew] = useState(isNewDraft);
  const createdIdRef = useRef<number | null>(
    Number.isFinite(ridParam) ? ridParam : null,
  );
  const newDraftPreviewKeyRef = useRef<string | null>(null);

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
        setChefResponses(r.rapport?.chefResponses || []);
        const dj =
          r.rapport?.currentVersion?.data_json ||
          r.rapport?.versions?.[0]?.data_json ||
          {};
        applyDocumentJson(dj);
      })
      .catch((e) => {
        // Deleted or inaccessible — leave the broken editor URL (Back after delete).
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          navigate("/office/services", { replace: true });
          return;
        }
        snack.show(t("errorGeneric"), "error");
      });
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
  }, [rid, token, snack, t, applyDocumentJson, navigate]);

  // New-draft preview only — must NOT depend on rid/loadCurrent. Assigning an id
  // during media upload must not remount the editor or re-apply empty preview JSON.
  useEffect(() => {
    if (!isNewDraft || !newTypeId || !Number.isFinite(sid)) {
      if (!isNewDraft) setLoadingNew(false);
      return;
    }
    const previewKey = `${sid}:${newTypeId}:${newTemplateId ?? ""}:${newSkipDefault ? 1 : 0}`;
    // Skip re-preview when only unstable deps (token/snack) change after first success.
    if (newDraftPreviewKeyRef.current === previewKey) return;

    let cancelled = false;
    setLoadingNew(true);
    api
      .previewDocumentCreate(token, sid, {
        rapportTypeId: newTypeId,
        templateId: newTemplateId,
        skipDefault: newSkipDefault,
      })
      .then((preview) => {
        if (cancelled) return;
        newDraftPreviewKeyRef.current = previewKey;
        setNewDraftMeta({
          service: preview.service,
          rapportType: preview.rapportType,
        });
        setTitle(preview.suggestedTitle || "");
        setCanEdit(true);
        applyDocumentJson(preview.data_json || {});
        setVersions([]);
        setWaliResponses([]);
        setChefResponses([]);
        setMediaFiles({});
      })
      .catch(() => {
        if (!cancelled) snack.show(t("errorGeneric"), "error");
      })
      .finally(() => {
        if (!cancelled) setLoadingNew(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    isNewDraft,
    newTypeId,
    newTemplateId,
    newSkipDefault,
    sid,
    token,
    snack,
    t,
    applyDocumentJson,
  ]);

  // Existing rapport URL only — never overwrite in-memory new-draft edits.
  useEffect(() => {
    if (isNewDraft) return;
    loadCurrent();
  }, [isNewDraft, loadCurrent]);

  async function ensureDocumentId(options?: {
    navigate?: boolean;
  }): Promise<number> {
    if (rid) return rid;
    if (createdIdRef.current) return createdIdRef.current;
    if (!newTypeId || !Number.isFinite(sid)) {
      throw new Error("errorGeneric");
    }
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error("rapportTitleRequired");
    }
    const { rapport: created } = await api.createDocument(token, sid, newTypeId, {
      skipDefault: true,
      title: trimmed,
      data_json: {
        rich_html_ar: docData.rich_html_ar,
        rich_html_fr: docData.rich_html_fr,
        blocks: docData.blocks,
        embedded_tables: embeddedTables,
        media_rows: mediaRows,
        calendar_events: calendarEvents,
      },
    });
    // Assign id only — do not reload/preview or replace local docData/tables/media.
    createdIdRef.current = created.id as number;
    setRapport(created);
    setPersistedId(created.id);
    if (options?.navigate !== false) {
      navigate(`/office/rapports/${created.id}/document`, { replace: true });
    }
    return created.id as number;
  }

  async function persistDocument(): Promise<number> {
    const id = await ensureDocumentId({ navigate: false });
    const patched = await patchRapportTitle(token, id, title);
    setTitle(patched.title);
    setRapport(patched.rapport);
    await api.saveDocument(token, id, {
      rich_html_ar: docData.rich_html_ar,
      rich_html_fr: docData.rich_html_fr,
      blocks: docData.blocks,
      embedded_tables: embeddedTables,
      media_rows: mediaRows,
    });
    await api.saveCalendarEvents(token, id, calendarEvents);
    if (isNewDraft) {
      navigate(`/office/rapports/${id}/document`, { replace: true });
    }
    return id;
  }

  async function saveForPreview(): Promise<void> {
    await persistDocument();
  }

  async function save() {
    setSaving(true);
    try {
      await persistDocument();
      notifyHubCountsRefresh();
      snack.show(t("save"), "success");
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
    setSubmitting(true);
    try {
      const id = await persistDocument();
      await api.submitRapport(token, id);
      await notifyHubCountsRefresh();
      snack.show(t("submitRapport"), "success");
      loadCurrent();
    } catch (e) {
      const msg =
        e instanceof Error && e.message === "rapportTitleRequired"
          ? "rapportTitleRequired"
          : "errorGeneric";
      snack.show(t(msg), "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function importTemplate(
    templateId: number,
    mode: "replace" | "append",
  ) {
    try {
      if (!rid) {
        snack.show(t("errorGeneric"), "error");
        return;
      }
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
    (isNewDraft && !persistedId
      ? true
      : !!(rapport && ["draft", "changes_requested"].includes(rapport.status)));
  const docBackPath =
    rapport?.service_id && rapport?.rapport_type_id
      ? `/office/services/${rapport.service_id}/rapports/${rapport.rapport_type_id}`
      : Number.isFinite(sid) && sid > 0 && newTypeId
        ? `/office/services/${sid}/rapports/${newTypeId}`
        : rapport?.service_id || newDraftMeta?.service?.id
          ? officeServiceHubPath(rapport?.service_id || newDraftMeta!.service.id)
          : "/office/services";

  const docRemarksVersionId = useMemo(
    () =>
      activeRemarksVersionId(rapport, versions, [
        ...chefResponses,
        ...waliResponses,
      ]),
    [rapport, versions, chefResponses, waliResponses],
  );
  const docChefResponses = useMemo(
    () => filterResponsesByVersionId(chefResponses, docRemarksVersionId),
    [chefResponses, docRemarksVersionId],
  );
  const docWaliResponses = useMemo(
    () => filterResponsesByVersionId(waliResponses, docRemarksVersionId),
    [waliResponses, docRemarksVersionId],
  );
  async function finishCurrentRapport() {
    if (!rid) return;
    setFinishing(true);
    try {
      await api.finishRapport(token, rid);
      await notifyHubCountsRefresh();
      snack.show(t("finishRapportDone"), "success");
      navigate(
        rapport?.service_id && rapport?.rapport_type_id
          ? `/office/services/${rapport.service_id}/rapports/${rapport.rapport_type_id}`
          : "/office/rapports",
        { replace: true },
      );
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setFinishing(false);
    }
  }

  async function returnCurrentToDraft() {
    if (!rid) return;
    setReturningToDraft(true);
    try {
      await api.returnRapportToDraft(token, rid);
      await notifyHubCountsRefresh();
      snack.show(t("returnToDraftDone"), "success");
      loadCurrent();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setReturningToDraft(false);
    }
  }

  async function startNewVersionFromCurrent() {
    if (!rid) return;
    setStartingNewVersion(true);
    try {
      await api.startOfficeNewVersion(token, rid);
      await notifyHubCountsRefresh();
      snack.show(t("startNewVersionDone"), "success");
      loadCurrent();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setStartingNewVersion(false);
    }
  }

  async function deleteCurrentRapport() {
    if (!rid) return;
    setDeleting(true);
    try {
      const result = await api.officeDeleteRapport(token, rid);
      await notifyHubCountsRefresh();
      if (result.mode === "requested") {
        snack.show(t("deleteRapportRequestSent"), "success");
        loadCurrent();
      } else if (result.mode === "discard_draft_version") {
        snack.show(t("deleteRapportDiscardVersionDone"), "success");
        loadCurrent();
      } else if (result.mode === "reset_fresh_v1") {
        snack.show(t("deleteRapportResetV1Done"), "success");
        loadCurrent();
      } else {
        snack.show(t("deleteRapportDone"), "success");
        const listTarget =
          rapport?.service_id && rapport?.rapport_type_id
            ? `/office/services/${rapport.service_id}/rapports/${rapport.rapport_type_id}`
            : "/office/rapports";
        navigate(listTarget, { replace: true });
      }
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setDeleting(false);
    }
  }

  async function cancelCurrentDeleteRequest() {
    if (!rid) return;
    setCancellingDelete(true);
    try {
      await api.cancelRapportDeleteRequest(token, rid);
      await notifyHubCountsRefresh();
      snack.show(t("cancelDeleteRequestDone"), "success");
      loadCurrent();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setCancellingDelete(false);
    }
  }

  if (loadingNew) {
    return (
      <div className="page">
        <p className="muted">…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={
            newDraftMeta?.rapportType
              ? localizedRapportTypeName(newDraftMeta.rapportType, i18n.language)
              : t("navRapports")
          }
        />
        {!canEdit ? <span className="badge">{t("accessView")}</span> : null}
        {rid ? (
          <RapportVersionHeaderActions
            rapportId={rid}
            rapportType={rapport?.rapportType || newDraftMeta?.rapportType}
            versions={versions}
            showSentVersion={!editable}
          />
        ) : null}
        {editable ? (
          <>
            {ENABLE_DOCUMENT_TEMPLATES && rid ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setImportPickOpen(true)}
                disabled={saving || submitting}
              >
                {t("documentTemplateImport")}
              </button>
            ) : null}
            <BusyButton
              type="button"
              className="btn btn-primary"
              onClick={save}
              busy={saving}
              busyLabel={t("saving")}
              disabled={submitting}
            >
              {t("save")}
            </BusyButton>
            <BusyButton
              type="button"
              className="btn btn-accent"
              onClick={submit}
              busy={submitting}
              busyLabel={t("submitting")}
              disabled={saving}
            >
              {t("submitRapport")}
            </BusyButton>
          </>
        ) : null}
        {rid ? (
          <OfficeRapportDeleteControls
            rapport={rapport}
            canManage={canEdit}
            deleting={deleting}
            cancelling={cancellingDelete}
            onDelete={deleteCurrentRapport}
            onCancelRequest={cancelCurrentDeleteRequest}
            size="md"
          />
        ) : null}
        {rid ? (
          <RapportExportButtons
            token={token}
            rapportId={rid}
            onPreparePreview={editable ? saveForPreview : undefined}
          />
        ) : null}
        <BackButton to={docBackPath} fallbackTo={docBackPath} />
      </div>

      <RapportOfficeStatusBanner
        rapport={rapport}
        versioningMode={rapport?.rapportType?.versioning_mode}
        editable={!!editable}
        canManage={canEdit}
        onReturnToDraft={returnCurrentToDraft}
        returning={returningToDraft}
        onStartNewVersion={startNewVersionFromCurrent}
        startingNewVersion={startingNewVersion}
        onFinish={finishCurrentRapport}
        finishing={finishing}
      />

      {editable ? (
        <RichDocumentEditor
          data={{ ...docData, embedded_tables: embeddedTables }}
          editable
          token={token}
          rapportId={rid || undefined}
          ensureRapportId={() => ensureDocumentId({ navigate: false })}
          onUploadError={(err) => {
            const msg =
              err instanceof Error && err.message === "rapportTitleRequired"
                ? "rapportTitleRequired"
                : "mediaUploadFailed";
            snack.show(t(msg), "error");
          }}
          serviceId={rapport?.service_id || newDraftMeta?.service?.id}
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
          serviceId={rapport?.service_id || newDraftMeta?.service?.id}
        />
      )}

      {editable ? (
        <MediaRowsEditor
          rows={mediaRows}
          files={mediaFiles}
          token={token}
          editable
          onChange={setMediaRows}
          onUpload={async (file, opts) => {
            const id = await ensureDocumentId({ navigate: false });
            const res = await api.uploadRapportFile(token, id, file, { onProgress: opts?.onProgress });
            setMediaFiles((prev) => ({ ...prev, [res.file.id]: res.file }));
            return res.file;
          }}
        />
      ) : rid ? (
        <MediaRowsView rows={mediaRows} files={mediaFiles} token={token} />
      ) : null}

      {ENABLE_DOCUMENT_TEMPLATES &&
      importPickOpen &&
      (rapport?.service_id || newDraftMeta?.service?.id) &&
      (rapport?.rapport_type_id || newDraftMeta?.rapportType?.id) ? (
        <DocumentTemplatePickModal
          token={token}
          serviceId={Number(rapport?.service_id || newDraftMeta?.service?.id)}
          rapportTypeId={Number(
            rapport?.rapport_type_id || newDraftMeta?.rapportType?.id,
          )}
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

      <WaliResponsesSection
        chefResponses={docChefResponses}
        responses={docWaliResponses}
      />
      {rid ? (
        <RapportDiscussionSection
          token={token}
          rapportId={rid}
          mode="office"
          enabled={isDiscussionEnabledByStatus(rapport?.status)}
          versionId={rapport?.current_version_id ?? null}
        />
      ) : null}
    </div>
  );
}

export function WaliRapportViewPage({
  token,
  audience = "wali",
}: Props & { audience?: "wali" | "admin" | "chef" }) {
  const { rapportId } = useParams();
  const rid = Number(rapportId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [view, setView] = useState<any>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);
  const [deleteDeciding, setDeleteDeciding] = useState(false);
  const location = useLocation();
  const isWali = audience === "wali";
  const isChef = audience === "chef";
  const isReviewer = isWali || isChef;
  const listBack = isChef ? "/chef/rapports" : isWali ? "/wali/rapports" : "/admin/rapports";
  const viewBackTarget = readBackTarget(location, listBack);

  const load = useCallback(async () => {
    if (!rid) return;
    try {
      setView(
        isChef
          ? await api.getChefRapportView(token, rid, showHidden)
          : isWali
            ? await api.getWaliRapportView(token, rid, showHidden)
            : await api.getAdminRapportView(token, rid, showHidden),
      );
      // Opening may move submitted → under_review; refresh badges in background.
      if (isReviewer) void notifyHubCountsRefresh();
    } catch {
      snack.show(t("errorGeneric"), "error");
    }
  }, [token, rid, showHidden, snack, t, isWali, isChef, isReviewer]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendResponse(payload: {
    decision: string;
    follow_up_status?: string;
    body_text?: string;
  }) {
    try {
      if (isChef) await api.chefRespond(token, rid, payload);
      else await api.waliRespond(token, rid, payload);
      await notifyHubCountsRefresh();
      await load();
    } catch {
      snack.show(t("errorGeneric"), "error");
      throw new Error("respond failed");
    }
  }

  async function decideDelete(decision: "approved" | "rejected") {
    setDeleteDeciding(true);
    try {
      const result = await api.chefDeleteDecision(token, rid, decision);
      await notifyHubCountsRefresh();
      if (decision === "rejected") {
        snack.show(t("chefRejectDeleteDone"), "success");
        await load();
      } else if (result.mode === "restored_previous") {
        snack.show(t("chefDeleteRestoredPreviousDone"), "success");
        await load();
      } else {
        snack.show(t("chefDeleteFullyDone"), "success");
        navigate("/chef/rapports?status_group=delete_requested");
      }
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setDeleteDeciding(false);
    }
  }

  const columns: Column[] = view?.schema?.columns || [];
  const layoutJson: LayoutJson | null = view?.schema?.layout_json || null;
  const tableMeta: TableMeta = view?.tableMeta || {};
  const waliResponses = view?.waliResponses || [];
  const chefResponses = view?.chefResponses || view?.rapport?.chefResponses || [];
  const viewRemarksVersionId = useMemo(
    () =>
      activeRemarksVersionId(view?.rapport, view?.versions || [], [
        ...chefResponses,
        ...waliResponses,
      ]),
    [view?.rapport, view?.versions, chefResponses, waliResponses],
  );
  const scopedChefResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        chefResponses as ReviewResponseRow[],
        viewRemarksVersionId,
      ),
    [chefResponses, viewRemarksVersionId],
  );
  const scopedWaliResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        waliResponses as ReviewResponseRow[],
        viewRemarksVersionId,
      ),
    [waliResponses, viewRemarksVersionId],
  );
  const documentDataJson =
    view?.rapport?.currentVersion?.data_json ||
    (view?.rapport?.versions || []).find(
      (v: { id?: number }) => Number(v.id) === Number(view?.rapport?.current_version_id),
    )?.data_json ||
    {};
  const documentViewData = {
    rich_html_ar: documentDataJson.rich_html_ar,
    rich_html_fr: documentDataJson.rich_html_fr,
    blocks: view?.blocks?.length ? view.blocks : documentDataJson.blocks,
    embedded_tables: documentDataJson.embedded_tables,
  };
  const documentMediaRows = view?.media_rows ?? documentDataJson.media_rows ?? [];

  return (
    <div className="page">
      <div className="pageHeader row">
        <h1>{view?.rapport?.title || t("navInbox")}</h1>
        <div className="pageHeaderActions">
          {supportsRapportVersionArchive(
            view?.rapport?.rapportType,
            view?.versions || [],
          ) ? (
            isChef ? (
              <ChefArchiveVersionsLink rapportId={rid} />
            ) : isWali ? (
              <WaliArchiveVersionsLink rapportId={rid} />
            ) : (
              <ArchiveVersionsLink rapportId={rid} />
            )
          ) : null}
          {isReviewer &&
          (isChef
            ? view?.rapport?.status === "pending_chef"
            : ["submitted", "under_review"].includes(view?.rapport?.status)) ? (
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
            chef={isChef}
            showHidden={showHidden}
          />
          <BackButton fallbackTo={viewBackTarget} />
        </div>
      </div>

      {isChef ? (
        <ChefDeleteRequestBanner
          rapport={view?.rapport}
          deleting={deleteDeciding}
          onDecide={decideDelete}
        />
      ) : null}

      {view?.content_kind === "table_grid" ? (
        <div className="card tableWrap excelTable">
          <TableTitleBlock tableMeta={tableMeta} editable={false} />
          <TableGridView
            columns={columns}
            rows={view.rows || []}
            layoutJson={layoutJson}
            tableMeta={tableMeta}
            editable={false}
            showRowMeta
            rowFilterMode="active"
          />
          <MediaRowsView
            rows={view.media_rows || []}
            files={view.files || {}}
            token={token}
          />
        </div>
      ) : view?.content_kind === "commune_list" ? (
        <CommuneListVersionView
          token={token}
          serviceId={view?.rapport?.service_id}
          entities={
            view.entities?.length
              ? view.entities
              : [
                  ...(view.municipalities || []),
                  ...(view.dairas || []),
                  ...(view.directions || []),
                ]
          }
          entitiesData={view.entitiesData}
          communes={view.communes}
          schema={view.schema}
          files={view.files || {}}
          communeContentKind={view.rapport?.rapportType?.commune_content_kind}
          targetKinds={view.rapport?.rapportType?.entity_target_kinds}
          tableTitle={view?.rapport?.title}
        />
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

      {isReviewer ? (
        <WaliResponsesSection
          chefResponses={scopedChefResponses}
          responses={scopedWaliResponses}
        />
      ) : null}

      {isReviewer && rid ? (
        <RapportDiscussionSection
          token={token}
          rapportId={rid}
          mode={isChef ? "chef" : "wali"}
          enabled={isDiscussionEnabledByStatus(view?.rapport?.status)}
          versionId={view?.rapport?.current_version_id ?? null}
        />
      ) : null}

      {isReviewer ? (
        <WaliRespondModal
          open={respondOpen}
          onClose={() => setRespondOpen(false)}
          onSubmit={sendResponse}
          mode={isChef ? "chef" : "wali"}
        />
      ) : null}
    </div>
  );
}

export function OfficeFichesPage({ token }: Props) {
  return <OfficeDocumentsPage token={token} contentKind="fiche_lecture" />;
}
