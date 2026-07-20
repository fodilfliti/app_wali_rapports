import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  invalidateAppQueries,
  type InvalidateOptions,
} from '../query/invalidateAppQueries'

export function useInvalidateAppQueries() {
  const queryClient = useQueryClient()
  return useCallback(
    (opts: InvalidateOptions = {}) => invalidateAppQueries(queryClient, opts),
    [queryClient],
  )
}
