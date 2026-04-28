import { useCallback, useEffect, useRef, useState } from 'react';
import { isKiwiConfirmPayload, parseKiwiConfirmPayload, parseKiwiSseLine } from '@/lib/kiwiSse';

export interface KiwiChatMessage {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
  type?: string;
  structuredData?: Record<string, unknown>;
  contextLabel?: 'parent_notes';
}

export interface SendKiwiMessageOptions {
  bodyExtras?: Record<string, unknown>;
  userContextLabel?: 'parent_notes';
}

export function useKiwiChatStream() {
  const [messages, setMessages] = useState<KiwiChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeToolStep, setActiveToolStep] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = useCallback(
    async (messageText: string, options?: SendKiwiMessageOptions) => {
      const text = messageText.trim();
      if (!text || loading || isStreaming) return;

      const userMessage: KiwiChatMessage = {
        emisor: 'user',
        contenido: text,
        timestamp: new Date(),
        ...(options?.userContextLabel ? { contextLabel: options.userContextLabel } : {}),
      };
      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);
      setMessages((prev) => [...prev, { emisor: 'ai', contenido: '', timestamp: new Date() }]);

      try {
        const token = localStorage.getItem('autoclose_token');
        const body: Record<string, unknown> = {
          message: text,
          ...(sessionId ? { sessionId } : {}),
          ...(options?.bodyExtras ?? {}),
        };

        const response = await fetch('/api/kiwi/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });

        if (!response.ok || !response.body) {
          let errMsg = 'Error al conectar con Kiwi';
          try {
            const b = (await response.json()) as { error?: string };
            errMsg = b.error || errMsg;
          } catch {
            /* ignore */
          }
          throw new Error(errMsg);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let firstChunk = true;

        setLoading(false);
        setIsStreaming(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const event = parseKiwiSseLine(line);
            if (!event) continue;

            if (event.type === 'tool_step') {
              setActiveToolStep(event.status === 'start' && event.tool ? event.tool : null);
              continue;
            }

            if (event.type === 'chunk' && event.text) {
              if (isKiwiConfirmPayload(event.text)) {
                const payload = parseKiwiConfirmPayload(event.text);
                setLoading(false);
                setIsStreaming(false);
                setActiveToolStep(null);
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    emisor: 'ai',
                    contenido: '',
                    timestamp: new Date(),
                    type: 'kiwi_confirm',
                    structuredData: payload ?? undefined,
                  };
                  return next;
                });
                firstChunk = false;
                scrollToBottom();
                continue;
              }

              if (event.text.startsWith('__EVO_DOC__:')) {
                try {
                  const docData = JSON.parse(event.text.slice('__EVO_DOC__:'.length)) as Record<string, unknown>;
                  setLoading(false);
                  setIsStreaming(false);
                  setActiveToolStep(null);
                  setMessages((prev) => {
                    const next = [...prev];
                    next[next.length - 1] = {
                      emisor: 'ai',
                      contenido: '',
                      timestamp: new Date(),
                      type: 'evo_doc',
                      structuredData: docData,
                    };
                    return next;
                  });
                  firstChunk = false;
                } catch {
                  /* ignore parse errors */
                }
                scrollToBottom();
                continue;
              }

              if (firstChunk) {
                setActiveToolStep(null);
                setMessages((prev) => {
                  const next = [...prev];
                  next[next.length - 1] = {
                    emisor: 'ai',
                    contenido: event.text!,
                    timestamp: new Date(),
                  };
                  return next;
                });
                firstChunk = false;
              } else {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  updated[updated.length - 1] = { ...last, contenido: last.contenido + event.text! };
                  return updated;
                });
              }
              scrollToBottom();
            } else if (event.type === 'done') {
              if (event.sessionId) setSessionId(event.sessionId);
              setIsStreaming(false);
              setActiveToolStep(null);
              setTimeout(() => scrollToBottom(), 100);
            } else if (event.type === 'error') {
              const errMsg = event.message || 'Lo siento, ocurrió un error. Intenta de nuevo.';
              setLoading(false);
              setIsStreaming(false);
              setActiveToolStep(null);
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { emisor: 'ai', contenido: errMsg, timestamp: new Date() };
                return next;
              });
              setTimeout(() => scrollToBottom(), 100);
            }
          }
        }
      } catch (error: unknown) {
        console.error('Error en chat Kiwi:', error);
        const errorText =
          error instanceof Error
            ? error.message
            : 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { emisor: 'ai', contenido: errorText, timestamp: new Date() };
          return next;
        });
        setTimeout(() => scrollToBottom(), 100);
      } finally {
        setLoading(false);
        setIsStreaming(false);
        setActiveToolStep(null);
      }
    },
    [loading, isStreaming, sessionId, scrollToBottom],
  );

  const handleSendFromInput = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    void sendMessage(t);
  }, [input, sendMessage]);

  return {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    isStreaming,
    sessionId,
    activeToolStep,
    messagesEndRef,
    scrollToBottom,
    sendMessage,
    handleSendFromInput,
  };
}
