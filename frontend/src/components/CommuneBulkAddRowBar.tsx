import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export type CommuneOption = {
  code: string;
  name_ar?: string;
  name_fr?: string;
};

type Props = {
  municipalities: CommuneOption[];
  rowCountsByCode: Record<string, number>;
  selectedCode: string;
  onSelectCode: (code: string) => void;
  onAddRow: () => void;
};

function communeLabel(m: CommuneOption, locale: string) {
  if (locale === "fr") return m.name_fr || m.name_ar || m.code;
  return m.name_ar || m.name_fr || m.code;
}

function matchCommune(m: CommuneOption, q: string) {
  if (!q) return true;
  const haystack =
    `${m.name_ar || ""} ${m.name_fr || ""} ${m.code || ""}`.toLowerCase();
  return haystack.includes(q);
}

export function CommuneBulkAddRowBar({
  municipalities,
  rowCountsByCode,
  selectedCode,
  onSelectCode,
  onAddRow,
}: Props) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");

  const query = search.trim().toLowerCase();
  const filtered = useMemo(
    () => municipalities.filter((m) => matchCommune(m, query)),
    [municipalities, query],
  );

  const selected =
    municipalities.find((m) => m.code === selectedCode) || filtered[0] || null;

  return (
    <div className="communeBulkAddRowBar card">
      <div className="communeBulkAddRowHeader">
        <strong className="communeBulkAddRowTitle">{t("communeBulkAddRowFor")}</strong>
        {selected ? (
          <span className="communeBulkAddRowSelected muted small">
            {communeLabel(selected, i18n.language)}
            <span className="communeBulkAddRowCount">
              {t("communeBulkRowCount", {
                count: rowCountsByCode[selected.code] || 0,
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
          placeholder={t("communeSearchPlaceholder")}
          aria-label={t("communeSearchPlaceholder")}
        />
        <button
          type="button"
          className="btn btn-primary communeBulkAddRowBtn"
          disabled={!selectedCode}
          onClick={onAddRow}
        >
          + {t("addRow")}
        </button>
      </div>

      <div className="communeBulkAddRowListWrap" role="listbox" aria-label={t("communeBulkAddRowFor")}>
        {filtered.length ? (
          <ul className="communeBulkAddRowList">
            {filtered.map((m) => {
              const active = m.code === selectedCode;
              const count = rowCountsByCode[m.code] || 0;
              return (
                <li key={m.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={`communeBulkAddRowItem${active ? " active" : ""}`}
                    onClick={() => onSelectCode(m.code)}
                  >
                    <span className="communeBulkAddRowItemName">
                      {communeLabel(m, i18n.language)}
                    </span>
                    <span className="communeBulkAddRowItemMeta">
                      <span className="communeBulkAddRowItemCode">{m.code}</span>
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
