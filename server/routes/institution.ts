import express from 'express';
import { protect } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';
import { InstitutionConfig } from '../models';

const router = express.Router();

/**
 * GET /api/institution/config
 * Obtiene la configuración del colegio del usuario autenticado
 * Accesible para cualquier usuario autenticado (para obtener colores y configuración de su colegio)
 */
router.get('/config', protect, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    
    if (!colegioId) {
      return res.status(400).json({ 
        message: 'Usuario no tiene un colegio asignado.' 
      });
    }

    const config = await InstitutionConfig.findOne({ colegioId })
      .select('colegioId nombre logoUrl nombreIA colorPrimario colorSecundario')
      .lean();

    if (!config) {
      // Si no existe configuración, devolver valores por defecto
      return res.json({
        colegioId,
        nombre: 'Colegio',
        logoUrl: '',
        nombreIA: 'AutoClose AI',
        colorPrimario: '#9f25b8',
        colorSecundario: '#6a0dad',
      });
    }

    res.json(config);
  } catch (error: any) {
    console.error('Error al obtener configuración del colegio:', error);
    res.status(500).json({ message: 'Error al obtener la configuración del colegio.' });
  }
});

export default router;
