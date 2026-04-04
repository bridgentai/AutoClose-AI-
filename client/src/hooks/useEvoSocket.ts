import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_API_URL) {
    const u = new URL(import.meta.env.VITE_API_URL);
    // socket.io-client espera un origen http(s); él mismo negocia websocket/polling.
    return `${u.protocol}//${u.host}`;
  }
  return window.location.origin;
};

export function useEvoSocket(token: string | null) {
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);
  const [lastRead, setLastRead] = useState<{ threadId?: string; userId?: string } | null>(null);
  const [typing, setTyping] = useState<{ userId?: string; userName?: string; threadId?: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const joinedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) return;
    const url = getSocketUrl();
    const socket = io(url, {
      path: '/api/evo-send-ws',
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('evo:message', (msg) => setLastMessage(msg));
    socket.on('evo:read', (payload) => setLastRead(payload));
    socket.on('evo:typing', (payload) => setTyping(payload));
    return () => {
      socket.off('connect').off('disconnect').off('evo:message').off('evo:read').off('evo:typing');
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const joinThread = useCallback((threadId: string | null) => {
    const s = socketRef.current;
    if (!s) return;
    if (joinedThreadRef.current) {
      s.emit('evo:leave', joinedThreadRef.current);
    }
    joinedThreadRef.current = threadId;
    if (threadId) s.emit('evo:join', threadId);
  }, []);

  const emitTyping = useCallback((threadId: string, userName?: string) => {
    socketRef.current?.emit('evo:typing', { threadId, userName });
  }, []);

  const clearLastMessage = useCallback(() => setLastMessage(null), []);
  const clearLastRead = useCallback(() => setLastRead(null), []);
  const clearTyping = useCallback(() => setTyping(null), []);

  return {
    connected,
    joinThread,
    emitTyping,
    lastMessage,
    lastRead,
    typing,
    clearLastMessage,
    clearLastRead,
    clearTyping,
  };
}
