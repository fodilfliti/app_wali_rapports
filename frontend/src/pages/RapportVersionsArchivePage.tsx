import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import * as api from "../api";
import { BackButton } from "../components/BackButton";
import type { RapportVersionRow } from "../components/RapportVersionsList";
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
  rapportId: number;
  rapportTitle?: string;
  rapportStatus?: string;
  versions: RapportVersionRow[];
  liveCurrentVersionId?: number | null;
  wali?: boolean;
  previewPath: string;
};

export function RapportVersionsArchivePanel({
  rapportId,
  rapportTitle,
  rapportStatus,
  versions,
  liveCurrentVersionId,
  wali = false,
  previewPath,
}: ArchivePanelProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "fr" ? "fr" : "ar";
  const editableRapport =
    rapportStatus === "draft" || rapportStatus === "changes_requested";

  const viewPath = (versionId: number) =>
    versionDetailPath(rapportId, versionId, wali);

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
            isCurrent && isDraft && editableRapport && !wali;
          const href = openEditor ? previewPath : viewPath(v.id);

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
  rid,
}: {
  token: string;
  wali: boolean;
  rid: number;
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
        const vRes = wali
          ? await api.listWaliRapportVersions(token, rid)
          : await api.listRapportVersions(token, rid);
        const rRes = wali
          ? await api.getWaliRapportView(token, rid, false)
          : await api.getRapport(token, rid);
        if (cancelled) return;
        setRapport(rRes.rapport);
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
  }, [rid, token, wali, snack, t]);

  const previewBack = useMemo(
    () => rapportPreviewPath(rid, wali, rapport),
    [rid, wali, rapport],
  );

  return (
    <div className="page rapportVersionsPage">
      <div className="pageHeader row compact">
        <h1>{t("archivedVersions")}</h1>
        <BackButton to={previewBack} fallbackTo={previewBack} replace />
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
}: {
  token: string;
  wali?: boolean;
}) {
  const { rapportId, versionId } = useParams();
  const rid = Number(rapportId);

  if (versionId) {
    return <RapportVersionDetail token={token} wali={wali} />;
  }

  return (
    <RapportVersionsArchiveListPage token={token} wali={wali} rid={rid} />
  );
}

export function ArchiveVersionsLink({
  rapportId,
  wali = false,
  className = "btn btn-secondary",
}: {
  rapportId: number;
  wali?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Link
      className={className}
      to={versionsListPath(rapportId, wali)}
    >
      {t("archivedVersions")}
    </Link>
  );
}

export function WaliArchiveVersionsLink({
  rapportId,
  className = "btn btn-secondary",
}: {
  rapportId: number;
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
