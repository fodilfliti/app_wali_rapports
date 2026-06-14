export function versionsListPath(
  rapportId: number,
  wali: boolean,
  returnTo?: string,
) {
  const base = wali
    ? `/wali/rapports/${rapportId}/versions`
    : `/office/rapports/${rapportId}/versions`;
  if (!returnTo) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}

export function versionDetailPath(
  rapportId: number,
  versionId: number,
  wali: boolean,
  returnTo?: string,
) {
  const base = wali
    ? `/wali/rapports/${rapportId}/versions/${versionId}`
    : `/office/rapports/${rapportId}/versions/${versionId}`;
  if (!returnTo) return base;
  return `${base}?returnTo=${encodeURIComponent(returnTo)}`;
}
