import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGuardianStudent } from '../repositories/guardianStudentRepository.js';

const router = express.Router();

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
    if (rol !== 'directivo' && rol !== 'admin-general-colegio' && rol !== 'school_admin') {
      return res.status(403).json({ message: 'Solo directivos y administradores pueden ver el resumen de cursos.' });
    }
    return res.json([]);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener resumen de cursos.' });
  }
});

export default router;
