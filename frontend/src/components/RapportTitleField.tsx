import { useTranslation } from 'react-i18next'
import type { EntityIdParam } from '../api'
import * as api from '../api'

type Props = {
  title: string
  onChange: (title: string) => void
  editable: boolean
  fallback?: string
}

export function RapportTitleField({ title, onChange, editable, fallback }: Props) {
  const { t } = useTranslation()

  if (!editable) {
    return <h1>{title || fallback || t('navRapports')}</h1>
  }

  return (
    <label className="rapportTitleField">
      <input
        className="rapportTitleInput"
        value={title}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('rapportTitle')}
        maxLength={500}
        aria-label={t('rapportTitle')}
      />
    </label>
  )
}

export async function patchRapportTitle(token: string, rapportId: EntityIdParam, title: string) {
  const trimmed = title.trim()
  if (!trimmed) {
    const err = new Error('rapportTitleRequired')
    throw err
  }
  const res = await api.patchOfficeRapport(token, rapportId, { title: trimmed })
  return { title: res.rapport?.title || trimmed, rapport: res.rapport }
}
