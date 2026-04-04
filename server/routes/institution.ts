import express from 'express';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth.js';
import { findInstitutionById, mergeInstitutionSettings } from '../repositories/institutionRepository.js';

const router = express.Router();

function parseCurrentAcademicTerm(settings: Record<string, unknown>): number {
  const v = settings.currentAcademicTerm;
  if (typeof v === 'number' && v >= 1 && v <= 3) return Math.floor(v);
  if (typeof v === 'string') {
    const n = parseInt(v, 10);
    if (n >= 1 && n <= 3) return n;
  }
  return 1;
}

router.get('/config', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;

    if (!colegioId) {
      return res.status(400).json({
        message: 'Usuario no tiene un colegio asignado.',
      });
    }

    const row = await findInstitutionById(colegioId);
    const settings = (row?.settings ?? {}) as Record<string, unknown>;
    return res.json({
      colegioId: row?.id ?? colegioId,
      nombre: row?.name ?? 'Colegio',
      logoUrl: (settings.logoUrl as string) ?? '',
      nombreIA: (settings.nombreIA as string) ?? 'EvoOS',
      colorPrimario: (settings.colorPrimario as string) ?? '#9f25b8',
      colorSecundario: (settings.colorSecundario as string) ?? '#6a0dad',
      currentAcademicTerm: parseCurrentAcademicTerm(settings),
    });
  } catch (error: unknown) {
    console.error('Error al obtener configuración del colegio:', error);
    res.status(500).json({ message: 'Error al obtener la configuración del colegio.' });
  }
});

router.get('/academic-term', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) {
      return res.status(400).json({ message: 'Usuario sin institución asignada.' });
    }
    const row = await findInstitutionById(colegioId);
    const settings = (row?.settings ?? {}) as Record<string, unknown>;
    return res.json({ currentAcademicTerm: parseCurrentAcademicTerm(settings) });
  } catch (error: unknown) {
    console.error('Error al leer trimestre académico:', error);
    res.status(500).json({ message: 'Error al leer el trimestre académico.' });
  }
});

router.patch(
  '/academic-term',
  protect,
  requireRole('asistente-academica', 'admin-general-colegio', 'school_admin'),
  async (req: AuthRequest, res) => {
    try {
      const colegioId = req.user?.colegioId;
      if (!colegioId) {
        return res.status(400).json({ message: 'Usuario sin institución asignada.' });
      }
      const raw = (req.body as { currentAcademicTerm?: unknown })?.currentAcademicTerm;
      const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 3) {
        return res.status(400).json({ message: 'currentAcademicTerm debe ser 1, 2 o 3.' });
      }
      const row = await mergeInstitutionSettings(colegioId, { currentAcademicTerm: n });
      if (!row) {
        return res.status(404).json({ message: 'Institución no encontrada.' });
      }
      const settings = (row.settings ?? {}) as Record<string, unknown>;
      return res.json({ currentAcademicTerm: parseCurrentAcademicTerm(settings) });
    } catch (error: unknown) {
      console.error('Error al guardar trimestre académico:', error);
      res.status(500).json({ message: 'Error al guardar el trimestre académico.' });
    }
  }
);

export default router;
