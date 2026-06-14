import { useTranslation } from 'react-i18next'

type Props = {
  showHidden: boolean
  onChange: (showHidden: boolean) => void
  scopeLabelKey?: string
  activeLabelKey?: string
  hiddenLabelKey?: string
  ariaLabelKey?: string
}

export function RapportListScopeFilter({
  showHidden,
  onChange,
  scopeLabelKey = 'rapportListScope',
  activeLabelKey = 'rapportListActive',
  hiddenLabelKey = 'rapportListFinished',
  ariaLabelKey = 'showFinishedRapports',
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="rapportListScopeFilter" role="group" aria-label={t(ariaLabelKey)}>
      <span className="rapportListScopeFilterLabel">{t(scopeLabelKey)}</span>
      <div className="rapportListScopeFilterButtons">
        <button
          type="button"
          className={`btn btn-secondary btn-sm${showHidden ? '' : ' active'}`}
          aria-pressed={!showHidden}
          onClick={() => onChange(false)}
        >
          {t(activeLabelKey)}
        </button>
        <button
          type="button"
          className={`btn btn-secondary btn-sm${showHidden ? ' active' : ''}`}
          aria-pressed={showHidden}
          onClick={() => onChange(true)}
        >
          {t(hiddenLabelKey)}
        </button>
      </div>
    </div>
  )
}
