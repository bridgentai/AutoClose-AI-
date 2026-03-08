import express from 'express';
import { EvoThread, EvoMessage, User, Course, Assignment, Asistencia } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { requireRole } from '../middleware/roleAuth';
import { normalizeIdForQuery } from '../utils/idGenerator';
import { emitEvoMessage, emitEvoRead } from '../socket';

const router = express.Router();

/** Roles que pueden acceder al módulo Evo Send */
const EVO_SEND_ROLES = ['directivo', 'profesor', 'estudiante', 'asistente', 'admin-general-colegio'];

/** Verificar que el usuario puede acceder a un hilo (creador o destinatario) */
async function canAccessThread(threadId: string, userId: string): Promise<boolean> {
  const t = await EvoThread.findById(normalizeIdForQuery(threadId)).lean();
  if (!t) return false;
  const uid = normalizeIdForQuery(userId);
  const isCreator = t.creadoPor?.toString() === uid;
  const isRecipient = (t.recipientIds || []).some((id: any) => id?.toString() === uid);
  return isCreator || isRecipient;
}

/** GET /api/evo-send/threads - Listar hilos del usuario (por rol) */
router.get('/threads', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    const { tipo, cursoId, q, favorito } = req.query;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const uid = normalizeIdForQuery(userId);
    const query: any = {
      colegioId,
      $or: [
        { creadoPor: uid },
        { recipientIds: uid },
      ],
    };

    if (tipo && typeof tipo === 'string') query.tipo = tipo;
    if (cursoId && typeof cursoId === 'string') query.cursoId = normalizeIdForQuery(cursoId);

    let threads = await EvoThread.find(query)
      .populate('creadoPor', 'nombre correo rol')
      .populate('cursoId', 'nombre')
      .populate('assignmentId', 'titulo fechaEntrega')
      .sort({ updatedAt: -1 })
      .lean();

    // Búsqueda por palabra clave en asunto
    if (q && typeof q === 'string' && q.trim()) {
      const qLower = q.trim().toLowerCase();
      threads = threads.filter((t: any) => (t.asunto || '').toLowerCase().includes(qLower));
    }

    const withLastMessage = await Promise.all(
      threads.map(async (t: any) => {
        const last = await EvoMessage.findOne({ threadId: t._id })
          .sort({ fecha: -1 })
          .populate('remitenteId', 'nombre rol')
          .lean();
        const unreadCount = await EvoMessage.countDocuments({
          threadId: t._id,
          remitenteId: { $ne: uid },
          leidoPor: { $ne: uid },
        });
        return {
          ...t,
          ultimoMensaje: last
            ? {
                contenido: last.contenido,
                fecha: last.fecha,
                remitente: (last.remitenteId as any)?.nombre,
                rolRemitente: last.rolRemitente,
                prioridad: last.prioridad,
              }
            : null,
          unreadCount,
        };
      })
    );

    return res.json(withLastMessage);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar hilos.' });
  }
});

/** GET /api/evo-send/threads/:id - Obtener hilo y mensajes */
router.get('/threads/:id', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessThread(id, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado a este hilo.' });

    const thread = await EvoThread.findById(normalizeIdForQuery(id))
      .populate('creadoPor', 'nombre correo rol')
      .populate('cursoId', 'nombre')
      .populate('assignmentId', 'titulo descripcion fechaEntrega')
      .lean();

    if (!thread) return res.status(404).json({ message: 'Hilo no encontrado.' });

    const messages = await EvoMessage.find({ threadId: normalizeIdForQuery(id) })
      .populate('remitenteId', 'nombre correo rol')
      .sort({ fecha: 1 })
      .lean();

    return res.json({ thread, messages });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener hilo.' });
  }
});

/** POST /api/evo-send/threads - Crear hilo y primer mensaje (directivo: comunicado; profesor: curso) */
router.post('/threads', protect, requireRole('directivo', 'profesor', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const { asunto, contenido, tipo, cursoId, recipientIds, prioridad } = req.body;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!asunto || !contenido?.trim()) {
      return res.status(400).json({ message: 'Faltan asunto o contenido.' });
    }

    const threadType = tipo === 'comunicado_general' ? 'comunicado_general' : tipo === 'curso' ? 'curso' : 'general';
    if (rol === 'directivo' && threadType !== 'comunicado_general') {
      return res.status(400).json({ message: 'El directivo solo puede enviar comunicados generales.' });
    }
    if (rol === 'profesor' && threadType === 'comunicado_general') {
      return res.status(403).json({ message: 'Solo directivos pueden enviar comunicados generales.' });
    }

    let recipients: string[] = [];
    if (Array.isArray(recipientIds) && recipientIds.length) {
      recipients = recipientIds.map((r: any) => normalizeIdForQuery(String(r)));
    } else if (threadType === 'comunicado_general') {
      const users = await User.find({ colegioId, rol: { $in: ['estudiante', 'profesor'] } }).select('_id').lean();
      recipients = users.map((u: any) => u._id.toString());
    } else if (threadType === 'curso' && cursoId) {
      const course = await Course.findById(normalizeIdForQuery(cursoId)).select('estudianteIds estudiantes').lean();
      const ids = (course?.estudianteIds || course?.estudiantes || []) as any[];
      recipients = ids.map((id: any) => id?.toString()).filter(Boolean);
    }
    if (!recipients.length && threadType !== 'general') {
      return res.status(400).json({ message: 'No hay destinatarios para este hilo.' });
    }

    const thread = await EvoThread.create({
      colegioId,
      tipo: threadType,
      asunto: asunto.trim(),
      creadoPor: userId,
      cursoId: cursoId ? normalizeIdForQuery(cursoId) : undefined,
      recipientIds: recipients,
      updatedAt: new Date(),
    });

    const msg = await EvoMessage.create({
      threadId: thread._id,
      remitenteId: userId,
      rolRemitente: rol || 'profesor',
      contenido: contenido.trim(),
      tipo: 'texto',
      prioridad: prioridad === 'urgente' || prioridad === 'alta' ? prioridad : 'normal',
      leidoPor: [userId],
    });

    const populated = await EvoThread.findById(thread._id)
      .populate('creadoPor', 'nombre correo rol')
      .populate('cursoId', 'nombre')
      .lean();
    const msgPop = await EvoMessage.findById(msg._id).populate('remitenteId', 'nombre correo rol').lean();
    emitEvoMessage(thread._id.toString(), msgPop);

    return res.status(201).json({ thread: populated, message: msgPop });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear hilo.' });
  }
});

/** POST /api/evo-send/threads/:id/messages - Enviar mensaje en hilo existente */
router.post('/threads/:id/messages', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { contenido, prioridad } = req.body;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessThread(id, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado a este hilo.' });

    if (!contenido || !contenido.trim()) return res.status(400).json({ message: 'Contenido requerido.' });

    const threadId = normalizeIdForQuery(id);
    const msg = await EvoMessage.create({
      threadId,
      remitenteId: userId,
      rolRemitente: rol || 'estudiante',
      contenido: contenido.trim(),
      tipo: 'texto',
      prioridad: prioridad === 'urgente' || prioridad === 'alta' ? prioridad : 'normal',
      leidoPor: [userId],
    });

    await EvoThread.updateOne({ _id: threadId }, { $set: { updatedAt: new Date() } });

    const populated = await EvoMessage.findById(msg._id).populate('remitenteId', 'nombre correo rol').lean();
    emitEvoMessage(threadId, populated);
    return res.status(201).json(populated);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

/** PATCH /api/evo-send/threads/:id/read - Marcar mensajes del hilo como leídos */
router.patch('/threads/:id/read', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessThread(id, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado.' });

    const uid = normalizeIdForQuery(userId);
    await EvoMessage.updateMany(
      { threadId: normalizeIdForQuery(id) },
      { $addToSet: { leidoPor: uid } }
    );

    emitEvoRead(id, userId);
    return res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar leídos.' });
  }
});

/** GET /api/evo-send/search - Búsqueda por remitente, palabra clave, fecha, tipo */
router.get('/search', protect, requireRole(...EVO_SEND_ROLES), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const { q, remitenteId, tipo, desde, hasta } = req.query;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const uid = normalizeIdForQuery(userId);
    const threadIds = await EvoThread.find({
      colegioId,
      $or: [{ creadoPor: uid }, { recipientIds: uid }],
    })
      .select('_id')
      .lean();
    const ids = threadIds.map((t: any) => t._id);

    const msgQuery: any = { threadId: { $in: ids } };
    if (remitenteId && typeof remitenteId === 'string') msgQuery.remitenteId = normalizeIdForQuery(remitenteId);
    if (tipo && typeof tipo === 'string') msgQuery.tipo = tipo;
    if (desde && typeof desde === 'string') msgQuery.fecha = { ...msgQuery.fecha, $gte: new Date(desde) };
    if (hasta && typeof hasta === 'string') msgQuery.fecha = { ...msgQuery.fecha, $lte: new Date(hasta) };
    if (q && typeof q === 'string' && q.trim()) {
      msgQuery.contenido = { $regex: (q as string).trim(), $options: 'i' };
    }
    const messages = await EvoMessage.find(msgQuery)
      .populate('remitenteId', 'nombre correo rol')
      .populate('threadId')
      .sort({ fecha: -1 })
      .limit(50)
      .lean();

    return res.json(messages);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error en búsqueda.' });
  }
});

/** GET /api/evo-send/attendance-inbox - Inbox de asistencia (solo asistente) */
router.get('/attendance-inbox', protect, requireRole('asistente'), async (req: AuthRequest, res) => {
  try {
    const colegioId = req.user?.colegioId;
    const { cursoId, fecha, estudianteId } = req.query;
    if (!colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const query: any = { colegioId };
    if (cursoId && typeof cursoId === 'string') query.cursoId = normalizeIdForQuery(cursoId);
    if (estudianteId && typeof estudianteId === 'string') query.estudianteId = normalizeIdForQuery(estudianteId);
    if (fecha && typeof fecha === 'string') query.fecha = { $gte: new Date(fecha), $lt: new Date(new Date(fecha).setHours(23, 59, 59, 999)) };

    const records = await Asistencia.find(query)
      .populate('cursoId', 'nombre')
      .populate('estudianteId', 'nombre correo')
      .sort({ fecha: -1 })
      .limit(200)
      .lean();

    return res.json(records);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener registros de asistencia.' });
  }
});

/** GET /api/evo-send/courses - Listar cursos (para profesor, al redactar por curso) */
router.get('/courses', protect, requireRole('profesor', 'directivo', 'admin-general-colegio'), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    const rol = req.user?.rol;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const query: any = { colegioId };
    if (rol === 'profesor') {
      query.$or = [{ profesorId: normalizeIdForQuery(userId) }, { profesorIds: normalizeIdForQuery(userId) }];
    }
    const courses = await Course.find(query).select('nombre _id cursos estudianteIds').lean();
    return res.json(courses);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar cursos.' });
  }
});

export default router;
