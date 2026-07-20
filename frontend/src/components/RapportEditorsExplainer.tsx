import { useTranslation } from 'react-i18next'
import { HubIcon } from './HubIcons'
import { contentKindHubIcon } from '../utils/rapportNavigation'

type Props = {
  /** When true, omit outer card chrome (for use inside a modal). */
  bare?: boolean
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="kindsExplainerFeatureList">
      {items.map((text) => (
        <li key={text}>{text}</li>
      ))}
    </ul>
  )
}

export function RapportEditorsExplainer({ bare = false }: Props) {
  const { t } = useTranslation()

  return (
    <aside
      className={bare ? 'kindsExplainer kindsExplainer--bare' : 'card kindsExplainer'}
      aria-labelledby="editorsExplainerTitle"
    >
      <h2 id="editorsExplainerTitle" className="kindsExplainerTitle">
        {t('editorsExplainerTitle')}
      </h2>
      <p className="muted small kindsExplainerLead">{t('editorsExplainerLead')}</p>

      <section className="kindsExplainerSection" aria-labelledby="editorsExplainerCommon">
        <h3 id="editorsExplainerCommon" className="kindsExplainerSectionTitle">
          {t('editorsExplainerCommonTitle')}
        </h3>
        <p className="muted small kindsExplainerVersionsWhy">{t('editorsExplainerCommonLead')}</p>
        <ol className="kindsExplainerSteps">
          <li>{t('editorsExplainerCommonStep1')}</li>
          <li>{t('editorsExplainerCommonStep2')}</li>
          <li>{t('editorsExplainerCommonStep3')}</li>
          <li>{t('editorsExplainerCommonStep4')}</li>
          <li>{t('editorsExplainerCommonStep5')}</li>
        </ol>
        <FeatureList
          items={[
            t('editorsExplainerCommonFeature1'),
            t('editorsExplainerCommonFeature2'),
            t('editorsExplainerCommonFeature3'),
            t('editorsExplainerCommonFeature4'),
          ]}
        />
      </section>

      <section className="kindsExplainerSection" aria-labelledby="editorsExplainerDocument">
        <h3 id="editorsExplainerDocument" className="kindsExplainerSectionTitle">
          <HubIcon
            name={contentKindHubIcon('document_compose')}
            className="kindsExplainerKindIcon"
          />{' '}
          {t('editorsExplainerDocumentTitle')}
        </h3>
        <p className="muted small">{t('editorsExplainerDocumentLead')}</p>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCreateHow')}</strong>
        <ol className="kindsExplainerSteps">
          <li>{t('editorsExplainerDocumentCreate1')}</li>
          <li>{t('editorsExplainerDocumentCreate2')}</li>
          <li>{t('editorsExplainerDocumentCreate3')}</li>
          <li>{t('editorsExplainerDocumentCreate4')}</li>
        </ol>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCanDo')}</strong>
        <FeatureList
          items={[
            t('editorsExplainerDocumentFeature1'),
            t('editorsExplainerDocumentFeature2'),
            t('editorsExplainerDocumentFeature3'),
            t('editorsExplainerDocumentFeature4'),
            t('editorsExplainerDocumentFeature5'),
            t('editorsExplainerDocumentFeature6'),
            t('editorsExplainerDocumentFeature7'),
            t('editorsExplainerDocumentFeature8'),
          ]}
        />
        <p className="muted small kindsExplainerVersionsWhy">{t('editorsExplainerDocumentFicheNote')}</p>
      </section>

      <section className="kindsExplainerSection" aria-labelledby="editorsExplainerTable">
        <h3 id="editorsExplainerTable" className="kindsExplainerSectionTitle">
          <HubIcon name={contentKindHubIcon('table_grid')} className="kindsExplainerKindIcon" />{' '}
          {t('editorsExplainerTableTitle')}
        </h3>
        <p className="muted small">{t('editorsExplainerTableLead')}</p>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCreateHow')}</strong>
        <ol className="kindsExplainerSteps">
          <li>{t('editorsExplainerTableCreate1')}</li>
          <li>{t('editorsExplainerTableCreate2')}</li>
          <li>{t('editorsExplainerTableCreate3')}</li>
          <li>{t('editorsExplainerTableCreate4')}</li>
        </ol>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCanDo')}</strong>
        <FeatureList
          items={[
            t('editorsExplainerTableFeature1'),
            t('editorsExplainerTableFeature2'),
            t('editorsExplainerTableFeature3'),
            t('editorsExplainerTableFeature4'),
            t('editorsExplainerTableFeature5'),
            t('editorsExplainerTableFeature6'),
            t('editorsExplainerTableFeature7'),
            t('editorsExplainerTableFeature8'),
            t('editorsExplainerTableFeature9'),
          ]}
        />
      </section>

      <section className="kindsExplainerSection" aria-labelledby="editorsExplainerListeComplex">
        <h3 id="editorsExplainerListeComplex" className="kindsExplainerSectionTitle">
          <HubIcon
            name={contentKindHubIcon('commune_list')}
            className="kindsExplainerKindIcon"
          />{' '}
          {t('editorsExplainerListeComplexTitle')}
        </h3>
        <p className="muted small">{t('editorsExplainerListeComplexLead')}</p>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCreateHow')}</strong>
        <ol className="kindsExplainerSteps">
          <li>{t('editorsExplainerListeComplexCreate1')}</li>
          <li>{t('editorsExplainerListeComplexCreate2')}</li>
          <li>{t('editorsExplainerListeComplexCreate3')}</li>
          <li>{t('editorsExplainerListeComplexCreate4')}</li>
        </ol>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCanDo')}</strong>
        <FeatureList
          items={[
            t('editorsExplainerListeComplexFeature1'),
            t('editorsExplainerListeComplexFeature2'),
            t('editorsExplainerListeComplexFeature3'),
            t('editorsExplainerListeComplexFeature4'),
            t('editorsExplainerListeComplexFeature5'),
            t('editorsExplainerListeComplexFeature6'),
          ]}
        />
      </section>

      <section className="kindsExplainerSection" aria-labelledby="editorsExplainerListeTable">
        <h3 id="editorsExplainerListeTable" className="kindsExplainerSectionTitle">
          <HubIcon
            name={contentKindHubIcon('commune_list')}
            className="kindsExplainerKindIcon"
          />{' '}
          {t('editorsExplainerListeTableTitle')}
        </h3>
        <p className="muted small">{t('editorsExplainerListeTableLead')}</p>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCreateHow')}</strong>
        <ol className="kindsExplainerSteps">
          <li>{t('editorsExplainerListeTableCreate1')}</li>
          <li>{t('editorsExplainerListeTableCreate2')}</li>
          <li>{t('editorsExplainerListeTableCreate3')}</li>
          <li>{t('editorsExplainerListeTableCreate4')}</li>
        </ol>
        <strong className="kindsExplainerSubHead">{t('editorsExplainerCanDo')}</strong>
        <FeatureList
          items={[
            t('editorsExplainerListeTableFeature1'),
            t('editorsExplainerListeTableFeature2'),
            t('editorsExplainerListeTableFeature3'),
            t('editorsExplainerListeTableFeature4'),
            t('editorsExplainerListeTableFeature5'),
            t('editorsExplainerListeTableFeature6'),
            t('editorsExplainerListeTableFeature7'),
          ]}
        />
      </section>
    </aside>
  )
}
