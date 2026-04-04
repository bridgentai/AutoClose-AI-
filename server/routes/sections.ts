import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth.js';
import { logAdminAction } from '../services/auditLogger';
import {
  findSectionsByInstitution,
  createSection,
  updateSectionName,
  findSectionById,
  findSectionByInstitutionAndName,
} from '../repositories/sectionRepository.js';
import {
  findGroupById,
  findGroupByNameAndInstitution,
  findGroupsBySection,
  updateGroupSection,
} from '../repositories/groupRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

function canManageSections(req: AuthRequest): { allowed: boolean; colegioId?: string } {
  const colegioId = req.user?.colegioId;
  if (!req.user?.id || !colegioId) return { allowed: false };
  const allowed = req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin';
  return { allowed, colegioId };
}

function canViewSections(req: AuthRequest): { allowed: boolean; colegioId?: string } {
  const colegioId = req.user?.colegioId;
  if (!req.user?.id || !colegioId) return { allowed: false };
  const allowed = req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin' || req.user.rol === 'directivo';
  return { allowed, colegioId };
}

router.get('/my-section', protect, requireRole('directivo'), async (req: AuthRequest, res) => {
  try {
    const sectionId = req.user?.sectionId;
    const colegioId = req.user?.colegioId;
    if (!sectionId) return res.status(404).json({ message: 'No tienes una sección asignada.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const section = await findSectionById(sectionId);
    if (!section || section.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Sección no encontrada.' });
    }

    const groups = await findGroupsBySection(sectionId);
    const totalEstudiantes = await queryPg<{ count: number }>(
      `SELECT COUNT(DISTINCT e.student_id)::int AS count
       FROM enrollments e
       WHERE e.group_id = ANY($1::uuid[])`,
      [groups.map(g => g.id)]
    );

    return res.json({
      id: section.id,
      _id: section.id,
      nombre: section.name,
      grupos: groups.map(g => ({ id: g.id, _id: g.id, nombre: g.name })),
      totalGrupos: groups.length,
      totalEstudiantes: totalEstudiantes.rows[0]?.count ?? 0,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener sección.' });
  }
});

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canViewSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para listar secciones.' });
    }

    const sections = await findSectionsByInstitution(colegioId);
    const result = await Promise.all(
      sections.map(async (s) => {
        const grupos = await findGroupsBySection(s.id);
        return {
          _id: s.id,
          nombre: s.name,
          colegioId: s.institution_id,
          cursos: grupos.map((g) => ({ _id: g.id, nombre: g.name })),
        };
      })
    );
    return res.json(result);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar secciones.' });
  }
});

router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para crear secciones.' });
    }
    const userId = req.user?.id;
    const { nombre, cursoIds } = req.body as { nombre?: string; cursoIds?: string[] };
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre de la sección es obligatorio.' });
    }
    const nombreTrim = nombre.trim();

    const existente = await findSectionByInstitutionAndName(colegioId, nombreTrim);
    if (existente) {
      return res.status(400).json({ message: `Ya existe una sección llamada "${nombreTrim}".` });
    }
    const section = await createSection(colegioId, nombreTrim);
    const idsToLink = Array.isArray(cursoIds) ? cursoIds : [];
    for (const idOrName of idsToLink) {
      const str = String(idOrName).trim();
      const group = (str.length === 36 && str.includes('-'))
        ? await findGroupById(str)
        : await findGroupByNameAndInstitution(colegioId, str.toUpperCase());
      if (group && group.institution_id === colegioId) {
        await updateGroupSection(group.id, colegioId, section.id);
      }
    }
    const cursos = await findGroupsBySection(section.id);
    if (userId) {
      logAdminAction({
        userId,
        role: 'admin-general-colegio',
        action: 'create_section',
        entityType: 'section',
        entityId: section.id,
        colegioId,
        requestData: { nombre: nombreTrim, cursoIds: idsToLink },
      }).catch(() => {});
    }
    return res.status(201).json({
      message: 'Sección creada correctamente.',
      section: {
        _id: section.id,
        nombre: section.name,
        colegioId: section.institution_id,
        cursos: cursos.map((g) => ({ _id: g.id, nombre: g.name })),
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear la sección.' });
  }
});

router.patch('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para editar secciones.' });
    }
    const userId = req.user?.id;
    const sectionId = req.params.id;

    const section = await findSectionById(sectionId);
    if (!section || section.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Sección no encontrada.' });
    }
    const { nombre, addCursoIds, removeCursoIds } = req.body as {
      nombre?: string;
      addCursoIds?: string[];
      removeCursoIds?: string[];
    };

    if (typeof nombre === 'string' && nombre.trim()) {
      const otro = await findSectionByInstitutionAndName(colegioId, nombre.trim());
      if (otro && otro.id !== sectionId) {
        return res.status(400).json({ message: 'Ya existe otra sección con ese nombre.' });
      }
      await updateSectionName(sectionId, colegioId, nombre.trim());
    }

    const toAdd = Array.isArray(addCursoIds) ? addCursoIds : [];
    for (const idOrName of toAdd) {
      const str = String(idOrName).trim();
      const group = (str.length === 36 && str.includes('-'))
        ? await findGroupById(str)
        : await findGroupByNameAndInstitution(colegioId, str.toUpperCase());
      if (group && group.institution_id === colegioId) {
        await updateGroupSection(group.id, colegioId, sectionId);
      }
    }

    const toRemove = Array.isArray(removeCursoIds) ? removeCursoIds : [];
    const allSections = await findSectionsByInstitution(colegioId);
    const fallbackSectionId = allSections.find((s) => s.id !== sectionId)?.id ?? allSections[0]?.id;
    for (const idOrName of toRemove) {
      const str = String(idOrName).trim();
      const group = (str.length === 36 && str.includes('-'))
        ? await findGroupById(str)
        : await findGroupByNameAndInstitution(colegioId, str.toUpperCase());
      if (group && group.institution_id === colegioId && group.section_id === sectionId && fallbackSectionId) {
        await updateGroupSection(group.id, colegioId, fallbackSectionId);
      }
    }

    if (userId) {
      logAdminAction({
        userId,
        role: 'admin-general-colegio',
        action: 'update_section',
        entityType: 'section',
        entityId: sectionId,
        colegioId,
        requestData: { nombre, addCursoIds: toAdd, removeCursoIds: toRemove },
      }).catch(() => {});
    }

    const updated = await findSectionById(sectionId);
    const cursos = updated ? await findGroupsBySection(updated.id) : [];
    return res.json({
      message: 'Sección actualizada.',
      section: {
        _id: updated?.id ?? sectionId,
        nombre: updated?.name ?? '',
        colegioId,
        cursos: cursos.map((g) => ({ _id: g.id, nombre: g.name })),
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar la sección.' });
  }
});

export default router;
