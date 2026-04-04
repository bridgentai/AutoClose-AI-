import type { AuthRequest } from '../middleware/auth.js';
import { findGroupsBySection } from '../repositories/groupRepository.js';

/**
 * For directivos: returns group IDs belonging to their section.
 * For admin-general/super_admin: returns null (no section restriction).
 * Returns [] if the directivo has no section assigned (sees nothing).
 */
export async function getDirectivoGroupIds(req: AuthRequest): Promise<string[] | null> {
  const rol = req.user?.rol;
  if (rol !== 'directivo') return null;

  const sectionId = req.user?.sectionId;
  if (!sectionId) {
    console.warn(`[sectionFilter] Directivo ${req.user?.id} sin section_id asignado`);
    return [];
  }

  const groups = await findGroupsBySection(sectionId);
  return groups.map((g) => g.id);
}

/**
 * Builds a WHERE clause fragment filtering groups by section when applicable.
 * Returns { clause, params, nextIndex }.
 */
export function buildGroupFilter(
  groupIds: string[] | null,
  institutionId: string,
  startIndex: number = 1,
): { clause: string; params: unknown[]; nextIndex: number } {
  if (groupIds === null) {
    return {
      clause: `institution_id = $${startIndex}`,
      params: [institutionId],
      nextIndex: startIndex + 1,
    };
  }
  if (groupIds.length === 0) {
    return {
      clause: '1 = 0',
      params: [],
      nextIndex: startIndex,
    };
  }
  const placeholders = groupIds.map((_, i) => `$${startIndex + 1 + i}`).join(', ');
  return {
    clause: `institution_id = $${startIndex} AND group_id IN (${placeholders})`,
    params: [institutionId, ...groupIds],
    nextIndex: startIndex + 1 + groupIds.length,
  };
}
