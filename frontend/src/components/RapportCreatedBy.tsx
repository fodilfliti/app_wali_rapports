import { useTranslation } from "react-i18next";

export type CreatedByUser = {
  id?: string | number;
  name?: string | null;
  username?: string | null;
  role?: string;
  is_deleted?: boolean;
  deleted_at?: string | null;
};

function roleLabel(role: string | undefined, t: (k: string) => string) {
  if (role === "CHEF_CABINET") return t("roleChefCabinet");
  if (role === "WALI") return t("roleWali");
  if (role === "ADMIN") return t("roleAdmin");
  return t("roleOffice");
}

/** Display name for rapport / version creator (soft-delete → role label). */
export function createdByDisplayName(
  user: CreatedByUser | null | undefined,
  t: (k: string) => string,
): string | null {
  if (!user) return null;
  const deleted = Boolean(user.is_deleted || user.deleted_at);
  if (deleted || (!user.name && !user.username)) {
    return roleLabel(user.role, t);
  }
  return user.name || user.username || roleLabel(user.role, t);
}

type Props = {
  user?: CreatedByUser | null;
  className?: string;
  /** i18n key with `{{name}}` — default `createdByUser` */
  labelKey?: string;
};

export function RapportCreatedBy({
  user,
  className = "muted small rapportCreatedBy",
  labelKey = "createdByUser",
}: Props) {
  const { t } = useTranslation();
  const name = createdByDisplayName(user, t);
  if (!name) return null;
  return <p className={className}>{t(labelKey, { name })}</p>;
}
