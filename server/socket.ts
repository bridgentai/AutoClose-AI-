import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

let io: Server | null = null;

export function setupEvoSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    path: '/api/evo-send-ws',
    cors: { origin: true, credentials: true },
  });

  io.on('connection', (socket: Socket) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    let userId: string | null = null;

    try {
      const secret = process.env.JWT_SECRET || 'fallback';
      const decoded = jwt.verify(token as string, secret) as { id?: string };
      userId = decoded?.id || null;
    } catch {
      socket.disconnect(true);
      return;
    }

    if (!userId) {
      socket.disconnect(true);
      return;
    }

    socket.data.userId = userId;

    socket.on('evo:join', (threadId: string) => {
      if (threadId) socket.join(`thread:${threadId}`);
    });

    socket.on('evo:leave', (threadId: string) => {
      if (threadId) socket.leave(`thread:${threadId}`);
    });

    socket.on('evo:typing', (payload: { threadId: string; userName?: string }) => {
      if (payload?.threadId) {
        socket.to(`thread:${payload.threadId}`).emit('evo:typing', {
          userId,
          userName: payload.userName,
          threadId: payload.threadId,
        });
      }
    });

    socket.on('disconnect', () => {});
  });

  return io;
}

export function getEvoIo(): Server | null {
  return io;
}

/** Emitir nuevo mensaje a todos los usuarios en el hilo */
export function emitEvoMessage(threadId: string, message: unknown): void {
  getEvoIo()?.to(`thread:${threadId}`).emit('evo:message', message);
}

/** Emitir mensajes marcados como leídos */
export function emitEvoRead(threadId: string, userId: string): void {
  getEvoIo()?.to(`thread:${threadId}`).emit('evo:read', { threadId, userId });
}
