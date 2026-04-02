"use client";

import { forwardRef, useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/authContext";
import { useQuery } from "@tanstack/react-query";
import {
  MessageSquare,
  Sparkles,
  X,
  Home,
  BookOpen,
  GraduationCap,
  Users,
  Globe,
  User,
  LogOut,
  Command,
  Send,
  Loader2,
  Mail,
  FileCheck,
  Bell,
  Cloud,
  Building2,
  ChevronRight,
  Inbox,
  Megaphone,
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
  type?: string;
  structuredData?: Record<string, unknown>;
}

interface AIDockProps {
  onOpenCommandPalette?: () => void;
  onChatStateChange?: (isOpen: boolean, isExpanded: boolean) => void;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.replace("#", "").trim();
  const full = normalized.length === 3
    ? normalized.split("").map((c) => c + c).join("")
    : normalized;

  if (full.length !== 6) return null;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbaFromHex(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(255,255,255,${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Ruta activa en el dock: igual o subruta (p. ej. /mi-aprendizaje/cursos). */
function dockPathActive(currentLocation: string, itemPath: string): boolean {
  const path = (currentLocation.split('?')[0] ?? '/').replace(/\/$/, '') || '/';
  const target = (itemPath.split('?')[0] ?? '/').replace(/\/$/, '') || '/';
  if (path === target) return true;
  if (target === '/dashboard' && (path === '/' || path === '')) return true;
  if (target.length > 1 && path.startsWith(`${target}/`)) return true;
  return false;
}

function isParentAprendizajeSection(loc: string): boolean {
  const p = loc.split('?')[0] ?? '';
  const roots = [
    '/parent/aprendizaje',
    '/parent/notas',
    '/parent/materias',
    '/parent/materiales',
    '/parent/cursos',
    '/parent/horario',
    '/parent/calendario',
    '/parent/tareas',
  ];
  for (const r of roots) {
    if (p === r || p.startsWith(`${r}/`)) return true;
  }
  return p.startsWith('/parent/analytics/');
}

/** Texto contextual bajo «AI Dock» */
function getDockLocationLabel(location: string): string {
  const p = (location.split('?')[0] ?? '/').replace(/\/$/, '') || '/';
  const rules: Array<{ match: (s: string) => boolean; label: string }> = [
    { match: (s) => s === '/dashboard' || s === '' || s === '/', label: 'Dashboard' },
    { match: (s) => s.startsWith('/chat'), label: 'Chat AI' },
    { match: (s) => s.startsWith('/permisos'), label: 'Permisos de salida' },
    { match: (s) => s.startsWith('/evo-drive'), label: 'Evo Drive' },
    { match: (s) => s.startsWith('/evo-send'), label: 'Evo Send' },
    { match: (s) => s.startsWith('/notificaciones'), label: 'Notificaciones' },
    { match: (s) => s.startsWith('/comunicacion/academico'), label: 'Academia (comunicación)' },
    { match: (s) => s.startsWith('/comunidad/noticias') || s.startsWith('/comunidad'), label: 'GLC' },
    { match: (s) => isParentAprendizajeSection(s), label: 'Aprendizaje del hijo/a' },
    { match: (s) => s.startsWith('/mi-aprendizaje'), label: 'Mi Aprendizaje' },
    { match: (s) => s.startsWith('/profesor/academia'), label: 'Academia' },
    { match: (s) => s.startsWith('/profesor/comunicacion'), label: 'Comunicación' },
    { match: (s) => s.startsWith('/directivo/academia'), label: 'Academia' },
    { match: (s) => s.startsWith('/directivo/comunicacion'), label: 'Comunicación' },
    { match: (s) => s.startsWith('/comunicacion'), label: 'Comunicación' },
    { match: (s) => s.startsWith('/calendar') || s.startsWith('/teacher-calendar'), label: 'Calendario' },
    { match: (s) => s.startsWith('/plataformas'), label: 'Plataformas' },
    { match: (s) => s.startsWith('/mi-perfil'), label: 'Mi perfil' },
    { match: (s) => s.startsWith('/materials'), label: 'Materiales' },
    { match: (s) => s.startsWith('/courses'), label: 'Cursos' },
  ];
  for (const r of rules) {
    if (r.match(p)) return r.label;
  }
  if (p.startsWith('/course') || p.startsWith('/assignment')) return 'Curso o tarea';
  return 'Navegando';
}

type DockCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  accentHex: string;
  onClick: () => void;
  rightSlot?: React.ReactNode;
  isActive?: boolean;
  /** Atajo (paleta compacta, no módulo principal) */
  compact?: boolean;
  /** Halo animado en borde — Chat AI */
  chatAiGlow?: boolean;
  /** Sustituye el fondo del icono (p. ej. gradiente marca Evo Send). */
  iconShellClassName?: string;
};

const DockCard = forwardRef<HTMLButtonElement, DockCardProps>(function DockCard(
  {
    icon: Icon,
    title,
    description,
    accentHex,
    onClick,
    rightSlot,
    isActive,
    compact,
    chatAiGlow,
    iconShellClassName,
  }: DockCardProps,
  ref
) {
  const bg = rgbaFromHex(accentHex, compact ? 0.06 : 0.08);
  const border = rgbaFromHex(accentHex, compact ? 0.12 : 0.15);
  const activeRing = rgbaFromHex('#ffd700', compact ? 0.55 : 0.62);
  const fillActive = rgbaFromHex(accentHex, compact ? 0.11 : 0.15);
  const useGradientShell = Boolean(iconShellClassName);

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        "w-full text-left",
        "transition-all duration-300 transition-bounce",
        "flex items-center justify-between",
        "shadow-sm shadow-black/20 hover:shadow-md",
        "group hover-lift",
        compact
          ? "rounded-lg px-2.5 py-2 gap-2 min-h-0"
          : "rounded-xl p-3 gap-3 min-h-[74px]",
        chatAiGlow && !isActive && "ai-dock-chat-card",
        isActive && "ai-dock-card-current",
      )}
      style={{
        background: isActive ? fillActive : bg,
        border: isActive ? `2px solid ${activeRing}` : `1px solid ${border}`,
        boxSizing: 'border-box',
      }}
    >
      <div className={cn("flex items-center min-w-0", compact ? "gap-2" : "gap-3")}>
        <div
          className={cn(
            "rounded-lg flex items-center justify-center shrink-0",
            !useGradientShell && "shadow-inner border border-white/10",
            compact ? "h-7 w-7" : "h-9 w-9",
            iconShellClassName,
          )}
          style={
            useGradientShell
              ? undefined
              : { background: rgbaFromHex(accentHex, compact ? 0.14 : 0.22) }
          }
        >
          <Icon className={cn("text-white", compact ? "w-3.5 h-3.5" : "w-4 h-4")} />
        </div>
        <div className="min-w-0">
          <p
            className={cn(
              "font-semibold text-white font-['Poppins'] truncate",
              compact ? "text-xs" : "text-sm",
            )}
          >
            {title}
          </p>
          <p
            className={cn(
              "leading-snug truncate",
              compact ? "text-[10px] text-white/45" : "text-[11px] text-white/60",
            )}
          >
            {description}
          </p>
        </div>
      </div>
      {rightSlot ? (
        <div className="flex-shrink-0">{rightSlot}</div>
      ) : (
        <ChevronRight
          className={cn(
            "text-white/40 group-hover:text-[#ffd700] transition-colors flex-shrink-0",
            compact ? "w-3 h-3" : "w-4 h-4",
          )}
        />
      )}
    </button>
  );
});

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
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

  const isChatPage = location === "/chat";
  const isDashboardPage = location === "/dashboard";

  // No auto-open chat when on /chat route (to avoid duplication with full page)
  // The chat panel should only open when explicitly clicked from the dock
  // Also disable chat on dashboard to avoid duplication with AIChatBox

  // Navigation items based on role
  const getNavigationItems = () => {
    // Vista directivo: Dashboard, Comunicación, Academia, Evo Drive
    if (user?.rol === "directivo") {
      return [
        { icon: Home, label: "Dashboard", description: "Resumen y métricas del colegio", path: "/dashboard", roles: ["directivo"], accentHex: "#1e3cff" },
        { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["directivo"], action: "chat" },
        { icon: Mail, label: "Comunicación", description: "Mensajes, anuncios y novedades", path: "/directivo/comunicacion", roles: ["directivo"], accentHex: "#1e3cff" },
        { icon: BookOpen, label: "Academia", description: "Cursos, planes y gestión académica", path: "/directivo/academia", roles: ["directivo"], accentHex: "#1e3cff" },
        { icon: Cloud, label: "Evo Drive", description: "Acceder al drive de la plataforma", path: "/evo-drive", roles: ["directivo"], accentHex: "#00c8ff" },
      ];
    }

    const baseItems = [
      {
        icon: Home,
        label: "Dashboard",
        description: "Resumen de tu actividad y accesos",
        path: "/dashboard",
        roles: [
          "estudiante",
          "profesor",
          "directivo",
          "padre",
          "administrador-general",
          "admin-general-colegio",
          "school_admin",
          "super_admin",
        ],
        accentHex: "#1e3cff",
      },
      { icon: MessageSquare, label: "Chat AI", path: "/chat", roles: ["estudiante", "profesor", "directivo", "padre"], action: "chat" },
      { icon: GraduationCap, label: "Mi Aprendizaje", description: "Cursos, tareas, notas y materiales", path: "/mi-aprendizaje", roles: ["estudiante"], accentHex: "#1e3cff" },
      {
        icon: Send,
        label: "Evo Send",
        description: "Chat con tus acudientes y con tus cursos",
        path: "/evo-send?open=family",
        roles: ["estudiante"],
        accentHex: "#f43f5e",
        iconShellClassName:
          "bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30 border-0",
      },
      {
        icon: Send,
        label: "Evo Send",
        description: "Mensajería con acudientes y cursos",
        path: "/evo-send",
        roles: ["profesor"],
        accentHex: "#f43f5e",
        iconShellClassName:
          "bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30 border-0",
      },
      {
        icon: Cloud,
        label: "Evo Drive",
        description: "Acceder al drive de la plataforma",
        path: "/evo-drive",
        roles: [
          "estudiante",
          "profesor",
          "administrador-general",
          "admin-general-colegio",
          "school_admin",
          "super_admin",
        ],
        accentHex: "#00c8ff",
      },
      { icon: BookOpen, label: "Academia", description: "Planeación, cursos y recursos", path: "/profesor/academia", roles: ["profesor"], accentHex: "#1e3cff" },
      { icon: Mail, label: "Comunicación", description: "Mensajes y comunicados", path: "/comunicacion", roles: ["profesor"], accentHex: "#1e3cff" },
      { icon: FileCheck, label: "Permisos", description: "Solicitudes y autorizaciones", path: "/permisos", roles: ["padre"], accentHex: "#1e3cff" },
      {
        icon: Send,
        label: "Evo Send",
        description: "Chat familiar con tu hijo o hija vinculado",
        path: "/evo-send?open=family",
        roles: ["padre"],
        accentHex: "#f43f5e",
        iconShellClassName:
          "bg-gradient-to-br from-red-500 via-red-600 to-rose-500 shadow-md shadow-red-500/30 border-0",
      },
    ];

    return baseItems.filter(item => item.roles.includes(user?.rol || ""));
  };

  const navigationItems = getNavigationItems();

  /** Padre: Dashboard y Permisos arriba (mismo orden siempre). */
  const padreDockPrimary = useMemo(() => {
    if (user?.rol !== 'padre') return [];
    const paths = ['/dashboard', '/permisos'] as const;
    return paths
      .map((path) => navigationItems.find((i) => i.path === path))
      .filter((i): i is (typeof navigationItems)[number] => i != null);
  }, [user?.rol, navigationItems]);

  /** Padre: lista «Navegación» sin duplicar Dashboard/Permisos. */
  const dockNavigationItems = useMemo(() => {
    const noChat = navigationItems.filter((item) => item.action !== 'chat');
    if (user?.rol !== 'padre') return noChat;
    const skip = new Set(['/dashboard', '/permisos']);
    return noChat.filter((i) => !skip.has(i.path));
  }, [user?.rol, navigationItems]);

  const { data: notifData } = useQuery<{ unreadCount: number }>({
    queryKey: ['notifications-unread'],
    queryFn: async () => {
      const r = await apiRequest<{ list: unknown[]; unreadCount: number }>('GET', '/api/notifications');
      return { unreadCount: r.unreadCount ?? 0 };
    },
    enabled: !!user && (user.rol === 'estudiante' || user.rol === 'padre' || user.rol === 'profesor' || user.rol === 'directivo'),
  });
  const unreadNotifCount = notifData?.unreadCount ?? 0;

  const { data: dockComSummary } = useQuery<{
    academico?: { mensajesSinLeer?: number };
    institucional?: { mensajesSinLeer?: number; ultimoPublicado?: string | null };
  }>({
    queryKey: ["communication-summary"],
    queryFn: async () => apiRequest("GET", "/api/courses/communication-summary"),
    enabled: !!user && (user.rol === "padre" || user.rol === "estudiante"),
    staleTime: 60 * 1000,
  });
  const academiaUnread = dockComSummary?.academico?.mensajesSinLeer ?? 0;
  const glcUnread = dockComSummary?.institucional?.mensajesSinLeer ?? 0;

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

  const isKiwiConfirmPayload = (text: string) => typeof text === 'string' && text.startsWith('__CONFIRM__:');

  const parseKiwiConfirmPayload = (text: string): Record<string, unknown> | null => {
    if (!isKiwiConfirmPayload(text)) return null;
    const raw = text.slice('__CONFIRM__:'.length).trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
      return null;
    } catch {
      return null;
    }
  };

  type ParsedCourseItem = { subject: string; group: string };
  const parseTeacherCoursesFromText = (text: string): ParsedCourseItem[] | null => {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    if (!t.toLowerCase().includes('tus cursos activos')) return null;

    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    const items: ParsedCourseItem[] = [];
    for (const line of lines) {
      const m = line.match(/^\d+\.\s*(?:\*\*)?(.+?)(?:\*\*)?\s*-\s*([A-Za-z0-9]+)\s*$/);
      if (!m) continue;
      const subject = m[1].trim();
      const group = m[2].trim().toUpperCase();
      if (!subject || !group) continue;
      items.push({ subject, group });
    }
    return items.length > 0 ? items : null;
  };

  type ParsedSubjectGroups = { subject: string; groups: string[] };
  const parseSubjectGroupsFromText = (text: string): ParsedSubjectGroups | null => {
    if (typeof text !== 'string') return null;
    const t = text.trim();
    const m = t.match(/tienes\s+asignados\s+los\s+siguientes\s+grupos\s+de\s+(.+?)\s*:/i);
    if (!m) return null;
    const subject = (m[1] ?? '').trim();
    if (!subject) return null;
    const groupMatches = [...t.matchAll(/\b(\d{1,2}[A-Za-z])\b/g)]
      .map((x) => (x[1] ?? '').toUpperCase())
      .filter(Boolean);
    const groups = Array.from(new Set(groupMatches));
    return groups.length > 0 ? { subject, groups } : null;
  };

  const handleSend = async () => {
    if (!input.trim() || loading || isStreaming) return;

    const userMessage: Message = {
      emisor: 'user',
      contenido: input,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    // Placeholder vacío para el streaming
    setMessages(prev => [...prev, { emisor: 'ai', contenido: '', timestamp: new Date() }]);

    try {
      const token = localStorage.getItem('autoclose_token');
      const res = await fetch('/api/kiwi/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: currentInput,
          ...(currentSessionId ? { sessionId: currentSessionId } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        let errMsg = 'Error al conectar con Kiwi';
        try { const b = await res.json(); errMsg = b.error || errMsg; } catch { /* ignore */ }
        setMessages(prev => {
          const next = [...prev];
          next[next.length - 1] = { emisor: 'ai', contenido: errMsg, timestamp: new Date() };
          return next;
        });
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      setLoading(false);
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
          try { parsed = JSON.parse(raw); } catch { continue; }

          if (parsed.type === 'chunk' && parsed.text) {
            const chunk = parsed.text;

            // Confirmación estructurada: reemplaza el placeholder por una card
            if (isKiwiConfirmPayload(chunk)) {
              const payload = parseKiwiConfirmPayload(chunk);
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
              setIsStreaming(false);
              setTimeout(() => scrollToBottom(), 50);
              continue;
            }
            setMessages(prev => {
              const next = [...prev];
              const last = next[next.length - 1];
              if (last?.emisor === 'ai') {
                next[next.length - 1] = { ...last, contenido: last.contenido + chunk };
              }
              return next;
            });
            setTimeout(() => scrollToBottom(), 50);
          } else if (parsed.type === 'done') {
            if (parsed.sessionId) setCurrentSessionId(parsed.sessionId);
            setIsStreaming(false);
            setTimeout(() => scrollToBottom(), 150);
          } else if (parsed.type === 'error') {
            setMessages(prev => {
              const next = [...prev];
              next[next.length - 1] = { emisor: 'ai', contenido: parsed.message ?? 'Ocurrió un error.', timestamp: new Date() };
              return next;
            });
            setIsStreaming(false);
          }
        }
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Lo siento, ocurrió un error al procesar tu mensaje.';
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { emisor: 'ai', contenido: errMsg, timestamp: new Date() };
        return next;
      });
      setTimeout(() => scrollToBottom(), 150);
    } finally {
      setLoading(false);
      setIsStreaming(false);
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
            "relative",
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
          <div className="flex items-center justify-between p-4 border-b border-white/10 gap-2">
            {isExpanded && (
              <div className="flex items-start gap-2 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner border border-white/10"
                  style={{ background: rgbaFromHex('#1e3cff', 0.22) }}
                >
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <div className="flex flex-col min-w-0 gap-0.5">
                  <span className="text-sm font-medium text-white font-['Poppins'] leading-tight">AI Dock</span>
                  <span
                    className="text-[10px] font-medium text-white/85 font-['Poppins'] truncate pl-2 border-l-2 border-[#ffd700] ai-dock-header-loc"
                    title={getDockLocationLabel(location)}
                  >
                    {getDockLocationLabel(location)}
                  </span>
                </div>
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
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shadow-inner border border-white/10"
                        style={{ background: rgbaFromHex('#1e3cff', 0.22) }}
                      >
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
                          <div
                            className="w-16 h-16 rounded-xl mx-auto mb-4 flex items-center justify-center shadow-inner border border-white/10"
                            style={{ background: rgbaFromHex('#1e3cff', 0.22) }}
                          >
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
                            {msg.emisor === 'ai' && msg.type === 'kiwi_confirm' && msg.structuredData ? (
                              <div className="max-w-[92%] w-full bg-white/10 text-white rounded-xl rounded-bl-sm border border-white/20 p-3">
                                <div className="text-xs text-white/60">Confirmación requerida</div>
                                <div className="text-sm font-semibold text-white mt-1">Crear tarea</div>
                                <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3">
                                  <div className="text-[11px] text-white/60">Título</div>
                                  <div className="text-sm text-white mt-0.5">
                                    {String((msg.structuredData as any)?.params?.title ?? '')}
                                  </div>
                                  <div className="text-[11px] text-white/60 mt-2">Entrega</div>
                                  <div className="text-sm text-white mt-0.5">
                                    {String((msg.structuredData as any)?.params?.dueDate ?? '')}
                                  </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    className="h-8 border-white/20 text-white/80 hover:text-white hover:bg-white/10"
                                    onClick={() => {
                                      const payload = msg.structuredData ?? {};
                                      setInput(`KIWI_CONFIRM ${JSON.stringify(payload)}`);
                                    }}
                                  >
                                    Editar
                                  </Button>
                                  <Button
                                    className="h-8 bg-gradient-to-br from-[#1e3cff] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1e3cff] border border-white/10"
                                    onClick={() => {
                                      const payload = msg.structuredData ?? {};
                                      setInput(`KIWI_CONFIRM ${JSON.stringify(payload)}`);
                                      setTimeout(() => handleSend(), 0);
                                    }}
                                  >
                                    Confirmar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "max-w-[85%] px-4 py-2 rounded-xl text-sm",
                                  msg.emisor === 'user'
                                    ? 'text-white rounded-br-sm border border-white/10 shadow-sm bg-gradient-to-br from-[#1e3cff] to-[#1D4ED8]'
                                    : 'bg-white/10 text-white rounded-bl-sm border border-white/20'
                                )}
                              >
                                {msg.emisor === 'ai' && parseTeacherCoursesFromText(msg.contenido) ? (
                                  <div className="space-y-3">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10"
                                        style={{
                                          background:
                                            'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
                                        }}
                                      >
                                        <BookOpen className="w-4 h-4 text-[#00c8ff]" />
                                      </div>
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-white">Tus cursos activos</div>
                                        <div className="text-[11px] text-white/60">Toca uno para empezar una tarea.</div>
                                      </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2">
                                      {parseTeacherCoursesFromText(msg.contenido)!.slice(0, 16).map((c, i) => (
                                        <button
                                          key={`${c.subject}-${c.group}-${i}`}
                                          type="button"
                                          onClick={() => setInput(`Asignar una tarea para ${c.group} de ${c.subject}.`)}
                                          className="text-left rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-2"
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-white truncate">{c.subject}</div>
                                              <div className="text-[11px] text-white/60 flex items-center gap-1.5 mt-0.5">
                                                <Users className="w-3.5 h-3.5 text-white/55" />
                                                <span className="truncate">{c.group}</span>
                                              </div>
                                            </div>
                                            <span
                                              className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                              style={{
                                                background: 'rgba(0,200,255,0.14)',
                                                border: '1px solid rgba(0,200,255,0.28)',
                                                color: 'rgba(125,211,252,0.95)',
                                              }}
                                            >
                                              {c.group}
                                            </span>
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ) : msg.emisor === 'ai' && parseSubjectGroupsFromText(msg.contenido) ? (
                                  <div className="space-y-3">
                                    {(() => {
                                      const parsed = parseSubjectGroupsFromText(msg.contenido)!;
                                      return (
                                        <>
                                          <div className="flex items-center gap-2">
                                            <div
                                              className="w-8 h-8 rounded-lg flex items-center justify-center border border-white/10"
                                              style={{
                                                background:
                                                  'linear-gradient(145deg, rgba(30,58,138,0.35), rgba(15,23,42,0.6))',
                                              }}
                                            >
                                              <BookOpen className="w-4 h-4 text-[#00c8ff]" />
                                            </div>
                                            <div className="min-w-0">
                                              <div className="text-sm font-semibold text-white truncate">{parsed.subject}</div>
                                              <div className="text-[11px] text-white/60">Grupos asignados ({parsed.groups.length})</div>
                                            </div>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {parsed.groups.slice(0, 20).map((g) => (
                                              <button
                                                key={g}
                                                type="button"
                                                onClick={() => setInput(`Asignar una tarea para ${g} de ${parsed.subject}.`)}
                                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors px-3 py-1.5"
                                              >
                                                <Users className="w-4 h-4 text-white/60" />
                                                <span className="text-sm text-white font-medium">{g}</span>
                                              </button>
                                            ))}
                                          </div>
                                        </>
                                      );
                                    })()}
                                  </div>
                                ) : (
                                  <p className="leading-relaxed whitespace-pre-wrap">
                                    {msg.contenido}
                                  </p>
                                )}
                              </div>
                            )}
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
                      disabled={loading || isStreaming}
                    />
                    <Button
                      onClick={handleSend}
                      disabled={loading || isStreaming || !input.trim()}
                      className="h-10 w-10 rounded-lg flex-shrink-0 bg-gradient-to-br from-[#1e3cff] to-[#1D4ED8] hover:from-[#2563EB] hover:to-[#1e3cff] border border-white/10"
                    >
                      {(loading || isStreaming) ? (
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
                  {/* Chat Button - Hidden on chat page and dashboard */}
                  {!isChatPage && !isDashboardPage && (
                    <DockCard
                      icon={MessageSquare}
                      title="Chat AI"
                      description="Preguntas, tareas y automatizaciones"
                      accentHex="#1e3cff"
                      chatAiGlow
                      onClick={() => setIsChatOpen(true)}
                    />
                  )}

                  {/* Atajo: más compacto y tono neutro (no módulo) */}
                  <DockCard
                    compact
                    icon={Command}
                    title="Acceso Rápido"
                    description="Atajos de teclado"
                    accentHex="#64748b"
                    onClick={handleOpenCommandPalette}
                    rightSlot={<span className="text-[10px] text-white/45 tabular-nums">⌘K</span>}
                  />

                  {user?.rol === 'padre' &&
                    padreDockPrimary.map((item) => {
                      const Icon = item.icon;
                      const isActive = dockPathActive(location, item.path);
                      return (
                        <Tooltip key={item.path}>
                          <TooltipTrigger asChild>
                            <DockCard
                              icon={Icon}
                              title={item.label}
                              description={
                                'description' in item && typeof item.description === 'string'
                                  ? item.description
                                  : 'Acceso directo'
                              }
                              accentHex={
                                'accentHex' in item && typeof item.accentHex === 'string'
                                  ? item.accentHex
                                  : '#1e3cff'
                              }
                              isActive={isActive}
                              onClick={() => handleNavClick(item.path, item.action)}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            <p>{item.label}</p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}

                  {user?.rol === 'estudiante' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider px-2">
                        Institución
                      </p>
                      <DockCard
                        icon={Building2}
                        title="GLC"
                        description="Circulares y comunicados institucionales"
                        accentHex="#1e3cff"
                        isActive={dockPathActive(location, '/comunidad/noticias')}
                        onClick={() => setLocation('/comunidad/noticias')}
                        rightSlot={
                          glcUnread > 0 ? (
                            <span
                              className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#fde047]"
                              style={{
                                background: rgbaFromHex('#ffd700', 0.16),
                                border: `1px solid ${rgbaFromHex('#ffd700', 0.35)}`,
                              }}
                            >
                              {glcUnread > 99 ? '99+' : glcUnread}
                            </span>
                          ) : (
                            <Megaphone className="w-4 h-4 text-white/35 group-hover:text-[#ffd700] transition-colors" />
                          )
                        }
                      />
                    </div>
                  )}

                  {user?.rol === 'padre' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider px-2">
                        Aprendizaje
                      </p>
                      <DockCard
                        icon={BookOpen}
                        title="Aprendizaje"
                        description="Cursos, notas, tareas, materiales, horario y calendario"
                        accentHex="#1e3cff"
                        isActive={isParentAprendizajeSection(location)}
                        onClick={() => setLocation('/parent/aprendizaje')}
                      />
                    </div>
                  )}

                  {user?.rol === 'padre' && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-white/50 uppercase tracking-wider px-2">
                        Comunicación
                      </p>
                      <div className="grid grid-cols-1 gap-2">
                        <DockCard
                          icon={GraduationCap}
                          title="Academia"
                          description="Comunicados de tus docentes y avisos del aula"
                          accentHex="#1e3cff"
                          isActive={dockPathActive(location, '/comunicacion/academico')}
                          onClick={() => setLocation('/comunicacion/academico')}
                          rightSlot={
                            academiaUnread > 0 ? (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#7dd3fc]"
                                style={{
                                  background: rgbaFromHex('#00c8ff', 0.18),
                                  border: `1px solid ${rgbaFromHex('#00c8ff', 0.35)}`,
                                }}
                              >
                                {academiaUnread > 99 ? '99+' : academiaUnread}
                              </span>
                            ) : (
                              <Inbox className="w-4 h-4 text-white/35 group-hover:text-[#00c8ff] transition-colors" />
                            )
                          }
                        />

                        <DockCard
                          icon={Building2}
                          title="GLC"
                          description="Circulares y comunicados institucionales"
                          accentHex="#1e3cff"
                          isActive={dockPathActive(location, '/comunidad/noticias')}
                          onClick={() => setLocation('/comunidad/noticias')}
                          rightSlot={
                            glcUnread > 0 ? (
                              <span
                                className="text-[10px] font-semibold px-2 py-0.5 rounded-full text-[#fde047]"
                                style={{
                                  background: rgbaFromHex('#ffd700', 0.16),
                                  border: `1px solid ${rgbaFromHex('#ffd700', 0.35)}`,
                                }}
                              >
                                {glcUnread > 99 ? '99+' : glcUnread}
                              </span>
                            ) : (
                              <Megaphone className="w-4 h-4 text-white/35 group-hover:text-[#ffd700] transition-colors" />
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* Navigation Items */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-white/50 uppercase tracking-wider px-2">
                      Navegación
                    </p>
                    {dockNavigationItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = dockPathActive(location, item.path);
                      return (
                        <Tooltip key={item.path}>
                          <TooltipTrigger asChild>
                            <DockCard
                              icon={Icon}
                              title={item.label}
                              description={
                                'description' in item && typeof item.description === 'string'
                                  ? item.description
                                  : 'Acceso directo'
                              }
                              accentHex={
                                'accentHex' in item && typeof item.accentHex === 'string'
                                  ? item.accentHex
                                  : '#1e3cff'
                              }
                              isActive={isActive}
                              onClick={() => handleNavClick(item.path, item.action)}
                              iconShellClassName={
                                'iconShellClassName' in item &&
                                  typeof (item as { iconShellClassName?: string }).iconShellClassName ===
                                  'string'
                                  ? (item as { iconShellClassName: string }).iconShellClassName
                                  : undefined
                              }
                            />
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
            /* Collapsed State - Sparkles, Chat, Command */
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
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-inner border border-white/10"
                      style={{ background: rgbaFromHex('#1e3cff', 0.22) }}
                    >
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
                        setLocation("/chat");
                      } else {
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
                      (isChatPage || isDashboardPage) ? "text-white/30" : "group-hover:text-[#ffd700]"
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
                    <Command className="w-5 h-5 group-hover:text-[#ffd700] transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Acceso Rápido (⌘K)</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLocation("/notificaciones")}
                    className={cn(
                      "relative p-2.5 rounded-full",
                      "hover:bg-white/10 transition-colors",
                      "text-white/70 hover:text-white",
                      "group",
                    )}
                    aria-label="Notificaciones"
                  >
                    <Bell className="w-5 h-5 group-hover:text-[#ffd700] transition-colors" />
                    {unreadNotifCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#1e3cff] px-1 text-[10px] font-medium text-white">
                        {unreadNotifCount > 99 ? "99+" : unreadNotifCount}
                      </span>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Notificaciones</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLocation("/mi-perfil")}
                    className={cn(
                      "p-2.5 rounded-full",
                      "hover:bg-white/10 transition-colors",
                      "text-white/70 hover:text-white",
                      "group",
                    )}
                    aria-label="Mi Perfil"
                  >
                    <User className="w-5 h-5 group-hover:text-[#ffd700] transition-colors" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Mi Perfil</p>
                </TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
