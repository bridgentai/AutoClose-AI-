export function getRoleHomePath(role: string): string {
  switch (role) {
    case 'estudiante':
      return '/student';
    case 'profesor':
      return '/teacher';
    case 'directivo':
      return '/director';
    case 'padre':
      return '/parent';
    default:
      return '/dashboard';
  }
}
