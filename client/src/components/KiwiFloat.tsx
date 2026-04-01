import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/authContext';
import kiwiIdle from '@/assets/kiwi sentado.png';
import kiwiThinking from '@/assets/kiwi chill.png';
import kiwiTalking from '@/assets/Kiwi-chat.png';
import kiwiFallback from '@/assets/kiwi.png';

type Message = { role: 'user' | 'kiwi'; text: string };

type KiwiImgState = 'idle' | 'thinking' | 'talking';

function getKiwiImg(state: KiwiImgState): string {
  if (state === 'thinking') return kiwiThinking;
  if (state === 'talking') return kiwiTalking;
  return kiwiIdle;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-3 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="kiwi-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

function ConfirmModal({
  preview,
  onConfirm,
  onCancel,
}: {
  preview: Record<string, unknown>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const entries = Object.entries(preview).filter(([k]) => k !== 'action');
  const actionLabel = (preview.action as string) ?? 'acción';

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 mx-4 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <img
            src={kiwiThinking}
            alt="Kiwi"
            className="w-12 h-12 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = kiwiFallback; }}
          />
          <div>
            <p className="font-semibold text-gray-800">¿Confirmar acción?</p>
            <p className="text-sm text-gray-500 capitalize">{actionLabel.replace(/_/g, ' ')}</p>
          </div>
        </div>

        {entries.length > 0 && (
          <ul className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3 mb-5 space-y-1">
            {entries.map(([k, v]) => (
              <li key={k}>
                <span className="font-medium capitalize">{k.replace(/_/g, ' ')}:</span>{' '}
                {typeof v === 'object' ? JSON.stringify(v) : String(v)}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function KiwiFloat() {
  const { isAuthenticated, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    preview: Record<string, unknown>;
    originalMessage: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const kiwiImgState: KiwiImgState = isLoading
    ? 'thinking'
    : isStreaming
    ? 'talking'
    : 'idle';

  const sendMessage = useCallback(
    async (text: string, confirmed = false) => {
      if (!text.trim() || isLoading || isStreaming) return;

      const token = localStorage.getItem('autoclose_token');
      if (!token) return;

      setMessages((prev) => [...prev, { role: 'user', text }]);
      setInput('');
      setIsLoading(true);
      setIsStreaming(false);

      // Placeholder for Kiwi's streaming reply
      setMessages((prev) => [...prev, { role: 'kiwi', text: '' }]);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const res = await fetch('/api/kiwi/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            ...(sessionId ? { sessionId } : {}),
            ...(confirmed ? { confirmed: true } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) {
          const errText = await res.text().catch(() => 'Error desconocido');
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = {
              role: 'kiwi',
              text: `Ocurrió un error: ${errText}`,
            };
            return next;
          });
          setIsLoading(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        setIsLoading(false);
        setIsStreaming(true);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const raw = line.slice(6).trim();
            if (!raw) continue;

            let parsed: { type: string; text?: string; sessionId?: string; message?: string };
            try {
              parsed = JSON.parse(raw);
            } catch {
              continue;
            }

            if (parsed.type === 'chunk' && parsed.text) {
              const chunk = parsed.text;

              // Detect __CONFIRM__ signal
              if (chunk.startsWith('__CONFIRM__:')) {
                let preview: Record<string, unknown> = {};
                try {
                  preview = JSON.parse(chunk.slice('__CONFIRM__:'.length));
                } catch {
                  preview = { accion: 'acción pendiente' };
                }
                setPendingConfirm({ preview, originalMessage: text });
                // Remove the empty placeholder kiwi message
                setMessages((prev) => prev.slice(0, -1));
                setIsStreaming(false);
                return;
              }

              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last?.role === 'kiwi') {
                  next[next.length - 1] = { ...last, text: last.text + chunk };
                }
                return next;
              });
            } else if (parsed.type === 'done') {
              if (parsed.sessionId) setSessionId(parsed.sessionId);
              setIsStreaming(false);
            } else if (parsed.type === 'error') {
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = {
                  role: 'kiwi',
                  text: parsed.message ?? 'Ocurrió un error.',
                };
                return next;
              });
              setIsStreaming(false);
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = {
            role: 'kiwi',
            text: 'No pude conectarme. Intenta de nuevo.',
          };
          return next;
        });
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [isLoading, isStreaming, sessionId]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleConfirm = () => {
    if (!pendingConfirm) return;
    const msg = pendingConfirm.originalMessage;
    setPendingConfirm(null);
    sendMessage(msg, true);
  };

  const handleCancel = () => {
    setPendingConfirm(null);
    setMessages((prev) => [
      ...prev,
      { role: 'kiwi', text: 'Entendido, acción cancelada.' },
    ]);
  };

  if (!isAuthenticated || !user) return null;

  return (
    <>
      {/* Confirmation modal (rendered outside the panel) */}
      {pendingConfirm && (
        <ConfirmModal
          preview={pendingConfirm.preview}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}

      {/* Floating container */}
      <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-3">

        {/* Chat panel */}
        {open && (
          <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
            style={{ maxHeight: '70vh' }}>

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-white">
              <img
                src={getKiwiImg(kiwiImgState)}
                alt="Kiwi"
                className="w-8 h-8 object-contain"
                onError={(e) => { (e.target as HTMLImageElement).src = kiwiFallback; }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm leading-tight">Kiwi</p>
                <p className="text-xs text-gray-400 leading-tight">Asistente EvoOS</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                aria-label="Cerrar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm pt-4">
                  <p>¡Hola! Soy Kiwi.</p>
                  <p className="mt-1">¿En qué puedo ayudarte hoy?</p>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}
                  >
                    {msg.text || (msg.role === 'kiwi' && isLoading ? null : msg.text)}
                    {msg.role === 'kiwi' && msg.text === '' && isLoading && (
                      <TypingIndicator />
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator when no placeholder yet */}
              {isLoading && messages[messages.length - 1]?.role !== 'kiwi' && (
                <div className="flex justify-start">
                  <div className="bg-gray-100 rounded-2xl rounded-bl-sm">
                    <TypingIndicator />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="border-t border-gray-100 p-3 flex gap-2 items-end"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                rows={1}
                className="flex-1 resize-none text-sm bg-gray-50 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-300 placeholder-gray-400 max-h-24 overflow-y-auto"
                disabled={isLoading || isStreaming}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isStreaming}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                aria-label="Enviar"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8h12M9 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </form>
          </div>
        )}

        {/* Floating koala button */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="kiwi-float w-16 h-16 rounded-full shadow-xl bg-white border-2 border-emerald-100 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform overflow-hidden p-0"
          aria-label="Abrir asistente Kiwi"
        >
          <img
            src={getKiwiImg(kiwiImgState)}
            alt="Kiwi"
            className="w-full h-full object-contain"
            onError={(e) => { (e.target as HTMLImageElement).src = kiwiFallback; }}
          />
        </button>
      </div>
    </>
  );
}
