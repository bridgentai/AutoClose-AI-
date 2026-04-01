import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { findUserById } from '../repositories/userRepository.js';
import {
  createComunicacionAnnouncement,
  cancelComunicadoPending,
  findComunicadoById,
  markAnnouncementCorrected,
  copyRecipientsToAnnouncement,
  listInstitucionalComunicados,
  countInstitucionalByCategory,
  resolveInstitutionalRecipientIds,
  getReadDetailForComunicado,
  markComunicadoRead,
} from '../repositories/comunicacionRepository.js';
import { isUserRecipientOfAnnouncement } from '../repositories/announcementRepository.js';
import { queryPg } from '../config/db-pg.js';

const router = express.Router();

const PUBLISH_ROLES = ['directivo', 'admin-general-colegio', 'asistente', 'asistente-academica', 'rector'] as const;

function institutionId(req: AuthRequest): string | undefined {
  return req.user?.colegioId ?? req.user?.institution_id;
}

function isPublisherRole(rol: string | undefined): boolean {
  return !!rol && (PUBLISH_ROLES as readonly string[]).includes(rol);
}

/** POST /api/institucional/comunicado */
router.post('/comunicado', protect, requireRole(...PUBLISH_ROLES), async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    if (!instId || !userId) return res.status(401).json({ message: 'No autorizado' });
    const body = req.body as {
      title?: string;
      body?: string;
      audience?: string;
      category?: string;
      priority?: string;
    };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    const audience = body.audience as 'all' | 'parents' | 'teachers' | 'staff' | undefined;
    const category = typeof body.category === 'string' ? body.category.trim().slice(0, 50) : 'general';
    const priority = typeof body.priority === 'string' ? body.priority.trim() : 'normal';
    if (!title) return res.status(400).json({ message: 'El título es obligatorio.' });
    if (!audience || !['all', 'parents', 'teachers', 'staff'].includes(audience)) {
      return res.status(400).json({ message: 'Audiencia inválida.' });
    }
    const recipientIds = await resolveInstitutionalRecipientIds(instId, audience);
    const scheduled = new Date(Date.now() + 30_000).toISOString();
    const created = await createComunicacionAnnouncement({
      institution_id: instId,
      title,
      body: text || null,
      type: 'comunicado_institucional',
      group_id: null,
      group_subject_id: null,
      created_by_id: userId,
      status: 'pending',
      scheduled_send_at: scheduled,
      sent_at: null,
      audience,
      category: category || 'general',
      priority,
    });
    const { addAnnouncementRecipients } = await import('../repositories/announcementRepository.js');
    await addAnnouncementRecipients(created.id, recipientIds);
    return res.status(201).json({ id: created.id, scheduled_send_at: scheduled });
  } catch (e: unknown) {
    console.error('institucional comunicado:', (e as Error).message);
    return res.status(500).json({ message: 'Error al crear comunicado.' });
  }
});

/** DELETE /api/institucional/comunicado/:id/cancel */
router.delete('/comunicado/:id/cancel', protect, requireRole(...PUBLISH_ROLES), async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!instId || !userId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, instId);
    if (!row || row.type !== 'comunicado_institucional') {
      return res.status(404).json({ message: 'Comunicado no encontrado.' });
    }
    const result = await cancelComunicadoPending(id, userId, instId);
    if (!result.ok) return res.status(400).json({ message: result.message });
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('institucional cancel:', (e as Error).message);
    return res.status(500).json({ message: 'Error al cancelar.' });
  }
});

/** POST /api/institucional/comunicado/:id/correccion */
router.post('/comunicado/:id/correccion', protect, requireRole(...PUBLISH_ROLES), async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!instId || !userId || !id) return res.status(401).json({ message: 'No autorizado' });
    const original = await findComunicadoById(id, instId);
    if (!original || original.type !== 'comunicado_institucional') {
      return res.status(404).json({ message: 'Comunicado no encontrado.' });
    }
    if (original.created_by_id !== userId) return res.status(403).json({ message: 'Solo el autor puede corregir.' });
    if (!original.sent_at) return res.status(400).json({ message: 'El comunicado aún no ha sido enviado.' });
    const sentAt = new Date(original.sent_at).getTime();
    if (Date.now() - sentAt > 24 * 60 * 60 * 1000) {
      return res.status(400).json({ message: 'Pasaron más de 24 horas desde el envío.' });
    }
    const dupCheck = await queryPg<{ id: string }>(
      `SELECT id FROM announcements WHERE correction_of = $1 LIMIT 1`,
      [id]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(400).json({ message: 'Ya existe una corrección.' });
    }
    const body = req.body as { title?: string; body?: string };
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const text = typeof body.body === 'string' ? body.body.trim() : '';
    if (!title) return res.status(400).json({ message: 'El título es obligatorio.' });
    const created = await createComunicacionAnnouncement({
      institution_id: instId,
      title,
      body: text || null,
      type: 'comunicado_institucional',
      created_by_id: userId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      audience: original.audience ?? 'parents',
      category: original.category ?? 'general',
      priority: original.priority ?? 'normal',
      correction_of: id,
    });
    await copyRecipientsToAnnouncement(id, created.id);
    await markAnnouncementCorrected(id, instId);
    return res.status(201).json({ id: created.id, sent_at: created.sent_at });
  } catch (e: unknown) {
    console.error('institucional correccion:', (e as Error).message);
    return res.status(500).json({ message: 'Error al publicar corrección.' });
  }
});

/** GET /api/institucional/comunicados/categorias */
router.get('/comunicados/categorias', protect, async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const rol = req.user?.rol;
    if (!instId || !userId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const asPublisher = isPublisherRole(rol);
    const allowedView = asPublisher || ['padre', 'profesor', 'estudiante'].includes(rol ?? '');
    if (!allowedView) return res.status(403).json({ message: 'Sin acceso' });
    const counts = await countInstitucionalByCategory(instId, asPublisher, userId);
    return res.json(counts);
  } catch (e: unknown) {
    console.error('institucional categorias:', (e as Error).message);
    return res.status(500).json({ message: 'Error al listar categorías.' });
  }
});

/** GET /api/institucional/comunicados */
router.get('/comunicados', protect, async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const rol = req.user?.rol;
    if (!instId || !userId) return res.status(401).json({ message: 'No autorizado' });
    const user = await findUserById(userId);
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    const asPublisher = isPublisherRole(rol);
    const canView =
      asPublisher ||
      [
        'padre',
        'profesor',
        'estudiante',
        'asistente',
        'school_admin',
        'transporte',
        'tesoreria',
        'nutricion',
        'cafeteria',
      ].includes(rol ?? '');
    if (!canView) return res.status(403).json({ message: 'Sin acceso' });
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const list = await listInstitucionalComunicados(instId, {
      viewerUserId: userId,
      category: category && category !== 'all' ? category : null,
      asPublisher,
    });
    return res.json(list);
  } catch (e: unknown) {
    console.error('institucional list:', (e as Error).message);
    return res.status(500).json({ message: 'Error al listar comunicados.' });
  }
});

/** POST /api/institucional/comunicado/:id/read */
router.post('/comunicado/:id/read', protect, async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!instId || !userId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, instId);
    if (!row || row.type !== 'comunicado_institucional') {
      return res.status(404).json({ message: 'No encontrado' });
    }
    const recipient = await isUserRecipientOfAnnouncement(id, userId);
    if (!recipient) return res.status(403).json({ message: 'No eres destinatario de este comunicado.' });
    await markComunicadoRead(id, userId);
    return res.json({ ok: true });
  } catch (e: unknown) {
    console.error('institucional read:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

/** GET /api/institucional/comunicado/:id/read-detail */
router.get('/comunicado/:id/read-detail', protect, async (req: AuthRequest, res) => {
  try {
    const instId = institutionId(req);
    const userId = req.user?.id;
    const { id } = req.params;
    if (!instId || !userId || !id) return res.status(401).json({ message: 'No autorizado' });
    const row = await findComunicadoById(id, instId);
    if (!row || row.type !== 'comunicado_institucional') {
      return res.status(404).json({ message: 'No encontrado' });
    }
    const publisher = isPublisherRole(req.user?.rol);
    if (!publisher) {
      const recipient = await isUserRecipientOfAnnouncement(id, userId);
      if (!recipient) return res.status(403).json({ message: 'Sin acceso' });
    }
    const detail = await getReadDetailForComunicado(id, instId);
    return res.json({ recipients: detail });
  } catch (e: unknown) {
    console.error('read-detail:', (e as Error).message);
    return res.status(500).json({ message: 'Error' });
  }
});

export default router;
