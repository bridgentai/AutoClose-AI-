"use client";

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/authContext";
import { 
  MessageSquare, 
  Sparkles, 
  X, 
  Home,
  BookOpen,
  GraduationCap,
  Calendar,
  Users,
  Globe,
  Settings,
  User,
  LogOut,
  Command,
  Send,
  Loader2,
  Mail,
  UsersRound,
  FileCheck,
  Bell
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useCommandPalette } from "./command-palette";

interface Message {
  emisor: 'user' | 'ai';
  contenido: string;
  timestamp: Date;
}

interface AIDockProps {
  onOpenCommandPalette?: () => void;
  onChatStateChange?: (isOpen: boolean, isExpanded: boolean) => void;
}

export function AIDock({ onOpenCommandPalette, onChatStateChange }: AIDockProps) {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { setOpen: setCommandOpen } = useCommandPalette();
  
  // Notificar cambios en el estado del chat
  useEffect(() => {
    if (onChatStateChange) {
      onChatStateChange(isChatOpen, isExpanded);
    }
  }, [isChatOpen, isExpanded, onChatStateChange]);

  
  // Use prop if provided, otherwise use hook
  const handleOpenCommandPalette = () => {
    if (onOpenCommandPalette) {
      onOpenCommandPalette();
    } else {
      setCommandOpen(true);
    }
  };
  
  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isChatPage = location === "/chat";
  const isDashboardPage = location === "/dashboard";

  // No auto-open chat when on /chat route (to avoid duplication with full page)
  // The chat panel should only open when explicitly clicked from the dock
  // Also disable chat on dashboard to avoid duplication with AIChatBox

  // Navigation items based on role
  const getNavigationItems = () => {
    const baseItems = [
      { icon: Home, label: "Dashboard", path: "/dashboard", roles: ["estudiante", "profesor", "directivo", "padre"] },
      { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["estudiante", "profesor", "directivo", "padre"], action: "chat" },
      { icon: GraduationCap, label: "Mi Aprendizaje", path: "/mi-aprendizaje", roles: ["estudiante"] },
      { icon: Mail, label: "Comunicación", path: "/comunicacion", roles: ["estudiante"] },
      { icon: UsersRound, label: "Comunidad", path: "/comunidad", roles: ["estudiante", "profesor", "directivo", "padre"] },
      // Módulos principales del profesor
      { icon: BookOpen, label: "Academia", path: "/profesor/academia", roles: ["profesor"] },
      { icon: Mail, label: "Comunicación", path: "/profesor/comunicacion", roles: ["profesor"] },
      { icon: Calendar, label: "Calendario", path: "/teacher-calendar", roles: ["profesor"] },
      // Otros roles
      { icon: Calendar, label: "Calendario", path: "/calendar", roles: ["directivo", "padre"] },
      { icon: FileCheck, label: "Permisos", path: "/permisos", roles: ["padre"] },
      { icon: Users, label: "Asignación de Grupos", path: "/group-assignment", roles: ["directivo"] },
      { icon: Globe, label: "Plataformas", path: "/plataformas", roles: ["directivo", "padre"] },
      { icon: Users, label: "Profesores", path: "/directivo", roles: ["directivo"] },
      { icon: User, label: "Mi Perfil", path: "/mi-perfil", roles: ["estudiante", "profesor", "directivo", "padre"] },
      { icon: Bell, label: "Notificaciones", path: "/notificaciones", roles: ["estudiante", "profesor", "directivo", "padre"] },
    ];

    return baseItems.filter(item => item.roles.includes(user?.rol || ""));
  };

  const navigationItems = getNavigationItems();

  const handleNavClick = (path: string, action?: string) => {
    if (action === "chat") {
      // Only open chat panel if not on chat page and not on dashboard (to avoid duplication)
      if (!isChatPage && !isDashboardPage) {
        setIsChatOpen(true);
        setIsExpanded(true);
      } else {
        // If already on chat page or dashboard, just expand the dock (but don't open chat)
        setIsExpanded(true);
      }
    } else {
      setLocation(path);
    }
  };

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  // Chat functions
  const scrollToBottom = () => {
    // Usar requestAnimationFrame para asegurar que el DOM se haya actualizado
    requestAnimationFrame(() => {
      const chatContainer = document.getElementById('chat-messages');
      if (chatContainer) {
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      emisor: 'user',
      contenido: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Construir historial de conversación para el contexto
      const conversationHistory = messages.map(msg => ({
        role: msg.emisor === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.contenido
      }));

      // Llamar al nuevo endpoint del Chat AI Global
      const response = await apiRequest<{ success: boolean; response: string; error?: string }>('POST', '/api/ai/chat', {
        message: currentInput,
        contexto_extra: {
          rol: user?.rol,
          curso: user?.curso,
        },
        conversationHistory,
      });

      if (!response.success) {
        throw new Error(response.error || 'Error al procesar el mensaje');
      }

      const aiMessage: Message = {
        emisor: 'ai',
        contenido: response.response,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      // Scroll después de agregar el mensaje de AI
      setTimeout(() => scrollToBottom(), 150);
    } catch (error: any) {
      console.error('Error en chat:', error);
      let errorText = 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';
      
      if (error.message) {
        errorText = error.message;
      } else if (error.response) {
        errorText = error.response.message || error.response.error || errorText;
      }
      
      const errorMessage: Message = {
        emisor: 'ai',
        contenido: errorText,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      // Scroll después de agregar el mensaje de error
      setTimeout(() => scrollToBottom(), 150);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      {/* Overlay con blur - Solo cuando está expandido Y NO es solo el chat (navegación del dock) */}
      {isExpanded && !isChatOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => {
            setIsExpanded(false);
            setIsChatOpen(false);
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Overlay transparente para cerrar el chat - Sin blur para poder ver el contenido */}
      {isChatOpen && (
        <div
          className="fixed inset-0 z-20 bg-transparent transition-opacity duration-300"
          onClick={() => {
            setIsChatOpen(false);
            if (!isExpanded) {
              setIsExpanded(false);
            }
          }}
          aria-hidden="true"
        />
      )}
      
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-30",
          "transition-all duration-500 ease-in-out",
          isExpanded ? (isChatOpen ? "w-96" : "w-80") : "w-16",
          "flex flex-col",
        )}
      >
        {/* Dock Container */}
        <div
          className={cn(
            "h-full",
            "glass-strong",
            "border-l border-white/10",
            "transition-all duration-500",
            "flex flex-col",
            "depth-2",
            "hover-glow",
          )}
          onClick={(e) => {
            // Prevenir que el clic dentro del dock cierre el overlay
            e.stopPropagation();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            {isExpanded && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm font-medium text-white font-['Poppins']">AI Dock</span>
              </div>
            )}
            {isExpanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      setIsExpanded(false);
                      setIsChatOpen(false);
                    }}
                    className={cn(
                      "p-2 rounded-lg",
                      "hover:bg-white/10 transition-colors",
                      "text-white/70 hover:text-white",
                    )}
                    aria-label="Cerrar AI Dock"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Cerrar</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Content */}
          {isExpanded ? (
            <>
              {isChatOpen ? (
                /* Chat Panel */
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="p-4 border-b border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] flex items-center justify-center">
                        <MessageSquare className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-white">Chat AI</span>
                    </div>
                    <button
                      onClick={() => setIsChatOpen(false)}
                      className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white"
                      aria-label="Cerrar chat"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div 
                    id="chat-messages"
                    className="flex-1 overflow-y-auto p-4 space-y-4"
                    style={{ scrollBehavior: 'smooth', overscrollBehavior: 'contain' }}
                  >
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full min-h-[200px]">
                        <div className="text-center">
                          <div className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]">
                            <MessageSquare className="w-8 h-8 text-white" />
                          </div>
                          <h3 className="text-lg font-semibold text-white mb-2 font-['Poppins']">
                            ¿Por dónde empezamos?
                          </h3>
                          <p className="text-sm text-white/60">
                            Pregunta sobre tus cursos, tareas o conceptos académicos
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "flex",
                              msg.emisor === 'user' ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <div
                              className={cn(
                                "max-w-[85%] px-4 py-2 rounded-xl text-sm",
                                msg.emisor === 'user'
                                  ? 'bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] text-white rounded-br-sm'
                                  : 'bg-white/10 text-white rounded-bl-sm border border-white/20'
                              )}
                            >
                              <p className="leading-relaxed whitespace-pre-wrap">
                                {msg.contenido}
                              </p>
                            </div>
                          </div>
                        ))}
                        {loading && (
                          <div className="flex justify-start">
                            <div className="bg-white/10 px-4 py-2 rounded-xl rounded-bl-sm border border-white/20 flex items-center gap-2">
                              <Loader2 className="w-4 h-4 animate-spin text-white/70" />
                              <span className="text-sm text-white/70 italic">Escribiendo...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t border-white/10 flex gap-2">
                    <Input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="Escribe tu pregunta..."
                      className="h-10 rounded-lg px-3 text-white placeholder:text-white/40 bg-white/5 border-white/10 text-sm"
                      disabled={loading}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={loading || !input.trim()}
                      className="h-10 w-10 rounded-lg flex-shrink-0 bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] hover:from-[#c66bff] hover:to-[#9f25b8]"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                /* Navigation Panel */
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Chat Button - Prominent - Hidden on chat page and dashboard */}
                  {!isChatPage && !isDashboardPage && (
                  <button
                    onClick={() => {
                      setIsChatOpen(true);
                    }}
                    className={cn(
                      "w-full p-4 rounded-xl",
                      "bg-gradient-to-br from-[#9f25b8] to-[#6a0dad]",
                      "hover:from-[#c66bff] hover:to-[#9f25b8]",
                      "transition-all duration-300 transition-bounce",
                      "flex items-center gap-3",
                      "text-white font-medium text-expressive-subtitle",
                      "shadow-lg shadow-[#9f25b8]/30",
                      "hover:shadow-xl hover:shadow-[#9f25b8]/50",
                      "hover-lift pulse-purple",
                    )}
                  >
                    <MessageSquare className="w-5 h-5 animate-float" />
                    <span>Abrir Chat AI</span>
                  </button>
                  )}

                  {/* Acceso Rápido Button */}
                  <button
                    onClick={handleOpenCommandPalette}
                    className={cn(
                      "w-full p-3 rounded-lg",
                      "bg-white/5 hover:bg-white/10",
                      "border border-white/10 hover:border-white/20",
                      "transition-all duration-300 transition-bounce",
                      "flex items-center gap-3",
                      "group hover-lift",
                    )}
                  >
                    <Command className="w-4 h-4 text-white/70 group-hover:text-[#9f25b8] transition-colors group-hover:scale-110" />
                    <span className="text-sm text-white/80 group-hover:text-white text-expressive-subtitle">Acceso Rápido</span>
                    <span className="ml-auto text-xs text-white/50">⌘K</span>
                  </button>

                  {/* Navigation Items */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider px-2">
                      Navegación
                    </p>
                    {navigationItems
                      .filter(item => item.action !== "chat")
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = location === item.path;
                        return (
                          <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                              <button
                                onClick={() => handleNavClick(item.path, item.action)}
                                className={cn(
                                  "w-full p-3 rounded-lg text-left",
                                  "bg-white/5 hover:bg-white/10",
                                  "border border-white/10 hover:border-white/20",
                                  "transition-all duration-300 transition-bounce",
                                  "flex items-center gap-3",
                                  "group hover-lift",
                                  isActive && "bg-[#9f25b8]/20 border-[#9f25b8]/30 hover-glow"
                                )}
                              >
                                <Icon className={cn(
                                  "w-4 h-4 text-white/70 mt-0.5 transition-all duration-300",
                                  isActive ? "text-[#9f25b8] animate-float" : "group-hover:text-[#9f25b8] group-hover:scale-110"
                                )} />
                                <span className={cn(
                                  "text-sm transition-colors text-expressive-subtitle",
                                  isActive ? "text-white font-medium" : "text-white/80 group-hover:text-white"
                                )}>
                                  {item.label}
                                </span>
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>{item.label}</p>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                  </div>

                  {/* User Info & Logout */}
                  <div className="mt-auto pt-4 border-t border-white/10 space-y-2">
                    <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                      <p className="text-xs text-white/90 font-medium truncate">{user?.nombre}</p>
                      <p className="text-xs text-white/50 truncate">{user?.email}</p>
                      <p className="text-xs text-white/40 mt-1 capitalize">{user?.rol}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className={cn(
                        "w-full p-3 rounded-lg text-left",
                        "bg-red-500/10 hover:bg-red-500/20",
                        "border border-red-500/20 hover:border-red-500/30",
                        "transition-all duration-200",
                        "flex items-center gap-3",
                        "text-red-400 hover:text-red-300",
                      )}
                    >
                      <LogOut className="w-4 h-4" />
                      <span className="text-sm">Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* Collapsed State - 3 Buttons Only */
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setIsExpanded(true)}
                    className={cn(
                      "p-3 rounded-lg",
                      "hover:bg-white/10 transition-colors",
                      "text-white/70 hover:text-white",
                      "group",
                    )}
                    aria-label="Expandir AI Dock"
                  >
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#9f25b8] to-[#6a0dad] flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>AI Dock</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => {
                      if (!isChatPage && !isDashboardPage) {
                        setIsExpanded(true);
                        setIsChatOpen(true);
                      } else if (isChatPage) {
                        // If on chat page, just navigate to it
                        setLocation("/chat");
                      } else {
                        // If on dashboard, just expand (but don't open chat to avoid duplication)
                        setIsExpanded(true);
                      }
                    }}
                    className={cn(
                      "p-3 rounded-lg",
                      "hover:bg-white/10 transition-colors",
                      (isChatPage || isDashboardPage) ? "opacity-50 cursor-not-allowed" : "text-white/70 hover:text-white",
                      "group",
                    )}
                    aria-label={isDashboardPage ? "Chat disponible en el dashboard" : "Abrir Chat"}
                    disabled={isDashboardPage}
                  >
                    <MessageSquare className={cn(
                      "w-5 h-5 transition-colors",
                      (isChatPage || isDashboardPage) ? "text-white/30" : "group-hover:text-[#9f25b8]"
                    )} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>{isDashboardPage ? "Chat disponible en el dashboard" : isChatPage ? "Ya estás en Chat" : "Chat AI"}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleOpenCommandPalette}
                    className={cn(
                      "p-3 rounded-lg",
                      "hover:bg-white/10 transition-colors",
                      "text-white/70 hover:text-white",
                      "group",
                    )}
                    aria-label="Acceso Rápido"
                  >
                    <Command className="w-5 h-5 group-hover:text-[#9f25b8] transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Acceso Rápido (⌘K)</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
