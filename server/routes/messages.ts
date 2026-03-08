import express from 'express';
import { Conversacion, Mensaje, User } from '../models';
import { protect, AuthRequest } from '../middleware/auth';
import { normalizeIdForQuery } from '../utils/idGenerator';

const router = express.Router();

async function canAccessConversation(conversacionId: string, userId: string): Promise<boolean> {
  const c = await Conversacion.findById(conversacionId).lean();
  if (!c) return false;
  return c.participanteIds.some((id: unknown) => id?.toString() === userId);
}

// GET /api/messages/conversations - Listar conversaciones del usuario
router.get('/conversations', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const list = await Conversacion.find({
      colegioId,
      participanteIds: normalizeIdForQuery(userId),
    })
      .populate('participanteIds', 'nombre correo rol')
      .populate('creadoPor', 'nombre')
      .populate('materiaId', 'nombre')
      .sort({ createdAt: -1 })
      .lean();

    const withLastMessage = await Promise.all(
      list.map(async (c) => {
        const last = await Mensaje.findOne({ conversationId: c._id })
          .sort({ fecha: -1 })
          .populate('remitenteId', 'nombre')
          .lean();
        return {
          ...c,
          ultimoMensaje: last ? { texto: last.texto, fecha: last.fecha, remitente: (last.remitenteId as any)?.nombre } : null,
        };
      })
    );

    return res.json(withLastMessage);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al listar conversaciones.' });
  }
});

// GET /api/messages/conversations/:id - Mensajes de una conversación
router.get('/conversations/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessConversation(id, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado a esta conversación.' });

    const conversacion = await Conversacion.findById(normalizeIdForQuery(id))
      .populate('participanteIds', 'nombre correo rol')
      .populate('materiaId', 'nombre')
      .lean();

    if (!conversacion) return res.status(404).json({ message: 'Conversación no encontrada.' });

    const mensajes = await Mensaje.find({ conversationId: normalizeIdForQuery(id) })
      .populate('remitenteId', 'nombre correo')
      .sort({ fecha: 1 })
      .lean();

    return res.json({ conversacion, mensajes });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener mensajes.' });
  }
});

// POST /api/messages/conversations - Crear conversación y primer mensaje (profesor/directivo -> padre)
router.post('/conversations', protect, async (req: AuthRequest, res) => {
  try {
    const { destinatarioId, asunto, texto, materiaId } = req.body;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!destinatarioId || !asunto || !texto) {
      return res.status(400).json({ message: 'Faltan destinatarioId, asunto o texto.' });
    }

    const allowed = ['profesor', 'directivo', 'admin-general-colegio', 'asistente'];
    if (!allowed.includes(rol)) return res.status(403).json({ message: 'Solo profesor, directivo o asistente pueden iniciar conversación con padres.' });

    const dest = await User.findById(normalizeIdForQuery(destinatarioId)).select('rol').lean();
    if (!dest || dest.rol !== 'padre') return res.status(400).json({ message: 'El destinatario debe ser un padre.' });

    const tipo = rol === 'profesor' ? 'profesor-padre' : rol === 'asistente' ? 'asistente-padre' : 'directivo-padre';

    const conversacion = await Conversacion.create({
      colegioId,
      asunto,
      participanteIds: [normalizeIdForQuery(userId), normalizeIdForQuery(destinatarioId)],
      tipo,
      materiaId: materiaId ? normalizeIdForQuery(materiaId) : undefined,
      creadoPor: userId,
    });

    const mensaje = await Mensaje.create({
      conversationId: conversacion._id,
      remitenteId: userId,
      texto,
      leido: false,
    });

    const populated = await Conversacion.findById(conversacion._id)
      .populate('participanteIds', 'nombre correo rol')
      .populate('creadoPor', 'nombre')
      .populate('materiaId', 'nombre')
      .lean();

    return res.status(201).json({ conversacion: populated, mensaje: await Mensaje.findById(mensaje._id).populate('remitenteId', 'nombre').lean() });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al crear conversación.' });
  }
});

// POST /api/messages/conversations/:id - Enviar mensaje en conversación existente
router.post('/conversations/:id', protect, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { texto } = req.body;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessConversation(id, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado a esta conversación.' });

    if (!texto || !texto.trim()) return res.status(400).json({ message: 'Texto requerido.' });

    const mensaje = await Mensaje.create({
      conversationId: normalizeIdForQuery(id),
      remitenteId: userId,
      texto: texto.trim(),
      leido: false,
    });

    const populated = await Mensaje.findById(mensaje._id).populate('remitenteId', 'nombre correo').lean();
    return res.status(201).json(populated);
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

// PATCH /api/messages/read/:conversationId - Marcar mensajes de una conversación como leídos
router.patch('/read/:conversationId', protect, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessConversation(conversationId, normalizeIdForQuery(userId));
    if (!can) return res.status(403).json({ message: 'No autorizado.' });

    await Mensaje.updateMany(
      { conversationId: normalizeIdForQuery(conversationId), remitenteId: { $ne: normalizeIdForQuery(userId) } },
      { $set: { leido: true } }
    );

    return res.json({ success: true });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar leídos.' });
  }
});

export default router;
