/** Roles que pueden usar layouts `/admin/academia`, `/admin/comunicacion`, `/admin/comunidad`. */
export const ADMIN_COLEGIO_LAYOUT_ROLES = ['admin-general-colegio', 'super_admin'] as const;

export function isAdminColegioLayoutRole(rol: string | undefined): boolean {
  return !!rol && (ADMIN_COLEGIO_LAYOUT_ROLES as readonly string[]).includes(rol);
}
