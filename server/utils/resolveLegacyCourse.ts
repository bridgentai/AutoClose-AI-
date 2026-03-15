/**
 * Resolución obligatoria de curso/grupo legacy.
 * Todas las rutas que reciban cursoId o grupoId (UUID, nombre "11H", o legacy "Física 11H")
 * deben usar resolveGroupId y/o resolveGroupSubjectId de este módulo.
 */
import { findGroupById, findGroupByNameAndInstitution } from '../repositories/groupRepository.js';
import { findGroupSubjectById, findGroupSubjectsByGroupWithDetails } from '../repositories/groupSubjectRepository.js';

/**
 * Dado un identificador que puede ser UUID del grupo, nombre real ("11H") o legacy ("Física 11H"),
 * devuelve el grupo real (row) o null.
 */
export async function resolveGroupId(
  groupOrLegacyId: string,
  institutionId: string
): Promise<{ id: string; name: string } | null> {
  const trimmed = groupOrLegacyId.trim();
  if (trimmed.length === 36 && trimmed.includes('-')) {
    const group = await findGroupById(trimmed);
    if (group && group.institution_id === institutionId) return { id: group.id, name: group.name };
    return null;
  }
  let group = await findGroupByNameAndInstitution(institutionId, trimmed.toUpperCase());
  if (!group && trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    const groupPart = parts.slice(1).join(' ').toUpperCase();
    if (groupPart) group = await findGroupByNameAndInstitution(institutionId, groupPart);
  }
  if (!group || group.institution_id !== institutionId) return null;
  return { id: group.id, name: group.name };
}

/**
 * Dado cursoId (UUID de group_subject, nombre "11H", o legacy "Física 11H"),
 * devuelve el UUID del group_subject. Si es legacy con materia, matchea por subject_name.
 */
export async function resolveGroupSubjectId(
  cursoId: string,
  institutionId: string
): Promise<string | null> {
  const trimmed = cursoId.trim();
  if (trimmed.length === 36 && trimmed.includes('-')) {
    const gs = await findGroupSubjectById(trimmed);
    if (gs && gs.institution_id === institutionId) return gs.id;
    const group = await findGroupById(trimmed);
    if (group && group.institution_id === institutionId) {
      const list = await findGroupSubjectsByGroupWithDetails(group.id, institutionId);
      return list[0]?.id ?? null;
    }
    return null;
  }
  const resolved = await resolveGroupId(trimmed, institutionId);
  if (!resolved) return null;
  const list = await findGroupSubjectsByGroupWithDetails(resolved.id, institutionId);
  if (list.length === 0) return null;
  if (trimmed.includes(' ')) {
    const subjectPart = trimmed.split(/\s+/)[0]?.toLowerCase() ?? '';
    const match = list.find((gs) => gs.subject_name?.toLowerCase() === subjectPart);
    if (match) return match.id;
  }
  return list[0]?.id ?? null;
}
