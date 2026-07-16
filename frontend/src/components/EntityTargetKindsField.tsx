import { useTranslation } from 'react-i18next'
import {
  ENTITY_TARGET_KINDS,
  type EntityTargetKind,
  toggleEntityTargetKind,
} from '../utils/entityTargets'

type Props = {
  value: EntityTargetKind[]
  onChange: (next: EntityTargetKind[]) => void
}

export function EntityTargetKindsField({ value, onChange }: Props) {
  const { t } = useTranslation()

  return (
    <fieldset className="entityTargetKindsField">
      <legend>{t('entityTargetKinds')}</legend>
      <div className="entityTargetKindsRow">
        {ENTITY_TARGET_KINDS.map((kind) => (
          <label key={kind} className="checkboxLabel">
            <input
              type="checkbox"
              checked={value.includes(kind)}
              onChange={() => onChange(toggleEntityTargetKind(value, kind))}
            />
            {t(`entityTargetKind_${kind}`)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
