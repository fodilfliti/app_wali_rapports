export const DEFAULT_PAGE_SIZE = 20

export function totalPages(total: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize))
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number = DEFAULT_PAGE_SIZE) {
  const start = (Math.max(1, page) - 1) * pageSize
  return items.slice(start, start + pageSize)
}
