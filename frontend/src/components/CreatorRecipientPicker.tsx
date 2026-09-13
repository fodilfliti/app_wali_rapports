import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type { EntityIdParam } from '../api'
import { TablePagination } from './TablePagination'
import { DEFAULT_PAGE_SIZE, paginateSlice } from '../utils/pagination'

export type CreatorBulkFlags = {
  allOffice: boolean
  allDaira: boolean
  allCommune: boolean
  allDirection: boolean
  /** Chef share / Chef instructions only — select all Wali accounts. */
  allWali?: boolean
}

type CreatorRoleFilter =
  | 'all'
  | 'OFFICE_USER'
  | 'PRESIDENT_DAIRA'
  | 'PRESIDENT_COMMUNE'
  | 'DIRECTEUR_DIRECTION'
  | 'WALI'

const CREATOR_ROLE_KEYS = [
  'OFFICE_USER',
  'PRESIDENT_DAIRA',
  'PRESIDENT_COMMUNE',
  'DIRECTEUR_DIRECTION',
] as const

export function creatorRoleLabel(role: string | undefined, t: TFunction) {
  if (role === 'PRESIDENT_DAIRA') return t('rolePresidentDaira')
  if (role === 'PRESIDENT_COMMUNE') return t('rolePresidentCommune')
  if (role === 'DIRECTEUR_DIRECTION') return t('roleDirecteurDirection')
  if (role === 'OFFICE_USER') return t('roleOffice')
  if (role === 'CHEF_CABINET') return t('roleChefCabinet')
  if (role === 'WALI') return t('roleWali')
  return role || ''
}

export function isCreatorRoleCoveredByBulk(role: string | undefined, flags: CreatorBulkFlags) {
  if (role === 'OFFICE_USER') return flags.allOffice
  if (role === 'PRESIDENT_DAIRA') return flags.allDaira
  if (role === 'PRESIDENT_COMMUNE') return flags.allCommune
  if (role === 'DIRECTEUR_DIRECTION') return flags.allDirection
  if (role === 'WALI') return Boolean(flags.allWali)
  return false
}

/** Drop individual selections that are already covered by an “all role” flag. */
export function pruneSelectedCoveredByBulk(
  selected: EntityIdParam[],
  users: { id: unknown; role?: string }[],
  flags: CreatorBulkFlags,
): EntityIdParam[] {
  const coveredIds = new Set(
    users.filter((u) => isCreatorRoleCoveredByBulk(u.role, flags)).map((u) => String(u.id)),
  )
  return selected.filter((id) => !coveredIds.has(String(id)))
}

type Props = {
  users: any[]
  flags: CreatorBulkFlags
  onFlagsChange: (next: Partial<CreatorBulkFlags>) => void
  selected: EntityIdParam[]
  onSelectedChange: (next: EntityIdParam[]) => void
  /** Fieldset legend / help (instructions vs shared files). */
  legendKey?: string
  helpKey?: string
  /** Show «كل الولاة» bulk checkbox (Chef share / Chef instructions). */
  showWaliBulk?: boolean
}

export function CreatorRecipientPicker({
  users,
  flags,
  onFlagsChange,
  selected,
  onSelectedChange,
  legendKey = 'instructionRecipients',
  helpKey = 'instructionRecipientsHelp',
  showWaliBulk = false,
}: Props) {
  const { t } = useTranslation()
  const [userSearch, setUserSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<CreatorRoleFilter>('all')
  const [userPage, setUserPage] = useState(1)
  const allWali = Boolean(flags.allWali)

  // Keep individual selection in sync when bulk flags change.
  useEffect(() => {
    const pruned = pruneSelectedCoveredByBulk(selected, users, flags)
    if (pruned.length !== selected.length) onSelectedChange(pruned)
  }, [
    flags.allOffice,
    flags.allDaira,
    flags.allCommune,
    flags.allDirection,
    flags.allWali,
    users,
    selected,
    onSelectedChange,
  ])

  // If active chip is a fully bulk-covered role, jump back to “all”.
  useEffect(() => {
    if (roleFilter !== 'all' && isCreatorRoleCoveredByBulk(roleFilter, flags)) {
      setRoleFilter('all')
    }
  }, [flags, roleFilter])

  const availableUsers = useMemo(
    () => users.filter((u) => !isCreatorRoleCoveredByBulk(u.role, flags)),
    [users, flags],
  )

  const hiddenByBulkCount = users.length - availableUsers.length

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase()
    return availableUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (!q) return true
      const roleLabel = creatorRoleLabel(u.role, t).toLowerCase()
      return (
        String(u.name || '')
          .toLowerCase()
          .includes(q) ||
        String(u.username || '')
          .toLowerCase()
          .includes(q) ||
        roleLabel.includes(q)
      )
    })
  }, [availableUsers, userSearch, roleFilter, t])

  useEffect(() => {
    setUserPage(1)
  }, [
    userSearch,
    roleFilter,
    flags.allOffice,
    flags.allDaira,
    flags.allCommune,
    flags.allDirection,
    flags.allWali,
  ])

  const pagedUsers = paginateSlice(filteredUsers, userPage, DEFAULT_PAGE_SIZE)
  const selectedVisible = selected.filter((id) =>
    filteredUsers.some((u) => String(u.id) === String(id)),
  ).length

  function setBulk(role: (typeof CREATOR_ROLE_KEYS)[number] | 'WALI', enabled: boolean) {
    const patch: Partial<CreatorBulkFlags> =
      role === 'OFFICE_USER'
        ? { allOffice: enabled }
        : role === 'PRESIDENT_DAIRA'
          ? { allDaira: enabled }
          : role === 'PRESIDENT_COMMUNE'
            ? { allCommune: enabled }
            : role === 'DIRECTEUR_DIRECTION'
              ? { allDirection: enabled }
              : { allWali: enabled }
    onFlagsChange(patch)
  }

  function toggleUser(userId: string, enabled: boolean) {
    onSelectedChange(
      enabled
        ? [...new Set([...selected.map(String), userId])]
        : selected.filter((id) => String(id) !== userId),
    )
  }

  function selectFiltered() {
    onSelectedChange([
      ...new Set([...selected.map(String), ...filteredUsers.map((u) => String(u.id))]),
    ])
  }

  function clearSelection() {
    onSelectedChange([])
  }

  const roleFilters: { id: CreatorRoleFilter; label: string; disabled?: boolean }[] = [
    { id: 'all', label: t('recipientFilterAll') },
    {
      id: 'OFFICE_USER',
      label: t('navCreatorsOffice'),
      disabled: flags.allOffice,
    },
    {
      id: 'PRESIDENT_DAIRA',
      label: t('navCreatorsDaira'),
      disabled: flags.allDaira,
    },
    {
      id: 'PRESIDENT_COMMUNE',
      label: t('navCreatorsCommune'),
      disabled: flags.allCommune,
    },
    {
      id: 'DIRECTEUR_DIRECTION',
      label: t('navCreatorsDirection'),
      disabled: flags.allDirection,
    },
  ]
  if (showWaliBulk) {
    roleFilters.push({
      id: 'WALI',
      label: t('roleWali'),
      disabled: allWali,
    })
  }

  const allCovered = availableUsers.length === 0 && users.length > 0

  return (
    <fieldset className="shareRecipientsSection">
      <legend className="shareRecipientsLegend">{t(legendKey)}</legend>
      <p className="muted small shareRecipientsHelp">{t(helpKey)}</p>

      <div className="instructionRoleBulk">
        <label className="formCheck">
          <input
            type="checkbox"
            checked={flags.allOffice}
            onChange={(e) => setBulk('OFFICE_USER', e.target.checked)}
          />
          <span>{t('allCreatorsOffice')}</span>
        </label>
        <label className="formCheck">
          <input
            type="checkbox"
            checked={flags.allDaira}
            onChange={(e) => setBulk('PRESIDENT_DAIRA', e.target.checked)}
          />
          <span>{t('allCreatorsDaira')}</span>
        </label>
        <label className="formCheck">
          <input
            type="checkbox"
            checked={flags.allCommune}
            onChange={(e) => setBulk('PRESIDENT_COMMUNE', e.target.checked)}
          />
          <span>{t('allCreatorsCommune')}</span>
        </label>
        <label className="formCheck">
          <input
            type="checkbox"
            checked={flags.allDirection}
            onChange={(e) => setBulk('DIRECTEUR_DIRECTION', e.target.checked)}
          />
          <span>{t('allCreatorsDirection')}</span>
        </label>
        {showWaliBulk ? (
          <label className="formCheck">
            <input
              type="checkbox"
              checked={allWali}
              onChange={(e) => setBulk('WALI', e.target.checked)}
            />
            <span>{t('allWaliAccounts')}</span>
          </label>
        ) : null}
      </div>

      {hiddenByBulkCount > 0 ? (
        <p className="muted small recipientBulkHint">
          {t('recipientBulkHidesUsers', { count: hiddenByBulkCount })}
        </p>
      ) : null}

      <div className={`recipientPanel${allCovered ? ' recipientPanel--empty' : ''}`}>
        {allCovered ? (
          <p className="muted small recipientEmpty">{t('recipientAllRolesCovered')}</p>
        ) : (
          <>
            <div className="recipientToolbar">
              <div className="recipientSearchWrap">
                <input
                  type="search"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder={t('shareSearchUsers')}
                  aria-label={t('shareSearchUsers')}
                  autoComplete="off"
                />
                {userSearch ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm recipientSearchClear"
                    onClick={() => setUserSearch('')}
                  >
                    {t('searchClear')}
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={selectFiltered}
                disabled={!filteredUsers.length}
              >
                {t('shareSelectAll')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={clearSelection}
                disabled={!selected.length}
              >
                {t('shareClearSelection')}
              </button>
            </div>

            <div className="recipientRoleFilters" role="group" aria-label={t(legendKey)}>
              {roleFilters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`recipientRoleChip${roleFilter === f.id ? ' active' : ''}${
                    f.disabled ? ' disabled' : ''
                  }`}
                  disabled={f.disabled}
                  title={f.disabled ? t('recipientRoleChipDisabled') : undefined}
                  onClick={() => setRoleFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <p className="muted small recipientCount">
              {t('shareSelectedCount', { count: selectedVisible, total: filteredUsers.length })}
              {selected.length > selectedVisible
                ? ` · ${t('instructionSelectedTotal', { count: selected.length })}`
                : null}
            </p>

            <ul className="recipientList">
              {pagedUsers.length ? (
                pagedUsers.map((u) => {
                  const userId = String(u.id)
                  const checked = selected.some((id) => String(id) === userId)
                  return (
                    <li key={userId}>
                      <label className={`formCheck recipientRow${checked ? ' selected' : ''}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => toggleUser(userId, e.target.checked)}
                        />
                        <span className="recipientRowMain">
                          <strong>{u.name || u.username}</strong>
                          <span className="recipientRowMeta muted small">
                            {u.name ? <span>{u.username}</span> : null}
                            {u.role ? (
                              <span className="recipientRoleBadge">{creatorRoleLabel(u.role, t)}</span>
                            ) : null}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })
              ) : (
                <li className="recipientEmpty muted small">{t('noResults')}</li>
              )}
            </ul>
            <TablePagination
              page={userPage}
              total={filteredUsers.length}
              onPageChange={setUserPage}
              compact
            />
          </>
        )}
      </div>
    </fieldset>
  )
}
