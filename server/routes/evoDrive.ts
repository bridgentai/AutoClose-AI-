import express from 'express';
import { google } from 'googleapis';
import { protect, restrictTo, AuthRequest } from '../middleware/authMiddleware.js';
import { ENV } from '../config/env.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { resolveGroupId } from '../utils/resolveLegacyCourse.js';
import { getAllCourseGroupsForStudent } from '../repositories/enrollmentRepository.js';
import {
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectsByGroupWithDetails,
  findGroupSubjectById,
} from '../repositories/groupSubjectRepository.js';
import { queryPg } from '../config/db-pg.js';
import {
  getPersonalFiles,
  createPersonalFile,
  deletePersonalFile,
  updatePersonalFileNombre,
} from '../repositories/evoPersonalFileRepository.js';
import {
  getGoogleToken,
  upsertGoogleToken,
  deleteGoogleToken,
} from '../repositories/googleTokenRepository.js';
import { getGoogleOAuth2Client, getAuthedOAuth2ForUser } from '../services/googleDriveUserOAuth.js';
import {
  getEvoFiles,
  getRecentCourseFilesForUser,
  createEvoFile,
  deleteEvoFile,
  toggleDestacado,
  getEvoFileById,
} from '../repositories/evoFileRepository.js';
import { computeInboxCategory } from '../services/evoSendAccess.js';

const router = express.Router();

function parseEvoDriveMessageAttachmentJson(content: string): { name?: string; url?: string | null; fileId?: string } | null {
  try {
    const o = JSON.parse(content) as unknown;
    if (!o || typeof o !== 'object') return null;
    const rec = o as Record<string, unknown>;
    return {
      name: typeof rec.name === 'string' ? rec.name : undefined,
      url: typeof rec.url === 'string' ? rec.url : null,
      fileId: typeof rec.fileId === 'string' ? rec.fileId : undefined,
    };
  } catch {
    return null;
  }
}

function webViewLinkFromDriveMeta(meta: { url?: string | null; fileId?: string | undefined }): string {
  const u = typeof meta.url === 'string' ? meta.url.trim() : '';
  if (u) return u;
  const id = typeof meta.fileId === 'string' ? meta.fileId.trim() : '';
  if (id) return `https://drive.google.com/file/d/${id}/view`;
  return '';
}

function parseAttachmentsJsonColumn(raw: unknown): Array<{ name: string; url?: string; fileId?: string }> {
  if (raw == null) return [];
  let arr: unknown;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  } else {
    arr = raw;
  }
  if (!Array.isArray(arr)) return [];
  const out: Array<{ name: string; url?: string; fileId?: string }> = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const nameRaw =
      typeof o.name === 'string' ? o.name : typeof o.nombre === 'string' ? o.nombre : '';
    const name = nameRaw.trim() || 'Archivo';
    const url = typeof o.url === 'string' ? o.url.trim() : '';
    const fileId = typeof o.fileId === 'string' ? o.fileId.trim() : '';
    if (!url && !fileId) continue;
    out.push({ name, url: url || undefined, fileId: fileId || undefined });
  }
  return out;
}

type CircSort = { api: ReturnType<typeof toEvoFileApi>; ts: number };

/** Circulares: mensajes Evo Send institucionales (evo_drive) + comunicados institucionales categoría circular (attachments_json). */
async function listPadreInstitutionalCirculareFiles(
  userId: string,
  institutionId: string
): Promise<ReturnType<typeof toEvoFileApi>[]> {
  const merged: CircSort[] = [];

  const r = await queryPg<{
    message_id: string;
    content: string;
    created_at: string;
    announcement_id: string;
    announcement_type: string;
  }>(
    `SELECT m.id AS message_id, m.content, m.created_at,
            a.id AS announcement_id, a.type AS announcement_type
     FROM announcement_messages m
     INNER JOIN announcements a ON a.id = m.announcement_id
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $1::uuid
     WHERE a.institution_id = $2::uuid
       AND m.content_type = 'evo_drive'
     ORDER BY m.created_at DESC
     LIMIT 300`,
    [userId, institutionId]
  );
  const catCache = new Map<string, 'academico' | 'institucional'>();
  for (const row of r.rows) {
    let cat = catCache.get(row.announcement_id);
    if (!cat) {
      cat = await computeInboxCategory({ id: row.announcement_id, type: row.announcement_type }, userId);
      catCache.set(row.announcement_id, cat);
    }
    if (cat !== 'institucional') continue;
    const meta = parseEvoDriveMessageAttachmentJson(row.content);
    if (!meta) continue;
    const link = webViewLinkFromDriveMeta({ url: meta.url ?? null, fileId: meta.fileId });
    if (!link) continue;
    const nombre = (meta.name && meta.name.trim()) || 'Archivo';
    const ts = new Date(row.created_at).getTime();
    const synthetic: Record<string, unknown> = {
      id: `circ-${row.message_id}`,
      nombre,
      tipo: 'doc',
      origen: 'google',
      google_file_id: meta.fileId ?? null,
      google_web_view_link: link,
      google_mime_type: null,
      mime_type: null,
      group_id: null,
      curso_nombre: 'Circulares',
      propietario_id: null,
      propietario_nombre: null,
      propietario_rol: null,
      es_publico: true,
      evo_storage_key: null,
      evo_storage_url: null,
      size_bytes: null,
      etiquetas: [],
      destacado: false,
      category_id: null,
      staff_only: false,
      created_at: row.created_at,
      updated_at: row.created_at,
    };
    merged.push({ api: toEvoFileApi(synthetic), ts });
  }

  const inst = await queryPg<{
    id: string;
    attachments_json: unknown;
    sent_at: string | null;
    created_at: string;
  }>(
    `SELECT a.id, a.attachments_json, a.sent_at, a.created_at
     FROM announcements a
     INNER JOIN announcement_recipients ar ON ar.announcement_id = a.id AND ar.user_id = $1::uuid
     WHERE a.institution_id = $2::uuid
       AND a.type = 'comunicado_institucional'
       AND LOWER(TRIM(COALESCE(a.category, ''))) = 'circular'
       AND COALESCE(a.status, 'sent') = 'sent'
       AND a.cancelled_at IS NULL
     ORDER BY COALESCE(a.sent_at, a.created_at) DESC
     LIMIT 100`,
    [userId, institutionId]
  );

  for (const row of inst.rows) {
    const items = parseAttachmentsJsonColumn(row.attachments_json);
    const ts = new Date(row.sent_at || row.created_at).getTime();
    items.forEach((att, idx) => {
      const link = webViewLinkFromDriveMeta({ url: att.url ?? null, fileId: att.fileId });
      if (!link) return;
      const synthetic: Record<string, unknown> = {
        id: `circ-inst-${row.id}-${idx}`,
        nombre: att.name,
        tipo: 'doc',
        origen: 'google',
        google_file_id: att.fileId ?? null,
        google_web_view_link: link,
        google_mime_type: null,
        mime_type: null,
        group_id: null,
        curso_nombre: 'Circulares',
        propietario_id: null,
        propietario_nombre: null,
        propietario_rol: null,
        es_publico: true,
        evo_storage_key: null,
        evo_storage_url: null,
        size_bytes: null,
        etiquetas: [],
        destacado: false,
        category_id: null,
        staff_only: false,
        created_at: row.sent_at || row.created_at,
        updated_at: row.sent_at || row.created_at,
      };
      merged.push({ api: toEvoFileApi(synthetic), ts });
    });
  }

  merged.sort((a, b) => b.ts - a.ts);
  return merged.map((m) => m.api);
}

const ROLES_WRITE = [
  'profesor',
  'directivo',
  'school_admin',
  'super_admin',
  'admin-general-colegio',
  'asistente',
  'asistente-academica',
];

function toEvoFileApi(row: Record<string, unknown>) {
  return {
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    origen: row.origen,
    mimeType: row.mime_type,
    groupId: row.group_id,
    cursoNombre: row.curso_nombre,
    propietarioId: row.propietario_id,
    propietarioNombre: row.propietario_nombre,
    propietarioRol: row.propietario_rol,
    esPublico: row.es_publico,
    googleFileId: row.google_file_id,
    googleWebViewLink: row.google_web_view_link,
    googleMimeType: row.google_mime_type,
    evoStorageKey: row.evo_storage_key,
    evoStorageUrl: row.evo_storage_url,
    sizeBytes: row.size_bytes,
    etiquetas: row.etiquetas ?? [],
    destacado: row.destacado,
    categoryId: row.category_id,
    staffOnly: row.staff_only === true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function canUsePersonalMyFolder(rol: string | undefined): boolean {
  return (
    rol === 'estudiante' ||
    rol === 'profesor' ||
    rol === 'padre' ||
    rol === 'directivo' ||
    rol === 'admin-general-colegio' ||
    rol === 'asistente-academica' ||
    rol === 'school_admin' ||
    rol === 'asistente'
  );
}

// GET /api/evo-drive/google/auth-url (protect: usuario debe estar logueado)
// Scopes include drive.file so users can create Google Docs, Slides, and Sheets via the Drive API.
// access_type=offline and prompt=consent force re-consent so existing users grant the new Drive scope.
router.get('/google/auth-url', protect, (req: AuthRequest, res) => {
  if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET || !ENV.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({ message: 'Google Drive no configurado. Revisa .env', url: '' });
  }
  const oauth2 = getGoogleOAuth2Client();
  const url = oauth2.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: req.user!.id,
  });
  return res.json({ url });
});

// GET /api/evo-drive/google/callback — SIN protect (Google redirige sin JWT)
router.get('/google/callback', async (req, res) => {
  const { code, state: userId } = req.query as { code?: string; state?: string };
  const { FRONTEND_URL } = ENV;
  if (!code || !userId) {
    return res.redirect(`${FRONTEND_URL}/evo-drive?error=missing_params`);
  }
  try {
    const oauth2 = getGoogleOAuth2Client();
    const { tokens } = await oauth2.getToken(code);
    oauth2.setCredentials(tokens);
    const oauth2api = google.oauth2({ version: 'v2', auth: oauth2 });
    const { data } = await oauth2api.userinfo.get();

    const userRes = await queryPg<{ institution_id: string }>(
      'SELECT institution_id FROM users WHERE id = $1',
      [userId]
    );
    const institutionId = userRes.rows[0]?.institution_id ?? '';

    await upsertGoogleToken({
      user_id: userId,
      institution_id: institutionId,
      access_token: tokens.access_token!,
      refresh_token: tokens.refresh_token ?? undefined,
      expiry_date: tokens.expiry_date ?? undefined,
      email: data.email ?? undefined,
    });

    return res.redirect(`${FRONTEND_URL}/evo-drive?googleConnected=true`);
  } catch (err) {
    console.error('[EvoDrive] callback error:', err);
    return res.redirect(`${FRONTEND_URL}/evo-drive?error=auth_failed`);
  }
});

// GET /api/evo-drive/google/status
router.get('/google/status', protect, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'No autorizado.' });
  const token = await getGoogleToken(userId);
  return res.json({ connected: !!token, email: token?.email ?? null });
});

// DELETE /api/evo-drive/google/disconnect
router.delete('/google/disconnect', protect, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'No autorizado.' });
  await deleteGoogleToken(userId);
  return res.json({ ok: true });
});

// GET /api/evo-drive/google/files — listar archivos de Drive (para Picker / vincular)
router.get('/google/files', protect, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'No autorizado.' });
  const auth = await getAuthedOAuth2ForUser(userId);
  if (!auth) return res.status(403).json({ error: 'Google Drive no conectado', code: 'GOOGLE_DRIVE_DISCONNECTED' });
  const drive = google.drive({ version: 'v3', auth });
  const { q = '', pageToken } = req.query as { q?: string; pageToken?: string };
  const params: Parameters<typeof drive.files.list>[0] = {
    pageSize: 30,
    fields: 'nextPageToken, files(id, name, mimeType, webViewLink, iconLink, modifiedTime, size)',
    orderBy: 'modifiedTime desc',
    q: q ? `name contains '${String(q).replace(/'/g, "''")}' and trashed = false` : 'trashed = false',
  };
  if (pageToken) params.pageToken = pageToken;
  const response = await drive.files.list(params);
  return res.json({
    files: response.data.files ?? [],
    nextPageToken: response.data.nextPageToken ?? null,
  });
});

const GOOGLE_CREATE_MIME: Record<string, string> = {
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
  slide: 'application/vnd.google-apps.presentation',
};

// POST /api/evo-drive/google/create — crear un Doc/Sheet/Slide nuevo en Drive y registrarlo en Evo
router.post('/google/create', protect, restrictTo(...ROLES_WRITE), async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  const colegioId = req.user?.colegioId;
  if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
  const auth = await getAuthedOAuth2ForUser(userId);
  if (!auth) return res.status(403).json({ message: 'Google Drive no conectado.', code: 'GOOGLE_DRIVE_DISCONNECTED' });
  const { nombre, tipo, cursoId, cursoNombre, groupSubjectId, staffOnly } = req.body as {
    nombre?: string;
    tipo?: string;
    cursoId?: string;
    cursoNombre?: string;
    groupSubjectId?: string;
    staffOnly?: boolean;
  };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  if (!cursoId) return res.status(400).json({ message: 'cursoId es obligatorio.' });
  const isStaffCoursePrivate = staffOnly === true;
  if (isStaffCoursePrivate && req.user?.rol !== 'profesor') {
    return res.status(403).json({ message: 'Solo los docentes pueden usar la carpeta privada del curso.' });
  }
  if (!isStaffCoursePrivate) {
    if (!groupSubjectId || typeof groupSubjectId !== 'string' || !String(groupSubjectId).trim()) {
      return res.status(400).json({ message: 'groupSubjectId es requerido. Debes especificar la materia del archivo.' });
    }
  }
  const mimeType = tipo && GOOGLE_CREATE_MIME[tipo] ? GOOGLE_CREATE_MIME[tipo] : GOOGLE_CREATE_MIME.doc;
  const resolved = await resolveGroupId(String(cursoId).trim(), colegioId);
  if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
  let validGroupSubjectId: string | null = null;
  if (!isStaffCoursePrivate) {
    const trimmedGroupSubjectId = String(groupSubjectId).trim();
    const gs = await findGroupSubjectById(trimmedGroupSubjectId);
    if (!gs || gs.group_id !== resolved.id || gs.institution_id !== colegioId) {
      return res.status(400).json({ message: 'Materia (groupSubjectId) no válida para este curso.' });
    }
    if (req.user?.rol === 'profesor' && gs.teacher_id !== userId) {
      return res.status(403).json({ message: 'Solo puedes crear archivos en las materias que dictas.' });
    }
    validGroupSubjectId = gs.id;
  }
  if (req.user?.rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === resolved.id);
    if (!teachesCourse) return res.status(403).json({ message: 'Solo puedes crear archivos en las materias que dictas.' });
  }
  try {
    const drive = google.drive({ version: 'v3', auth });
    const createRes = await drive.files.create({
      requestBody: { name: String(nombre).trim(), mimeType },
      fields: 'id, webViewLink',
    });
    const googleFileId = createRes.data.id;
    let webViewLink = createRes.data.webViewLink ?? '';
    if (!webViewLink && googleFileId) {
      const getRes = await drive.files.get({ fileId: googleFileId, fields: 'webViewLink' });
      webViewLink = getRes.data.webViewLink ?? '';
    }
    const user = await findUserById(userId);
    const propietarioNombre = user?.full_name ?? 'Usuario';
    const row = await createEvoFile({
      institution_id: colegioId,
      nombre: String(nombre).trim(),
      tipo: tipo ?? 'doc',
      origen: 'google',
      mime_type: mimeType,
      group_id: resolved.id,
      curso_nombre: cursoNombre ?? resolved.name,
      propietario_id: userId,
      propietario_nombre: propietarioNombre,
      propietario_rol: req.user?.rol ?? 'profesor',
      es_publico: !isStaffCoursePrivate,
      group_subject_id: validGroupSubjectId,
      staff_only: isStaffCoursePrivate,
      google_file_id: googleFileId,
      google_web_view_link: webViewLink || undefined,
      google_mime_type: mimeType,
    });
    return res.status(201).json(toEvoFileApi(row as Record<string, unknown>));
  } catch (err) {
    console.error('[EvoDrive] google/create error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el documento en Google Drive';
    return res.status(500).json({ message: msg });
  }
});

// POST /api/evo-drive/google/create-personal — crear Doc/Sheet/Slide en Drive del usuario sin registrar en Evo (ej. para entregas del estudiante)
router.post('/google/create-personal', protect, async (req: AuthRequest, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'No autorizado.' });
  const auth = await getAuthedOAuth2ForUser(userId);
  if (!auth) return res.status(403).json({ message: 'Google Drive no conectado.', code: 'GOOGLE_DRIVE_DISCONNECTED' });
  const { nombre, tipo } = req.body as { nombre?: string; tipo?: string };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  const mimeType = tipo && GOOGLE_CREATE_MIME[tipo] ? GOOGLE_CREATE_MIME[tipo] : GOOGLE_CREATE_MIME.doc;
  try {
    const drive = google.drive({ version: 'v3', auth });
    const createRes = await drive.files.create({
      requestBody: { name: String(nombre).trim(), mimeType },
      fields: 'id, webViewLink',
    });
    let webViewLink = createRes.data.webViewLink ?? '';
    if (!webViewLink && createRes.data.id) {
      const getRes = await drive.files.get({ fileId: createRes.data.id, fields: 'webViewLink' });
      webViewLink = getRes.data.webViewLink ?? '';
    }
    return res.status(201).json({ googleWebViewLink: webViewLink || undefined, nombre: String(nombre).trim() });
  } catch (err) {
    console.error('[EvoDrive] google/create-personal error:', err);
    const msg = err instanceof Error ? err.message : 'Error al crear el documento en Google Drive';
    return res.status(500).json({ message: msg });
  }
});

// GET /api/evo-drive/groups — profesor: carpetas por group_subject (materia — curso); admin/directivo: grupos con group_subjects anidados; estudiante: solo sus cursos (usa student-subject-folders en front)
router.get('/groups', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol === 'padre') {
    return res.json([]);
  }
  if (rol === 'estudiante') {
    const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId);
    return res.json(courseGroups.map((g) => ({ id: g.id, name: g.name })));
  }
  if (rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const folderName = (gs: { display_name?: string | null; subject_name: string; group_name: string }) =>
      `${gs.display_name?.trim() || gs.subject_name} — ${gs.group_name}`;
    return res.json(
      gsList.map((gs) => ({
        id: gs.id,
        name: folderName(gs),
        groupId: gs.group_id,
        groupSubjectId: gs.id,
      }))
    );
  }
  // admin / directivo: grupos con group_subjects anidados (dos niveles: curso → materia)
  const groups = await findGroupsByInstitution(colegioId);
  const result: { id: string; name: string; groupSubjects?: { id: string; name: string; groupId: string; groupSubjectId: string }[] }[] = [];
  for (const g of groups) {
    const details = await findGroupSubjectsByGroupWithDetails(g.id, colegioId);
    const folderName = (gs: { display_name?: string | null; subject_name: string; group_name: string }) =>
      `${gs.display_name?.trim() || gs.subject_name} — ${gs.group_name}`;
    result.push({
      id: g.id,
      name: g.name,
      groupSubjects: details.map((gs) => ({
        id: gs.id,
        name: folderName(gs),
        groupId: g.id,
        groupSubjectId: gs.id,
      })),
    });
  }
  return res.json(result);
});

// GET /api/evo-drive/student-subject-folders — estudiante: carpetas por materia (una por group_subject de sus cursos). Siempre incluye todas las materias, vacías o no.
router.get('/student-subject-folders', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol !== 'estudiante') return res.status(403).json({ message: 'Solo para estudiantes.' });
  const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId);
  const folders: { id: string; name: string; groupId: string; groupName: string }[] = [];
  for (const g of courseGroups) {
    const details = await findGroupSubjectsByGroupWithDetails(g.id, colegioId);
    for (const gs of details) {
      folders.push({
        id: gs.id,
        name: gs.subject_name,
        groupId: gs.group_id,
        groupName: gs.group_name,
      });
    }
  }
  return res.json(folders);
});

// GET /api/evo-drive/files?cursoId= & optional groupSubjectId= — archivos del curso (o de una materia). Estudiante: solo si está inscrito.
router.get('/files', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  const cursoIdParam = req.query.cursoId as string | undefined;
  const groupSubjectIdParam = req.query.groupSubjectId as string | undefined;
  const teacherPrivate =
    req.query.teacherPrivate === '1' || String(req.query.teacherPrivate || '').toLowerCase() === 'true';
  if (!cursoIdParam) return res.status(400).json({ message: 'cursoId es requerido.' });
  const resolved = await resolveGroupId(cursoIdParam.trim(), colegioId);
  if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
  const groupId = resolved.id;
  if (rol === 'padre') {
    return res.status(403).json({
      message: 'Evo Drive del curso no está disponible para acudientes por privacidad del estudiante.',
    });
  }
  if (teacherPrivate) {
    if (rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo el docente puede ver esta carpeta.' });
    }
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === groupId);
    if (!teachesCourse) {
      return res.status(403).json({ message: 'Solo puedes ver archivos de los cursos que impartes.' });
    }
    const rows = await getEvoFiles(colegioId, groupId, userId, rol ?? '', null, 'teacher_course_private');
    return res.json(rows.map(toEvoFileApi));
  }
  if (rol === 'estudiante') {
    const myGroups = await getAllCourseGroupsForStudent(userId, colegioId);
    const canAccess = myGroups.some((g) => g.id === groupId);
    if (!canAccess) return res.status(403).json({ message: 'No tienes acceso a este curso.' });
  }
  if (rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === groupId);
    if (!teachesCourse) {
      return res.status(403).json({ message: 'Solo puedes ver archivos de las materias que dictas.' });
    }
  }
  const rows = await getEvoFiles(colegioId, groupId, userId, rol ?? '', groupSubjectIdParam || undefined);
  return res.json(rows.map(toEvoFileApi));
});

// GET /api/evo-drive/padre/circulares-files — circulares (adjuntos Evo Drive) desde Evo Send institucional.
router.get('/padre/circulares-files', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol !== 'padre') return res.status(403).json({ message: 'Solo para acudientes.' });
  try {
    const files = await listPadreInstitutionalCirculareFiles(userId, colegioId);
    return res.json(files);
  } catch (err) {
    console.error('[evoDrive] padre/circulares-files:', err);
    return res.status(500).json({ message: 'Error al listar circulares.' });
  }
});

// GET /api/evo-drive/my-folder — archivos personales (estudiante o profesor).
router.get('/my-folder', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (!canUsePersonalMyFolder(rol)) return res.status(403).json({ message: 'No disponible para tu rol.' });
  try {
    const rows = await getPersonalFiles(userId, colegioId);
    return res.json(
      rows.map((r) => ({
        id: r.id,
        nombre: r.nombre,
        tipo: r.tipo,
        url: r.url || r.google_web_view_link || '',
        googleWebViewLink: r.google_web_view_link,
        origen: r.google_file_id ? 'google' : 'material',
      }))
    );
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('evo_personal_files') && (msg.includes('does not exist') || msg.includes('no existe'))) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Contacta al administrador del sistema.' });
    }
    if (msg.includes('institution_id') && msg.includes('does not exist')) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Contacta al administrador del sistema.' });
    }
    throw err;
  }
});

// POST /api/evo-drive/my-folder — añadir ítem a Mi carpeta (enlace o ref Google).
router.post('/my-folder', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (!canUsePersonalMyFolder(rol)) return res.status(403).json({ message: 'No disponible para tu rol.' });
  const { nombre, tipo, url, googleFileId, googleWebViewLink, googleMimeType } = req.body as {
    nombre?: string;
    tipo?: string;
    url?: string;
    googleFileId?: string;
    googleWebViewLink?: string;
    googleMimeType?: string;
  };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  try {
    const row = await createPersonalFile({
      user_id: userId,
      institution_id: colegioId,
      nombre: String(nombre).trim(),
      tipo: tipo || 'link',
      url: url || null,
      google_file_id: googleFileId || null,
      google_web_view_link: googleWebViewLink || url || null,
      google_mime_type: googleMimeType || null,
    });
    return res.status(201).json({
      id: row.id,
      nombre: row.nombre,
      tipo: row.tipo,
      url: row.url || row.google_web_view_link || '',
      googleWebViewLink: row.google_web_view_link,
      origen: row.google_file_id ? 'google' : 'material',
    });
  } catch (err) {
    const msg = (err as Error).message || '';
    if (msg.includes('evo_personal_files') && (msg.includes('does not exist') || msg.includes('no existe'))) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Contacta al administrador del sistema.' });
    }
    if (msg.includes('institution_id') && msg.includes('does not exist')) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Contacta al administrador del sistema.' });
    }
    throw err;
  }
});

// DELETE /api/evo-drive/my-folder/:id — eliminar ítem de Mi carpeta.
router.delete('/my-folder/:id', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (!canUsePersonalMyFolder(rol)) return res.status(403).json({ message: 'No disponible para tu rol.' });
  const deleted = await deletePersonalFile(req.params.id, userId, colegioId);
  if (!deleted) return res.status(404).json({ message: 'No encontrado.' });
  return res.json({ message: 'Eliminado.' });
});

// PATCH /api/evo-drive/my-folder/:id — renombrar ítem (solo el propietario).
router.patch('/my-folder/:id', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (!canUsePersonalMyFolder(rol)) return res.status(403).json({ message: 'No disponible para tu rol.' });
  const { nombre } = req.body as { nombre?: string };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  const row = await updatePersonalFileNombre(req.params.id, userId, colegioId, String(nombre).trim());
  if (!row) return res.status(404).json({ message: 'No encontrado.' });
  return res.json({
    id: row.id,
    nombre: row.nombre,
    tipo: row.tipo,
    url: row.url || row.google_web_view_link || '',
    googleWebViewLink: row.google_web_view_link,
    origen: row.google_file_id ? 'google' : 'material',
  });
});

// GET /api/evo-drive/recientes — hasta 10 ítems más recientes (curso + Mi carpeta si aplica), por fecha de creación.
router.get('/recientes', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol ?? '';
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol === 'padre') {
    type Sortable = { api: ReturnType<typeof toEvoFileApi>; ts: number };
    const merged: Sortable[] = [];
    try {
      const personal = await getPersonalFiles(userId, colegioId);
      for (const p of personal.slice(0, 15)) {
        const row: Record<string, unknown> = {
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          origen: p.google_file_id ? 'google' : 'material',
          mime_type: p.google_mime_type,
          group_id: null,
          curso_nombre: 'Mi carpeta',
          propietario_id: userId,
          propietario_nombre: null,
          propietario_rol: rol,
          es_publico: false,
          google_file_id: p.google_file_id,
          google_web_view_link: p.google_web_view_link,
          google_mime_type: p.google_mime_type,
          evo_storage_key: null,
          evo_storage_url: p.url,
          size_bytes: null,
          etiquetas: [],
          destacado: false,
          category_id: null,
          staff_only: false,
          created_at: p.created_at,
          updated_at: p.created_at,
        };
        merged.push({
          api: toEvoFileApi(row),
          ts: new Date(p.created_at).getTime(),
        });
      }
    } catch {
      /* Mi carpeta no disponible */
    }
    try {
      const circ = await listPadreInstitutionalCirculareFiles(userId, colegioId);
      for (const api of circ.slice(0, 20)) {
        const ca = api.createdAt ? new Date(String(api.createdAt)).getTime() : 0;
        const ua = api.updatedAt ? new Date(String(api.updatedAt)).getTime() : ca;
        merged.push({ api, ts: Math.max(ca, ua) });
      }
    } catch {
      /* circulares best-effort */
    }
    merged.sort((a, b) => b.ts - a.ts);
    return res.json(merged.slice(0, 10).map((m) => m.api));
  }

  const courseRows = await getRecentCourseFilesForUser(colegioId, userId, rol, 15);
  type Sortable = { api: ReturnType<typeof toEvoFileApi>; ts: number };
  const merged: Sortable[] = courseRows.map((row) => ({
    api: toEvoFileApi(row),
    ts: Math.max(
      new Date(String(row.created_at ?? 0)).getTime(),
      new Date(String(row.updated_at ?? 0)).getTime()
    ),
  }));

  if (canUsePersonalMyFolder(rol)) {
    try {
      const personal = await getPersonalFiles(userId, colegioId);
      for (const p of personal.slice(0, 15)) {
        const row: Record<string, unknown> = {
          id: p.id,
          nombre: p.nombre,
          tipo: p.tipo,
          origen: p.google_file_id ? 'google' : 'material',
          mime_type: p.google_mime_type,
          group_id: null,
          curso_nombre: 'Mi carpeta',
          propietario_id: userId,
          propietario_nombre: null,
          propietario_rol: rol,
          es_publico: false,
          google_file_id: p.google_file_id,
          google_web_view_link: p.google_web_view_link,
          google_mime_type: p.google_mime_type,
          evo_storage_key: null,
          evo_storage_url: p.url,
          size_bytes: null,
          etiquetas: [],
          destacado: false,
          category_id: null,
          staff_only: false,
          created_at: p.created_at,
          updated_at: p.created_at,
        };
        merged.push({
          api: toEvoFileApi(row),
          ts: new Date(p.created_at).getTime(),
        });
      }
    } catch {
      /* Mi carpeta no disponible: solo curso */
    }
  }

  merged.sort((a, b) => b.ts - a.ts);
  return res.json(merged.slice(0, 10).map((m) => m.api));
});

// POST /api/evo-drive/files — crear archivo (material subido o desde Picker). groupSubjectId = materia para que el estudiante vea el archivo solo en esa carpeta.
router.post('/files', protect, restrictTo(...ROLES_WRITE), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    const userId = req.user?.id;
    if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
    const user = await findUserById(userId);
    const propietarioNombre = user?.full_name ?? 'Usuario';
    const {
      nombre,
      tipo,
      origen,
      mimeType,
      cursoId,
      cursoNombre,
      esPublico,
      googleFileId,
      googleWebViewLink,
      googleMimeType,
      sizeBytes,
      groupSubjectId,
      staffOnly,
    } = req.body as {
      nombre?: string;
      tipo?: string;
      origen?: string;
      mimeType?: string;
      cursoId?: string;
      cursoNombre?: string;
      esPublico?: boolean;
      googleFileId?: string;
      googleWebViewLink?: string;
      googleMimeType?: string;
      sizeBytes?: number;
      groupSubjectId?: string;
      staffOnly?: boolean;
    };
    if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
    if (!cursoId) return res.status(400).json({ message: 'cursoId es obligatorio.' });
    const isStaffCoursePrivate = staffOnly === true;
    if (isStaffCoursePrivate && req.user?.rol !== 'profesor') {
      return res.status(403).json({ message: 'Solo los docentes pueden usar la carpeta privada del curso.' });
    }
    if (!isStaffCoursePrivate) {
      if (!groupSubjectId || typeof groupSubjectId !== 'string' || !String(groupSubjectId).trim()) {
        return res.status(400).json({ message: 'groupSubjectId es requerido. Debes especificar la materia del archivo.' });
      }
    }
    const resolved = await resolveGroupId(String(cursoId).trim(), colegioId);
    if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
    const groupId = resolved.id;
    let validGroupSubjectId: string | null = null;
    if (!isStaffCoursePrivate) {
      const trimmedGroupSubjectId = String(groupSubjectId).trim();
      const gs = await findGroupSubjectById(trimmedGroupSubjectId);
      if (!gs || gs.group_id !== groupId || gs.institution_id !== colegioId) {
        return res.status(400).json({ message: 'Materia (groupSubjectId) no válida para este curso.' });
      }
      if (req.user?.rol === 'profesor' && gs.teacher_id !== userId) {
        return res.status(403).json({ message: 'Solo puedes subir archivos a las materias que dictas.' });
      }
      validGroupSubjectId = gs.id;
    }
    if (req.user?.rol === 'profesor') {
      const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
      const teachesCourse = gsList.some((gs) => gs.group_id === groupId);
      if (!teachesCourse) {
        return res.status(403).json({ message: 'Solo puedes subir archivos a los cursos que impartes.' });
      }
    }
    const row = await createEvoFile({
      institution_id: colegioId,
      nombre: String(nombre).trim(),
      tipo: tipo ?? 'file',
      origen: origen ?? 'material',
      mime_type: mimeType,
      group_id: groupId,
      curso_nombre: cursoNombre ?? resolved.name,
      propietario_id: userId,
      propietario_nombre: propietarioNombre,
      propietario_rol: req.user?.rol ?? 'profesor',
      es_publico: isStaffCoursePrivate ? false : esPublico !== false,
      group_subject_id: validGroupSubjectId,
      staff_only: isStaffCoursePrivate,
      google_file_id: googleFileId,
      google_web_view_link: googleWebViewLink,
      google_mime_type: googleMimeType,
      size_bytes: sizeBytes,
    });
    return res.status(201).json(toEvoFileApi(row as Record<string, unknown>));
  } catch (e: unknown) {
    console.error('[evoDrive] POST /files:', e);
    return res.status(500).json({ message: 'Error al crear archivo en Evo Drive.' });
  }
});

// DELETE /api/evo-drive/files/:id
router.delete('/files/:id', protect, restrictTo(...ROLES_WRITE), async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  const file = await getEvoFileById(req.params.id, colegioId);
  if (!file) return res.status(404).json({ message: 'Archivo no encontrado.' });
  if (rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === file.group_id);
    if (!teachesCourse) return res.status(403).json({ message: 'Solo puedes eliminar archivos de las materias que dictas.' });
  }
  await deleteEvoFile(req.params.id, colegioId);
  return res.json({ message: 'Archivo eliminado.' });
});

// PATCH /api/evo-drive/files/:id/destacar
router.patch('/files/:id/destacar', protect, restrictTo(...ROLES_WRITE), async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  const file = await getEvoFileById(req.params.id, colegioId);
  if (!file) return res.status(404).json({ message: 'Archivo no encontrado.' });
  if (rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === file.group_id);
    if (!teachesCourse) return res.status(403).json({ message: 'Solo puedes destacar archivos de las materias que dictas.' });
  }
  const row = await toggleDestacado(req.params.id, colegioId);
  if (!row) return res.status(404).json({ message: 'Archivo no encontrado.' });
  return res.json(toEvoFileApi(row as Record<string, unknown>));
});

export default router;
