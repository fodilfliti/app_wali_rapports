import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { BackButton } from "../components/BackButton";
import {
  TableTitleBlock,
  TableWorkspace,
} from "../components/TableGridView";
import { RichDocumentView } from "../components/RichDocumentEditor";
import { MediaRowsView } from "../components/MediaBlocks";
import { CalendarEventsView } from "../components/CalendarEventsEditor";
import { WaliResponsesSection } from "../components/WaliResponsesSection";
import {
  RapportDiscussionSection,
  isDiscussionEnabledByStatus,
} from "../components/RapportDiscussionSection";
import { useSnackbar } from "../snackbar/SnackbarContext";
import {
  rowsWithCommuneNames,
  sortRowsByCommune,
  withCommuneNameColumn,
} from "../utils/communeBulkTable";
import type { TableMeta } from "../utils/tableLayout";
import { versionsListPath } from "../utils/rapportVersionsNav";
import { RapportExportButtons } from "../components/ExportPdfButton";
import { RapportCreatedBy } from "../components/RapportCreatedBy";
import {
  CommuneListVersionView,
  type VersionEntityMeta,
} from "../components/CommuneListVersionView";
import type { MediaFile } from "../utils/media";
import {
  ensureEntitiesMap,
  entityKey,
  getEntitiesMap,
  getEntityEntry,
  parseEntityKey,
} from "../utils/entityKeys";
import type { EntityTargetKind } from "../utils/entityTargets";
import { filterResponsesByVersionId } from "../utils/reviewResponses";
import { entityIdsEqual } from "../utils/entityIds";
import { countFinishedRows } from "../utils/tableRowMeta";

type DetailProps = {
  token: string;
  wali?: boolean;
  chef?: boolean;
};

type EntityCatalogItem = VersionEntityMeta & {
  entity_key: string;
  kind: EntityTargetKind | string;
};

function catalogFromWorkspace(ws: any): EntityCatalogItem[] {
  const list: any[] = ws?.entities?.length
    ? ws.entities
    : [
        ...(ws?.municipalities || []),
        ...(ws?.dairas || []),
        ...(ws?.directions || []),
      ];
  return list.map((m: any) => {
    const kind = (m.kind as EntityTargetKind) || "commune";
    const code = String(m.code);
    const key = m.entity_key || entityKey(kind, code);
    return {
      entity_key: key,
      kind,
      code,
      name_ar: m.name_ar,
      name_fr: m.name_fr,
      is_changed: m.is_changed,
    };
  });
}

function catalogFromViewRes(viewRes: any): EntityCatalogItem[] {
  if (viewRes?.entities?.length) return catalogFromWorkspace(viewRes);
  return catalogFromWorkspace({
    municipalities: viewRes?.municipalities,
    dairas: viewRes?.dairas,
    directions: viewRes?.directions,
  });
}

function snapshotEntityMaps(dataJson: any) {
  const normalized = ensureEntitiesMap(dataJson || {});
  return {
    entitiesData: (normalized.entities || {}) as Record<string, any>,
    communes: (normalized.communes || {}) as Record<string, any>,
  };
}

function documentHasContent(data: any) {
  if (!data) return false;
  if (data.rich_html_ar || data.rich_html_fr) return true;
  if (Array.isArray(data.blocks) && data.blocks.length) return true;
  if (Array.isArray(data.embedded_tables) && data.embedded_tables.length) {
    return true;
  }
  return false;
}

export function RapportVersionDetail({
  token,
  wali = false,
  chef = false,
}: DetailProps) {
  const { rapportId, versionId } = useParams();
  const rid = rapportId ?? "";
  const vid = versionId ?? "";
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const [rapport, setRapport] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [entityCatalog, setEntityCatalog] = useState<EntityCatalogItem[]>([]);
  const [communeVersionView, setCommuneVersionView] = useState<{
    entities: EntityCatalogItem[];
    entitiesData: Record<string, any>;
    communes: Record<string, any>;
    schema?: { columns?: any[]; layout_json?: any } | null;
    files?: Record<string, MediaFile>;
  } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<Record<string, MediaFile>>({});
  const [loading, setLoading] = useState(true);

  const archiveListPath = versionsListPath(rid, wali, chef);

  useEffect(() => {
    if (!rid || !vid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rRes, vRes] = await Promise.all([
          chef
            ? api.getChefRapportView(token, rid, false)
            : wali
              ? api.getWaliRapportView(token, rid, false)
              : api.getRapport(token, rid),
          chef
            ? api.getChefRapportVersion(token, rid, vid)
            : wali
              ? api.getWaliRapportVersion(token, rid, vid)
              : api.getRapportVersion(token, rid, vid),
        ]);
        if (cancelled) return;
        setRapport(rRes.rapport);
        setVersion(vRes.version);
        const kind = rRes.rapport?.rapportType?.content_kind;
        const communeKind = rRes.rapport?.rapportType?.commune_content_kind;
        const snap = vRes.version?.data_json?.schema_snapshot;
        const maps = snapshotEntityMaps(vRes.version?.data_json);
        setCommuneVersionView(null);
        setEntityCatalog([]);
        setMediaFiles({});

        if (
          kind === "document_compose" ||
          kind === "fiche_lecture" ||
          kind === "table_grid"
        ) {
          try {
            if (wali || chef) {
              const viewRes = chef
                ? await api.getChefRapportView(token, rid, false, vid)
                : await api.getWaliRapportView(token, rid, false, vid);
              if (!cancelled) setMediaFiles(viewRes.files || {});
            } else {
              const mediaRes = await api
                .getRapportMediaFiles(token, rid)
                .catch(() => ({ files: {} }));
              if (!cancelled) setMediaFiles(mediaRes.files || {});
            }
          } catch {
            if (!cancelled) setMediaFiles({});
          }
        }

        if (
          kind === "commune_list" &&
          communeKind !== "table" &&
          rRes.rapport?.service_id
        ) {
          if (wali || chef) {
            try {
              const viewRes = chef
                ? await api.getChefRapportView(token, rid, false, vid)
                : await api.getWaliRapportView(token, rid, false, vid);
              if (!cancelled) {
                const viewMaps = snapshotEntityMaps({
                  entities:
                    viewRes.entitiesData ||
                    viewRes.entities_map ||
                    undefined,
                  communes: viewRes.communes,
                });
                const entitiesData =
                  Object.keys(maps.entitiesData).length > 0
                    ? maps.entitiesData
                    : viewMaps.entitiesData;
                const communes =
                  Object.keys(maps.communes).length > 0
                    ? maps.communes
                    : viewMaps.communes;
                setCommuneVersionView({
                  entities: catalogFromViewRes(viewRes),
                  entitiesData,
                  communes,
                  schema: viewRes.schema,
                  files: viewRes.files || {},
                });
              }
            } catch {
              if (!cancelled) {
                setCommuneVersionView({
                  entities: [],
                  entitiesData: maps.entitiesData,
                  communes: maps.communes,
                  files: {},
                });
              }
            }
          } else {
            try {
              const [ws, mediaRes] = await Promise.all([
                api.getCommuneWorkspace(token, rRes.rapport.service_id, {
                  rapportId: rid,
                }),
                api.getRapportMediaFiles(token, rid).catch(() => ({ files: {} })),
              ]);
              if (!cancelled) {
                setCommuneVersionView({
                  entities: catalogFromWorkspace(ws),
                  entitiesData: maps.entitiesData,
                  communes: maps.communes,
                  schema: ws.schema,
                  files: mediaRes.files || {},
                });
              }
            } catch {
              if (!cancelled) {
                setCommuneVersionView({
                  entities: [],
                  entitiesData: maps.entitiesData,
                  communes: maps.communes,
                  files: {},
                });
              }
            }
          }
        } else if (kind === "table_grid") {
          if (snap && !cancelled) {
            setSchema(snap);
          } else if (rRes.rapport?.service_id) {
            try {
              const ws = await api.getTableWorkspace(token, rRes.rapport.service_id, {
                rapportId: rid,
              });
              if (!cancelled) setSchema(ws.schema);
            } catch {
              /* optional schema */
            }
          }
        } else if (
          kind === "commune_list" &&
          communeKind === "table" &&
          rRes.rapport?.service_id
        ) {
          try {
            if (wali || chef) {
              const viewRes = chef
                ? await api.getChefRapportView(token, rid, false, vid)
                : await api.getWaliRapportView(token, rid, false, vid);
              if (!cancelled) {
                setSchema(viewRes.schema);
                setEntityCatalog(catalogFromViewRes(viewRes));
              }
            } else {
              const ws = await api.getCommuneWorkspace(token, rRes.rapport.service_id, {
                rapportId: rid,
              });
              if (!cancelled) {
                setSchema(ws.schema);
                setEntityCatalog(catalogFromWorkspace(ws));
              }
            }
          } catch {
            /* optional schema */
          }
        }
      } catch {
        if (!cancelled) snack.show(t("errorGeneric"), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rid, vid, token, wali, chef, snack, t]);

  const kind = rapport?.rapportType?.content_kind;
  const data = version?.data_json || {};

  const versionWaliResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        [
          ...(version?.waliResponses || []),
          ...(rapport?.waliResponses || []),
        ].filter(
          (r, i, arr) => arr.findIndex((x) => entityIdsEqual(x.id, r.id)) === i,
        ),
        vid,
      ),
    [version?.waliResponses, rapport?.waliResponses, vid],
  );

  const versionChefResponses = useMemo(
    () =>
      filterResponsesByVersionId(
        [
          ...(version?.chefResponses || []),
          ...(rapport?.chefResponses || []),
        ].filter(
          (r, i, arr) => arr.findIndex((x) => entityIdsEqual(x.id, r.id)) === i,
        ),
        vid,
      ),
    [version?.chefResponses, rapport?.chefResponses, vid],
  );
  const tableContent = useMemo(() => {
    if (kind === "table_grid") {
      const table = data.tables?.[0] || {};
      const snap = data.schema_snapshot;
      const columns = snap?.columns || schema?.columns || [];
      const layoutJson = snap?.layout_json || schema?.layout_json || null;
      const tableMeta: TableMeta = {
        title_ar: table.title_ar,
        title_fr: table.title_fr,
        subtitle_ar: table.subtitle_ar,
        subtitle_fr: table.subtitle_fr,
        merge_column_keys: table.merge_column_keys || [],
      };
      return { columns, layoutJson, tableMeta, rows: table.rows || [] };
    }
    if (
      kind === "commune_list" &&
      rapport?.rapportType?.commune_content_kind === "table"
    ) {
      const entitiesMap = getEntitiesMap(data);
      const communesLegacy =
        data.communes && typeof data.communes === "object" ? data.communes : {};
      const columns = schema?.columns || [];
      const allRows: Record<string, unknown>[] = [];

      const catalog =
        entityCatalog.length > 0
          ? entityCatalog
          : Object.keys(entitiesMap).map((key) => {
              const parsed = parseEntityKey(key);
              return {
                entity_key: key,
                kind: parsed?.kind || "commune",
                code: parsed?.code || key,
                name_ar: parsed?.code || key,
                name_fr: parsed?.code || key,
              };
            });

      const seen = new Set<string>();
      for (const m of catalog) {
        const key = m.entity_key || entityKey((m.kind as EntityTargetKind) || "commune", m.code);
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = getEntityEntry(entitiesMap, communesLegacy, key) as
          | any
          | undefined;
        if (!entry) continue;
        const nameAr = m.name_ar || entry?.name_ar || m.code;
        const nameFr = m.name_fr || entry?.name_fr || m.code;
        const communeRows = entry?.rows?.length ? entry.rows : [];
        if (!communeRows.length) continue;
        for (const r of communeRows) {
          allRows.push({
            ...r,
            municipality_code: m.code,
            _municipality_name_ar: nameAr,
            _municipality_name_fr: nameFr,
            _entity_key: key,
            _entity_kind: m.kind,
          });
        }
      }

      // Include orphan keys present only in snapshot
      for (const key of Object.keys(entitiesMap)) {
        if (seen.has(key)) continue;
        const parsed = parseEntityKey(key);
        if (!parsed) continue;
        const entry = entitiesMap[key] as any;
        if (!entry?.rows?.length) continue;
        seen.add(key);
        const nameAr = entry?.name_ar || parsed.code;
        const nameFr = entry?.name_fr || parsed.code;
        for (const r of entry.rows) {
          allRows.push({
            ...r,
            municipality_code: parsed.code,
            _municipality_name_ar: nameAr,
            _municipality_name_fr: nameFr,
            _entity_key: key,
            _entity_kind: parsed.kind,
          });
        }
      }

      return {
        columns: withCommuneNameColumn(columns),
        layoutJson: schema?.layout_json || null,
        tableMeta: { title_ar: rapport.title, title_fr: rapport.title },
        rows: rowsWithCommuneNames(sortRowsByCommune(allRows), i18n.language),
      };
    }
    return null;
  }, [kind, data, schema, rapport, entityCatalog, i18n.language]);

  const showDocument =
    !loading && (kind === "document_compose" || kind === "fiche_lecture");
  const docHasBody = documentHasContent(data);
  const versionFinishedCount = tableContent
    ? countFinishedRows(tableContent.rows)
    : 0;

  return (
    <div className="page rapportVersionViewPage">
      <div className="pageHeader row compact">
        <div className="pageHeaderTitleBlock">
          <h1>{rapport?.title || t("viewVersion")}</h1>
          {version ? (
            <p className="muted small rapportVersionViewMeta">
              {t("viewVersion")} v{version.version_number}
              {version.submitted_at
                ? ` — ${new Date(version.submitted_at).toLocaleString()}`
                : ` — ${t("statusDraft")}`}
            </p>
          ) : null}
          <RapportCreatedBy
            user={version?.createdByUser}
            labelKey="versionCreatedBy"
          />
        </div>
        <div className="pageHeaderActions">
          <span className="badge badge-submitted">{t("accessView")}</span>
          {rapport?.id && version?.id ? (
            <RapportExportButtons
              token={token}
              rapportId={rid}
              wali={wali}
              chef={chef}
              versionId={vid}
              contentKind={rapport?.rapportType?.content_kind}
              communeContentKind={rapport?.rapportType?.commune_content_kind}
            />
          ) : null}
          <BackButton fallbackTo={archiveListPath} />
        </div>
      </div>

      {loading ? <p className="muted">{t("loading")}</p> : null}

      {!loading && tableContent ? (
        <div className="card rapportVersionViewCard">
          <TableTitleBlock tableMeta={tableContent.tableMeta} editable={false} />
          {tableContent.rows.length === 0 ? (
            <p className="muted communeEmptyHint">{t("noResults")}</p>
          ) : (
            <TableWorkspace
              columns={tableContent.columns}
              rows={tableContent.rows}
              layoutJson={tableContent.layoutJson}
              tableMeta={tableContent.tableMeta}
              editable={false}
              showRowMeta
              rowCount={tableContent.rows.length}
              finishedCount={versionFinishedCount}
              filterMode="active"
              onFilterModeChange={() => {}}
              showHeader={false}
              showRowFilters={false}
            />
          )}
          <MediaRowsView
            rows={data.tables?.[0]?.media_rows || []}
            files={mediaFiles}
            token={token}
          />
        </div>
      ) : null}

      {showDocument ? (
        <div className="card rapportVersionViewCard">
          {docHasBody ? (
            <RichDocumentView
              data={{
                rich_html_ar: data.rich_html_ar,
                rich_html_fr: data.rich_html_fr,
                blocks: data.blocks,
                embedded_tables: data.embedded_tables,
              }}
              locale={i18n.language}
              token={token}
              serviceId={rapport?.service_id}
            />
          ) : (
            <p className="muted communeEmptyHint">{t("noResults")}</p>
          )}
          <MediaRowsView
            rows={data.media_rows || []}
            files={mediaFiles}
            token={token}
          />
        </div>
      ) : null}

      {!loading &&
      kind === "commune_list" &&
      rapport?.rapportType?.commune_content_kind !== "table" &&
      communeVersionView ? (
        <div className="card rapportVersionViewCard">
          <CommuneListVersionView
            token={token}
            serviceId={rapport?.service_id}
            entities={communeVersionView.entities}
            entitiesData={communeVersionView.entitiesData}
            communes={communeVersionView.communes}
            schema={communeVersionView.schema}
            files={communeVersionView.files}
            communeContentKind={rapport?.rapportType?.commune_content_kind}
            targetKinds={rapport?.rapportType?.entity_target_kinds}
            tableTitle={rapport?.title}
          />
        </div>
      ) : null}

      {!loading && data.calendar_events?.length ? (
        <CalendarEventsView events={data.calendar_events} />
      ) : null}

      {!loading && (versionWaliResponses.length || versionChefResponses.length) ? (
        <WaliResponsesSection
          chefResponses={versionChefResponses}
          responses={versionWaliResponses}
        />
      ) : null}

      {!loading && rid && vid ? (
        <RapportDiscussionSection
          token={token}
          rapportId={rid}
          mode={chef ? "chef" : wali ? "wali" : "office"}
          enabled={
            Boolean(version?.submitted_at) ||
            isDiscussionEnabledByStatus(rapport?.status)
          }
          versionId={vid}
          readOnly
        />
      ) : null}
    </div>
  );
}

/** @deprecated Use RapportVersionsArchivePage with optional :versionId route param */
export function RapportVersionViewPage(props: { token: string; wali?: boolean }) {
  return <RapportVersionDetail {...props} />;
}
