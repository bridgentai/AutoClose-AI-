/** Color estable por id de curso/grupo (misma paleta que cursos/calendario). */
export function generateCourseColor(id: string): string {
  if (!id) return '#002366';
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#002366',
    '#1e3cff',
    '#00c8ff',
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
    '#ec4899',
    '#14b8a6',
    '#6366f1',
    '#84cc16',
    '#f43f5e',
  ];
  return colors[Math.abs(hash) % colors.length];
}
