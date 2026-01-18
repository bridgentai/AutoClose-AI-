import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { MessageSquare, Clock, X, Edit2, Check, X as XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChatSession {
  _id: string;
  titulo: string;
  createdAt: string;
  updatedAt: string;
  mensajesCount?: number;
  ultimoMensaje?: string;
}

interface ChatSidebarProps {
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number;
}

export function ChatSidebar({ 
  currentSessionId, 
  onSelectSession, 
  onNewChat,
  isOpen,
  onClose,
  refreshTrigger
}: ChatSidebarProps) {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [savingTitle, setSavingTitle] = useState(false);

  useEffect(() => {
    const loadSessions = async () => {
      setLoading(true);
      try {
        const data = await apiRequest<ChatSession[]>('GET', '/api/chat/sessions');
        setSessions(data || []);
      } catch (error) {
        console.error('Error al cargar sesiones:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [refreshTrigger]); // Refrescar cuando cambie refreshTrigger

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (!text) return 'Sin mensajes';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  const handleStartEdit = (session: ChatSession) => {
    setEditingSessionId(session._id);
    setEditingTitle(session.titulo);
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingTitle('');
  };

  const handleSaveTitle = async (sessionId: string) => {
    if (!editingTitle.trim()) {
      handleCancelEdit();
      return;
    }

    setSavingTitle(true);
    try {
      await apiRequest('PUT', `/api/chat/${sessionId}/title`, {
        titulo: editingTitle.trim()
      });
      
      // Recargar las sesiones para asegurar sincronización
      const data = await apiRequest<ChatSession[]>('GET', '/api/chat/sessions');
      setSessions(data || []);
      
      setEditingSessionId(null);
      setEditingTitle('');
    } catch (error) {
      console.error('Error al actualizar título:', error);
    } finally {
      setSavingTitle(false);
    }
  };

  return (
    <>
      {/* Overlay para móvil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed right-0 top-0 h-full w-80 bg-white/5 border-l border-white/10 backdrop-blur-md z-50
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
          flex flex-col
        `}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white font-['Poppins']">
            Conversaciones
          </h2>
          <div className="flex items-center gap-2">
            <Button
              onClick={onNewChat}
              size="sm"
              className="bg-gradient-to-r from-[#9f25b8] to-[#6a0dad] text-white hover:opacity-90"
            >
              <MessageSquare className="w-4 h-4 mr-1" />
              Nuevo
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="lg:hidden text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Lista de sesiones */}
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-white/60 text-sm">Cargando...</div>
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="w-12 h-12 text-white/20 mb-4" />
              <p className="text-white/60 text-sm">
                No hay conversaciones anteriores
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => (
                <div
                  key={session._id}
                  className={`
                    w-full p-3 rounded-xl transition-all duration-200
                    ${currentSessionId === session._id
                      ? 'bg-gradient-to-r from-[#9f25b8]/30 to-[#6a0dad]/30 border border-[#9f25b8]/50'
                      : 'bg-white/5 border border-white/10 hover:bg-white/10'
                    }
                  `}
                >
                  {editingSessionId === session._id ? (
                    // Modo edición
                    <div className="space-y-2">
                      <Input
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleSaveTitle(session._id);
                          } else if (e.key === 'Escape') {
                            handleCancelEdit();
                          }
                        }}
                        className="h-8 text-sm bg-white/10 border-white/20 text-white placeholder:text-white/40"
                        autoFocus
                        disabled={savingTitle}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => handleSaveTitle(session._id)}
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-white/80 hover:text-white hover:bg-white/10"
                          disabled={savingTitle}
                        >
                          <Check className="w-3 h-3" />
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-white/80 hover:text-white hover:bg-white/10"
                          disabled={savingTitle}
                        >
                          <XIcon className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Modo visualización
                    <>
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <button
                          onClick={() => {
                            onSelectSession(session._id);
                            onClose();
                          }}
                          className="flex-1 text-left"
                        >
                          <h3 className="text-sm font-semibold text-white truncate">
                            {session.titulo || 'Chat sin título'}
                          </h3>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(session);
                          }}
                          className="p-1 text-white/40 hover:text-white/80 hover:bg-white/10 rounded transition-colors"
                          title="Editar título"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                      {session.ultimoMensaje && (
                        <p className="text-xs text-white/60 mb-2 line-clamp-2">
                          {truncateText(session.ultimoMensaje, 40)}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(session.updatedAt)}</span>
                        {session.mensajesCount !== undefined && (
                          <>
                            <span>•</span>
                            <span>{session.mensajesCount} mensajes</span>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

