import express from 'express';
import bcrypt from 'bcryptjs';
import { protect, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth.js';
import { logAdminAction } from '../services/auditLogger';
import {
  findSectionsByInstitution,
  updateSectionName,
  findSectionById,
  findSectionByInstitutionAndName,
} from '../repositories/sectionRepository.js';
import {
  findGroupById,
  findGroupByNameAndInstitution,
  findGroupsBySection,
  updateGroupSection,
  type GroupRow,
} from '../repositories/groupRepository.js';
import { getPgPool, queryPg } from '../config/db-pg.js';
import { findUserByEmail } from '../repositories/userRepository.js';
import { generateUserId } from '../utils/idGenerator.js';
import {
  computeSectionHierarchicalGpa,
  countSectionDisciplinaryActions,
} from '../utils/sectionDashboardStats.js';
import {
  createDisciplinaryAction,
  type DisciplinarySeverity,
} from '../repositories/disciplinaryActionRepository.js';
import { createComunicacionAnnouncement } from '../repositories/comunicacionRepository.js';
import { addAnnouncementRecipients } from '../repositories/announcementRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { getFirstGroupNameForStudent } from '../repositories/enrollmentRepository.js';

const router = express.Router();

const SEVERITY_VALUES: readonly DisciplinarySeverity[] = ['leve', 'grave', 'suma gravedad'];

function isDisciplinarySeverity(s: unknown): s is DisciplinarySeverity {
  return typeof s === 'string' && (SEVERITY_VALUES as readonly string[]).includes(s);
}

async function studentEnrolledInSection(
  studentId: string,
  sectionId: string,
  institutionId: string
): Promise<boolean> {
  const r = await queryPg<{ x: number }>(
    `SELECT 1 AS x
     FROM enrollments e
     INNER JOIN groups g ON g.id = e.group_id AND g.institution_id = $3
     WHERE e.student_id = $1::uuid AND g.section_id = $2::uuid
     LIMIT 1`,
    [studentId, sectionId, institutionId]
  );
  return r.rows.length > 0;
}

async function listGuardianIdsForStudent(studentId: string): Promise<string[]> {
  const r = await queryPg<{ id: string }>(
    `SELECT DISTINCT u.id
     FROM guardian_students gs
     INNER JOIN users u ON u.id = gs.guardian_id AND u.role = 'padre'
     WHERE gs.student_id = $1::uuid`,
    [studentId]
  );
  return r.rows.map((row: { id: string }) => row.id);
}

/** Cliente mínimo para transacción (misma firma que pg PoolClient#query). */
type PgClientForSectionTx = {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>;
};

async function resolveGroupRowForLink(
  client: PgClientForSectionTx,
  institutionId: string,
  idOrName: string
): Promise<{ id: string } | null> {
  const str = String(idOrName).trim();
  if (str.length === 36 && str.includes('-')) {
    const r = await client.query<{ id: string; institution_id: string }>(
      'SELECT id, institution_id FROM groups WHERE id = $1',
      [str]
    );
    const row = r.rows[0];
    return row && row.institution_id === institutionId ? { id: row.id } : null;
  }
  const r = await client.query<{ id: string }>(
    'SELECT id FROM groups WHERE institution_id = $1 AND UPPER(TRIM(name)) = UPPER(TRIM($2))',
    [institutionId, str]
  );
  return r.rows[0] ?? null;
}

async function generarInternalCodeTx(client: PgClientForSectionTx): Promise<string> {
  for (let intentos = 0; intentos < 1000; intentos++) {
    const codigo = Math.floor(1000 + Math.random() * 9000).toString();
    const c = await client.query('SELECT 1 FROM users WHERE internal_code = $1 LIMIT 1', [codigo]);
    if (c.rowCount === 0) return codigo;
  }
  throw new Error('No se pudo generar un código interno único.');
}

function generarPasswordAleatorio(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 12; i++) s += chars.charAt(Math.floor(Math.random() * chars.length));
  return s;
}

function canManageSections(req: AuthRequest): { allowed: boolean; colegioId?: string } {
  const colegioId = req.user?.colegioId;
  if (!req.user?.id || !colegioId) return { allowed: false };
  const allowed = req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin';
  return { allowed, colegioId };
}

function canViewSections(req: AuthRequest): { allowed: boolean; colegioId?: string } {
  const colegioId = req.user?.colegioId;
  if (!req.user?.id || !colegioId) return { allowed: false };
  const allowed = req.user.rol === 'admin-general-colegio' || req.user.rol === 'school_admin' || req.user.rol === 'directivo';
  return { allowed, colegioId };
}

router.get('/my-section', protect, requireRole('directivo'), async (req: AuthRequest, res) => {
  try {
    const sectionId = req.user?.sectionId;
    const colegioId = req.user?.colegioId;
    if (!sectionId) return res.status(404).json({ message: 'No tienes una sección asignada.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const section = await findSectionById(sectionId);
    if (!section || section.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Sección no encontrada.' });
    }

    const groups = await findGroupsBySection(sectionId);
    const groupIds = groups.map((g) => g.id);

    const [totalEstudiantes, staffRow, promedioGeneral, totalAmonestaciones] = await Promise.all([
      groupIds.length === 0
        ? Promise.resolve({ rows: [{ count: 0 }] })
        : queryPg<{ count: number }>(
            `SELECT COUNT(DISTINCT e.student_id)::int AS count
             FROM enrollments e
             WHERE e.group_id = ANY($1::uuid[])`,
            [groupIds]
          ),
      groupIds.length === 0
        ? Promise.resolve({ rows: [{ profesores: 0, materias: 0 }] })
        : queryPg<{ profesores: number; materias: number }>(
            `SELECT
               COUNT(DISTINCT gs.teacher_id) FILTER (WHERE gs.teacher_id IS NOT NULL)::int AS profesores,
               COUNT(DISTINCT gs.subject_id)::int AS materias
             FROM group_subjects gs
             WHERE gs.group_id = ANY($1::uuid[])`,
            [groupIds]
          ),
      computeSectionHierarchicalGpa(groupIds),
      countSectionDisciplinaryActions(colegioId, groupIds),
    ]);

    return res.json({
      id: section.id,
      _id: section.id,
      nombre: section.name,
      grupos: groups.map(g => ({ id: g.id, _id: g.id, nombre: g.name })),
      totalGrupos: groups.length,
      totalEstudiantes: totalEstudiantes.rows[0]?.count ?? 0,
      totalProfesores: staffRow.rows[0]?.profesores ?? 0,
      totalMaterias: staffRow.rows[0]?.materias ?? 0,
      promedioGeneral,
      totalAmonestaciones,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener sección.' });
  }
});

/** Estudiantes matriculados en algún curso de la sección del directivo (lista para directorio). */
router.get('/my-section/students', protect, requireRole('directivo'), async (req: AuthRequest, res) => {
  try {
    const sectionId = req.user?.sectionId;
    const colegioId = req.user?.colegioId;
    if (!sectionId) return res.status(404).json({ message: 'No tienes una sección asignada.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    type SectionStudentRow = {
      id: string;
      nombre: string;
      email: string | null;
      grupo_id: string;
      grupo_nombre: string;
    };
    const r = await queryPg<SectionStudentRow>(
      `SELECT DISTINCT ON (u.id)
         u.id,
         COALESCE(NULLIF(TRIM(u.full_name), ''), NULLIF(TRIM(u.email), ''), u.id::text) AS nombre,
         u.email,
         g.id AS grupo_id,
         g.name AS grupo_nombre
       FROM enrollments e
       INNER JOIN users u ON u.id = e.student_id AND u.institution_id = $2::uuid AND u.role = 'estudiante'
       INNER JOIN groups g ON g.id = e.group_id AND g.institution_id = $2::uuid
       WHERE g.section_id = $1::uuid
       ORDER BY u.id, g.name ASC`,
      [sectionId, colegioId]
    );

    return res.json(
      r.rows.map((row: SectionStudentRow) => ({
        id: row.id,
        nombre: row.nombre,
        email: row.email ?? '',
        grupoId: row.grupo_id,
        grupoNombre: row.grupo_nombre,
      }))
    );
  } catch (e: unknown) {
    console.error('my-section/students:', e);
    return res.status(500).json({ message: 'Error al listar estudiantes.' });
  }
});

/** Historial de amonestaciones de estudiantes de la sección. */
router.get('/my-section/disciplinary-actions', protect, requireRole('directivo'), async (req: AuthRequest, res) => {
  try {
    const sectionId = req.user?.sectionId;
    const colegioId = req.user?.colegioId;
    if (!sectionId) return res.status(404).json({ message: 'No tienes una sección asignada.' });
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    type SectionDisciplinaryRow = {
      id: string;
      student_id: string;
      student_name: string | null;
      severity: DisciplinarySeverity;
      reason: string;
      occurred_at: string;
      created_at: string;
      creator_name: string | null;
      grupo_id: string | null;
    };
    const r = await queryPg<SectionDisciplinaryRow>(
      `SELECT da.id, da.student_id,
              su.full_name AS student_name,
              da.severity, da.reason, da.occurred_at, da.created_at,
              cu.full_name AS creator_name,
              (SELECT g.id
               FROM enrollments e
               INNER JOIN groups g ON g.id = e.group_id AND g.institution_id = da.institution_id
               WHERE e.student_id = da.student_id AND g.section_id = $2::uuid
               ORDER BY g.name
               LIMIT 1) AS grupo_id
       FROM disciplinary_actions da
       INNER JOIN users su ON su.id = da.student_id
       LEFT JOIN users cu ON cu.id = da.created_by_id
       WHERE da.institution_id = $1::uuid
         AND EXISTS (
           SELECT 1 FROM enrollments e
           INNER JOIN groups g ON g.id = e.group_id AND g.institution_id = $1::uuid
           WHERE e.student_id = da.student_id AND g.section_id = $2::uuid
         )
       ORDER BY da.created_at DESC
       LIMIT 150`,
      [colegioId, sectionId]
    );

    return res.json(
      r.rows.map((row: SectionDisciplinaryRow) => ({
        _id: row.id,
        estudianteId: row.student_id,
        estudianteNombre: row.student_name ?? '',
        gravedad: row.severity,
        razon: row.reason,
        fechaHecho: row.occurred_at,
        fechaRegistro: row.created_at,
        registradoPor: row.creator_name ?? '',
        grupoId: row.grupo_id,
      }))
    );
  } catch (e: unknown) {
    console.error('my-section/disciplinary-actions:', e);
    return res.status(500).json({ message: 'Error al listar amonestaciones.' });
  }
});

/** Registrar amonestación y enviar comunicado institucional a padres vinculados. */
router.post('/my-section/amonestaciones', protect, requireRole('directivo'), async (req: AuthRequest, res) => {
  try {
    const sectionId = req.user?.sectionId;
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!sectionId) return res.status(404).json({ message: 'No tienes una sección asignada.' });
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });

    const body = req.body as {
      student_id?: string;
      gravedad?: string;
      razon?: string;
      fechaHecho?: string;
    };
    const studentId = typeof body.student_id === 'string' ? body.student_id.trim() : '';
    const severityRaw = body.gravedad;
    const reason = typeof body.razon === 'string' ? body.razon.trim() : '';
    const fechaHechoRaw = typeof body.fechaHecho === 'string' ? body.fechaHecho.trim() : '';

    if (!studentId) return res.status(400).json({ message: 'Debes seleccionar un estudiante.' });
    if (!isDisciplinarySeverity(severityRaw)) return res.status(400).json({ message: 'Gravedad inválida.' });
    if (!reason) return res.status(400).json({ message: 'La explicación es obligatoria.' });

    const student = await findUserById(studentId);
    if (!student || student.role !== 'estudiante' || student.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Estudiante no encontrado.' });
    }

    const inSection = await studentEnrolledInSection(studentId, sectionId, colegioId);
    if (!inSection) {
      return res.status(403).json({ message: 'Este estudiante no pertenece a tu sección.' });
    }

    let occurredAt: string | null = null;
    if (fechaHechoRaw) {
      const isoish = fechaHechoRaw.includes('T') ? fechaHechoRaw : `${fechaHechoRaw}T12:00:00`;
      const d = new Date(isoish);
      if (Number.isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Fecha y hora del hecho no válida.' });
      }
      occurredAt = d.toISOString();
    }

    const guardianIds = await listGuardianIdsForStudent(studentId);
    if (guardianIds.length === 0) {
      return res.status(400).json({
        message: 'No hay acudientes vinculados a este estudiante. No se puede enviar el comunicado.',
      });
    }

    const director = await findUserById(userId);
    const grupoNombre = (await getFirstGroupNameForStudent(studentId)) ?? '';
    const studentDisplay = student.full_name?.trim() || student.email || studentId;
    const occurredDisplay = occurredAt
      ? new Date(occurredAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })
      : new Date().toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

    const createdAction = await createDisciplinaryAction({
      institution_id: colegioId,
      student_id: studentId,
      created_by_id: userId,
      severity: severityRaw,
      reason,
      occurred_at: occurredAt,
    });

    const title = `Amonestación · ${studentDisplay}`;
    const bodyText =
      `Se registra una amonestación disciplinaria.\n\n` +
      `Estudiante: ${studentDisplay}${grupoNombre ? `\nCurso / grupo: ${grupoNombre}` : ''}\n` +
      `Gravedad: ${severityRaw}\n` +
      `Fecha y hora del hecho: ${occurredDisplay}\n\n` +
      `Explicación:\n${reason}\n\n` +
      `Registrado por: ${director?.full_name?.trim() || 'Director de sección'}`;

    const priority = severityRaw === 'leve' ? 'normal' : 'alta';
    const scheduled = new Date(Date.now() + 30_000).toISOString();

    const announcement = await createComunicacionAnnouncement({
      institution_id: colegioId,
      title,
      body: bodyText,
      type: 'comunicado_institucional',
      group_id: null,
      group_subject_id: null,
      created_by_id: userId,
      status: 'pending',
      scheduled_send_at: scheduled,
      sent_at: null,
      audience: 'parents',
      category: 'aviso',
      priority,
    });

    await addAnnouncementRecipients(announcement.id, guardianIds);

    return res.status(201).json({
      disciplinaryActionId: createdAction.id,
      announcementId: announcement.id,
      scheduled_send_at: scheduled,
    });
  } catch (e: unknown) {
    console.error('my-section/amonestaciones:', e);
    return res.status(500).json({ message: 'Error al registrar la amonestación.' });
  }
});

router.get('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canViewSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para listar secciones.' });
    }

    const sections = await findSectionsByInstitution(colegioId);
    const result = await Promise.all(
      sections.map(async (s) => {
        const grupos = await findGroupsBySection(s.id);
        return {
          _id: s.id,
          nombre: s.name,
          colegioId: s.institution_id,
          cursos: grupos.map((g) => ({ _id: g.id, nombre: g.name })),
        };
      })
    );
    return res.json(result);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar secciones.' });
  }
});

router.post('/', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para crear secciones.' });
    }
    const adminUserId = req.user?.id;
    const body = req.body as {
      nombre?: string;
      cursoIds?: string[];
      nuevosCursos?: string[];
      directivo?: { nombre?: string; email?: string };
    };
    const { nombre, cursoIds, nuevosCursos, directivo } = body;
    if (!nombre || typeof nombre !== 'string' || !nombre.trim()) {
      return res.status(400).json({ message: 'El nombre de la sección es obligatorio.' });
    }
    const nombreTrim = nombre.trim();

    const existente = await findSectionByInstitutionAndName(colegioId, nombreTrim);
    if (existente) {
      return res.status(400).json({ message: `Ya existe una sección llamada "${nombreTrim}".` });
    }

    const idsToLink = Array.isArray(cursoIds) ? cursoIds : [];
    const nuevos = Array.isArray(nuevosCursos)
      ? nuevosCursos.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
      : [];

    let directivoNombre: string | undefined;
    let directivoEmail: string | undefined;
    if (directivo != null && typeof directivo === 'object') {
      const n = typeof directivo.nombre === 'string' ? directivo.nombre.trim() : '';
      const e = typeof directivo.email === 'string' ? directivo.email.trim().toLowerCase() : '';
      if (n || e) {
        if (!n || !e) {
          return res.status(400).json({
            message: 'Para crear el directivo de la sección indica nombre y correo, o deja ambos vacíos.',
          });
        }
        directivoNombre = n;
        directivoEmail = e;
        const ya = await findUserByEmail(directivoEmail);
        if (ya) {
          return res.status(400).json({ message: 'El correo ya está registrado.' });
        }
      }
    }

    const pool = getPgPool();
    const client = await pool.connect();
    let sectionId = '';
    let cursosRows: { id: string; name: string }[] = [];
    let directivoOut: {
      _id: string;
      nombre: string;
      email: string;
      passwordTemporal: string;
      userId: string;
    } | null = null;

    try {
      await client.query('BEGIN');

      const insSec = await client.query<{ id: string; name: string; institution_id: string }>(
        'INSERT INTO sections (institution_id, name) VALUES ($1, $2) RETURNING id, name, institution_id',
        [colegioId, nombreTrim]
      );
      const sectionRow = insSec.rows[0];
      if (!sectionRow) throw new Error('No se pudo crear la sección.');
      sectionId = sectionRow.id;

      for (const idOrName of idsToLink) {
        const g = await resolveGroupRowForLink(client, colegioId, idOrName);
        if (g) {
          await client.query(
            'UPDATE groups SET section_id = $1, updated_at = now() WHERE id = $2 AND institution_id = $3',
            [sectionId, g.id, colegioId]
          );
        }
      }

      for (const nameUpper of nuevos) {
        const dup = await client.query<{ id: string }>(
          'SELECT id FROM groups WHERE institution_id = $1 AND UPPER(TRIM(name)) = UPPER(TRIM($2))',
          [colegioId, nameUpper]
        );
        if (dup.rows[0]) {
          throw new Error(`El grupo ${nameUpper} ya existe en la institución.`);
        }
        await client.query(
          `INSERT INTO groups (institution_id, section_id, name, description, academic_period_id)
           VALUES ($1, $2, $3, $4, NULL)`,
          [colegioId, sectionId, nameUpper, `Grupo ${nameUpper}`]
        );
      }

      if (directivoNombre && directivoEmail) {
        const passwordPlain = generarPasswordAleatorio();
        const passwordHash = await bcrypt.hash(passwordPlain, 10);
        const internalCode = await generarInternalCodeTx(client);
        const insUser = await client.query<{ id: string }>(
          `INSERT INTO users (
             institution_id, email, password_hash, full_name, role, status, internal_code, phone, section_id, config
           ) VALUES ($1, $2, $3, $4, 'directivo', 'active', $5, NULL, $6, $7::jsonb)
           RETURNING id`,
          [colegioId, directivoEmail, passwordHash, directivoNombre, internalCode, sectionId, JSON.stringify({})]
        );
        const newId = insUser.rows[0]?.id;
        if (!newId) throw new Error('No se pudo crear el directivo.');
        const userIdInfo = generateUserId('directivo', newId as never);
        await client.query('UPDATE users SET config = $1::jsonb, updated_at = now() WHERE id = $2', [
          JSON.stringify({ userId: userIdInfo.fullId }),
          newId,
        ]);
        directivoOut = {
          _id: newId,
          nombre: directivoNombre,
          email: directivoEmail,
          passwordTemporal: passwordPlain,
          userId: userIdInfo.fullId,
        };
      }

      await client.query('COMMIT');

      const cAfter = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM groups WHERE section_id = $1 ORDER BY name',
        [sectionId]
      );
      cursosRows = cAfter.rows;
    } catch (err: unknown) {
      await client.query('ROLLBACK');
      const msg = err instanceof Error ? err.message : 'Error al crear la sección.';
      if (msg.includes('ya existe')) {
        return res.status(400).json({ message: msg });
      }
      console.error(err);
      return res.status(500).json({ message: 'Error al crear la sección.' });
    } finally {
      client.release();
    }

    if (adminUserId) {
      logAdminAction({
        userId: adminUserId,
        role: 'admin-general-colegio',
        action: 'create_section',
        entityType: 'section',
        entityId: sectionId,
        colegioId,
        requestData: {
          nombre: nombreTrim,
          cursoIds: idsToLink,
          nuevosCursos: nuevos,
          directivoEmail: directivoEmail ?? null,
        },
      }).catch(() => {});
      if (directivoOut) {
        logAdminAction({
          userId: adminUserId,
          role: 'admin-general-colegio',
          action: 'create_user',
          entityType: 'user',
          entityId: directivoOut._id,
          colegioId,
          requestData: { rol: 'directivo', email: directivoOut.email, sectionId },
        }).catch(() => {});
      }
    }

    return res.status(201).json({
      message: 'Sección creada correctamente.',
      section: {
        _id: sectionId,
        nombre: nombreTrim,
        colegioId,
        cursos: cursosRows.map((g) => ({ _id: g.id, nombre: g.name })),
      },
      directivo: directivoOut,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear la sección.' });
  }
});

router.patch('/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { allowed, colegioId } = canManageSections(req);
    if (!allowed || !colegioId) {
      return res.status(403).json({ message: 'No autorizado para editar secciones.' });
    }
    const userId = req.user?.id;
    const sectionId = req.params.id;

    const section = await findSectionById(sectionId);
    if (!section || section.institution_id !== colegioId) {
      return res.status(404).json({ message: 'Sección no encontrada.' });
    }
    const { nombre, addCursoIds, removeCursoIds } = req.body as {
      nombre?: string;
      addCursoIds?: string[];
      removeCursoIds?: string[];
    };

    if (typeof nombre === 'string' && nombre.trim()) {
      const otro = await findSectionByInstitutionAndName(colegioId, nombre.trim());
      if (otro && otro.id !== sectionId) {
        return res.status(400).json({ message: 'Ya existe otra sección con ese nombre.' });
      }
      await updateSectionName(sectionId, colegioId, nombre.trim());
    }

    const toAdd = Array.isArray(addCursoIds) ? addCursoIds : [];
    for (const idOrName of toAdd) {
      const str = String(idOrName).trim();
      const group: GroupRow | null = (str.length === 36 && str.includes('-'))
        ? await findGroupById(str)
        : await findGroupByNameAndInstitution(colegioId, str.toUpperCase());
      if (group && group.institution_id === colegioId) {
        await updateGroupSection(group.id, colegioId, sectionId);
      }
    }

    const toRemove = Array.isArray(removeCursoIds) ? removeCursoIds : [];
    const allSections = await findSectionsByInstitution(colegioId);
    const fallbackSectionId = allSections.find((s) => s.id !== sectionId)?.id ?? allSections[0]?.id;
    for (const idOrName of toRemove) {
      const str = String(idOrName).trim();
      const group: GroupRow | null = (str.length === 36 && str.includes('-'))
        ? await findGroupById(str)
        : await findGroupByNameAndInstitution(colegioId, str.toUpperCase());
      if (group && group.institution_id === colegioId && group.section_id === sectionId && fallbackSectionId) {
        await updateGroupSection(group.id, colegioId, fallbackSectionId);
      }
    }

    if (userId) {
      logAdminAction({
        userId,
        role: 'admin-general-colegio',
        action: 'update_section',
        entityType: 'section',
        entityId: sectionId,
        colegioId,
        requestData: { nombre, addCursoIds: toAdd, removeCursoIds: toRemove },
      }).catch(() => {});
    }

    const updated = await findSectionById(sectionId);
    const cursos = updated ? await findGroupsBySection(updated.id) : [];
    return res.json({
      message: 'Sección actualizada.',
      section: {
        _id: updated?.id ?? sectionId,
        nombre: updated?.name ?? '',
        colegioId,
        cursos: cursos.map((g) => ({ _id: g.id, nombre: g.name })),
      },
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al actualizar la sección.' });
  }
});

export default router;
