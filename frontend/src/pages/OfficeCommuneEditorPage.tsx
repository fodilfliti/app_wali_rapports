import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ApiError } from "../api";
import { BackButton } from "../components/BackButton";
import {
  CalendarEventsEditor,
  type CalendarEvent,
} from "../components/CalendarEventsEditor";
import {
  RapportTitleField,
  patchRapportTitle,
} from "../components/RapportTitleField";
import { RichDocumentEditor } from "../components/RichDocumentEditor";
import { TableMergeToolbar, TableWorkspace } from "../components/TableGridView";
import { RapportVersionHeaderActions } from "../components/RapportVersionHeaderActions";
import { RapportOfficeStatusBanner } from "../components/RapportOfficeStatusBanner";
import { OfficeRapportDeleteControls } from "../components/RapportDeleteControls";
import { useSnackbar } from "../snackbar/SnackbarContext";
import type { EmbeddedTable } from "../types/embeddedTable";
import { mergeRichHtmlIntoData } from "../utils/richDocument";
import { markOfficeRapportOpened } from "../utils/officeRapportList";
import { notifyHubCountsRefresh } from "../utils/hubCountsRefresh";
import type { MediaFile, MediaRow } from "../utils/media";
import { MediaRowsEditor, MediaRowsView } from "../components/MediaBlocks";
import { countFinishedRows, type TableRowFilterMode } from "../utils/tableRowMeta";
import { reorderRowsArray } from "../utils/tableRowReorder";
import type { TableMeta } from "../utils/tableLayout";

type Props = { token: string };

type CommuneContent = {
  rich_html_ar?: string;
  rich_html_fr?: string;
  blocks?: any[];
  embedded_tables?: EmbeddedTable[];
  calendar_events?: CalendarEvent[];
  media_rows?: MediaRow[];
};

export function OfficeCommuneEditorPage({ token }: Props) {
  const { serviceId, municipalityCode } = useParams();
  const [searchParams] = useSearchParams();
  const rapportTypeId = searchParams.get("rapport_type_id")
    ? Number(searchParams.get("rapport_type_id"))
    : undefined;
  const rapportIdParam = searchParams.get("rapport_id")
    ? Number(searchParams.get("rapport_id"))
    : undefined;
  const sid = Number(serviceId);
  const code = municipalityCode || "";
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const navigate = useNavigate();
  const [workspace, setWorkspace] = useState<any>(null);
  const [content, setContent] = useState<CommuneContent>({});
  const [embeddedTables, setEmbeddedTables] = useState<EmbeddedTable[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [municipality, setMunicipality] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [editable, setEditable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<any[]>([]);
  const [rowFilterMode, setRowFilterMode] = useState<TableRowFilterMode>("active");
  const [tableMeta, setTableMeta] = useState<TableMeta>({});
  const [mediaRows, setMediaRows] = useState<MediaRow[]>([]);
  const [mediaFiles, setMediaFiles] = useState<Record<number, MediaFile>>({});
  const [returningToDraft, setReturningToDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cancellingDelete, setCancellingDelete] = useState(false);
  const createdIdRef = useRef<number | null>(
    Number.isFinite(rapportIdParam) ? (rapportIdParam as number) : null,
  );

  const listPath = `/office/services/${sid}/communes${
    rapportTypeId || rapportIdParam
      ? `?${new URLSearchParams({
          ...(rapportTypeId ? { rapport_type_id: String(rapportTypeId) } : {}),
          ...(rapportIdParam ? { rapport_id: String(rapportIdParam) } : {}),
        }).toString()}`
      : ""
  }`;
  const rapportId = workspace?.rapport?.id as number | undefined;

  const load = useCallback(async () => {
    if (!sid || !code) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ws = await api.getCommuneWorkspace(token, sid, {
        rapportTypeId,
        rapportId: rapportIdParam,
      });
      setWorkspace(ws);
      setTitle(ws.rapport?.title || ws.suggestedTitle || "");
      setEditable(ws.editable === true);

      const entity =
        (ws.entities || []).find(
          (e: any) =>
            e.entity_key === code ||
            e.code === code ||
            `commune:${e.code}` === code,
        ) || null;
      setMunicipality(
        entity || {
          code,
          name_ar: code,
          name_fr: code,
        },
      );

      if (!ws.rapport?.id) {
        setVersions([]);
        setContent({ rich_html_ar: "", rich_html_fr: "" });
        setEmbeddedTables([]);
        setCalendarEvents([]);
        setMediaRows([]);
        setMediaFiles({});
        const cols = ws.schema?.columns || [];
        if (ws.rapportType?.commune_content_kind === "table" && cols.length) {
          setRows(
            cols.length
              ? [
                  {
                    municipality_code: entity?.code || code,
                    _highlight: "none",
                    _row_finished: false,
                    _wali_visible: true,
                    _cell_colors: {},
                    ...Object.fromEntries(
                      cols.map((c: any) => [
                        c.key,
                        c.type === "number" || c.type === "formula" ? null : "",
                      ]),
                    ),
                  },
                ]
              : [],
          );
        } else {
          setRows([]);
        }
        return;
      }

      void markOfficeRapportOpened(token, ws.rapport.id);
      const vRes = await api.listRapportVersions(token, ws.rapport.id);
      setVersions(vRes.versions);
      const detail = await api.getCommuneRows(token, ws.rapport.id, code);
      setMunicipality(detail.municipality);
      const tables = detail.embedded_tables || [];
      setContent({
        rich_html_ar: detail.rich_html_ar,
        rich_html_fr: detail.rich_html_fr,
        blocks: detail.blocks,
        embedded_tables: tables,
      });
      setEmbeddedTables(tables);
      setCalendarEvents(detail.calendar_events || []);
      setMediaRows(detail.media_rows || []);
      setRows(detail.rows || []);
      setEditable(detail.editable === true);
      api
        .getRapportMediaFiles(token, ws.rapport.id)
        .then((r) => setMediaFiles(r.files || {}))
        .catch(() => {});
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      setLoadError(msg);
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setLoading(false);
    }
  }, [token, sid, code, rapportTypeId, rapportIdParam, snack, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function ensureCommuneRapportId(): Promise<number> {
    if (workspace?.rapport?.id) return workspace.rapport.id;
    if (createdIdRef.current) return createdIdRef.current;
    if (!workspace?.rapportType?.id) {
      throw new Error("errorGeneric");
    }
    const trimmed = title.trim();
    if (!trimmed) {
      throw new Error("rapportTitleRequired");
    }
    const data_json: Record<string, unknown> = {
      communes: {},
      entities: {},
    };
    if (workspace.included_entity_keys?.length) {
      data_json.included_entity_keys = workspace.included_entity_keys;
    }
    const { rapport } = await api.createRapport(token, {
      service_id: Number(sid),
      rapport_type_id: Number(workspace.rapportType.id),
      title: trimmed,
      data_json,
    });
    createdIdRef.current = rapport.id as number;
    setWorkspace((prev: any) => (prev ? { ...prev, rapport } : prev));
    return rapport.id as number;
  }

  async function save() {
    if (!code || !editable) return;
    setSaving(true);
    try {
      const rid = await ensureCommuneRapportId();
      const patched = await patchRapportTitle(token, rid, title);
      setTitle(patched.title);
      await api.saveCommuneData(token, rid, {
        municipality_code: code,
        rich_html_ar: content.rich_html_ar,
        rich_html_fr: content.rich_html_fr,
        embedded_tables: embeddedTables,
        calendar_events: calendarEvents,
        media_rows: mediaRows,
        rows: rows,
      });
      notifyHubCountsRefresh();
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

  function updateRow(rowIdx: number, key: string, value: unknown) {
    setRows((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }

  function updateCellColor(rowIdx: number, colKey: string, color: string | null) {
    setRows((prev) =>
      prev.map((r, i) => {
        if (i !== rowIdx) return r;
        const cellColors = { ...((r._cell_colors as Record<string, string>) || {}) };
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
    setRows((prev) => {
      const template = prev[prev.length - 1] || {
        _highlight: "none",
        _row_finished: false,
        _wali_visible: true,
        _cell_colors: {},
        municipality_code: code,
      };
      const newRow = { ...template };
      Object.keys(newRow).forEach((k) => {
        if (!k.startsWith("_") && k !== "municipality_code") newRow[k] = null;
      });
      return [...prev, newRow];
    });
  }

  function deleteRow(rowIdx: number) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== rowIdx)));
  }

  function reorderRow(fromIdx: number, toIdx: number) {
    setRows((prev) => reorderRowsArray(prev, fromIdx, toIdx));
  }

  const communeName = municipality
    ? i18n.language === "fr"
      ? municipality.name_fr || municipality.name_ar || municipality
      : municipality.name_ar || municipality.name_fr || municipality
    : code;

  const isEditable = editable;
  const finishedRowCount = countFinishedRows(rows);
  const mergeKeys = tableMeta.merge_column_keys || [];

  async function returnCurrentToDraft() {
    if (!rapportId) return;
    setReturningToDraft(true);
    try {
      await api.returnRapportToDraft(token, rapportId);
      await notifyHubCountsRefresh();
      snack.show(t("returnToDraftDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setReturningToDraft(false);
    }
  }

  async function deleteCurrentRapport() {
    if (!rapportId) return;
    setDeleting(true);
    try {
      const result = await api.officeDeleteRapport(token, rapportId);
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
        navigate(
          rapportTypeId
            ? `/office/services/${sid}/rapports/${rapportTypeId}`
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
    if (!rapportId) return;
    setCancellingDelete(true);
    try {
      await api.cancelRapportDeleteRequest(token, rapportId);
      await notifyHubCountsRefresh();
      snack.show(t("cancelDeleteRequestDone"), "success");
      load();
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setCancellingDelete(false);
    }
  }

  return (
    <div className="page communeEditorPage">
      <div className="pageHeader row compact communeEditorHeader">
        <div className="communeEditorHeaderTitles">
          <RapportTitleField
            title={title}
            onChange={setTitle}
            editable={isEditable}
            fallback={communeName || t("navRapports")}
          />
          <p className="muted small communeEditorCommuneLabel">{communeName}</p>
        </div>
        <div className="pageHeaderActions">
          {rapportId ? (
            <RapportVersionHeaderActions
              rapportId={rapportId}
              rapportType={workspace?.rapportType}
              versions={versions}
              showSentVersion={!isEditable}
            />
          ) : null}
          {isEditable ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={save}
              disabled={saving}
            >
              {t("save")}
            </button>
          ) : null}
          {rapportId && workspace?.rapport ? (
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
          {workspace?.accessLevel === "view" ? (
            <span className="badge">{t("accessView")}</span>
          ) : null}
          <BackButton fallbackTo={listPath} />
        </div>
      </div>

      {loading ? <p className="muted communeStatus">{t("loading")}</p> : null}
      {loadError ? (
        <div className="communeError card">
          <p>{t(loadError, { defaultValue: t("errorGeneric") })}</p>
          {loadError === "tableSchemaNotConfigured" ? (
            <Link className="btn btn-primary" to={`/office/services/${sid}/config`}>
              {t("goToServiceConfig")}
            </Link>
          ) : null}
        </div>
      ) : null}

      {!loading && !loadError && workspace ? (
        <>
          <RapportOfficeStatusBanner
            rapport={workspace?.rapport}
            editable={isEditable}
            canManage={workspace?.accessLevel === "manage"}
            onReturnToDraft={returnCurrentToDraft}
            returning={returningToDraft}
          />

          {workspace?.rapportType?.commune_content_kind === "table" ? (
            <>
              <TableWorkspace
                columns={workspace.schema?.columns || []}
                rows={rows}
                layoutJson={workspace.schema?.layout_json}
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
                columns={workspace.schema?.columns || []}
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
            </>
          ) : (
            <RichDocumentEditor
              data={{ ...content, embedded_tables: embeddedTables }}
              editable={isEditable}
              token={token}
              rapportId={rapportId}
              ensureRapportId={ensureCommuneRapportId}
              onUploadError={(err) => {
                const msg =
                  err instanceof Error && err.message === "rapportTitleRequired"
                    ? "rapportTitleRequired"
                    : "mediaUploadFailed";
                snack.show(t(msg), "error");
              }}
              serviceId={sid}
              onEmbeddedTablesChange={setEmbeddedTables}
              onChange={(locale, html) =>
                setContent(
                  (prev) =>
                    mergeRichHtmlIntoData(prev, locale, html) as CommuneContent,
                )
              }
            />
          )}
          {workspace?.rapportType?.commune_content_kind !== "table" ? (
            isEditable ? (
              <MediaRowsEditor
                rows={mediaRows}
                files={mediaFiles}
                token={token}
                editable
                onChange={setMediaRows}
                onUpload={async (file, opts) => {
                  const id = await ensureCommuneRapportId();
                  const res = await api.uploadRapportFile(token, id, file, { onProgress: opts?.onProgress });
                  setMediaFiles((prev) => ({ ...prev, [res.file.id]: res.file }));
                  return res.file;
                }}
              />
            ) : (
              <MediaRowsView rows={mediaRows} files={mediaFiles} token={token} />
            )
          ) : null}
          <CalendarEventsEditor
            events={calendarEvents}
            editable={isEditable}
            onChange={setCalendarEvents}
          />
        </>
      ) : null}
    </div>
  );
}
