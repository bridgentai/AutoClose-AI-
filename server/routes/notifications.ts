import express from 'express';
import { Notificacion } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

// GET /api/notifications - Listar notificaciones del usuario
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const { leido, limit } = req.query;
    const filter: Record<string, unknown> = { usuarioId: normalizeIdForQuery(userId) };
    if (leido === 'true' || leido === 'false') filter.leido = leido === 'true';

    const list = await Notificacion.find(filter)
      .sort({ fecha: -1 })
      .limit(Math.min(Number(limit) || 50, 100))
      .lean();

    const unreadCount = await Notificacion.countDocuments({
      usuarioId: normalizeIdForQuery(userId),
      leido: false,
    });

    return res.json({ list, unreadCount });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar notificaciones.' });
  }
});

// PATCH /api/notifications/:id/read - Marcar como leída
router.patch('/:id/read', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const notif = await Notificacion.findOneAndUpdate(
      { _id: normalizeIdForQuery(id), usuarioId: normalizeIdForQuery(userId) },
      { $set: { leido: true } },
      { new: true }
    ).lean();

    if (!notif) return res.status(404).json({ message: 'Notificación no encontrada.' });
    return res.json(notif);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar notificación.' });
  }
});

// POST /api/notifications/mark-all-read - Marcar todas como leídas
router.post('/mark-all-read', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    await Notificacion.updateMany(
      { usuarioId: normalizeIdForQuery(userId), leido: false },
      { $set: { leido: true } }
    );

    return res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar notificaciones.' });
  }
});

export default router;
