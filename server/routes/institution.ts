import express from 'express';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { findInstitutionById } from '../repositories/institutionRepository.js';

const router = express.Router();

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
    });
  } catch (error: unknown) {
    console.error('Error al obtener configuración del colegio:', error);
    res.status(500).json({ message: 'Error al obtener la configuración del colegio.' });
  }
});

export default router;
