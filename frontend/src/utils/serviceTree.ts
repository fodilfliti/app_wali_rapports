export function serviceLabel(s: { name_ar?: string; name_fr?: string }, locale: string) {
  return locale === 'fr' ? s.name_fr || s.name_ar || '' : s.name_ar || s.name_fr || ''
}

export function findServiceNode(nodes: any[], id: number): any | null {
  for (const n of nodes) {
    if (Number(n.id) === id) return n
    if (n.children?.length) {
      const hit = findServiceNode(n.children, id)
      if (hit) return hit
    }
  }
  return null
}

export function folderBackPath(
  nodes: any[],
  folderId: number,
  basePath: string,
): string {
  const path: any[] = []
  function walk(list: any[], trail: any[]): boolean {
    for (const n of list) {
      const next = [...trail, n]
      if (Number(n.id) === folderId) {
        path.push(...next)
        return true
      }
      if (n.children?.length && walk(n.children, next)) return true
    }
    return false
  }
  walk(nodes, [])
  if (path.length < 2) return basePath
  const parent = path[path.length - 2]
  if (parent?.is_folder) return `${basePath}/folder/${parent.id}`
  return basePath
}
