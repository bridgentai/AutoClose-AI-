import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requirePermission } from '../middleware/permissionMiddleware.js';
import {
  findActivityLogsByInstitution,
  countActivityLogsByInstitution,
} from '../repositories/activityLogRepository.js';
import { queryPg } from '../config/db-pg.js';
import { findUserById } from '../repositories/userRepository.js';

const router = express.Router();

interface AiActionLogRow {
  id: string;
  institution_id: string;
  actor_user_id: string;
  actor_role: string;
  action_name: string;
  entity_type: string | null;
  entity_id: string | null;
  parameters: Record<string, unknown>;
  result: Record<string, unknown>;
  status: string;
  ip_address: string | null;
  created_at: string;
}

async function findAiActionLogs(
  institutionId: string,
  opts: { limit?: number; offset?: number; entityType?: string; action?: string; startDate?: string; endDate?: string }
): Promise<AiActionLogRow[]> {
  let q = 'SELECT * FROM analytics.ai_action_logs WHERE institution_id = $1';
  const params: unknown[] = [institutionId];
  let i = 2;
  if (opts.entityType) {
    q += ` AND entity_type = $${i}`;
    params.push(opts.entityType);
    i++;
  }
  if (opts.action) {
    q += ` AND action_name = $${i}`;
    params.push(opts.action);
    i++;
  }
  if (opts.startDate) {
    q += ` AND created_at >= $${i}::timestamptz`;
    params.push(opts.startDate);
    i++;
  }
  if (opts.endDate) {
    q += ` AND created_at <= $${i}::timestamptz`;
    params.push(opts.endDate);
  }
  q += ' ORDER BY created_at DESC';
  const limit = Math.min(opts.limit ?? 50, 500);
  const offset = opts.offset ?? 0;
  q += ` LIMIT ${limit} OFFSET ${offset}`;
  const r = await queryPg<AiActionLogRow>(q, params);
  return r.rows;
}

router.get('/logs', protect, requirePermission('audit_logs', 'read'), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(400).json({ message: 'Colegio no definido.' });

    const { action, entityType, startDate, endDate, limit } = req.query;
    const opts = {
      action: typeof action === 'string' ? action : undefined,
      entityType: typeof entityType === 'string' ? entityType : undefined,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) || 50 : 50,
    };

    const [activityLogs, aiLogs] = await Promise.all([
      findActivityLogsByInstitution(colegioId, opts),
      findAiActionLogs(colegioId, opts),
    ]);

    const activityMapped = await Promise.all(
      activityLogs.map(async (row) => {
        const u = await findUserById(row.user_id);
        return {
          _id: row.id,
          userId: row.user_id,
          role: u?.role ?? '',
          action: row.action,
          entityType: row.entity_type,
          entityId: row.entity_id ?? undefined,
          colegioId: row.institution_id,
          timestamp: row.created_at,
          result: 'success',
          ipAddress: row.ip_address ?? null,
          requestData: (row.metadata as Record<string, unknown>) ?? undefined,
        };
      })
    );

    const aiMapped = aiLogs.map((row) => ({
      _id: row.id,
      userId: row.actor_user_id,
      role: row.actor_role,
      action: row.action_name,
      entityType: row.entity_type ?? '',
      entityId: row.entity_id ?? undefined,
      colegioId: row.institution_id,
      timestamp: row.created_at,
      result: row.status,
      ipAddress: row.ip_address ?? null,
      requestData: row.parameters ?? undefined,
    }));

    const combined = [...activityMapped, ...aiMapped].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const limited = combined.slice(0, opts.limit ?? 50);

    const totalActivity = await countActivityLogsByInstitution(colegioId, opts);
    const totalAi = (await queryPg<{ c: number }>(
      'SELECT COUNT(*)::int AS c FROM analytics.ai_action_logs WHERE institution_id = $1',
      [colegioId]
    )).rows[0]?.c ?? 0;
    const total = totalActivity + totalAi;

    return res.json({ logs: limited, total });
  } catch (e: unknown) {
    console.error('Error en GET /api/audit/logs:', e);
    return res.status(500).json({ message: 'Error al obtener logs de auditoría.' });
  }
});

export default router;
