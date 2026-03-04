import express from 'express';
import { Types } from 'mongoose';
import { GroupSchedule } from '../models/GroupSchedule';
import { ProfessorSchedule } from '../models/ProfessorSchedule';
import { Group } from '../models/Group';
import { GroupStudent } from '../models/GroupStudent';
import { User } from '../models/User';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

function normalizeSlots(raw: Record<string, unknown>): Record<string, string> {
  const slots: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v != null && k) slots[k] = typeof v === 'string' ? v : (v && typeof v === 'object' && '$oid' in v ? (v as { $oid: string }).$oid : String(v));
  }
  return slots;
}

/** GET /api/schedule/my-group - Horario del curso del estudiante (solo rol estudiante) */
router.get('/my-group', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'estudiante') {
      return res.status(403).json({ message: 'Solo estudiantes pueden consultar su horario.' });
    }
    const colegioId = req.user?.colegioId;
    const estudianteId = normalizeIdForQuery(req.userId || req.user?.id || '');
    if (!colegioId || !estudianteId) {
      return res.json({ grupoNombre: req.user?.curso || '', slots: {} });
    }

    let grupoIdStr: string | null = null;
    let grupoNombre: string = req.user?.curso || '';

    const curso = req.user?.curso ? String(req.user.curso).trim() : '';

    // 1) Si user.curso parece ObjectId (24 hex), buscar grupo por _id (mismo colegio)
    if (curso && /^[a-fA-F0-9]{24}$/.test(curso)) {
      const groupById = await Group.findOne({ _id: normalizeIdForQuery(curso), colegioId }).select('_id nombre').lean();
      if (groupById) {
        grupoIdStr = String((groupById as any)._id);
        grupoNombre = (groupById as any).nombre || curso;
      }
    }

    // 2) Si no, resolver por nombre del curso (ej. "11H")
    if (!grupoIdStr && curso) {
      const groupByNombre = await Group.findOne({
        colegioId,
        nombre: new RegExp('^' + curso.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      }).select('_id nombre').lean();
      if (groupByNombre) {
        grupoIdStr = String((groupByNombre as any)._id);
        grupoNombre = (groupByNombre as any).nombre || curso;
      }
    }

    // 3) Fallback: GroupStudent (estudiante asignado al grupo)
    if (!grupoIdStr) {
      try {
        const gs = await GroupStudent.findOne({ estudianteId: new Types.ObjectId(normalizeIdForQuery(estudianteId)) })
          .select('grupoId')
          .lean();
        if (gs && (gs as any).grupoId) {
          const gid = String((gs as any).grupoId);
          const groupDoc = await Group.findOne({ _id: gid, colegioId }).select('nombre').lean();
          if (groupDoc) {
            grupoIdStr = gid;
            grupoNombre = (groupDoc as any).nombre || grupoNombre;
          }
        }
      } catch (_) {
        // ignore
      }
    }

    if (!grupoIdStr) {
      return res.json({ grupoNombre, slots: {} });
    }

    // Horario se guarda por grupo _id (igual que cuando el directivo confirma)
    const doc = await GroupSchedule.findOne({ colegioId, grupoId: grupoIdStr }).lean();
    const raw = doc?.slots && typeof doc.slots === 'object' ? doc.slots as Record<string, unknown> : {};
    const slots = normalizeSlots(raw);
    res.json({
      grupoId: grupoIdStr,
      grupoNombre,
      slots,
    });
  } catch (e: any) {
    console.error('Error GET schedule/my-group:', e);
    res.status(500).json({ message: e.message || 'Error al cargar horario.' });
  }
});

/** GET /api/schedule/group/:grupoId - Obtener horario del grupo (directivo) */
router.get('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(403).json({ message: 'No autorizado.' });
    if (req.user?.rol !== 'directivo' && req.user?.rol !== 'admin-general-colegio' && req.user?.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivo puede consultar horarios.' });
    }
    const { grupoId } = req.params;
    const idParam = grupoId.trim();
    let doc = await GroupSchedule.findOne({ colegioId, grupoId: idParam }).lean();
    if (!doc && idParam && !/^[a-fA-F0-9]{24}$/.test(idParam)) {
      const group = await Group.findOne({ colegioId, nombre: new RegExp('^' + idParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }).select('_id').lean();
      if (group) {
        const idStr = String((group as any)._id);
        doc = await GroupSchedule.findOne({ colegioId, grupoId: idStr }).lean();
        if (doc) (doc as any).grupoId = idStr;
      }
    }
    const raw = doc?.slots && typeof doc.slots === 'object' ? doc.slots as Record<string, unknown> : {};
    const slots = normalizeSlots(raw);
    res.json({ grupoId: doc ? (doc as any).grupoId || idParam : idParam, slots });
  } catch (e: any) {
    console.error('Error GET schedule/group:', e);
    res.status(500).json({ message: e.message || 'Error al cargar horario.' });
  }
});

/** PUT /api/schedule/group/:grupoId - Guardar horario del grupo (directivo). Siempre guarda por group _id para que estudiantes lo lean igual. */
router.put('/group/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(403).json({ message: 'No autorizado.' });
    if (req.user?.rol !== 'directivo' && req.user?.rol !== 'admin-general-colegio' && req.user?.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivo puede guardar horarios.' });
    }
    const { grupoId } = req.params;
    const idParam = (grupoId || '').trim();
    if (!idParam) return res.status(400).json({ message: 'Falta grupoId.' });

    // Resolver siempre al _id del grupo (24 hex) para que GET my-group del estudiante encuentre el mismo doc
    let canonicalGrupoId: string;
    if (/^[a-fA-F0-9]{24}$/.test(idParam)) {
      const group = await Group.findOne({ _id: normalizeIdForQuery(idParam), colegioId }).select('_id').lean();
      if (!group) return res.status(404).json({ message: 'Curso/grupo no encontrado.' });
      canonicalGrupoId = String((group as any)._id);
    } else {
      const group = await Group.findOne({
        colegioId,
        nombre: new RegExp('^' + idParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      }).select('_id').lean();
      if (!group) return res.status(404).json({ message: 'Curso/grupo no encontrado.' });
      canonicalGrupoId = String((group as any)._id);
    }

    const { slots } = req.body as { slots?: Record<string, string> };
    const normalized: Record<string, string> = {};
    if (slots && typeof slots === 'object') {
      for (const [key, val] of Object.entries(slots)) {
        if (key && val) normalized[key] = String(val);
      }
    }
    await GroupSchedule.findOneAndUpdate(
      { colegioId, grupoId: canonicalGrupoId },
      { $set: { slots: normalized, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ grupoId: canonicalGrupoId, slots: normalized });
  } catch (e: any) {
    console.error('Error PUT schedule/group:', e);
    res.status(500).json({ message: e.message || 'Error al guardar horario.' });
  }
});

/** GET /api/schedule/my-professor - Horario del profesor logueado (solo rol profesor). Misma data que confirma el directivo. */
router.get('/my-professor', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo profesores pueden consultar su horario.' });
    }
    const colegioId = req.user?.colegioId;
    if (!colegioId) {
      return res.json({ profesorId: '', slots: {} });
    }
    // Usar el mismo id que tiene el User en BD (req.user.id = userDoc._id.toString()) para que coincida con lo que guarda el directivo
    const idFromUser = (req.user?.id && String(req.user.id).trim()) || '';
    const idFromToken = (req.userId && String(req.userId).trim()) || '';
    const normalizedFromUser = idFromUser ? normalizeIdForQuery(idFromUser) : '';
    const normalizedFromToken = idFromToken ? normalizeIdForQuery(idFromToken) : '';
    const idsToTry = [normalizedFromUser, normalizedFromToken, idFromUser, idFromToken].filter(Boolean);
    const uniqueIds = [...new Set(idsToTry)];

    let doc: any = null;
    for (const pid of uniqueIds) {
      if (!pid) continue;
      doc = await ProfessorSchedule.findOne({ colegioId, profesorId: pid }).lean();
      if (doc) break;
    }
    const raw = doc?.slots && typeof doc.slots === 'object' ? doc.slots as Record<string, unknown> : {};
    const slots = normalizeSlots(raw);
    const profesorIdStr = doc ? (doc.profesorId || uniqueIds[0]) : (uniqueIds[0] || '');
    res.json({ profesorId: profesorIdStr, slots });
  } catch (e: any) {
    console.error('Error GET schedule/my-professor:', e);
    res.status(500).json({ message: e.message || 'Error al cargar horario.' });
  }
});

/** GET /api/schedule/group-for-attendance/:grupoId - Horario del grupo para asistencia (solo rol profesor). Siempre devuelve 200 con el horario del grupo si el grupo existe; no se bloquea por 403. */
router.get('/group-for-attendance/:grupoId', protect, async (req: AuthRequest, res) => {
  try {
    if (req.user?.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo profesores pueden usar este recurso.' });
    }
    const colegioId = req.user?.colegioId;
    const idParam = (req.params.grupoId || '').trim();
    if (!colegioId || !idParam) {
      return res.json({ grupoId: '', grupoNombre: '', slots: {} });
    }
    const isObjectId = /^[a-fA-F0-9]{24}$/.test(idParam);
    const query: any = { colegioId };
    if (isObjectId) {
      query.$or = [
        { _id: normalizeIdForQuery(idParam) },
        { nombre: new RegExp('^' + idParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') },
      ];
    } else {
      query.nombre = new RegExp('^' + idParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i');
    }
    const group = await Group.findOne(query).select('_id nombre').lean();
    if (!group) {
      return res.json({ grupoId: '', grupoNombre: '', slots: {} });
    }
    const groupIdStr = String((group as any)._id);
    const groupDoc = await GroupSchedule.findOne({ colegioId, grupoId: groupIdStr }).lean();
    const raw = groupDoc?.slots && typeof groupDoc.slots === 'object' ? groupDoc.slots as Record<string, unknown> : {};
    const slots = normalizeSlots(raw);
    res.json({ grupoId: groupIdStr, grupoNombre: (group as any).nombre, slots });
  } catch (e: any) {
    console.error('Error GET schedule/group-for-attendance:', e);
    res.status(500).json({ message: e.message || 'Error al cargar horario.' });
  }
});

/** GET /api/schedule/professor/:profesorId - Obtener horario del profesor (directivo) */
router.get('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(403).json({ message: 'No autorizado.' });
    if (req.user?.rol !== 'directivo' && req.user?.rol !== 'admin-general-colegio' && req.user?.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivo puede consultar horarios.' });
    }
    const { profesorId } = req.params;
    const idParam = profesorId.trim();
    let doc = await ProfessorSchedule.findOne({ colegioId, profesorId: idParam }).lean();
    if (!doc && idParam && !/^[a-fA-F0-9]{24}$/.test(idParam)) {
      const prof = await User.findOne({
        colegioId,
        rol: 'profesor',
        nombre: new RegExp(idParam.replace(/\s+/g, '.*'), 'i'),
      }).select('_id').lean();
      if (prof) {
        const idStr = String((prof as any)._id);
        doc = await ProfessorSchedule.findOne({ colegioId, profesorId: idStr }).lean();
        if (doc) (doc as any).profesorId = idStr;
      }
    }
    const raw = doc?.slots && typeof doc.slots === 'object' ? doc.slots as Record<string, unknown> : {};
    const slots = normalizeSlots(raw);
    res.json({ profesorId: doc ? (doc as any).profesorId || idParam : idParam, slots });
  } catch (e: any) {
    console.error('Error GET schedule/professor:', e);
    res.status(500).json({ message: e.message || 'Error al cargar horario.' });
  }
});

/** PUT /api/schedule/professor/:profesorId - Guardar horario del profesor (directivo). Siempre guarda por profesor _id para que el profesor lo vea en su horario. */
router.put('/professor/:profesorId', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(403).json({ message: 'No autorizado.' });
    if (req.user?.rol !== 'directivo' && req.user?.rol !== 'admin-general-colegio' && req.user?.rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivo puede guardar horarios.' });
    }
    const { profesorId } = req.params;
    const idParam = (profesorId || '').trim();
    if (!idParam) return res.status(400).json({ message: 'Falta profesorId.' });

    let canonicalProfesorId: string;
    if (/^[a-fA-F0-9]{24}$/.test(idParam)) {
      const prof = await User.findOne({ _id: normalizeIdForQuery(idParam), colegioId, rol: 'profesor' }).select('_id').lean();
      if (!prof) return res.status(404).json({ message: 'Profesor no encontrado.' });
      canonicalProfesorId = String((prof as any)._id);
    } else {
      const prof = await User.findOne({
        colegioId,
        rol: 'profesor',
        nombre: new RegExp('^' + idParam.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i'),
      }).select('_id').lean();
      if (!prof) return res.status(404).json({ message: 'Profesor no encontrado.' });
      canonicalProfesorId = String((prof as any)._id);
    }

    const { slots } = req.body as { slots?: Record<string, string> };
    const normalized: Record<string, string> = {};
    if (slots && typeof slots === 'object') {
      for (const [key, val] of Object.entries(slots)) {
        if (key && val) normalized[key] = String(val);
      }
    }
    await ProfessorSchedule.findOneAndUpdate(
      { colegioId, profesorId: canonicalProfesorId },
      { $set: { slots: normalized, updatedAt: new Date() } },
      { upsert: true, new: true }
    );
    res.json({ profesorId: canonicalProfesorId, slots: normalized });
  } catch (e: any) {
    console.error('Error PUT schedule/professor:', e);
    res.status(500).json({ message: e.message || 'Error al guardar horario.' });
  }
});

export default router;
