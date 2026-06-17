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
import { CalendarEventsView } from "../components/CalendarEventsEditor";
import { WaliResponsesSection } from "../components/WaliResponsesSection";
import { useSnackbar } from "../snackbar/SnackbarContext";
import {
  buildEmptyCommuneRow,
  rowsWithCommuneNames,
  sortRowsByCommune,
  withCommuneNameColumn,
} from "../utils/communeBulkTable";
import type { TableMeta } from "../utils/tableLayout";
import { versionsListPath, rapportPreviewPath } from "../utils/rapportVersionsNav";
import { RapportExportButtons } from "../components/ExportPdfButton";
import { CommuneListVersionView } from "../components/CommuneListVersionView";
import type { MediaFile } from "../utils/media";

type DetailProps = {
  token: string;
  wali?: boolean;
};

export function RapportVersionDetail({
  token,
  wali = false,
}: DetailProps) {
  const { rapportId, versionId } = useParams();
  const rid = Number(rapportId);
  const vid = Number(versionId);
  const { t, i18n } = useTranslation();
  const snack = useSnackbar();
  const [rapport, setRapport] = useState<any>(null);
  const [version, setVersion] = useState<any>(null);
  const [schema, setSchema] = useState<any>(null);
  const [municipalities, setMunicipalities] = useState<
    { code: string; name_ar: string; name_fr: string }[]
  >([]);
  const [communeVersionView, setCommuneVersionView] = useState<{
    municipalities: { code: string; name_ar: string; name_fr: string; is_changed?: boolean }[];
    communes: Record<string, any>;
    schema?: { columns?: any[]; layout_json?: any } | null;
    files?: Record<number, MediaFile>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const previewBack = rapportPreviewPath(rid, wali, rapport);
  const archiveListPath = versionsListPath(rid, wali);

  useEffect(() => {
    if (!rid || !vid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rRes, vRes] = await Promise.all([
          wali ? api.getWaliRapportView(token, rid, false) : api.getRapport(token, rid),
          wali
            ? api.getWaliRapportVersion(token, rid, vid)
            : api.getRapportVersion(token, rid, vid),
        ]);
        if (cancelled) return;
        setRapport(rRes.rapport);
        setVersion(vRes.version);
        const kind = rRes.rapport?.rapportType?.content_kind;
        const communeKind = rRes.rapport?.rapportType?.commune_content_kind;
        const snap = vRes.version?.data_json?.schema_snapshot;
        setCommuneVersionView(null);

        if (
          kind === "commune_list" &&
          communeKind !== "table" &&
          rRes.rapport?.service_id
        ) {
          if (wali) {
            try {
              const viewRes = await api.getWaliRapportView(token, rid, false, vid);
              if (!cancelled) {
                setCommuneVersionView({
                  municipalities: viewRes.municipalities || [],
                  communes: viewRes.communes || vRes.version?.data_json?.communes || {},
                  schema: viewRes.schema,
                  files: viewRes.files || {},
                });
              }
            } catch {
              if (!cancelled) {
                setCommuneVersionView({
                  municipalities: [],
                  communes: vRes.version?.data_json?.communes || {},
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
                  municipalities: ws.municipalities || [],
                  communes: vRes.version?.data_json?.communes || {},
                  schema: ws.schema,
                  files: mediaRes.files || {},
                });
              }
            } catch {
              if (!cancelled) {
                setCommuneVersionView({
                  municipalities: [],
                  communes: vRes.version?.data_json?.communes || {},
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
            if (wali) {
              const viewRes = await api.getWaliRapportView(token, rid, false, vid);
              if (!cancelled) {
                setSchema(viewRes.schema);
                setMunicipalities(viewRes.municipalities || []);
              }
            } else {
              const ws = await api.getCommuneWorkspace(token, rRes.rapport.service_id, {
                rapportId: rid,
              });
              if (!cancelled) {
                setSchema(ws.schema);
                setMunicipalities(ws.municipalities || []);
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
  }, [rid, vid, token, wali, snack, t]);

  const kind = rapport?.rapportType?.content_kind;
  const data = version?.data_json || {};

  const versionWaliResponses = useMemo(() => {
    const onVersion = version?.waliResponses;
    if (Array.isArray(onVersion) && onVersion.length) return onVersion;
    return (rapport?.waliResponses || []).filter(
      (r: { rapport_version_id?: number }) => r.rapport_version_id === vid,
    );
  }, [version?.waliResponses, rapport?.waliResponses, vid]);

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
    if (kind === "commune_list" && rapport?.rapportType?.commune_content_kind === "table") {
      const communes = data.communes || {};
      const nameByCode = new Map(
        municipalities.map((m) => [String(m.code), { name_ar: m.name_ar, name_fr: m.name_fr }]),
      );
      const columns = schema?.columns || [];
      const allRows: Record<string, unknown>[] = [];
      for (const [code, entry] of Object.entries(communes) as [string, any][]) {
        const names = nameByCode.get(code);
        const nameAr = names?.name_ar || entry?.name_ar || code;
        const nameFr = names?.name_fr || entry?.name_fr || code;
        const communeRows = entry?.rows?.length
          ? entry.rows
          : [buildEmptyCommuneRow({ code, name_ar: nameAr, name_fr: nameFr })];
        for (const r of communeRows) {
          allRows.push({
            ...r,
            municipality_code: code,
            _municipality_name_ar: nameAr,
            _municipality_name_fr: nameFr,
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
  }, [kind, data, schema, rapport, municipalities, i18n.language]);

  return (
    <div className="page rapportVersionViewPage">
      <div className="pageHeader row compact">
        <div>
          <h1>{rapport?.title || t("viewVersion")}</h1>
          {version ? (
            <p className="muted small rapportVersionViewMeta">
              {t("viewVersion")} v{version.version_number}
              {version.submitted_at
                ? ` — ${new Date(version.submitted_at).toLocaleString()}`
                : ` — ${t("statusDraft")}`}
            </p>
          ) : null}
        </div>
        <div className="pageHeaderActions">
          <span className="badge badge-submitted">{t("accessView")}</span>
          {rapport?.id && version?.id ? (
            <RapportExportButtons
              token={token}
              rapportId={rid}
              wali={wali}
              versionId={vid}
            />
          ) : null}
          <BackButton to={previewBack} fallbackTo={archiveListPath} replace />
        </div>
      </div>

      {loading ? <p className="muted">{t("loading")}</p> : null}

      {!loading && tableContent ? (
        <div className="card rapportVersionViewCard">
          <TableTitleBlock tableMeta={tableContent.tableMeta} editable={false} />
          <TableWorkspace
            columns={tableContent.columns}
            rows={tableContent.rows}
            layoutJson={tableContent.layoutJson}
            tableMeta={tableContent.tableMeta}
            editable={false}
            showRowMeta
            rowCount={tableContent.rows.length}
            finishedCount={0}
            filterMode="all"
            onFilterModeChange={() => {}}
            showHeader={false}
          />
        </div>
      ) : null}

      {!loading && (kind === "document_compose" || kind === "fiche_lecture") ? (
        <div className="card rapportVersionViewCard">
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
            municipalities={communeVersionView.municipalities}
            communes={communeVersionView.communes}
            schema={communeVersionView.schema}
            files={communeVersionView.files}
          />
        </div>
      ) : null}

      {!loading && data.calendar_events?.length ? (
        <CalendarEventsView events={data.calendar_events} />
      ) : null}

      {!loading && versionWaliResponses.length ? (
        <WaliResponsesSection responses={versionWaliResponses} />
      ) : null}
    </div>
  );
}

/** @deprecated Use RapportVersionsArchivePage with optional :versionId route param */
export function RapportVersionViewPage(props: { token: string; wali?: boolean }) {
  return <RapportVersionDetail {...props} />;
}
