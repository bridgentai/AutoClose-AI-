import express from 'express';
import { Boletin, User, Vinculacion } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/boletin - Listar boletines según rol (estudiante/padre: los suyos o de hijos; directivo/profesor: del colegio o sus cursos)
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    let filter: Record<string, unknown> = { colegioId };

    if (rol === 'directivo' || rol === 'admin-general-colegio') {
      // Todos los boletines del colegio
    } else if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const taught = await Course.find({ profesorIds: normalizeIdForQuery(userId), colegioId }).select('_id').lean();
      const ids = taught.map((c) => c._id);
      if (ids.length) filter.cursoId = { $in: ids };
      else return res.json([]);
    } else if (rol === 'estudiante') {
      filter['resumen.estudianteId'] = normalizeIdForQuery(userId);
    } else if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizeIdForQuery(userId), estado: 'vinculado' })
        .select('estudianteId')
        .lean();
      const estudianteIds = vincs.map((v) => v.estudianteId);
      if (estudianteIds.length === 0) return res.json([]);
      filter['resumen.estudianteId'] = { $in: estudianteIds };
    } else {
      return res.status(403).json({ message: 'Rol no autorizado para ver boletines.' });
    }

    const list = await Boletin.find(filter)
      .populate('cursoId', 'nombre')
      .populate('generadoPor', 'nombre')
      .sort({ fecha: -1 })
      .limit(50)
      .lean();

    return res.json(list);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar boletines.' });
  }
});

// GET /api/boletin/:id - Un boletín (solo si el usuario tiene permiso)
router.get('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const doc = await Boletin.findOne({ _id: normalizeIdForQuery(id), colegioId })
      .populate('cursoId', 'nombre')
      .populate('generadoPor', 'nombre')
      .lean();

    if (!doc) return res.status(404).json({ message: 'Boletín no encontrado.' });

    const normalizedUser = normalizeIdForQuery(userId);
    if (rol === 'directivo' || rol === 'admin-general-colegio') {
      return res.json(doc);
    }
    if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const course = await Course.findOne({
        _id: doc.cursoId,
        profesorIds: normalizedUser,
        colegioId,
      }).lean();
      if (course) return res.json(doc);
    }
    if (rol === 'estudiante') {
      const hasMe = (doc.resumen || []).some(
        (r: { estudianteId?: unknown }) => (r.estudianteId as unknown as string)?.toString() === normalizedUser
      );
      if (hasMe) return res.json(doc);
    }
    if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizedUser, estado: 'vinculado' }).select('estudianteId').lean();
      const allowedIds = new Set(vincs.map((v) => (v.estudianteId as unknown as string)?.toString()));
      const hasChild = (doc.resumen || []).some((r: { estudianteId?: unknown }) =>
        allowedIds.has((r.estudianteId as unknown as string)?.toString())
      );
      if (hasChild) return res.json(doc);
    }

    return res.status(403).json({ message: 'No autorizado a ver este boletín.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener boletín.' });
  }
});

// GET /api/boletin/:id/pdf - Versión imprimible/PDF del boletín (misma autorización que GET :id)
router.get('/:id/pdf', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const doc = await Boletin.findOne({ _id: normalizeIdForQuery(id), colegioId })
      .populate('cursoId', 'nombre')
      .populate('generadoPor', 'nombre')
      .lean();

    if (!doc) return res.status(404).json({ message: 'Boletín no encontrado.' });

    const normalizedUser = normalizeIdForQuery(userId);
    let allowed = false;
    if (rol === 'directivo' || rol === 'admin-general-colegio' || rol === 'school_admin') allowed = true;
    if (rol === 'profesor') {
      const { Course } = await import('../models/Course');
      const course = await Course.findOne({
        _id: doc.cursoId,
        profesorIds: normalizedUser,
        colegioId,
      }).lean();
      if (course) allowed = true;
    }
    if (rol === 'estudiante') {
      const hasMe = (doc.resumen || []).some(
        (r: { estudianteId?: unknown }) => (r.estudianteId as unknown as string)?.toString() === normalizedUser
      );
      if (hasMe) allowed = true;
    }
    if (rol === 'padre') {
      const vincs = await Vinculacion.find({ padreId: normalizedUser, estado: 'vinculado' }).select('estudianteId').lean();
      const allowedIds = new Set(vincs.map((v) => (v.estudianteId as unknown as string)?.toString()));
      const hasChild = (doc.resumen || []).some((r: { estudianteId?: unknown }) =>
        allowedIds.has((r.estudianteId as unknown as string)?.toString())
      );
      if (hasChild) allowed = true;
    }
    if (!allowed) return res.status(403).json({ message: 'No autorizado a ver este boletín.' });

    const periodo = doc.periodo || 'Boletín';
    const cursoNombre = (doc.cursoId as { nombre?: string })?.nombre || (doc as { grupoNombre?: string }).grupoNombre || '';
    const resumen = (doc.resumen || []) as { estudianteId: string; nombre: string; promedioGeneral: number; materias: { nombre: string; promedio: number }[] }[];
    const rows = resumen
      .map(
        (r) =>
          `<tr><td>${r.nombre}</td><td>${(r.promedioGeneral ?? 0).toFixed(1)}</td><td>${(r.materias || [])
            .map((m) => `${m.nombre}: ${(m.promedio ?? 0).toFixed(1)}`)
            .join(', ')}</td></tr>`
      )
      .join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${periodo}</title>
<style>body{font-family:system-ui,sans-serif;padding:1rem;max-width:800px;margin:0 auto;} table{border-collapse:collapse;width:100%;} th,td{border:1px solid #ddd;padding:8px;text-align:left;} th{background:#f5f5f5;}</style>
</head><body>
<h1>${periodo}</h1>
<p>${cursoNombre} · ${new Date((doc as { fecha?: Date }).fecha || Date.now()).toLocaleDateString('es')}</p>
<table><thead><tr><th>Estudiante</th><th>Promedio</th><th>Materias</th></tr></thead><tbody>${rows}</tbody></table>
<p style="margin-top:2rem;color:#666;font-size:0.9rem;">AutoClose AI · Use "Imprimir" y "Guardar como PDF" para exportar.</p>
</body></html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="boletin-${periodo.replace(/\s/g, '-')}.html"`);
    return res.send(html);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al generar boletín para PDF.' });
  }
});

export default router;
