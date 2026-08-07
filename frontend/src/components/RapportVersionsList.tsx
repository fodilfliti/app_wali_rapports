import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TablePagination } from "./TablePagination";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "../utils/pagination";
import {
  createdByDisplayName,
  type CreatedByUser,
} from "./RapportCreatedBy";

export type RapportVersionRow = {
  id: number | string;
  version_number: number;
  submitted_at?: string | null;
  createdByUser?: CreatedByUser | null;
};

type Props = {
  versions: RapportVersionRow[];
  liveCurrentVersionId?: number | string | null;
  selectedVersionId?: number | string | null;
  onSelectVersion: (versionId: number | string) => void;
  onBackToCurrent: () => void;
  onClose?: () => void;
};

export function RapportVersionsList({
  versions,
  liveCurrentVersionId,
  selectedVersionId,
  onSelectVersion,
  onBackToCurrent,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);

  if (!versions.length) return null;

  const activeId = selectedVersionId ?? liveCurrentVersionId ?? null;
  const paged = paginateSlice(versions, page, DEFAULT_PAGE_SIZE);

  return (
    <section className="card rapportVersionsPanel">
      <div className="rapportVersionsPanelHeader">
        <h2 className="rapportVersionsPanelTitle">{t("archivedVersions")}</h2>
        {onClose ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            {t("close")}
          </button>
        ) : null}
      </div>
      <ul className="versionList">
        {paged.map((v) => {
          const creator = createdByDisplayName(v.createdByUser, t);
          return (
            <li key={v.id}>
              <button
                type="button"
                className={`btn btn-ghost versionListBtn${String(v.id) === String(activeId) ? " active" : ""}`}
                onClick={() => {
                  if (String(v.id) === String(liveCurrentVersionId)) onBackToCurrent();
                  else onSelectVersion(v.id);
                }}
              >
                <span className="versionListBtnMain">
                  v{v.version_number} —{" "}
                  {v.submitted_at
                    ? new Date(v.submitted_at).toLocaleString()
                    : t("statusDraft")}
                  {String(v.id) === String(liveCurrentVersionId)
                    ? ` (${t("current")})`
                    : ""}
                </span>
                {creator ? (
                  <span className="muted small versionListCreator">
                    {t("versionCreatedBy", { name: creator })}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <TablePagination
        page={page}
        total={versions.length}
        onPageChange={setPage}
        compact
      />
    </section>
  );
}
