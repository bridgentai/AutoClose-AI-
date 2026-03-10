import express from 'express';
import { protect, AuthRequest } from '../middleware/authMiddleware.js';
import {
  findConversationById,
  findConversationIdsByParticipant,
  createConversation,
  addConversationParticipant,
  isConversationParticipant,
} from '../repositories/conversationRepository.js';
import {
  findMessagesByConversation,
  getLastMessageByConversation,
  createMessage,
  markMessagesAsReadByConversationForUser,
} from '../repositories/messageRepository.js';
import { findUserById } from '../repositories/userRepository.js';

const router = express.Router();

async function canAccessConversation(conversationId: string, userId: string): Promise<boolean> {
  return isConversationParticipant(conversationId, userId);
}

// GET /api/messages/conversations - Listar conversaciones del usuario
router.get('/conversations', protect, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    const ids = await findConversationIdsByParticipant(userId);
    const list = await Promise.all(ids.map((id) => findConversationById(id)));
    const valid = list.filter((c): c is NonNullable<typeof c> => c != null);

    const withLastMessage = await Promise.all(
      valid.map(async (c) => {
        const last = await getLastMessageByConversation(c.id);
        const creator = await findUserById(c.created_by);
        return {
          _id: c.id,
          colegioId: c.institution_id,
          asunto: c.subject,
          tipo: c.type,
          creadoPor: creator ? { _id: creator.id, nombre: creator.full_name } : null,
          participanteIds: [], // se rellenan abajo si se necesita
          ultimoMensaje: last
            ? {
                texto: last.text,
                fecha: last.created_at,
                remitente: null,
              }
            : null,
        };
      })
    );

    return res.json(withLastMessage);
  } catch (e: unknown) {
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

    const can = await canAccessConversation(id, userId);
    if (!can) return res.status(403).json({ message: 'No autorizado a esta conversación.' });

    const conversacion = await findConversationById(id);
    if (!conversacion) return res.status(404).json({ message: 'Conversación no encontrada.' });

    const mensajes = await findMessagesByConversation(id);
    const creator = await findUserById(conversacion.created_by);

    const conversacionPayload = {
      _id: conversacion.id,
      colegioId: conversacion.institution_id,
      asunto: conversacion.subject,
      tipo: conversacion.type,
      creadoPor: creator ? { _id: creator.id, nombre: creator.full_name } : null,
      participanteIds: [],
    };

    const mensajesPayload = await Promise.all(
      mensajes.map(async (m) => {
        const sender = await findUserById(m.sender_id);
        return {
          _id: m.id,
          conversationId: m.conversation_id,
          remitenteId: { _id: m.sender_id, nombre: sender?.full_name ?? '', correo: sender?.email ?? '' },
          texto: m.text,
          leido: !!m.read_at,
          fecha: m.created_at,
        };
      })
    );

    return res.json({ conversacion: conversacionPayload, mensajes: mensajesPayload });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al obtener mensajes.' });
  }
});

// POST /api/messages/conversations - Crear conversación y primer mensaje (profesor/directivo -> padre)
router.post('/conversations', protect, async (req: AuthRequest, res) => {
  try {
    const { destinatarioId, asunto, texto } = req.body;
    const userId = req.user?.id;
    const rol = req.user?.rol;
    const colegioId = req.user?.colegioId;
    if (!userId || !colegioId) return res.status(401).json({ message: 'No autorizado.' });

    if (!destinatarioId || !asunto || !texto) {
      return res.status(400).json({ message: 'Faltan destinatarioId, asunto o texto.' });
    }

    const allowed = ['profesor', 'directivo', 'admin-general-colegio', 'asistente'];
    if (!allowed.includes(rol)) return res.status(403).json({ message: 'Solo profesor, directivo o asistente pueden iniciar conversación con padres.' });

    const dest = await findUserById(destinatarioId);
    if (!dest || dest.role !== 'padre') return res.status(400).json({ message: 'El destinatario debe ser un padre.' });

    const tipo = rol === 'profesor' ? 'profesor-padre' : rol === 'asistente' ? 'asistente-padre' : 'directivo-padre';

    const conversacion = await createConversation({
      institution_id: colegioId,
      subject: asunto,
      type: tipo,
      created_by: userId,
    });
    await addConversationParticipant(conversacion.id, userId);
    await addConversationParticipant(conversacion.id, destinatarioId);

    const mensaje = await createMessage({
      conversation_id: conversacion.id,
      sender_id: userId,
      text: texto,
    });

    const creator = await findUserById(conversacion.created_by);
    const conversacionPopulated = {
      _id: conversacion.id,
      colegioId: conversacion.institution_id,
      asunto: conversacion.subject,
      tipo: conversacion.type,
      creadoPor: creator ? { _id: creator.id, nombre: creator.full_name } : null,
      participanteIds: [],
    };
    const sender = await findUserById(mensaje.sender_id);
    const mensajePopulated = {
      _id: mensaje.id,
      remitenteId: { _id: mensaje.sender_id, nombre: sender?.full_name ?? '' },
      texto: mensaje.text,
      fecha: mensaje.created_at,
    };

    return res.status(201).json({ conversacion: conversacionPopulated, mensaje: mensajePopulated });
  } catch (e: unknown) {
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

    const can = await canAccessConversation(id, userId);
    if (!can) return res.status(403).json({ message: 'No autorizado a esta conversación.' });

    if (!texto || !String(texto).trim()) return res.status(400).json({ message: 'Texto requerido.' });

    const mensaje = await createMessage({
      conversation_id: id,
      sender_id: userId,
      text: String(texto).trim(),
    });

    const sender = await findUserById(mensaje.sender_id);
    return res.status(201).json({
      _id: mensaje.id,
      remitenteId: { _id: mensaje.sender_id, nombre: sender?.full_name ?? '', correo: sender?.email ?? '' },
      texto: mensaje.text,
      fecha: mensaje.created_at,
    });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al enviar mensaje.' });
  }
});

// PATCH /api/messages/read/:conversationId - Marcar mensajes como leídos
router.patch('/read/:conversationId', protect, async (req: AuthRequest, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'No autorizado.' });

    const can = await canAccessConversation(conversationId, userId);
    if (!can) return res.status(403).json({ message: 'No autorizado.' });

    await markMessagesAsReadByConversationForUser(conversationId, userId);
    return res.json({ success: true });
  } catch (e: unknown) {
    console.error(e);
    return res.status(500).json({ message: 'Error al marcar leídos.' });
  }
});

export default router;
