import type { ReactNode, ReactElement, SVGProps } from 'react'

export type HubIconName =
  | 'municipalities'
  | 'users'
  | 'rapports'
  | 'services'
  | 'schemas'
  | 'access'
  | 'notifications'
  | 'shared'
  | 'inbox'
  | 'calendar'
  | 'officeUsers'
  | 'table'
  | 'document'
  | 'fiche'
  | 'communes'
  | 'config'
  | 'folder'
  | 'file'
  | 'create'

type IconProps = SVGProps<SVGSVGElement>

function SvgBase({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  )
}

const UsersIcon = (p: IconProps) => (
  <SvgBase {...p}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </SvgBase>
)

const RapportsIcon = (p: IconProps) => (
  <SvgBase {...p}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
  </SvgBase>
)

const ServicesIcon = (p: IconProps) => (
  <SvgBase {...p}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </SvgBase>
)

const icons: Record<HubIconName, (props: IconProps) => ReactElement> = {
  municipalities: (p) => (
    <SvgBase {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-6h6v6" />
      <path d="M9 9h.01M15 9h.01" />
    </SvgBase>
  ),
  users: UsersIcon,
  rapports: RapportsIcon,
  services: ServicesIcon,
  schemas: (p) => (
    <SvgBase {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
    </SvgBase>
  ),
  access: (p) => (
    <SvgBase {...p}>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </SvgBase>
  ),
  notifications: (p) => (
    <SvgBase {...p}>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </SvgBase>
  ),
  shared: (p) => (
    <SvgBase {...p}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </SvgBase>
  ),
  inbox: (p) => (
    <SvgBase {...p}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6l8-5 8 5z" />
    </SvgBase>
  ),
  calendar: (p) => (
    <SvgBase {...p}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <rect x="7" y="14" width="3" height="3" rx="0.5" fill="currentColor" stroke="none" />
    </SvgBase>
  ),
  officeUsers: UsersIcon,
  table: (p) => (
    <SvgBase {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M3 15h18M9 3v18" />
    </SvgBase>
  ),
  document: (p) => (
    <SvgBase {...p}>
      <path d="M12 3v18M8 7h8M8 11h8M8 15h5" />
      <rect x="4" y="3" width="16" height="18" rx="2" />
    </SvgBase>
  ),
  fiche: (p) => (
    <SvgBase {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8M8 11h8" />
    </SvgBase>
  ),
  communes: (p) => (
    <SvgBase {...p}>
      <path d="M12 21s-6-4.35-6-10a6 6 0 0 1 12 0c0 5.65-6 10-6 10z" />
      <circle cx="12" cy="11" r="2.5" />
    </SvgBase>
  ),
  config: (p) => (
    <SvgBase {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </SvgBase>
  ),
  folder: ServicesIcon,
  file: RapportsIcon,
  create: (p) => (
    <SvgBase {...p}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </SvgBase>
  ),
}

export function HubIcon({ name, className }: { name: HubIconName; className?: string }) {
  const Icon = icons[name]
  return <Icon className={className} />
}

export function serviceHubIcon(service: {
  is_folder?: boolean
  rapportTypes?: { content_kind?: string }[]
}): HubIconName {
  if (service.is_folder) return 'folder'
  const kinds = (service.rapportTypes || []).map((t) => t.content_kind)
  if (kinds.includes('table_grid')) return 'table'
  if (kinds.includes('commune_list')) return 'communes'
  if (kinds.includes('fiche_lecture')) return 'fiche'
  if (kinds.includes('document_compose')) return 'document'
  return 'services'
}
