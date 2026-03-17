/**
 * Admin-only SQL console: ejecuta consultas contra la base Neon (PostgreSQL).
 * Solo roles admin-general-colegio, school_admin, super_admin.
 */

import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import { queryPg } from '../config/db-pg.js';
import { logAdminAction } from '../services/auditLogger.js';

const router = express.Router();

/** Handler para POST /api/admin/sql — ejecutar SQL con la misma conexión PG (Neon) que usa la plataforma */
export async function adminSqlHandler(req: AuthRequest, res: express.Response) {
    try {
      const { sql } = req.body as { sql?: string };
      if (!sql || typeof sql !== 'string') {
        return res.status(400).json({ error: 'Se requiere el campo "sql" con la consulta.' });
      }
      const trimmed = sql.trim();
      if (!trimmed) {
        return res.status(400).json({ error: 'La consulta SQL no puede estar vacía.' });
      }
      // Solo permitir SELECT (seguridad: solo lectura)
      const normalized = trimmed.toUpperCase();
      if (!normalized.startsWith('SELECT')) {
        return res.status(400).json({ error: 'Solo se permiten consultas SELECT. Esta operación no está permitida desde la consola.' });
      }
      // Bloquear patrones destructivos (defensa en profundidad)
      if (/\b(DROP|TRUNCATE|DELETE|ALTER\s+TABLE|UPDATE)\b/i.test(trimmed) || trimmed.includes('--')) {
        return res.status(400).json({ error: 'Esta operación no está permitida desde la consola.' });
      }
      // Una sola sentencia por request (evitar múltiples statements)
      const statements = trimmed.split(';').filter((s) => s.trim().length > 0);
      if (statements.length > 1) {
        return res.status(400).json({
          error: 'Solo se permite una sentencia SQL por ejecución. Ejecuta varias consultas por separado.',
        });
      }

      const result = await queryPg(trimmed);
      const rowCount = result.rowCount ?? 0;
      const command = result.command ?? '';

      await logAdminAction({
        userId: req.user?.id ?? '',
        role: req.user?.rol ?? 'admin-general-colegio',
        action: 'admin_sql',
        entityType: 'database',
        entityId: '',
        colegioId: req.user?.colegioId ?? req.user?.institution_id ?? '',
        requestData: { sqlPreview: trimmed.slice(0, 200), command, rowCount },
      }).catch(() => {});

      if (command === 'SELECT' && result.rows) {
        const fields = result.fields?.map((f) => f.name) ?? [];
        return res.json({
          rows: result.rows,
          rowCount: result.rows.length,
          fields,
        });
      }
      return res.json({ rowCount, command });
  } catch (e: unknown) {
    const message = (e as Error).message ?? 'Error al ejecutar la consulta.';
    console.error('Admin SQL error:', message);
    return res.status(500).json({ error: message });
  }
}

router.post('/sql', protect, requireRole('admin-general-colegio', 'school_admin', 'super_admin'), adminSqlHandler);

export default router;
