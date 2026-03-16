import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

export interface CursoResumenItem {
  _id: string;
  nombre: string;
  promedio: number | null;
  cantidadNotas: number;
}

router.get('/estudiante/:id/resumen', protect, async (req: AuthRequest, res) => {
  try {
    const estudianteId = req.params.id;
    const userId = req.user?.id ?? req.userId;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const estudiante = await findUserById(estudianteId);
    if (!estudiante || estudiante.institution_id !== colegioId) return res.status(404).json({ message: 'Estudiante no encontrado.' });
    if (estudiante.role !== 'estudiante') return res.status(400).json({ message: 'El usuario no es un estudiante.' });

    const canView =
      rol === 'directivo' ||
      rol === 'admin-general-colegio' ||
      rol === 'school_admin' ||
      userId === estudianteId ||
      (rol === 'padre' && (await findGuardianStudent(userId ?? '', estudianteId)));

    if (!canView) return res.status(403).json({ message: 'No autorizado a ver este resumen.' });

    const now = new Date();
    return res.json({
      estudiante: { _id: estudiante.id, nombre: estudiante.full_name, email: estudiante.email, curso: (estudiante.config as { curso?: string })?.curso },
      asistencia: { porcentaje: 0, total: 0, presentes: 0, mes: now.getMonth() + 1, anio: now.getFullYear() },
      notas: { cantidad: 0, promedioGeneral: null, detalle: [] },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen del estudiante.' });
  }
});

router.get('/cursos/resumen', protect, async (req: AuthRequest, res) => {
  try {
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (rol !== 'directivo' && rol !== 'admin-general-colegio' && rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivos y administradores pueden ver el resumen de cursos.' });
    }
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const r = await queryPg<{ id: string; nombre: string; promedio: number | null; cantidad_notas: string }>(
      `SELECT g.id, g.name AS nombre,
        AVG(CASE WHEN gr.max_score > 0 THEN COALESCE(gr.normalized_score, gr.score::numeric / NULLIF(gr.max_score, 0)) * 5 ELSE NULL END)::numeric(4,2) AS promedio,
        COUNT(gr.id)::text AS cantidad_notas
       FROM groups g
       LEFT JOIN grades gr ON gr.group_id = g.id
       WHERE g.institution_id = $1 AND g.name ~ '^[0-9]'
       GROUP BY g.id, g.name
       ORDER BY g.name`,
      [colegioId]
    );
    const cursos: CursoResumenItem[] = r.rows.map((row) => ({
      _id: row.id,
      nombre: row.nombre,
      promedio: row.promedio != null ? Number(row.promedio) : null,
      cantidadNotas: parseInt(row.cantidad_notas, 10) || 0,
    }));
    return res.json(cursos);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen de cursos.' });
  }
});

export default router;
