import type { AnchorHTMLAttributes, ReactNode } from 'react'
import { useSignedFileUrl } from '../hooks/useSignedFileUrl'

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  path: string | undefined | null
  children: ReactNode
}

export function SignedFileLink({ path, children, href: _href, ...rest }: Props) {
  const href = useSignedFileUrl(path)
  if (!href) {
    return (
      <span className={rest.className} aria-disabled>
        {children}
      </span>
    )
  }
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  )
}
