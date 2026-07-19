import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export type BulkEntityOption = {
  code: string;
  name_ar?: string;
  name_fr?: string;
  kind?: string;
  entity_key?: string;
};

type Props = {
  entities: BulkEntityOption[];
  rowCountsByKey: Record<string, number>;
  selectedKey: string;
  onSelectKey: (key: string) => void;
  onAddRow: () => void;
  onAddAllRows?: () => void;
  canAddAll?: boolean;
};

function entityKeyOf(e: BulkEntityOption) {
  return e.entity_key || `${e.kind || "commune"}:${e.code}`;
}

function entityLabel(e: BulkEntityOption, locale: string) {
  if (locale === "fr") return e.name_fr || e.name_ar || e.code;
  return e.name_ar || e.name_fr || e.code;
}

function kindLabelKey(kind?: string) {
  if (kind === "daira") return "entityTargetKind_daira";
  if (kind === "direction") return "entityTargetKind_direction";
  return "entityTargetKind_commune";
}

function matchEntity(e: BulkEntityOption, q: string) {
  if (!q) return true;
  const haystack =
    `${e.name_ar || ""} ${e.name_fr || ""} ${e.code || ""} ${e.kind || ""}`.toLowerCase();
  return haystack.includes(q);
}

export function CommuneBulkAddRowBar({
  entities,
  rowCountsByKey,
  selectedKey,
  onSelectKey,
  onAddRow,
  onAddAllRows,
  canAddAll = false,
}: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () => entities.filter((e) => matchEntity(e, query)),
    [entities, query],
  );

  const selected =
    entities.find((e) => entityKeyOf(e) === selectedKey) || filtered[0] || null;

  return (
    <div className="communeBulkAddRowBar card">
      <div className="communeBulkAddRowHeader">
        <strong className="communeBulkAddRowTitle">{t("communeBulkAddRowFor")}</strong>
        {selected ? (
          <span className="communeBulkAddRowSelected muted small">
            {entityLabel(selected, i18n.language)}
            <span className="muted"> · {t(kindLabelKey(selected.kind))}</span>
            <span className="communeBulkAddRowCount">
              {t("communeBulkRowCount", {
                count: rowCountsByKey[entityKeyOf(selected)] || 0,
              })}
            </span>
          </span>
        ) : null}
      </div>

      <div className="communeBulkAddRowControls">
        <input
          type="search"
          className="input communeBulkAddRowSearch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("entitySearchPlaceholder")}
          aria-label={t("entitySearchPlaceholder")}
        />
        <button
          type="button"
          className="btn btn-primary communeBulkAddRowBtn"
          disabled={!selectedKey}
          onClick={onAddRow}
        >
          + {t("addRow")}
        </button>
        {onAddAllRows ? (
          <button
            type="button"
            className="btn btn-secondary communeBulkAddAllBtn"
            disabled={!canAddAll}
            onClick={onAddAllRows}
          >
            + {t("communeBulkAddAllRows")}
          </button>
        ) : null}
      </div>

      <div className="communeBulkAddRowListWrap" role="listbox" aria-label={t("communeBulkAddRowFor")}>
        {filtered.length ? (
          <ul className="communeBulkAddRowList">
            {filtered.map((e) => {
              const key = entityKeyOf(e);
              const active = key === selectedKey;
              const count = rowCountsByKey[key] || 0;
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`communeBulkAddRowItem${active ? " active" : ""}`}
                    onClick={() => onSelectKey(key)}
                  >
                    <span className="communeBulkAddRowItemName">
                      {entityLabel(e, i18n.language)}
                      <span className="muted small"> · {t(kindLabelKey(e.kind))}</span>
                    </span>
                    <span className="communeBulkAddRowItemMeta">
                      <span className="communeBulkAddRowItemCode">{e.code}</span>
                      <span className="communeBulkAddRowItemCount">
                        {t("communeBulkRowCount", { count })}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted small communeBulkAddRowEmpty">{t("noResults")}</p>
        )}
      </div>
    </div>
  );
}
