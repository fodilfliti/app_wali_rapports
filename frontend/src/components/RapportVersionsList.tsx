import { useState } from "react";
import { useTranslation } from "react-i18next";
import { TablePagination } from "./TablePagination";
import { DEFAULT_PAGE_SIZE, paginateSlice } from "../utils/pagination";

export type RapportVersionRow = {
  id: number;
  version_number: number;
  submitted_at?: string | null;
};

type Props = {
  versions: RapportVersionRow[];
  liveCurrentVersionId?: number | null;
  selectedVersionId?: number | null;
  onSelectVersion: (versionId: number) => void;
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
        {paged.map((v) => (
          <li key={v.id}>
            <button
              type="button"
              className={`btn btn-ghost versionListBtn${v.id === activeId ? " active" : ""}`}
              onClick={() => {
                if (v.id === liveCurrentVersionId) onBackToCurrent();
                else onSelectVersion(v.id);
              }}
            >
              v{v.version_number} —{" "}
              {v.submitted_at
                ? new Date(v.submitted_at).toLocaleString()
                : t("statusDraft")}
              {v.id === liveCurrentVersionId ? ` (${t("current")})` : ""}
            </button>
          </li>
        ))}
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
