import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { CONTENT_KINDS_ORDER, contentKindHubIcon } from '../utils/rapportNavigation'

const KIND_ORDER = [...CONTENT_KINDS_ORDER]

type Props = {
  /** When true, omit outer card chrome (for use inside a modal). */
  bare?: boolean
}

export function RapportKindsExplainer({ bare = false }: Props) {
  const { t } = useTranslation()

  return (
    <aside
      className={bare ? 'kindsExplainer kindsExplainer--bare' : 'card kindsExplainer'}
      aria-labelledby="kindsExplainerTitle"
    >
      <h2 id="kindsExplainerTitle" className="kindsExplainerTitle">
        {t('kindsExplainerTitle')}
      </h2>
      <p className="muted small kindsExplainerLead">{t('kindsExplainerLead')}</p>

      <section className="kindsExplainerSection" aria-labelledby="kindsExplainerTypeVsRapport">
        <h3 id="kindsExplainerTypeVsRapport" className="kindsExplainerSectionTitle">
          {t('kindsExplainerTypeVsRapportTitle')}
        </h3>
        <div className="kindsExplainerPair">
          <div className="kindsExplainerPairCard">
            <strong>{t('kindsExplainerTypeLabel')}</strong>
            <p className="muted small">{t('kindsExplainerTypeBody')}</p>
          </div>
          <div className="kindsExplainerPairCard">
            <strong>{t('kindsExplainerRapportLabel')}</strong>
            <p className="muted small">{t('kindsExplainerRapportBody')}</p>
          </div>
        </div>
      </section>

      <section className="kindsExplainerSection" aria-labelledby="kindsExplainerKinds">
        <h3 id="kindsExplainerKinds" className="kindsExplainerSectionTitle">
          {t('kindsExplainerKindsTitle')}
        </h3>
        <div className="kindsExplainerGrid">
          {KIND_ORDER.map((kind) => (
            <div key={kind} className="kindsExplainerKindCard">
              <HubIcon name={contentKindHubIcon(kind)} className="kindsExplainerKindIcon" />
              <strong>{t(`contentKind_${kind}`)}</strong>
              <p className="muted small">{t(`kindsExplainerKind_${kind}`)}</p>
              <span className="kindsExplainerKindBadge">
                {t(`kindsExplainerKindVersion_${kind}`)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="kindsExplainerSection" aria-labelledby="kindsExplainerListeModes">
        <h3 id="kindsExplainerListeModes" className="kindsExplainerSectionTitle">
          {t('kindsExplainerListeModesTitle')}
        </h3>
        <p className="muted small kindsExplainerVersionsWhy">{t('kindsExplainerListeModesLead')}</p>
        <div className="kindsExplainerPair">
          <div className="kindsExplainerPairCard">
            <strong>{t('communeContentKind_complex')}</strong>
            <p className="muted small">{t('kindsExplainerListeMode_complex')}</p>
          </div>
          <div className="kindsExplainerPairCard">
            <strong>{t('communeContentKind_table')}</strong>
            <p className="muted small">{t('kindsExplainerListeMode_table')}</p>
          </div>
        </div>
      </section>

      <section className="kindsExplainerSection" aria-labelledby="kindsExplainerVersions">
        <h3 id="kindsExplainerVersions" className="kindsExplainerSectionTitle">
          {t('kindsExplainerVersionsTitle')}
        </h3>
        <p className="muted small kindsExplainerVersionsWhy">{t('kindsExplainerVersionsWhy')}</p>
        <div className="kindsExplainerPair">
          <div className="kindsExplainerPairCard kindsExplainerPairCard--versioned">
            <strong>{t('kindsExplainerVersionedLabel')}</strong>
            <p className="muted small">{t('kindsExplainerVersionedBody')}</p>
            <ol className="kindsExplainerSteps">
              <li>{t('kindsExplainerVersionedStep1')}</li>
              <li>{t('kindsExplainerVersionedStep2')}</li>
              <li>{t('kindsExplainerVersionedStep3')}</li>
            </ol>
          </div>
          <div className="kindsExplainerPairCard kindsExplainerPairCard--standalone">
            <strong>{t('kindsExplainerStandaloneLabel')}</strong>
            <p className="muted small">{t('kindsExplainerStandaloneBody')}</p>
            <ol className="kindsExplainerSteps">
              <li>{t('kindsExplainerStandaloneStep1')}</li>
              <li>{t('kindsExplainerStandaloneStep2')}</li>
            </ol>
          </div>
        </div>
      </section>
    </aside>
  )
}
