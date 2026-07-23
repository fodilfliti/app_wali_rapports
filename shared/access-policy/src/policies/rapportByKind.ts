import { canOfficeEditRapport } from './rapportStatus';

export type ContentKind =
  | 'table_grid'
  | 'document_compose'
  | 'fiche_lecture'
  | 'commune_list';

export type VersioningMode = 'versioned' | 'standalone';

export type RapportKindContext = {
  content_kind: ContentKind;
  versioning_mode?: VersioningMode | string | null;
  commune_content_kind?: string | null;
  status?: string | null;
  accessLevel?: string | null;
};

/** Versioned + acknowledged — office may fork a new draft. Never for fiche_lecture. */
export function canStartNewVersion(ctx: {
  status?: string | null;
  versioning_mode?: VersioningMode | string | null;
  content_kind: ContentKind;
}): boolean {
  if (ctx.content_kind === 'fiche_lecture') return false;
  return ctx.status === 'acknowledged' && ctx.versioning_mode === 'versioned';
}

/** Version archive UI — false for fiche_lecture; true when versioned. */
export function canShowVersionArchive(ctx: {
  versioning_mode?: VersioningMode | string | null;
  content_kind: ContentKind;
}): boolean {
  if (ctx.content_kind === 'fiche_lecture') return false;
  return ctx.versioning_mode === 'versioned';
}

/** Excel export — table_grid or commune_list in table mode. */
export function canExportExcel(ctx: {
  content_kind: ContentKind;
  commune_content_kind?: string | null;
}): boolean {
  if (ctx.content_kind === 'table_grid') return true;
  if (ctx.content_kind === 'commune_list') return ctx.commune_content_kind === 'table';
  return false;
}

/** Wali response export block — fiche_lecture only. */
export function canShowWaliResponseExportBlock(ctx: {
  content_kind: ContentKind;
}): boolean {
  return ctx.content_kind === 'fiche_lecture';
}

/**
 * Kind-aware office edit gate — still requires manage accessLevel + editable status.
 * Explicit false semantics for non-office callers (call canOfficeEditRapport for status-only).
 */
export function canOfficeEditRapportKind(ctx: RapportKindContext): boolean {
  if (ctx.accessLevel !== undefined && ctx.accessLevel !== 'manage') return false;
  if (!ctx.status) return false;
  return canOfficeEditRapport(ctx.status);
}
