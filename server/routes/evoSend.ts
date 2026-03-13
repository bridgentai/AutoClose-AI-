import express from 'express';
import { protect, AuthRequest } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleAuth.js';
import {
  findAnnouncementsByInstitution,
  findAnnouncementById,
  findAnnouncementMessages,
  createAnnouncement,
  createAnnouncementMessage,
  getLastAnnouncementMessage,
  findOrCreateEvoChatForGroupSubject,
} from '../repositories/announcementRepository.js';
import { findUserById } from '../repositories/userRepository.js';
import { findGroupById } from '../repositories/groupRepository.js';
import { findAssignmentById } from '../repositories/assignmentRepository.js';
import {
  findGroupSubjectsByTeacher,
  findGroupSubjectsByTeacherWithDetails,
  findGroupSubjectsByGroupWithDetails,
} from '../repositories/groupSubjectRepository.js';
import { findGroupsByInstitution } from '../repositories/groupRepository.js';
import { findEnrollmentsByStudent } from '../repositories/enrollmentRepository.js';
import { emitEvoMessage } from '../socket.js';

const router = express.Router();
const EVO_SEND_ROLES = ['directivo', 'profesor', 'estudiante', 'asistente', 'admin-general-colegio'];

async function buildThreadFromAnnouncement(a: {
  id: string;
  title: string;
  type: string;
  group_id: string | null;
  assignment_id: string | null;
  created_by_id: string;
  updated_at: string;
}) {
  const creator = await findUserById(a.created_by_id);
  const lastMsg = await getLastAnnouncementMessage(a.id);
  let cursoId: { _id: string; nombre: string } | undefined;
  if (a.group_id) {
    const g = await findGroupById(a.group_id);
    if (g) cursoId = { _id: g.id, nombre: g.name };
  }
  let assignmentId: { _id: string; titulo: string; fechaEntrega: string } | undefined;
  if (a.assignment_id) {
    const asn = await findAssignmentById(a.assignment_id);
    if (asn) assignmentId = { _id: asn.id, titulo: asn.title, fechaEntrega: asn.due_date };
  }
  return {
    _id: a.id,
    asunto: a.title,
    displayTitle: a.title,
    tipo: a.type,
    creadoPor: creator ? { _id: creator.id, nombre: creator.full_name, rol: creator.role } : undefined,
    cursoId,
    assignmentId,
    ultimoMensaje: lastMsg
      ? { contenido: lastMsg.content, fecha: lastMsg.created_at, prioridad: lastMsg.priority, remitente: (creator?.full_name) ?? '' }
      : null,
    unreadCount: 0,
    updatedAt: a.updated_at,
  };
}

router.get('/threads', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const tipo = req.query.tipo as string | undefined;

    // Evo Send tipo WhatsApp: profesor ve grupos = cursos; estudiante ve grupos = materia + profesor
    if (rol === 'profesor' && userId) {
      const gsList = await findGroupSubjectsByTeacherWithDetails(userId, colegioId);
      const threads = await Promise.all(
        gsList.map(async (gs) => {
          const a = await findOrCreateEvoChatForGroupSubject(
            gs.id,
            colegioId,
            gs.group_name,
            gs.teacher_id,
            gs.group_id
          );
          const t = await buildThreadFromAnnouncement(a);
          return { ...t, displayTitle: gs.group_name };
        })
      );
      return res.json(threads);
    }

    if (rol === 'estudiante' && userId) {
      const enrollments = await findEnrollmentsByStudent(userId);
      const allGsWithDetails: Array<{
        id: string;
        group_id: string;
        group_name: string;
        subject_name: string;
        teacher_name: string;
        teacher_id: string;
        institution_id: string;
      }> = [];
      for (const e of enrollments) {
        const list = await findGroupSubjectsByGroupWithDetails(e.group_id, colegioId);
        allGsWithDetails.push(...list);
      }
      const threads = await Promise.all(
        allGsWithDetails.map(async (gs) => {
          const displayTitle = `${gs.subject_name} - ${gs.teacher_name}`;
          const a = await findOrCreateEvoChatForGroupSubject(
            gs.id,
            colegioId,
            displayTitle,
            gs.teacher_id,
            gs.group_id
          );
          const t = await buildThreadFromAnnouncement(a);
          return { ...t, displayTitle };
        })
      );
      return res.json(threads);
    }

    // directivo, asistente, admin-general-colegio: listar todos los hilos (incl. evo_chat y otros)
    const announcements = await findAnnouncementsByInstitution(colegioId, tipo ? { type: tipo } : undefined);
    const threads = await Promise.all(announcements.map((a) => buildThreadFromAnnouncement(a)));
    return res.json(threads);
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar hilos.' });
  }
});

router.get('/threads/:id', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const colegioId = req.user?.colegioId;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) {
      return res.json({ thread: null, messages: [] });
    }

    const creator = await findUserById(a.created_by_id);
    let cursoId: { _id: string; nombre: string } | undefined;
    if (a.group_id) {
      const g = await findGroupById(a.group_id);
      if (g) cursoId = { _id: g.id, nombre: g.name };
    }
    let assignmentId: { _id: string; titulo: string; descripcion?: string; fechaEntrega: string } | undefined;
    if (a.assignment_id) {
      const asn = await findAssignmentById(a.assignment_id);
      if (asn) assignmentId = { _id: asn.id, titulo: asn.title, descripcion: asn.description ?? undefined, fechaEntrega: asn.due_date };
    }

    const thread = {
      _id: a.id,
      asunto: a.title,
      tipo: a.type,
      creadoPor: creator ? { _id: creator.id, nombre: creator.full_name, rol: creator.role } : undefined,
      cursoId,
      assignmentId,
      updatedAt: a.updated_at,
    };

    const msgRows = await findAnnouncementMessages(id);
    const messages = await Promise.all(
      msgRows.map(async (m) => {
        const sender = await findUserById(m.sender_id);
        return {
          _id: m.id,
          contenido: m.content,
          tipo: m.content_type,
          prioridad: m.priority,
          fecha: m.created_at,
          remitenteId: { _id: m.sender_id, nombre: sender?.full_name ?? '', rol: sender?.role },
          rolRemitente: m.sender_role,
        };
      })
    );

    return res.json({ thread, messages });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener hilo.' });
  }
});

router.post('/threads', protect, requireRole('directivo', 'profesor', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { asunto, contenido, tipo, cursoId, prioridad } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });
    if (!asunto?.trim() || !contenido?.trim()) {
      return res.status(400).json({ message: 'Faltan asunto o contenido.' });
    }

    const a = await createAnnouncement({
      institution_id: colegioId,
      title: asunto.trim(),
      body: contenido.trim(),
      type: tipo ?? 'general',
      group_id: cursoId ?? null,
      created_by_id: userId,
    });

    await createAnnouncementMessage({
      announcement_id: a.id,
      sender_id: userId,
      sender_role: req.user?.rol ?? 'profesor',
      content: contenido.trim(),
      priority: prioridad ?? 'normal',
    });

    return res.status(201).json({ _id: a.id, message: 'Hilo creado.' });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear hilo.' });
  }
});

router.post('/threads/:id/messages', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { contenido, prioridad } = req.body;
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const a = await findAnnouncementById(id);
    if (!a || a.institution_id !== colegioId) return res.status(404).json({ message: 'Hilo no encontrado.' });

    const msg = await createAnnouncementMessage({
      announcement_id: id,
      sender_id: userId,
      sender_role: req.user?.rol ?? 'estudiante',
      content: (contenido ?? '').trim() || '(mensaje vacío)',
      priority: prioridad ?? 'normal',
    });

    const sender = await findUserById(userId);
    emitEvoMessage(id, {
      threadId: id,
      _id: msg.id,
      contenido: msg.content,
      prioridad: msg.priority,
      fecha: msg.created_at,
      remitenteId: { _id: userId, nombre: sender?.full_name ?? '', rol: sender?.role },
      rolRemitente: msg.sender_role,
    });

    return res.status(201).json({ _id: msg.id });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

router.patch('/threads/:id/read', protect, requireRole(...EVO_SEND_ROLES), async (_req: AuthRequest, res) => {
  return res.json({ success: true });
});

router.get('/search', protect, requireRole(...EVO_SEND_ROLES), async (_req: AuthRequest, res) => {
  return res.json([]);
});

router.get('/attendance-inbox', protect, requireRole('asistente'), async (_req: AuthRequest, res) => {
  return res.json([]);
});

router.get('/courses', protect, requireRole('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const user = await findUserById(userId);
    if (!user) return res.json([]);

    const groups = await findGroupsByInstitution(colegioId);
    if (user.role === 'profesor') {
      const gsList = await findGroupSubjectsByTeacher(userId);
      const groupIds = new Set(gsList.map((gs) => gs.group_id));
      const courses = groups.filter((g) => groupIds.has(g.id)).map((g) => ({ _id: g.id, nombre: g.name }));
      return res.json(courses);
    }
    return res.json(groups.map((g) => ({ _id: g.id, nombre: g.name })));
  } catch (e: unknown) {
    console.error(e);
    return res.json([]);
  }
});

export default router;
