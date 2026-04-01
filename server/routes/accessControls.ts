import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { queryPg } from '../config/db-pg.js';
import { findUserById } from '../repositories/userRepository.js';

const router = express.Router();

const VALID_FEATURES = [
  'ver_notas',
  'ver_asistencia',
  'descargar_boletin',
  'chat_estudiantes',
  'subir_archivos',
];

async function ensureAdmin(req: AuthRequest): Promise<{ ok: true; colegioId: string } | { ok: false; status: number; message: string }> {
  const uid = req.user?.id;
  if (!uid) return { ok: false, status: 403, message: 'No autorizado' };
  const u = await findUserById(uid);
  if (!u || (u.role !== 'admin-general-colegio' && u.role !== 'school_admin' && u.role !== 'asistente-academica')) {
    return { ok: false, status: 403, message: 'Solo administradores del colegio pueden gestionar accesos.' };
  }
  if (!u.institution_id) return { ok: false, status: 400, message: 'Institución no definida.' };
  return { ok: true, colegioId: u.institution_id };
}

// GET /api/access-controls
router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdmin(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const result = await queryPg<{
      id: string;
      feature: string;
      blocked_roles: string[];
      reason: string | null;
      expires_at: string | null;
      created_at: string;
    }>(
      'SELECT id, feature, blocked_roles, reason, expires_at, created_at FROM access_controls WHERE institution_id = $1 ORDER BY created_at DESC',
      [check.colegioId]
    );

    // Devolver un mapa: feature → control (null si no existe = feature habilitada)
    const byFeature: Record<string, { id: string; blocked_roles: string[]; reason: string | null; expires_at: string | null } | null> = {};
    for (const f of VALID_FEATURES) byFeature[f] = null;
    for (const row of result.rows) {
      byFeature[row.feature] = {
        id: row.id,
        blocked_roles: row.blocked_roles,
        reason: row.reason,
        expires_at: row.expires_at,
      };
    }

    return res.json({ features: byFeature });
  } catch (e: unknown) {
    console.error('Error GET /access-controls:', e);
    return res.status(500).json({ message: 'Error al obtener controles de acceso.' });
  }
});

// POST /api/access-controls/toggle
// Body: { feature, blocked_roles, reason?, expires_at?, enabled }
// enabled=true → elimina el bloqueo; enabled=false → crea/actualiza el bloqueo
router.post('/toggle', protect, async (req: AuthRequest, res) => {
  try {
    const check = await ensureAdmin(req);
    if (!check.ok) return res.status(check.status).json({ message: check.message });

    const { feature, blocked_roles, reason, expires_at, enabled } = req.body as {
      feature?: string;
      blocked_roles?: string[];
      reason?: string;
      expires_at?: string | null;
      enabled?: boolean;
    };

    if (!feature || !VALID_FEATURES.includes(feature)) {
      return res.status(400).json({ message: `Feature inválido. Válidos: ${VALID_FEATURES.join(', ')}` });
    }

    if (enabled === true) {
      // Habilitar: eliminar el bloqueo
      await queryPg(
        'DELETE FROM access_controls WHERE institution_id = $1 AND feature = $2',
        [check.colegioId, feature]
      );
      return res.json({ message: `Feature "${feature}" habilitado.`, enabled: true });
    }

    // Deshabilitar: crear o actualizar
    const roles = Array.isArray(blocked_roles) && blocked_roles.length > 0
      ? blocked_roles
      : ['estudiante', 'padre'];

    const existing = await queryPg<{ id: string }>(
      'SELECT id FROM access_controls WHERE institution_id = $1 AND feature = $2',
      [check.colegioId, feature]
    );

    if (existing.rows.length > 0) {
      await queryPg(
        'UPDATE access_controls SET blocked_roles = $1, reason = $2, expires_at = $3, created_by = $4 WHERE id = $5',
        [roles, reason ?? null, expires_at ?? null, req.user!.id, existing.rows[0].id]
      );
    } else {
      await queryPg(
        'INSERT INTO access_controls (institution_id, feature, blocked_roles, reason, expires_at, created_by) VALUES ($1, $2, $3, $4, $5, $6)',
        [check.colegioId, feature, roles, reason ?? null, expires_at ?? null, req.user!.id]
      );
    }

    return res.json({ message: `Feature "${feature}" bloqueado para roles: ${roles.join(', ')}.`, enabled: false });
  } catch (e: unknown) {
    console.error('Error POST /access-controls/toggle:', e);
    return res.status(500).json({ message: 'Error al actualizar control de acceso.' });
  }
});

export default router;
