import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { ApiError } from "../api";
import { BackButton } from "../components/BackButton";
import { HubTile } from "../components/HubTile";
import {
  RapportTitleField,
  patchRapportTitle,
} from "../components/RapportTitleField";
import { TablePagination } from "../components/TablePagination";
import { WaliResponsesSection } from "../components/WaliResponsesSection";
import {
  RapportDiscussionSection,
  isDiscussionEnabledByStatus,
} from "../components/RapportDiscussionSection";
import { EntityInclusionModal } from "../components/EntityInclusionModal";
import { BusyButton } from "../components/BusyButton";
import { PageLoading } from "../components/PageLoading";
import { useSnackbar } from "../snackbar/SnackbarContext";
import {
  localizedRapportTypeName,
  officeCommuneBulkPath,
  officeEntityEditorPath,
  officeServiceHubPath,
} from "../utils/rapportNavigation";
import { listEntityUnitKey } from "../utils/entityTargets";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "../utils/pagination";
import { notifyHubCountsRefresh } from "../utils/hubCountsRefresh";
import { RapportOfficeStatusBanner } from "../components/RapportOfficeStatusBanner";
import { RapportVersionHeaderActions } from "../components/RapportVersionHeaderActions";

type Props = { token: string };

type FilterMode = "all" | "filled" | "empty";

export function OfficeCommuneListPage({ token }: Props) {
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
  const [workspace, setWorkspace] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [municipalitySearch, setMunicipalitySearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [title, setTitle] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [versions, setVersions] = useState<any[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [inclusionOpen, setInclusionOpen] = useState(false);
  const [savingTitle, setSavingTitle] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWorkspace = useCallback(async () => {
    if (!sid) return;
    setLoading(true);
    setLoadError(null);
    try {
      const ws = await api.getCommuneWorkspace(token, sid, {
        rapportTypeId,
        rapportId,
      });
      setWorkspace(ws);
      setTitle(ws.rapport?.title || "");
      if (ws.rapport?.id) {
        const vRes = await api.listRapportVersions(token, ws.rapport.id);
        setVersions(vRes.versions);
      }
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
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const rid = workspace?.rapport?.id;
    if (!rid || rapportId === rid) return;
    const next = new URLSearchParams(searchParams);
    next.set("rapport_id", String(rid));
    if (rapportTypeId) next.set("rapport_type_id", String(rapportTypeId));
    navigate({ pathname: location.pathname, search: `?${next.toString()}` }, { replace: true });
  }, [workspace?.rapport?.id, rapportId, rapportTypeId, searchParams, navigate, location.pathname]);

  const filterEntities = useCallback(
    (list: any[]) => {
      const q = municipalitySearch.trim().toLowerCase();
      return list.filter((m: any) => {
        if (filter === "filled" && !m.filled) return false;
        if (filter === "empty" && m.filled) return false;
        if (!q) return true;
        const name =
          `${m.name_ar || ""} ${m.name_fr || ""} ${m.code || ""}`.toLowerCase();
        return name.includes(q);
      });
    },
    [municipalitySearch, filter],
  );

  const municipalities = useMemo(
    () => filterEntities(workspace?.municipalities || []),
    [workspace?.municipalities, filterEntities],
  );

  const dairas = useMemo(
    () => filterEntities(workspace?.dairas || []),
    [workspace?.dairas, filterEntities],
  );
  const modiriyat = useMemo(
    () => filterEntities(workspace?.modiriyat || []),
    [workspace?.modiriyat, filterEntities],
  );

  useEffect(() => {
    setPage(1);
  }, [municipalitySearch, filter]);

  const pagedMunicipalities = paginateSlice(
    municipalities,
    page,
    DEFAULT_PAGE_SIZE,
  );

  const allEntities = useMemo(
    () => [
      ...(workspace?.municipalities || []),
      ...(workspace?.dairas || []),
      ...(workspace?.modiriyat || []),
    ],
    [workspace?.municipalities, workspace?.dairas, workspace?.modiriyat],
  );
  const filledCount = allEntities.filter((m: any) => m.filled).length;
  const changedCount = allEntities.filter((m: any) => m.is_changed).length;
  const totalCount = allEntities.length;
  const unitLabel = t(
    listEntityUnitKey(
      workspace?.rapportType?.entity_target_kinds || workspace?.targetKinds,
    ),
  );

  async function submitAll() {
    if (!workspace?.rapport?.id) return;
    setSubmitting(true);
    try {
      await patchRapportTitle(token, workspace.rapport.id, title);
      await api.submitRapport(token, workspace.rapport.id);
      notifyHubCountsRefresh();
      snack.show(t("submitRapport"), "success");
      loadWorkspace();
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

  const editable = workspace?.editable === true;
  const isTableCommuneMode = workspace?.rapportType?.commune_content_kind === "table";
  const bulkPath = officeCommuneBulkPath(sid, {
    rapportTypeId,
    rapportId: workspace?.rapport?.id ?? rapportId,
  });

  async function finishCurrentRapport() {
    if (!workspace?.rapport?.id) return;
    setFinishing(true);
    try {
      await api.finishRapport(token, workspace.rapport.id);
      notifyHubCountsRefresh();
      snack.show(t("finishRapportDone"), "success");
      navigate(
        rapportTypeId
          ? `/office/services/${sid}/rapports/${rapportTypeId}`
          : `/office/services/${sid}`,
      );
    } catch {
      snack.show(t("errorGeneric"), "error");
    } finally {
      setFinishing(false);
    }
  }

  const label = workspace?.rapportType
    ? localizedRapportTypeName(workspace.rapportType, i18n.language)
    : workspace?.service
      ? i18n.language === "fr"
        ? workspace.service.name_fr
        : workspace.service.name_ar
      : t("contentKind_commune_list");

  const serviceBackPath = officeServiceHubPath(sid);

  function entityLinkKey(entity: any) {
    return entity.entity_key || entity.code;
  }

  function renderEntityGrid(items: any[], paged: any[]) {
    return (
      <>
        <div className="hubGrid communeHubGrid">
          {paged.map((m: any) => {
            const name = i18n.language === "fr" ? m.name_fr : m.name_ar;
            const linkKey = entityLinkKey(m);
            return (
              <HubTile
                key={linkKey}
                to={officeEntityEditorPath(sid, linkKey, {
                  rapportTypeId,
                  rapportId: workspace?.rapport?.id,
                })}
                icon="communes"
                title={name}
                subtitle={m.filled ? t("communeFilled") : t("communeEmpty")}
                className={
                  m.filled ? "communeHubTileFilled" : "communeHubTileEmpty"
                }
                badge={
                  m.filled ? (
                    <span className="badge badge-submitted communeHubBadge">
                      {t("communeFilled")}
                    </span>
                  ) : null
                }
              />
            );
          })}
        </div>
        {!items.length ? (
          <p className="muted communeEmptyHint">{t("noResults")}</p>
        ) : null}
        <TablePagination page={page} total={items.length} onPageChange={setPage} />
      </>
    );
  }

  return (
    <div className="page communeHubPage">
      <div className="pageHeader row compact">
        <RapportTitleField
          title={title}
          onChange={setTitle}
          editable={!!editable}
          fallback={label}
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
            <BusyButton
              type="button"
              className="btn btn-primary btn-sm"
              busy={savingTitle}
              busyLabel={t("saving")}
              disabled={submitting}
              onClick={async () => {
                if (!workspace?.rapport?.id) return;
                setSavingTitle(true);
                try {
                  const patched = await patchRapportTitle(
                    token,
                    workspace.rapport.id,
                    title,
                  );
                  setTitle(patched.title);
                  snack.show(t("save"), "success");
                } catch (e) {
                  const msg =
                    e instanceof Error && e.message === "rapportTitleRequired"
                      ? "rapportTitleRequired"
                      : "errorGeneric";
                  snack.show(t(msg), "error");
                } finally {
                  setSavingTitle(false);
                }
              }}
            >
              {t("save")}
            </BusyButton>
          ) : null}
          {editable ? (
            <BusyButton
              type="button"
              className="btn btn-accent"
              onClick={submitAll}
              busy={submitting}
              busyLabel={t("submitting")}
              disabled={savingTitle}
            >
              {t("submitRapport")}
            </BusyButton>
          ) : null}
          {isTableCommuneMode ? (
            <Link className="btn btn-primary" to={bulkPath}>
              {t("bulkEntry")}
            </Link>
          ) : null}
          {workspace?.accessLevel === "view" ? (
            <span className="badge">{t("accessView")}</span>
          ) : null}
          <BackButton fallbackTo={serviceBackPath} />
        </div>
      </div>

      {loading ? <PageLoading className="communeStatus" /> : null}
      {loadError ? (
        <div className="communeError card">
          <p>
            {loadError === "tableSchemaNotConfigured"
              ? t("tableSchemaNotConfigured")
              : t("communeWorkspaceError")}
          </p>
          {loadError === "tableSchemaNotConfigured" ? (
            <Link
              className="btn btn-primary"
              to={`/office/services/${sid}/config`}
            >
              {t("goToServiceConfig")}
            </Link>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadWorkspace}
            >
              {t("refresh")}
            </button>
          )}
        </div>
      ) : null}

      {!loading && !loadError ? (
        <>
          <RapportOfficeStatusBanner
            rapport={workspace.rapport}
            editable={!!editable}
            onFinish={finishCurrentRapport}
            finishing={finishing}
          />

          {isTableCommuneMode ? (
            <div className="communeBulkEntryCard card">
              <div className="communeBulkEntryCardBody">
                <strong className="communeBulkEntryTitle">{t("communeBulkEntryTitle")}</strong>
                <p className="muted small communeBulkEntryDesc">{t("communeBulkEntryDesc")}</p>
              </div>
              <div className="communeBulkEntryActions">
                <Link className="btn btn-primary btn-lg communeBulkEntryBtn" to={bulkPath}>
                  {t("communeBulkEntryOpen")}
                </Link>
                <span className="muted small communeBulkEntryHint">{t("communeBulkEntryHint")}</span>
              </div>
            </div>
          ) : null}

          <div className="communeHubToolbar card">
            <input
              type="search"
              className="communeSearch"
              value={municipalitySearch}
              onChange={(e) => setMunicipalitySearch(e.target.value)}
              placeholder={t("listSearchPlaceholder", { unit: unitLabel })}
            />
            <div className="communeFilterRow">
              {(["all", "filled", "empty"] as FilterMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={`btn btn-secondary btn-sm${filter === mode ? " active" : ""}`}
                  onClick={() => setFilter(mode)}
                >
                  {t(`communeFilter_${mode}`)}
                </button>
              ))}
              {editable && workspace?.selection_catalog ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setInclusionOpen(true)}
                >
                  {t("entityInclusionTitle")}
                </button>
              ) : null}
            </div>
            <p className="muted small communeProgress">
              {t("listProgress", {
                filled: filledCount,
                total: totalCount,
                unit: unitLabel,
              })}
              {changedCount > 0
                ? ` · ${t("communeProgressChanged", { changed: changedCount })}`
                : ""}
            </p>
          </div>

          {!municipalities.length && !dairas.length && !modiriyat.length ? (
            <p className="muted communeEmptyHint">{t("noResults")}</p>
          ) : null}
          {municipalities.length ? (
            <>
              {dairas.length || modiriyat.length ? (
                <h2 className="entitySectionTitle">{t("entitySectionCommunes")}</h2>
              ) : null}
              {renderEntityGrid(municipalities, pagedMunicipalities)}
            </>
          ) : null}

          {dairas.length ? (
            <section className="entityListSection">
              <h2 className="entitySectionTitle">{t("entitySectionDairas")}</h2>
              {renderEntityGrid(dairas, paginateSlice(dairas, page, DEFAULT_PAGE_SIZE))}
            </section>
          ) : null}

          {modiriyat.length ? (
            <section className="entityListSection">
              <h2 className="entitySectionTitle">{t("entitySectionModiriyat")}</h2>
              {renderEntityGrid(
                modiriyat,
                paginateSlice(modiriyat, page, DEFAULT_PAGE_SIZE),
              )}
            </section>
          ) : null}

          <WaliResponsesSection
            chefResponses={workspace?.rapport?.chefResponses || []}
            responses={workspace?.rapport?.waliResponses || []}
          />
          {workspace?.rapport?.id ? (
            <RapportDiscussionSection
              token={token}
              rapportId={Number(workspace.rapport.id)}
              mode="office"
              enabled={isDiscussionEnabledByStatus(workspace.rapport.status)}
            />
          ) : null}
        </>
      ) : null}

      {inclusionOpen && workspace?.selection_catalog && workspace?.rapport?.id ? (
        <EntityInclusionModal
          catalog={workspace.selection_catalog}
          initialKeys={workspace.included_entity_keys ?? null}
          onClose={() => setInclusionOpen(false)}
          onSave={async (keys) => {
            await api.patchIncludedEntities(token, workspace.rapport.id, keys);
            snack.show(t("save"), "success");
            await loadWorkspace();
          }}
        />
      ) : null}
    </div>
  );
}
