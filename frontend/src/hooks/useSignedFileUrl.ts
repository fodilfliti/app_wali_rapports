import { useEffect, useState } from 'react'
import { signFileUrl } from '../api'

/** Resolve a /files/ path to a short-lived signed URL for img/a/video src. */
export function useSignedFileUrl(filePath: string | undefined | null): string {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (!filePath) {
      setUrl('')
      return
    }
    let cancelled = false
    signFileUrl(filePath)
      .then((signed) => {
        if (!cancelled) setUrl(signed)
      })
      .catch(() => {
        if (!cancelled) setUrl('')
      })
    return () => {
      cancelled = true
    }
  }, [filePath])

  return url
}
