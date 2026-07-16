import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { EntityTargetKind } from '../utils/entityTargets'

export type SelectionCatalogItem = {
  entity_key: string
  kind: EntityTargetKind | string
  code: string
  name_ar: string
  name_fr: string
}

type Catalog = {
  municipalities?: SelectionCatalogItem[]
  dairas?: SelectionCatalogItem[]
  modiriyat?: SelectionCatalogItem[]
}

type Props = {
  catalog: Catalog
  /** null = all currently included */
  initialKeys: string[] | null
  onSave: (keys: string[] | null) => Promise<void>
  onClose: () => void
}

export function EntityInclusionModal({ catalog, initialKeys, onSave, onClose }: Props) {
  const { t, i18n } = useTranslation()
  const allItems = useMemo(() => {
    return [
      ...(catalog.municipalities || []),
      ...(catalog.dairas || []),
      ...(catalog.modiriyat || []),
    ]
  }, [catalog])

  const allKeys = useMemo(() => allItems.map((i) => i.entity_key), [allItems])

  const [selected, setSelected] = useState<Set<string>>(() => {
    if (initialKeys == null) return new Set(allKeys)
    return new Set(initialKeys.filter((k) => allKeys.includes(k)))
  })
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allItems
    return allItems.filter((m) => {
      const name = `${m.name_ar || ''} ${m.name_fr || ''} ${m.code || ''}`.toLowerCase()
      return name.includes(q)
    })
  }, [allItems, search])

  const groups: { kind: string; titleKey: string; items: SelectionCatalogItem[] }[] = [
    {
      kind: 'commune',
      titleKey: 'entitySectionCommunes',
      items: filtered.filter((i) => i.kind === 'commune'),
    },
    {
      kind: 'daira',
      titleKey: 'entitySectionDairas',
      items: filtered.filter((i) => i.kind === 'daira'),
    },
    {
      kind: 'modiriya',
      titleKey: 'entitySectionModiriyat',
      items: filtered.filter((i) => i.kind === 'modiriya'),
    },
  ].filter((g) => g.items.length > 0)

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleSave() {
    setError(null)
    if (selected.size === 0) {
      setError('includedEntitiesRequired')
      return
    }
    setSaving(true)
    try {
      const allSelected = selected.size === allKeys.length && allKeys.every((k) => selected.has(k))
      await onSave(allSelected ? null : [...selected])
      onClose()
    } catch {
      setError('errorGeneric')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modalOverlay" role="dialog" aria-modal="true">
      <div className="modalCard entityInclusionModal">
        <h2>{t('entityInclusionTitle')}</h2>
        <p className="muted small">{t('entityInclusionHint')}</p>
        <input
          type="search"
          className="communeSearch"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('entityInclusionSearch')}
        />
        <div className="entityInclusionActions row compact">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelected(new Set(allKeys))}
          >
            {t('entityInclusionSelectAll')}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(new Set())}>
            {t('entityInclusionClear')}
          </button>
          <span className="muted small">
            {t('entityInclusionCount', { selected: selected.size, total: allKeys.length })}
          </span>
        </div>
        <div className="entityInclusionList">
          {groups.map((g) => (
            <section key={g.kind} className="entityInclusionGroup">
              {groups.length > 1 ? <h3 className="entitySectionTitle">{t(g.titleKey)}</h3> : null}
              <ul className="entityInclusionChecks">
                {g.items.map((item) => {
                  const name = i18n.language === 'fr' ? item.name_fr : item.name_ar
                  return (
                    <li key={item.entity_key}>
                      <label className="checkboxLabel">
                        <input
                          type="checkbox"
                          checked={selected.has(item.entity_key)}
                          onChange={() => toggle(item.entity_key)}
                        />
                        <span>{name}</span>
                        <span className="muted small">{item.code}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
          {!filtered.length ? <p className="muted">{t('noResults')}</p> : null}
        </div>
        {error ? <p className="formError">{t(error)}</p> : null}
        <div className="modalActions">
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {t('save')}
          </button>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
