export function getRoleHomePath(role: string): string {
  // Redirigir asistentes a su interfaz específica
  if (role === 'asistente') {
    return '/asistente';
  }
  // School admin va al dashboard (puede tener su propia página más adelante)
  if (role === 'school_admin') {
    return '/dashboard';
  }
  // Super admin general va al dashboard (donde verá la interfaz de gestión)
  if (role === 'super_admin') {
    return '/dashboard';
  }
  // Admin general del colegio va al dashboard
  if (role === 'admin-general-colegio') {
    return '/dashboard';
  }
  // Todos los demás roles van al dashboard oficial
  return '/dashboard';
}
