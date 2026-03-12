import express from 'express';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware.js';
import { findLearningResourcesByInstitution, createLearningResource, findLearningResourceById, deleteLearningResource } from '../repositories/learningResourceRepository.js';
import { findGroupByNameAndInstitution, findGroupById } from '../repositories/groupRepository.js';
import { findGroupSubjectById } from '../repositories/groupSubjectRepository.js';
import { createEvoFile } from '../repositories/evoFileRepository.js';
import { findUserById } from '../repositories/userRepository.js';

const router = express.Router();

function toMaterialApi(row: { id: string; title: string; type: string; url: string | null; description: string | null; created_at: string }) {
  return {
    _id: row.id,
    titulo: row.title,
    tipo: row.type,
    url: row.url ?? '',
    descripcion: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const { cursoId, materiaId } = req.query;
    let opts: { subjectId?: string; groupId?: string } = {};
    if (typeof materiaId === 'string') {
      const gs = await findGroupSubjectById(materiaId);
      opts.subjectId = gs?.subject_id ?? undefined;
    }
    if (typeof cursoId === 'string') {
      const group = await findGroupByNameAndInstitution(colegioId, cursoId.toUpperCase().trim());
      opts.groupId = group?.id;
    }

    const rows = await findLearningResourcesByInstitution(colegioId, opts.subjectId ? { subjectId: opts.subjectId } : opts.groupId ? { groupId: opts.groupId } : undefined);
    const filtered = opts.groupId
      ? rows.filter((r) => !r.group_id || r.group_id === opts.groupId)
      : opts.subjectId
        ? rows.filter((r) => !r.subject_id || r.subject_id === opts.subjectId)
        : rows;

    return res.json(filtered.map(toMaterialApi));
  } catch (error: unknown) {
    console.error('Error al obtener materiales:', (error as Error).message);
    return res.status(500).json({ message: 'Error en el servidor al cargar los materiales.' });
  }
});

router.post('/', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const { titulo, descripcion, tipo, url, materiaId, cursoId } = req.body;
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!titulo?.trim()) return res.status(400).json({ message: 'titulo es obligatorio.' });

    let subjectId: string | null = null;
    let groupId: string | null = null;
    if (materiaId) {
      const gs = await findGroupSubjectById(materiaId);
      subjectId = gs?.subject_id ?? null;
      groupId = gs?.group_id ?? null;
    }
    if (cursoId) {
      const group = await findGroupByNameAndInstitution(colegioId, String(cursoId).toUpperCase().trim());
      groupId = group?.id ?? null;
    }

    const row = await createLearningResource({
      institution_id: colegioId,
      subject_id: subjectId,
      group_id: groupId,
      title: titulo.trim(),
      description: descripcion?.trim() ?? null,
      type: tipo ?? 'other',
      url: url ?? null,
      uploaded_by_id: userId ?? null,
    });
    if (groupId && userId) {
      const group = await findGroupById(groupId);
      const user = await findUserById(userId);
      try {
        await createEvoFile({
          institution_id: colegioId,
          nombre: titulo.trim(),
          tipo: tipo ?? 'other',
          origen: 'material',
          group_id: groupId,
          curso_nombre: group?.name ?? String(cursoId),
          propietario_id: userId,
          propietario_nombre: user?.full_name ?? 'Usuario',
          propietario_rol: req.user?.rol ?? 'profesor',
          es_publico: true,
          evo_storage_url: url ?? undefined,
        });
      } catch (e) {
        console.error('Error creando evo_file desde material:', (e as Error).message);
      }
    }
    return res.status(201).json(toMaterialApi(row));
  } catch (error: unknown) {
    console.error('Error al crear material:', (error as Error).message);
    return res.status(500).json({ message: 'Error en el servidor al crear el material.' });
  }
});

router.patch('/:id', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  return res.status(404).json({ message: 'Material no encontrado.' });
});

router.delete('/:id', protect, restrictTo('profesor', 'directivo', 'school_admin', 'super_admin'), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
    const m = await findLearningResourceById(req.params.id);
    if (!m || m.institution_id !== colegioId) return res.status(404).json({ message: 'Material no encontrado.' });
    await deleteLearningResource(req.params.id);
    return res.json({ message: 'Material eliminado exitosamente.' });
  } catch (error: unknown) {
    console.error('Error al eliminar material:', (error as Error).message);
    return res.status(500).json({ message: 'Error al eliminar material.' });
  }
});

export default router;
