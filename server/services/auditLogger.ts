/**
 * auditLogger.ts
 * Sistema de auditoría unificado — SOLO PostgreSQL.
 *
 * Registra:
 * - Acciones de administración (crear usuario, asignar rol, etc.)
 * - Acciones de IA ejecutadas por el sistema
 * - Acciones críticas con IP (vía createActivityLog / middleware)
 */

import { createActivityLog } from '../repositories/activityLogRepository.js';
import { queryPg } from '../config/db-pg.js';
import { sanitizeContextObject } from './llmSanitizer.js';

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

// ── Tipos ────────────────────────────────────────────────────────────────────

export type AuditResult = 'success' | 'denied' | 'error';

export type AdminAuditAction =
  | 'create_user'
  | 'update_user'
  | 'delete_user'
  | 'create_group'
  | 'assign_student'
  | 'assign_professor_to_groups'
  | 'assign_professor'
  | 'enroll_students'
  | 'vinculacion'
  | 'confirmar_vinculacion'
  | 'activar_cuentas'
  | 'change_role'
  | 'reset_password'
  | 'export_data'
  | 'admin_sql';

export interface AuditLogData {
  userId: string;
  role: string;
  action: string;
  entityType: string;
  entityId?: string;
  institutionId: string;
  result: AuditResult;
  error?: string;
  requestData?: Record<string, unknown>;
  ipAddress?: string;
}

// ── Función principal de registro ─────────────────────────────────────────────

export async function logAuditEvent(data: AuditLogData): Promise<void> {
  try {
    const safeRequestData = data.requestData
      ? sanitizeContextObject(data.requestData as Record<string, unknown>)
      : undefined;
    await createActivityLog({
      institution_id: data.institutionId,
      user_id: data.userId,
      entity_type: data.entityType,
      entity_id: data.entityId && data.entityId.length > 0 ? data.entityId : null,
      action: data.action,
      ip_address: data.ipAddress ?? null,
      metadata: {
        role: data.role,
        result: data.result,
        ...(data.error ? { error: data.error } : {}),
        ...(safeRequestData ? { requestData: safeRequestData } : {}),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auditLogger] Error al registrar evento:', msg);
  }
}

// ── Helpers semánticos ────────────────────────────────────────────────────────

/** Registra una acción de administración */
export async function logAdminAction(data: {
  userId: string;
  role: string;
  action: AdminAuditAction | string;
  entityType: string;
  entityId?: string;
  colegioId?: string;
  institutionId?: string;
  requestData?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  const institutionId = data.institutionId ?? data.colegioId;
  if (!institutionId) {
    console.warn('[auditLogger] logAdminAction sin institutionId/colegioId, omitido');
    return;
  }
  await logAuditEvent({
    userId: data.userId,
    role: data.role,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    institutionId,
    result: 'success',
    requestData: data.requestData,
    ipAddress: data.ipAddress,
  });
}

/** Registra una acción ejecutada por la IA */
export async function logAIAction(data: {
  userId: string;
  role: string;
  action: string;
  entityType: string;
  entityId?: string;
  cursoId?: string;
  colegioId?: string;
  institutionId?: string;
  result: AuditResult;
  error?: string;
  requestData?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  const institutionId = data.institutionId ?? data.colegioId;
  if (!institutionId) {
    console.warn('[auditLogger] logAIAction sin institutionId/colegioId, omitido');
    return;
  }

  const entityUuid =
    data.entityId && isUuid(data.entityId) ? data.entityId : null;

  const parameters: Record<string, unknown> = {
    ...(typeof data.requestData === 'object' && data.requestData !== null ? data.requestData : {}),
  };
  if (data.cursoId) parameters.cursoId = data.cursoId;
  if (data.entityId && !entityUuid) parameters.entityRef = data.entityId;

  const safeParameters = sanitizeContextObject(parameters as Record<string, unknown>) as Record<string, unknown>;

  const resultJson =
    data.result === 'success' ? {} : { error: data.error ?? 'unknown' };

  try {
    await queryPg(
      `INSERT INTO analytics.ai_action_logs
         (institution_id, actor_user_id, actor_role, action_name, entity_type,
          entity_id, parameters, result, status, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        institutionId,
        data.userId,
        data.role,
        data.action,
        data.entityType ?? null,
        entityUuid,
        safeParameters,
        resultJson,
        data.result,
        data.ipAddress ?? null,
      ]
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auditLogger] Error al registrar acción IA:', msg);
  }
}

/** Registra acceso denegado */
export async function logDeniedAccess(data: {
  userId: string;
  role: string;
  action: string;
  entityType: string;
  institutionId: string;
  ipAddress?: string;
  reason?: string;
}): Promise<void> {
  await logAuditEvent({
    ...data,
    result: 'denied',
    requestData: data.reason ? { reason: data.reason } : undefined,
  });
}

// ── Consultas (opcional; el GET /api/audit/logs usa repositorio + query directa) ─

export interface AuditLogsFilter {
  action?: string;
  entityType?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export async function getAuditLogs(
  institutionId: string,
  filters: AuditLogsFilter = {}
): Promise<{ logs: Record<string, unknown>[]; total: number }> {
  try {
    let q = `
      SELECT
        id, institution_id, user_id, entity_type, entity_id,
        action, metadata, ip_address, created_at,
        'activity' AS log_source
      FROM analytics.activity_logs
      WHERE institution_id = $1
    `;
    const params: unknown[] = [institutionId];
    let i = 2;

    if (filters.action) {
      q += ` AND action = $${i}`;
      params.push(filters.action);
      i++;
    }
    if (filters.entityType) {
      q += ` AND entity_type = $${i}`;
      params.push(filters.entityType);
      i++;
    }
    if (filters.userId) {
      q += ` AND user_id = $${i}`;
      params.push(filters.userId);
      i++;
    }
    if (filters.ipAddress) {
      q += ` AND ip_address = $${i}`;
      params.push(filters.ipAddress);
      i++;
    }
    if (filters.startDate) {
      q += ` AND created_at >= $${i}::timestamptz`;
      params.push(filters.startDate);
      i++;
    }
    if (filters.endDate) {
      q += ` AND created_at <= $${i}::timestamptz`;
      params.push(filters.endDate);
      i++;
    }

    let countQ = `SELECT COUNT(*)::int AS c FROM analytics.activity_logs WHERE institution_id = $1`;
    const countParams: unknown[] = [institutionId];
    let j = 2;
    if (filters.action) {
      countQ += ` AND action = $${j}`;
      countParams.push(filters.action);
      j++;
    }
    if (filters.entityType) {
      countQ += ` AND entity_type = $${j}`;
      countParams.push(filters.entityType);
      j++;
    }
    if (filters.userId) {
      countQ += ` AND user_id = $${j}`;
      countParams.push(filters.userId);
      j++;
    }
    if (filters.ipAddress) {
      countQ += ` AND ip_address = $${j}`;
      countParams.push(filters.ipAddress);
      j++;
    }
    if (filters.startDate) {
      countQ += ` AND created_at >= $${j}::timestamptz`;
      countParams.push(filters.startDate);
      j++;
    }
    if (filters.endDate) {
      countQ += ` AND created_at <= $${j}::timestamptz`;
      countParams.push(filters.endDate);
      j++;
    }

    q += ' ORDER BY created_at DESC';
    const limit = Math.min(filters.limit ?? 50, 500);
    const offset = filters.offset ?? 0;
    q += ` LIMIT ${limit} OFFSET ${offset}`;

    const [logsResult, countResult] = await Promise.all([
      queryPg<Record<string, unknown>>(q, params),
      queryPg<{ c: number }>(countQ, countParams),
    ]);

    return {
      logs: logsResult.rows,
      total: countResult.rows[0]?.c ?? 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[auditLogger] Error al obtener logs:', msg);
    return { logs: [], total: 0 };
  }
}
