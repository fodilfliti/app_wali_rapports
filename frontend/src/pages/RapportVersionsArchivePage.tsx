import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { EntityIdParam } from "../api";
import * as api from "../api";
import { BackButton } from "../components/BackButton";
import type { RapportVersionRow } from "../components/RapportVersionsList";
import {
  createdByDisplayName,
} from "../components/RapportCreatedBy";
import { useSnackbar } from "../snackbar/SnackbarContext";
import { RapportVersionDetail } from "./RapportVersionViewPage";
import {
  rapportPreviewPath,
  versionDetailPath,
  versionsListPath,
} from "../utils/rapportVersionsNav";

export { versionsListPath } from "../utils/rapportVersionsNav";

function formatVersionDate(iso: string | null | undefined, locale: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(locale === "fr" ? "fr-FR" : "ar-DZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

type ArchivePanelProps = {
  rapportId: EntityIdParam;
  rapportTitle?: string;
  rapportStatus?: string;
  versions: RapportVersionRow[];
  liveCurrentVersionId?: number | null;
  wali?: boolean;
  chef?: boolean;
  previewPath: string;
};

export function RapportVersionsArchivePanel({
  rapportId,
  rapportTitle,
  rapportStatus,
  versions,
  liveCurrentVersionId,
  wali = false,
  chef = false,
  previewPath,
}: ArchivePanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "fr" ? "fr" : "ar";
  const editableRapport =
    rapportStatus === "draft" || rapportStatus === "changes_requested";

  const viewPath = (versionId: EntityIdParam) =>
    versionDetailPath(rapportId, versionId, wali, chef);

  const sorted = [...versions].sort(
    (a, b) => b.version_number - a.version_number,
  );

  return (
    <div className="rapportVersionsPageBody">
      {rapportTitle ? (
        <p className="muted small rapportVersionsPageSubtitle">{rapportTitle}</p>
      ) : null}
      <ul className="rapportVersionsArchiveList">
        {sorted.map((v) => {
          const isCurrent = v.id === liveCurrentVersionId;
          const isDraft = !v.submitted_at;
          const dateLabel = formatVersionDate(v.submitted_at, locale);
          const openEditor =
            isCurrent && isDraft && editableRapport && !wali && !chef;
          const href = openEditor ? previewPath : viewPath(v.id);
          const creator = createdByDisplayName(v.createdByUser, t);

          return (
            <li key={v.id}>
              <Link
                className={`rapportVersionCard${isCurrent ? " rapportVersionCard--current" : ""}${isDraft ? " rapportVersionCard--draft" : ""}`}
                to={href}
              >
                <span className="rapportVersionCardBadge" aria-hidden>
                  v{v.version_number}
                </span>
                <span className="rapportVersionCardBody">
                  <span className="rapportVersionCardDate">
                    {dateLabel || t("statusDraft")}
                  </span>
                  {creator ? (
                    <span className="muted small rapportVersionCardCreator">
                      {t("versionCreatedBy", { name: creator })}
                    </span>
                  ) : null}
                  <span className="rapportVersionCardTags">
                    {isDraft ? (
                      <span className="rapportVersionTag rapportVersionTag--draft">
                        {t("statusDraft")}
                      </span>
                    ) : null}
                    {isCurrent ? (
                      <span className="rapportVersionTag rapportVersionTag--current">
                        {t("current")}
                      </span>
                    ) : null}
                  </span>
                </span>
                <span className="rapportVersionCardAction">
                  <span>{openEditor ? t("openEditor") : t("viewVersion")}</span>
                  <span className="rapportVersionCardChevron" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RapportVersionsArchiveListPage({
  token,
  wali,
  chef = false,
  rid,
}: {
  token: string;
  wali: boolean;
  chef?: boolean;
  rid: EntityIdParam;
}) {
  const { t } = useTranslation();
  const snack = useSnackbar();
  const [rapport, setRapport] = useState<any>(null);
  const [versions, setVersions] = useState<RapportVersionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const vRes = chef
          ? await api.listChefRapportVersions(token, rid)
          : wali
            ? await api.listWaliRapportVersions(token, rid)
            : await api.listRapportVersions(token, rid);
        const rRes = chef
          ? await api.getChefRapportView(token, rid, false)
          : wali
            ? await api.getWaliRapportView(token, rid, false)
            : await api.getRapport(token, rid);
        if (cancelled) return;
        setRapport(rRes.rapport ?? rRes);
        setVersions(vRes.versions || []);
      } catch {
        if (!cancelled) snack.show(t("errorGeneric"), "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rid, token, wali, chef, snack, t]);

  const previewBack = useMemo(
    () => rapportPreviewPath(rid, wali, rapport, chef),
    [rid, wali, rapport, chef],
  );

  return (
    <div className="page rapportVersionsPage">
      <div className="pageHeader row compact">
        <h1>{t("archivedVersions")}</h1>
        <BackButton fallbackTo={previewBack} />
      </div>

      {loading ? <p className="muted">{t("loading")}</p> : null}

      {!loading && !versions.length ? (
        <p className="muted communeEmptyHint">{t("noResults")}</p>
      ) : null}

      {!loading && versions.length > 0 ? (
        <div className="card rapportVersionsPageCard">
          <RapportVersionsArchivePanel
            rapportId={rid}
            rapportTitle={rapport?.title}
            rapportStatus={rapport?.status}
            versions={versions}
            liveCurrentVersionId={rapport?.current_version_id}
            wali={wali}
            chef={chef}
            previewPath={previewBack}
          />
        </div>
      ) : null}
    </div>
  );
}

export function RapportVersionsArchivePage({
  token,
  wali = false,
  chef = false,
}: {
  token: string;
  wali?: boolean;
  chef?: boolean;
}) {
  const { rapportId, versionId } = useParams();
  const rid = rapportId ?? "";

  if (versionId) {
    return <RapportVersionDetail token={token} wali={wali} chef={chef} />;
  }

  return (
    <RapportVersionsArchiveListPage token={token} wali={wali} chef={chef} rid={rid} />
  );
}

export function ArchiveVersionsLink({
  rapportId,
  wali = false,
  chef = false,
  className = "btn btn-secondary",
}: {
  rapportId: EntityIdParam;
  wali?: boolean;
  chef?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      className={className}
      to={versionsListPath(rapportId, wali, chef)}
    >
      {t("archivedVersions")}
    </Link>
  );
}

export function WaliArchiveVersionsLink({
  rapportId,
  className = "btn btn-secondary",
}: {
  rapportId: EntityIdParam;
  className?: string;
}) {
  return (
    <ArchiveVersionsLink
      rapportId={rapportId}
      wali
      className={className}
    />
  );
}

export function ChefArchiveVersionsLink({
  rapportId,
  className = "btn btn-secondary",
}: {
  rapportId: EntityIdParam;
  className?: string;
}) {
  return (
    <ArchiveVersionsLink
      rapportId={rapportId}
      chef
      className={className}
    />
  );
}
