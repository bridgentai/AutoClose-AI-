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
} from '../repositories/evoPersonalFileRepository.js';
import {
  getGoogleToken,
  upsertGoogleToken,
  updateGoogleAccessToken,
  deleteGoogleToken,
} from '../repositories/googleTokenRepository.js';
import {
  getEvoFiles,
  getRecentFiles,
  createEvoFile,
  deleteEvoFile,
  toggleDestacado,
  getEvoFileById,
} from '../repositories/evoFileRepository.js';

const router = express.Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    ENV.GOOGLE_CLIENT_ID,
    ENV.GOOGLE_CLIENT_SECRET,
    ENV.GOOGLE_REDIRECT_URI
  );
}

async function getAuthedClient(userId: string) {
  const token = await getGoogleToken(userId);
  if (!token) return null;
  const oauth2 = getOAuthClient();
  oauth2.setCredentials({
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? undefined,
    expiry_date: token.expiry_date ?? undefined,
  });
  if (token.expiry_date && Date.now() > token.expiry_date - 60000) {
    try {
      const { credentials } = await oauth2.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await updateGoogleAccessToken(userId, credentials.access_token, credentials.expiry_date);
        oauth2.setCredentials(credentials);
      }
    } catch (e) {
      console.error('[EvoDrive] refresh token error:', e);
      return null;
    }
  }
  return oauth2;
}
const ROLES_WRITE = ['profesor', 'directivo', 'school_admin', 'super_admin', 'admin-general-colegio'];

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// GET /api/evo-drive/google/auth-url (protect: usuario debe estar logueado)
// Scopes include drive.file so users can create Google Docs, Slides, and Sheets via the Drive API.
// access_type=offline and prompt=consent force re-consent so existing users grant the new Drive scope.
router.get('/google/auth-url', protect, (req: AuthRequest, res) => {
  if (!ENV.GOOGLE_CLIENT_ID || !ENV.GOOGLE_CLIENT_SECRET || !ENV.GOOGLE_REDIRECT_URI) {
    return res.status(503).json({ message: 'Google Drive no configurado. Revisa .env', url: '' });
  }
  const oauth2 = getOAuthClient();
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
    const oauth2 = getOAuthClient();
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
  const auth = await getAuthedClient(userId);
  if (!auth) return res.status(401).json({ error: 'Google Drive no conectado' });
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
  const auth = await getAuthedClient(userId);
  if (!auth) return res.status(401).json({ message: 'Google Drive no conectado.' });
  const { nombre, tipo, cursoId, cursoNombre, groupSubjectId } = req.body as { nombre?: string; tipo?: string; cursoId?: string; cursoNombre?: string; groupSubjectId?: string };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  if (!cursoId) return res.status(400).json({ message: 'cursoId es obligatorio.' });
  const mimeType = tipo && GOOGLE_CREATE_MIME[tipo] ? GOOGLE_CREATE_MIME[tipo] : GOOGLE_CREATE_MIME.doc;
  const resolved = await resolveGroupId(String(cursoId).trim(), colegioId);
  if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
  let validGroupSubjectId: string | null = null;
  if (groupSubjectId && String(groupSubjectId).trim()) {
    const gs = await findGroupSubjectById(String(groupSubjectId).trim());
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
      es_publico: true,
      group_subject_id: validGroupSubjectId,
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
  const auth = await getAuthedClient(userId);
  if (!auth) return res.status(401).json({ message: 'Google Drive no conectado.' });
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

// GET /api/evo-drive/groups — estudiante: solo sus cursos; profesor: solo las materias que dicta; otros: todos los grupos del colegio
router.get('/groups', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol === 'estudiante') {
    const courseGroups = await getAllCourseGroupsForStudent(userId, colegioId);
    return res.json(courseGroups.map((g) => ({ id: g.id, name: g.name })));
  }
  if (rol === 'profesor') {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const gs of gsList) {
      if (!seen.has(gs.group_id)) {
        seen.add(gs.group_id);
        list.push({ id: gs.group_id, name: gs.group_name });
      }
    }
    return res.json(list);
  }
  const groups = await findGroupsByInstitution(colegioId);
  return res.json(groups.map((g) => ({ id: g.id, name: g.name })));
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
  if (!cursoIdParam) return res.status(400).json({ message: 'cursoId es requerido.' });
  const resolved = await resolveGroupId(cursoIdParam.trim(), colegioId);
  if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
  const groupId = resolved.id;
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

// GET /api/evo-drive/my-folder — archivos de "Mi carpeta" del estudiante (solo estudiante).
router.get('/my-folder', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol !== 'estudiante') return res.status(403).json({ message: 'Solo para estudiantes.' });
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
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Ejecuta la migración: server/db/evo-drive-subject-and-personal.sql' });
    }
    if (msg.includes('institution_id') && msg.includes('does not exist')) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Ejecuta: ALTER TABLE evo_personal_files ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;' });
    }
    throw err;
  }
});

// POST /api/evo-drive/my-folder — añadir ítem a Mi carpeta (enlace o ref Google). Solo estudiante.
router.post('/my-folder', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol !== 'estudiante') return res.status(403).json({ message: 'Solo para estudiantes.' });
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
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Ejecuta la migración: server/db/evo-drive-subject-and-personal.sql' });
    }
    if (msg.includes('institution_id') && msg.includes('does not exist')) {
      return res.status(503).json({ message: 'Mi carpeta no está disponible. Ejecuta: ALTER TABLE evo_personal_files ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE;' });
    }
    throw err;
  }
});

// DELETE /api/evo-drive/my-folder/:id — eliminar ítem de Mi carpeta. Solo estudiante.
router.delete('/my-folder/:id', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  const userId = req.user?.id;
  const rol = req.user?.rol;
  if (!colegioId || !userId) return res.status(401).json({ message: 'No autorizado.' });
  if (rol !== 'estudiante') return res.status(403).json({ message: 'Solo para estudiantes.' });
  const deleted = await deletePersonalFile(req.params.id, userId, colegioId);
  if (!deleted) return res.status(404).json({ message: 'No encontrado.' });
  return res.json({ message: 'Eliminado.' });
});

// GET /api/evo-drive/recientes
router.get('/recientes', protect, async (req: AuthRequest, res) => {
  const colegioId = req.user?.colegioId;
  if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });
  const rows = await getRecentFiles(colegioId);
  return res.json(rows.map(toEvoFileApi));
});

// POST /api/evo-drive/files — crear archivo (material subido o desde Picker). groupSubjectId = materia para que el estudiante vea el archivo solo en esa carpeta.
router.post('/files', protect, restrictTo(...ROLES_WRITE), async (req: AuthRequest, res) => {
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
  };
  if (!nombre?.trim()) return res.status(400).json({ message: 'nombre es obligatorio.' });
  if (!cursoId) return res.status(400).json({ message: 'cursoId es obligatorio.' });
  const resolved = await resolveGroupId(String(cursoId).trim(), colegioId);
  if (!resolved) return res.status(404).json({ message: 'Curso no encontrado.' });
  const groupId = resolved.id;
  let validGroupSubjectId: string | null = null;
  if (groupSubjectId && String(groupSubjectId).trim()) {
    const gs = await findGroupSubjectById(String(groupSubjectId).trim());
    if (!gs || gs.group_id !== groupId || gs.institution_id !== colegioId) {
      return res.status(400).json({ message: 'Materia (groupSubjectId) no válida para este curso.' });
    }
    if (req.user?.rol === 'profesor' && gs.teacher_id !== userId) {
      return res.status(403).json({ message: 'Solo puedes subir archivos a las materias que dictas.' });
    }
    validGroupSubjectId = gs.id;
  }
  if (req.user?.rol === 'profesor' && !validGroupSubjectId) {
    const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
    const teachesCourse = gsList.some((gs) => gs.group_id === groupId);
    if (!teachesCourse) {
      return res.status(403).json({ message: 'Solo puedes subir archivos a las materias que dictas.' });
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
    es_publico: esPublico !== false,
    group_subject_id: validGroupSubjectId,
    google_file_id: googleFileId,
    google_web_view_link: googleWebViewLink,
    google_mime_type: googleMimeType,
    size_bytes: sizeBytes,
  });
  return res.status(201).json(toEvoFileApi(row as Record<string, unknown>));
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
