import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ApiError } from "../api";
import { BackButton } from "../components/BackButton";
import {
  RapportTitleField,
  patchRapportTitle,
} from "../components/RapportTitleField";
import { RapportVersionHeaderActions } from "../components/RapportVersionHeaderActions";
import { RapportOfficeStatusBanner } from "../components/RapportOfficeStatusBanner";
import { TableMergeToolbar, TableWorkspace } from "../components/TableGridView";
import { CommuneBulkAddRowBar } from "../components/CommuneBulkAddRowBar";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { markOfficeRapportOpened } from "../utils/officeRapportList";
import { notifyHubCountsRefresh } from "../utils/hubCountsRefresh";
import {
  COMMUNE_NAME_COL_KEY,
  buildEmptyCommuneRow,
  rowEntityKey,
  rowsWithCommuneNames,
  sortRowsByCommune,
  stripCommuneDisplayFields,
  withCommuneNameColumn,
} from "../utils/communeBulkTable";
import { countFinishedRows, type TableRowFilterMode } from "../utils/tableRowMeta";
import { reorderRowsArray } from "../utils/tableRowReorder";
import type { TableMeta } from "../utils/tableLayout";

type Props = { token: string };

function entityKeyOfSummary(m: { entity_key?: string; kind?: string; code: string }) {
  return m.entity_key || `${m.kind || "commune"}:${m.code}`;
}

export function OfficeCommuneBulkEditorPage({ token }: Props) {
  const { serviceId } = useParams();
  const [searchParams] = useSearchParams();
  const rapportTypeId = searchParams.get("rapport_type_id")
    ? Number(searchParams.get("rapport_type_id"))
    : undefined;
  const rapportIdParam = searchParams.get("rapport_id")
    ? Number(searchParams.get("rapport_id"))
    : undefined;
  const sid = Number(serviceId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const [workspace, setWorkspace] = useState<any>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [tableMeta, setTableMeta] = useState<TableMeta>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [versions, setVersions] = useState<any[]>([]);
  const [rowFilterMode, setRowFilterMode] = useState<TableRowFilterMode>("active");
  const [addRowEntityKey, setAddRowEntityKey] = useState("");
  const [returningToDraft, setReturningToDraft] = useState(false);
  const keysPresentAtLoadRef = useRef<Set<string>>(new Set());

  const listPath = `/office/services/${sid}/communes${
    rapportTypeId || rapportIdParam
      ? `?${new URLSearchParams({
          ...(rapportTypeId ? { rapport_type_id: String(rapportTypeId) } : {}),
          ...(rapportIdParam ? { rapport_id: String(rapportIdParam) } : {}),
        }).toString()}`
      : ""
  }`;

  const bulkEntities = useMemo(() => {
    if (!workspace) return [];
    return [
      ...(workspace.municipalities || []),
      ...(workspace.dairas || []),
      ...(workspace.directions || []),
    ];
  }, [workspace]);

  const applyTableData = useCallback((tableData: any, entities: any[]) => {
    const table = tableData?.tables?.[0] || {};
    const sorted = sortRowsByCommune(table.rows || []);
    setRows(sorted);
    keysPresentAtLoadRef.current = new Set(
      sorted.map((r) => rowEntityKey(r)).filter(Boolean),
    );
    setTableMeta({
      title_ar: table.title_ar,
      title_fr: table.title_fr,
      subtitle_ar: table.subtitle_ar,
      subtitle_fr: table.subtitle_fr,
      merge_column_keys: table.merge_column_keys || [],
    });
    if (entities?.length) {
      const firstKey = entityKeyOfSummary(entities[0]);
      setAddRowEntityKey((prev) => prev || firstKey);
    }
  }, []);

  const load = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ws = await api.getCommuneBulkWorkspace(token, sid, {
        rapportTypeId,
        rapportId: rapportIdParam,
      });
      setWorkspace(ws);
      const entities = [
        ...(ws.municipalities || []),
        ...(ws.dairas || []),
        ...(ws.directions || []),
      ];
      applyTableData(ws.tableData, entities);
      setTitle(ws.rapport?.title || ws.suggestedTitle || "");
      if (ws.rapport?.id) {
        void markOfficeRapportOpened(token, ws.rapport.id);
        const vRes = await api.listRapportVersions(token, ws.rapport.id);
        setVersions(vRes.versions);
      } else {
        setVersions([]);
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "errorGeneric";
      setLoadError(msg);
      snack.show(t(msg, { defaultValue: t("errorGeneric") }), "error");
    } finally {
      setLoading(false);
    }
  }, [token, sid, rapportTypeId, rapportIdParam, snack, t, applyTableData]);

  useEffect(() => {
    load();
  }, [load]);

  async function ensureCommuneRapportId(): Promise<number> {
    if (workspace?.rapport?.id) return workspace.rapport.id;
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
    setWorkspace((prev: any) => (prev ? { ...prev, rapport } : prev));
    return rapport.id as number;
  }

  async function save() {
    if (!workspace?.editable) return;
    setSaving(true);
    try {
      const rid = await ensureCommuneRapportId();
      const patched = await patchRapportTitle(token, rid, title);
      setTitle(patched.title);
      const cleanedRows = rows.map(stripCommuneDisplayFields);
      const currentKeys = new Set(
        cleanedRows.map((r) => rowEntityKey(r)).filter(Boolean),
      );
      const cleared_entity_keys = [...keysPresentAtLoadRef.current].filter(
        (k) => !currentKeys.has(k),
      );
      await api.saveCommuneBulkData(token, rid, {
        tables: [
          {
            key: "bulk",
            rows: cleanedRows,
            ...tableMeta,
          },
        ],
        cleared_entity_keys,
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
    if (key === COMMUNE_NAME_COL_KEY) return;
    setRows((prev) =>
      prev.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)),
    );
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

  function addRowForEntity(entityKey: string) {
    const entity = bulkEntities.find(
      (m: any) => entityKeyOfSummary(m) === entityKey,
    );
    if (!entity) return;
    const template = rows.find((r) => rowEntityKey(r) === entityKey);
    setRows((prev) => {
      const next = [...prev];
      const insertAt =
        next.reduce(
          (last, r, i) => (rowEntityKey(r) === entityKey ? i : last),
          -1,
        ) + 1;
      const newRow = buildEmptyCommuneRow(entity, template);
      if (insertAt > 0) next.splice(insertAt, 0, newRow);
      else next.push(newRow);
      return sortRowsByCommune(next);
    });
  }

  function addRowForAllEntities() {
    setRows((prev) => {
      const present = new Set(prev.map((r) => rowEntityKey(r)).filter(Boolean));
      const next = [...prev];
      for (const entity of bulkEntities) {
        const key = entityKeyOfSummary(entity);
        if (present.has(key)) continue;
        next.push(buildEmptyCommuneRow(entity));
        present.add(key);
      }
      return sortRowsByCommune(next);
    });
  }

  function deleteRow(rowIdx: number) {
    setRows((prev) => prev.filter((_, i) => i !== rowIdx));
  }

  function reorderRow(fromIdx: number, toIdx: number) {
    setRows((prev) => reorderRowsArray(prev, fromIdx, toIdx));
  }

  const editable = workspace?.editable === true;
  const columns = withCommuneNameColumn(workspace?.schema?.columns || []);
  const displayRows = rowsWithCommuneNames(rows, i18n.language);
  const finishedRowCount = countFinishedRows(rows);
  const mergeKeys = tableMeta.merge_column_keys || [];
  const rowCountsByKey = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const key = rowEntityKey(r);
      if (!key) continue;
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [rows]);

  const canAddAll = useMemo(() => {
    if (!bulkEntities.length) return false;
    return bulkEntities.some(
      (e: any) => !(rowCountsByKey[entityKeyOfSummary(e)] > 0),
    );
  }, [bulkEntities, rowCountsByKey]);

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

  return (
    <div className="page communeBulkEditorPage">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={editable}
          fallback={t("bulkEntry")}
        />
        <div className="pageHeaderActions">
          {workspace?.rapport?.id ? (
            <RapportVersionHeaderActions
              rapportId={workspace.rapport.id}
              rapportType={workspace.rapportType}
              versions={versions}
              showSentVersion={!editable}
            />
          ) : null}
          {editable ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {t("save")}
            </button>
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
        </div>
      ) : null}

      {!loading && !loadError && workspace?.schema ? (
        <>
          <RapportOfficeStatusBanner
            rapport={workspace.rapport}
            editable={editable}
            canManage={workspace?.accessLevel === "manage"}
            onReturnToDraft={returnCurrentToDraft}
            returning={returningToDraft}
          />

          {editable ? (
            <CommuneBulkAddRowBar
              entities={bulkEntities}
              rowCountsByKey={rowCountsByKey}
              selectedKey={addRowEntityKey}
              onSelectKey={setAddRowEntityKey}
              onAddRow={() => addRowForEntity(addRowEntityKey)}
              onAddAllRows={addRowForAllEntities}
              canAddAll={canAddAll}
            />
          ) : null}

          <TableWorkspace
            columns={columns}
            rows={displayRows}
            layoutJson={workspace.schema.layout_json}
            tableMeta={tableMeta}
            editable={editable}
            showRowMeta
            onUpdateRow={updateRow}
            onSetAllWaliVisible={setAllWaliVisible}
            onUpdateCellColor={updateCellColor}
            onDeleteRow={editable ? deleteRow : undefined}
            onReorderRows={editable ? reorderRow : undefined}
            reorderScope="commune"
            rowCount={rows.length}
            finishedCount={finishedRowCount}
            filterMode={rowFilterMode}
            onFilterModeChange={setRowFilterMode}
          />

          <TableMergeToolbar
            columns={workspace.schema.columns}
            mergeKeys={mergeKeys}
            editable={editable}
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
      ) : null}
    </div>
  );
}
