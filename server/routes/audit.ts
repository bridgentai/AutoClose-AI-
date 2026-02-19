import express from 'express';
import { protect, AuthRequest } from '../middleware/auth';
import { checkAdminColegioOnly } from '../middleware/auth';
import { getAuditLogs, type AuditLogsFilter } from '../services/auditLogger';

const router = express.Router();

/**
 * GET /api/audit/logs
 * Solo admin general del colegio (o school_admin). Lista logs de auditoría del colegio con filtros opcionales.
 * Query: action, entityType, startDate, endDate, limit, skip
 */
router.get('/logs', protect, checkAdminColegioOnly, async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) {
      return res.status(400).json({ message: 'Colegio no definido.' });
    }
    const filters: AuditLogsFilter = {
      action: typeof req.query.action === 'string' ? req.query.action : undefined,
      entityType: typeof req.query.entityType === 'string' ? req.query.entityType : undefined,
      startDate: typeof req.query.startDate === 'string' ? req.query.startDate : undefined,
      endDate: typeof req.query.endDate === 'string' ? req.query.endDate : undefined,
      limit: req.query.limit != null ? Number(req.query.limit) : 50,
      skip: req.query.skip != null ? Number(req.query.skip) : 0,
    };
    const { logs, total } = await getAuditLogs(colegioId, filters);
    return res.json({ logs, total });
  } catch (e: any) {
    console.error('Error en GET /api/audit/logs:', e.message);
    return res.status(500).json({ message: 'Error al obtener logs de auditoría.' });
  }
});

export default router;
