import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { TableGridView, TableTitleBlock } from '../TableGridView'
import { localizedName } from '../../utils/schemaColumns'
import { isLinkedToServiceSchema } from '../../utils/embeddedTableSchema'
import { useSchemaTablesOptional } from './SchemaTableContext'

export function SchemaTableNodeView({ node, selected, deleteNode }: NodeViewProps) {
  const { t, i18n } = useTranslation()
  const ctx = useSchemaTablesOptional()
  const readOnly = ctx?.readOnly ?? false
  const tableId = node.attrs.tableId as string
  const table = ctx?.tables[tableId]

  if (!table) {
    return (
      <NodeViewWrapper className="schemaTableNode schemaTableNode-missing">
        <p className="muted">{t('schemaTableMissing')}</p>
      </NodeViewWrapper>
    )
  }

  const tableMeta = table.table_meta || {}
  const locale = i18n.language === 'fr' ? 'fr' : 'ar'
  const metaTitle = locale === 'fr' ? tableMeta.title_fr : tableMeta.title_ar
  const metaSubtitle = locale === 'fr' ? tableMeta.subtitle_fr : tableMeta.subtitle_ar
  const hasMetaHeading = Boolean(metaTitle?.trim() || metaSubtitle?.trim())

  const label = table.schema_name_ar
    ? localizedName({ name_ar: table.schema_name_ar, name_fr: table.schema_name_fr || table.schema_name_ar }, i18n.language)
    : table.schema_slug

  const wrapperClass = `schemaTableNode${readOnly ? ' schemaTableNode-readonly' : ''}${!readOnly && selected ? ' selected' : ''}`

  return (
    <NodeViewWrapper className={wrapperClass} {...(readOnly ? {} : { 'data-drag-handle': true })}>
      {readOnly ? (
        <>
          {hasMetaHeading ? <TableTitleBlock tableMeta={tableMeta} editable={false} /> : null}
          {!hasMetaHeading && label ? (
            <strong className="schemaTableNodeTitle schemaTableNodeTitle-readonly">{label}</strong>
          ) : null}
        </>
      ) : (
        <div className="schemaTableNodeHeader">
          <strong className="schemaTableNodeTitle">
            {label}
            {isLinkedToServiceSchema(table) ? (
              <span className="schemaTableLinkedBadge" title={t('schemaTableLinkedBadge')}>
                {t('schemaTableLinkedBadge')}
              </span>
            ) : null}
          </strong>
          {ctx ? (
            <div className="schemaTableNodeActions">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => ctx.setEditingId(tableId)}>
                {t('edit')}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                title={t('remove')}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  ctx.removeTable(tableId)
                  deleteNode()
                }}
              >
                {t('remove')}
              </button>
            </div>
          ) : null}
        </div>
      )}
      <div className="card tableWorkspaceCard tableWorkspaceCardCompact">
        <div className="tableWorkspaceBody tableWrap excelTable">
          <TableGridView
            columns={table.columns}
            rows={table.rows}
            layoutJson={table.layout_json}
            tableMeta={table.table_meta}
            editable={false}
            showRowMeta
            rowFilterMode="all"
            hideColorToolbar
            embedded={true}
          />
        </div>
      </div>
    </NodeViewWrapper>
  )
}
