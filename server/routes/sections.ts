import express from 'express';
import { Section, Group, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { logAdminAction } from '../services/auditLogger';

const router = express.Router();

/** Solo admin-general-colegio o school_admin */
const canManageSections = async (req: AuthRequest): Promise<{ allowed: boolean; colegioId?: string }> => {
  const userId = req.user?.id;
  const colegioId = req.user?.colegioId;
  if (!userId || !colegioId) return { allowed: false };
  const user = await User.findById(normalizeIdForQuery(userId)).select('rol colegioId').lean();
  if (!user) return { allowed: false };
  const allowed = user.rol === 'admin-general-colegio' || user.rol === 'school_admin';
  return { allowed, colegioId: user.colegioId };
};

// GET /api/sections - Listar secciones del colegio con sus cursos
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = await canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para listar secciones.' });
    }
    const sections = await Section.find({ colegioId }).sort({ nombre: 1 }).lean();
    const sectionIds = sections.map((s) => s._id);
    const groupsBySection = await Group.find({
      colegioId,
      sectionId: { $in: sectionIds },
    })
      .select('_id nombre sectionId')
      .lean();
    const map = new Map<string, { _id: string; nombre: string }[]>();
    groupsBySection.forEach((g) => {
      const sid = (g.sectionId as unknown as { toString: () => string })?.toString?.();
      if (sid) {
        if (!map.has(sid)) map.set(sid, []);
        map.get(sid)!.push({ _id: (g._id as unknown as { toString: () => string }).toString(), nombre: g.nombre });
      }
    });
    const result = sections.map((s) => ({
      _id: (s._id as unknown as { toString: () => string }).toString(),
      nombre: s.nombre,
      colegioId: s.colegioId,
      cursos: map.get((s._id as unknown as { toString: () => string }).toString()) || [],
    }));
    return res.json(result);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar secciones.' });
  }
});

// POST /api/sections - Crear sección y opcionalmente asignar cursos
router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = await canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para crear secciones.' });
    }
    const userId = req.user?.id;
    const { nombre, cursoIds } = req.body as { nombre?: string; cursoIds?: string[] };
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre de la sección es obligatorio.' });
    }
    const nombreTrim = nombre.trim();
    const existente = await Section.findOne({ colegioId, nombre: nombreTrim });
    if (existente) {
      return res.status(400).json({ message: `Ya existe una sección llamada "${nombreTrim}".` });
    }
    const section = await Section.create({ nombre: nombreTrim, colegioId });
    const sectionId = section._id;

    const idsToLink = Array.isArray(cursoIds) ? cursoIds : [];
    if (idsToLink.length > 0) {
      for (const idOrName of idsToLink) {
        const str = String(idOrName).trim();
        const byId = /^[0-9a-fA-F]{24}$/.test(str)
          ? await Group.findOne({ _id: normalizeIdForQuery(str), colegioId })
          : null;
        const group = byId ?? (await Group.findOne({ nombre: str.toUpperCase(), colegioId }));
        if (group) {
          (group as any).sectionId = sectionId;
          await group.save();
        }
      }
    }

    await logAdminAction({
      userId: normalizeIdForQuery(userId!),
      role: 'admin-general-colegio',
      action: 'create_section',
      entityType: 'section',
      entityId: sectionId,
      colegioId,
      requestData: { nombre: nombreTrim, cursoIds: idsToLink },
    });

    const cursos = await Group.find({ colegioId, sectionId }).select('_id nombre').lean();
    return res.status(201).json({
      message: 'Sección creada correctamente.',
      section: {
        _id: (section._id as unknown as { toString: () => string }).toString(),
        nombre: section.nombre,
        colegioId: section.colegioId,
        cursos: cursos.map((g) => ({ _id: (g._id as unknown as { toString: () => string }).toString(), nombre: g.nombre })),
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear la sección.' });
  }
});

// PATCH /api/sections/:id - Actualizar nombre y/o añadir/quitar cursos
router.patch('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = await canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para editar secciones.' });
    }
    const userId = req.user?.id;
    const sectionId = normalizeIdForQuery(req.params.id);
    const section = await Section.findOne({ _id: sectionId, colegioId });
    if (!section) return res.status(404).json({ message: 'Sección no encontrada.' });

    const { nombre, addCursoIds, removeCursoIds } = req.body as {
      nombre?: string;
      addCursoIds?: string[];
      removeCursoIds?: string[];
    };

    if (typeof nombre === 'string' && nombre.trim()) {
      const otro = await Section.findOne({ colegioId, nombre: nombre.trim(), _id: { $ne: sectionId } });
      if (otro) return res.status(400).json({ message: 'Ya existe otra sección con ese nombre.' });
      (section as any).nombre = nombre.trim();
      await section.save();
    }

    const toAdd = Array.isArray(addCursoIds) ? addCursoIds : [];
    for (const idOrName of toAdd) {
      const str = String(idOrName).trim();
      const byId = /^[0-9a-fA-F]{24}$/.test(str)
        ? await Group.findOne({ _id: normalizeIdForQuery(str), colegioId })
        : null;
      const group = byId ?? (await Group.findOne({ nombre: str.toUpperCase(), colegioId }));
      if (group) {
        (group as any).sectionId = section._id;
        await group.save();
      }
    }

    const toRemove = Array.isArray(removeCursoIds) ? removeCursoIds : [];
    for (const idOrName of toRemove) {
      const str = String(idOrName).trim();
      const byId = /^[0-9a-fA-F]{24}$/.test(str)
        ? await Group.findOne({ _id: normalizeIdForQuery(str), colegioId })
        : null;
      const group = byId ?? (await Group.findOne({ nombre: str.toUpperCase(), colegioId }));
      if (group && (group.sectionId as unknown as string)?.toString?.() === sectionId) {
        (group as any).sectionId = undefined;
        await group.save();
      }
    }

    await logAdminAction({
      userId: normalizeIdForQuery(userId!),
      role: 'admin-general-colegio',
      action: 'update_section',
      entityType: 'section',
      entityId: sectionId,
      colegioId,
      requestData: { nombre, addCursoIds: toAdd, removeCursoIds: toRemove },
    });

    const cursos = await Group.find({ colegioId, sectionId: section._id }).select('_id nombre').lean();
    return res.json({
      message: 'Sección actualizada.',
      section: {
        _id: (section._id as unknown as { toString: () => string }).toString(),
        nombre: (section as any).nombre,
        colegioId: section.colegioId,
        cursos: cursos.map((g) => ({ _id: (g._id as unknown as { toString: () => string }).toString(), nombre: g.nombre })),
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar la sección.' });
  }
});

export default router;
