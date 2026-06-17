import { useTranslation } from 'react-i18next'
import { ExpandableHelp } from './ExpandableHelp'

type LegendItem = {
  id: string
  labelKey: string
  hintKey: string
  badgeClass?: string
  swatchClass?: string
}

const WALI_ITEMS: LegendItem[] = [
  {
    id: 'new',
    labelKey: 'waliInboxNew',
    hintKey: 'waliInboxLegendNewHint',
    swatchClass: 'waliInboxLegendSwatchNew',
  },
  {
    id: 'submitted',
    labelKey: 'statusSubmitted',
    hintKey: 'waliInboxLegendSubmittedHint',
    badgeClass: 'badge-submitted',
  },
  {
    id: 'under_review',
    labelKey: 'statusUnderReview',
    hintKey: 'waliInboxLegendUnderReviewHint',
    badgeClass: 'badge-under_review',
  },
  {
    id: 'acknowledged',
    labelKey: 'statusAcknowledged',
    hintKey: 'waliInboxLegendAcknowledgedHint',
    badgeClass: 'badge-acknowledged',
  },
  {
    id: 'changes_requested',
    labelKey: 'statusChangesRequested',
    hintKey: 'waliInboxLegendChangesRequestedHint',
    badgeClass: 'badge-changes_requested',
  },
]

const OFFICE_ITEMS: LegendItem[] = [
  {
    id: 'draft',
    labelKey: 'statusDraft',
    hintKey: 'officeRapportLegendDraftHint',
    badgeClass: 'badge-draft',
  },
  {
    id: 'submitted',
    labelKey: 'statusSubmitted',
    hintKey: 'officeRapportLegendSubmittedHint',
    badgeClass: 'badge-submitted',
  },
  {
    id: 'under_review',
    labelKey: 'statusUnderReview',
    hintKey: 'officeRapportLegendUnderReviewHint',
    badgeClass: 'badge-under_review',
  },
  {
    id: 'changes_requested',
    labelKey: 'statusChangesRequested',
    hintKey: 'officeRapportLegendChangesRequestedHint',
    badgeClass: 'badge-changes_requested',
  },
  {
    id: 'acknowledged',
    labelKey: 'statusAcknowledged',
    hintKey: 'officeRapportLegendAcknowledgedHint',
    badgeClass: 'badge-acknowledged',
  },
]

type Props = {
  variant: 'wali' | 'office'
}

export function RapportStatusFlowHelp({ variant }: Props) {
  const { t } = useTranslation()
  const items = variant === 'wali' ? WALI_ITEMS : OFFICE_ITEMS
  const expandTitle =
    variant === 'wali' ? t('waliInboxFlowExpandTitle') : t('officeRapportFlowExpandTitle')
  const introKey = variant === 'wali' ? 'waliInboxFlowIntro' : 'officeRapportFlowIntro'

  return (
    <ExpandableHelp title={expandTitle} className="rapportStatusFlowHelp contentKindHelpExpand">
      <p className="muted small rapportStatusFlowIntro">{t(introKey)}</p>
      <ol className="waliInboxFlowSteps">
        {items.map((item, index) => (
          <li key={item.id} className="waliInboxFlowStep">
            <span className="waliInboxFlowStepOrder">{index + 1}</span>
            <div className="waliInboxFlowStepBody">
              <div className="waliInboxFlowStepLabel">
                {item.swatchClass ? (
                  <span className="waliInboxLegendItem">
                    <span className={`waliInboxLegendSwatch ${item.swatchClass}`} />
                    {t(item.labelKey)}
                  </span>
                ) : (
                  <span className={`badge ${item.badgeClass}`}>{t(item.labelKey)}</span>
                )}
              </div>
              <p className="muted small waliInboxFlowStepHint">{t(item.hintKey)}</p>
            </div>
          </li>
        ))}
      </ol>
    </ExpandableHelp>
  )
}
