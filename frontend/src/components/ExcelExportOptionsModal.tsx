import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { RapportExportOpts } from "../api";

type Props = {
  open: boolean;
  wali?: boolean;
  showHiddenDefault?: boolean;
  onClose: () => void;
  onExport: (opts: Pick<RapportExportOpts, "rowFilter" | "showHidden">) => void;
};

type RowFilter = RapportExportOpts["rowFilter"];

export function ExcelExportOptionsModal({
  open,
  wali = false,
  showHiddenDefault = false,
  onClose,
  onExport,
}: Props) {
  const { t } = useTranslation();
  const [rowFilter, setRowFilter] = useState<RowFilter>("active");
  const [showHidden, setShowHidden] = useState(showHiddenDefault);

  if (!open) return null;

  return (
    <div className="modalOverlay">
      <div className="modalCard excelExportModal">
        <h2>{t("excelExportTitle")}</h2>
        <p className="muted small excelExportIntro">{t("excelExportHint")}</p>

        <fieldset className="excelExportFieldset">
          <legend>{t("excelRowFilterLegend")}</legend>
          <div className="excelExportOptionList">
            {(
              [
                ["active", "excelRowFilterActive"],
                ["with_finished", "excelRowFilterWithFinished"],
                ["finished_only", "excelRowFilterFinishedOnly"],
              ] as const
            ).map(([value, labelKey]) => (
              <label key={value} className="excelExportOption">
                <input
                  type="radio"
                  name="excelRowFilter"
                  value={value}
                  checked={rowFilter === value}
                  onChange={() => setRowFilter(value)}
                />
                <span>{t(labelKey)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {!wali ? (
          <div className="excelExportCheckboxBlock">
            <label className="excelExportOption">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              <span>{t("excelIncludeHiddenRows")}</span>
            </label>
          </div>
        ) : null}

        <div className="modalActions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            type="button"
            className="btn btn-primary btnExcel"
            onClick={() => onExport({ rowFilter, showHidden: wali ? showHiddenDefault : showHidden })}
          >
            {t("exportExcel")}
          </button>
        </div>
      </div>
    </div>
  );
}
