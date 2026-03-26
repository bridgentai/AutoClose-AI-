import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import {
  findNotificationsByUserFiltered,
  countUnreadByUser,
  updateNotificationRead,
  markAllNotificationsReadByUser,
} from '../repositories/notificationRepository.js';

const router = express.Router();

function toNotificationResponse(row: {
  id: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
  user_id: string;
  type?: string | null;
  entity_type?: string | null;
  entity_id?: string | null;
  action_url?: string | null;
}) {
  return {
    _id: row.id,
    id: row.id,
    usuarioId: row.user_id,
    titulo: row.title,
    title: row.title,
    cuerpo: row.body,
    body: row.body,
    type: row.type ?? 'general',
    entityType: row.entity_type ?? null,
    entityId: row.entity_id ?? null,
    actionUrl: row.action_url ?? null,
    leido: !!row.read_at,
    fecha: row.created_at,
    createdAt: row.created_at,
  };
}

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const { leido, limit } = req.query;
    const readFilter = leido === 'true' ? true : leido === 'false' ? false : undefined;
    const list = await findNotificationsByUserFiltered(userId, {
      read: readFilter,
      limit: Math.min(Number(limit) || 50, 100),
    });
    const unreadCount = await countUnreadByUser(userId);
    return res.json({ list: list.map(toNotificationResponse), unreadCount });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar notificaciones.' });
  }
});

router.patch('/:id/read', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const notif = await updateNotificationRead(id, userId);
    if (!notif) return res.status(404).json({ message: 'Notificación no encontrada.' });
    return res.json(toNotificationResponse(notif));
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar notificación.' });
  }
});

router.post('/mark-all-read', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    await markAllNotificationsReadByUser(userId);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar notificaciones.' });
  }
});

export default router;
