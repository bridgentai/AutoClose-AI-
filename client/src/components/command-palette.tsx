"use client";

import { useEffect, useState, useMemo } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/authContext";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  Home,
  MessageSquare,
  BookOpen,
  Calendar,
  FileText,
  Settings,
  User,
  GraduationCap,
  Users,
  Globe,
  Sparkles,
  Mail,
  UsersRound,
  Clock,
  FolderOpen,
  CheckSquare,
  Award,
  History,
  Send,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CommandItem {
  icon: any;
  label: string;
  path: string;
  shortcut?: string;
  keywords?: string[]; // Palabras clave para búsqueda mejorada
  roles: string[];
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  // Todas las rutas disponibles organizadas por categoría
  const allCommands: { group: string; items: CommandItem[] }[] = [
    {
      group: "Navegación Principal",
      items: [
        { 
          icon: Home, 
          label: "Dashboard", 
          path: "/dashboard", 
          shortcut: "⌘D",
          keywords: ["inicio", "principal", "home"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: MessageSquare, 
          label: "Chat AI", 
          path: "/chat", 
          shortcut: "⌘C",
          keywords: ["ia", "asistente", "chat", "ayuda"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: GraduationCap, 
          label: "Mi Aprendizaje", 
          path: "/mi-aprendizaje",
          keywords: ["aprendizaje", "estudio", "cursos", "materiales", "plataformas"],
          roles: ["estudiante"]
        },
        { 
          icon: Mail, 
          label: "Comunicación", 
          path: "/comunicacion",
          keywords: ["mensajes", "comunicacion", "bandeja", "correo"],
          roles: ["estudiante"]
        },
        { 
          icon: UsersRound, 
          label: "Comunidad", 
          path: "/comunidad",
          keywords: ["comunidad", "eventos", "calendario", "noticias", "avisos"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: BookOpen, 
          label: "Academia", 
          path: "/profesor/academia",
          keywords: ["academia", "profesor", "cursos", "grupos", "tareas"],
          roles: ["profesor"]
        },
        { 
          icon: BookOpen, 
          label: "Cursos", 
          path: "/profesor/academia/cursos",
          keywords: ["cursos", "clases", "grupos", "estudiantes"],
          roles: ["profesor"]
        },
        { 
          icon: Mail, 
          label: "Comunicación Profesor", 
          path: "/profesor/comunicacion",
          keywords: ["comunicacion", "mensajes", "profesor", "bandeja"],
          roles: ["profesor"]
        },
        { 
          icon: Users, 
          label: "Profesores", 
          path: "/directivo",
          keywords: ["profesores", "docentes", "maestros", "directivo"],
          roles: ["directivo"]
        },
        { 
          icon: User, 
          label: "Mi Perfil", 
          path: "/mi-perfil",
          keywords: ["perfil", "cuenta", "personal", "medica", "informacion"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
      ],
    },
    {
      group: "Academia - Profesor",
      items: [
        { 
          icon: BookOpen, 
          label: "Cursos", 
          path: "/profesor/academia/cursos",
          keywords: ["cursos", "grupos", "clases", "estudiantes"],
          roles: ["profesor"]
        },
        { 
          icon: CheckSquare, 
          label: "Tareas", 
          path: "/profesor/academia/tareas",
          keywords: ["tareas", "asignaciones", "ejercicios"],
          roles: ["profesor"]
        },
        { 
          icon: Sparkles, 
          label: "Asignar Tarea", 
          path: "/profesor/academia/tareas/asignar",
          keywords: ["crear", "asignar", "nueva", "tarea"],
          roles: ["profesor"]
        },
        { 
          icon: FolderOpen, 
          label: "Revisar Tareas", 
          path: "/profesor/academia/tareas/revision",
          keywords: ["revisar", "corregir", "evaluar", "tareas"],
          roles: ["profesor"]
        },
        { 
          icon: Calendar, 
          label: "Calendario General", 
          path: "/teacher-calendar",
          keywords: ["calendario", "eventos", "fechas", "agenda", "tareas"],
          roles: ["profesor"]
        },
        { 
          icon: Clock, 
          label: "Resumen de Tareas", 
          path: "/profesor/tareas/resumen",
          keywords: ["resumen", "tareas", "resumen", "listado"],
          roles: ["profesor"]
        },
        { 
          icon: FileText, 
          label: "Materiales", 
          path: "/profesor/academia/materiales",
          keywords: ["materiales", "archivos", "documentos", "recursos"],
          roles: ["profesor"]
        },
        { 
          icon: Globe, 
          label: "Plataformas", 
          path: "/profesor/academia/plataformas",
          keywords: ["plataformas", "herramientas", "recursos", "externos"],
          roles: ["profesor"]
        },
      ],
    },
    {
      group: "Comunicación - Profesor",
      items: [
        { 
          icon: Mail, 
          label: "Bandeja de Entrada", 
          path: "/profesor/comunicacion/bandeja",
          keywords: ["bandeja", "entrada", "mensajes", "recibidos"],
          roles: ["profesor"]
        },
        { 
          icon: MessageSquare, 
          label: "Redactar Mensaje", 
          path: "/profesor/comunicacion/redactar",
          keywords: ["redactar", "enviar", "nuevo", "mensaje"],
          roles: ["profesor"]
        },
        { 
          icon: Send, 
          label: "Mensajes Enviados", 
          path: "/profesor/comunicacion/enviados",
          keywords: ["enviados", "mensajes", "historial"],
          roles: ["profesor"]
        },
      ],
    },
    {
      group: "Módulos Directivo",
      items: [
        { 
          icon: Users, 
          label: "Profesores", 
          path: "/directivo",
          keywords: ["profesores", "docentes", "asignacion", "grupos"],
          roles: ["directivo"]
        },
        { 
          icon: UsersRound, 
          label: "Comunidad", 
          path: "/directivo/comunidad",
          keywords: ["comunidad", "directivo", "eventos"],
          roles: ["directivo"]
        },
        { 
          icon: BookOpen, 
          label: "Academia", 
          path: "/directivo/academia",
          keywords: ["academia", "directivo", "cursos"],
          roles: ["directivo"]
        },
        { 
          icon: Mail, 
          label: "Comunicación", 
          path: "/directivo/comunicacion",
          keywords: ["comunicacion", "directivo", "mensajes"],
          roles: ["directivo"]
        },
      ],
    },
    {
      group: "Acciones Rápidas",
      items: [
        { 
          icon: Sparkles, 
          label: "Asignar Grupos", 
          path: "/group-assignment", 
          shortcut: "⌘T",
          keywords: ["crear", "tarea", "asignacion", "nueva", "grupos"],
          roles: ["profesor", "directivo"]
        },
        { 
          icon: Calendar, 
          label: "Calendario", 
          path: "/calendar",
          keywords: ["calendario", "eventos", "fechas", "agenda"],
          roles: ["directivo", "padre"]
        },
        { 
          icon: FileText, 
          label: "Materiales", 
          path: "/materials",
          keywords: ["materiales", "archivos", "documentos", "recursos"],
          roles: ["profesor"]
        },
        { 
          icon: Globe, 
          label: "Plataformas", 
          path: "/plataformas",
          keywords: ["plataformas", "herramientas", "recursos", "externos"],
          roles: ["profesor", "directivo", "padre"]
        },
        { 
          icon: Settings, 
          label: "Configuración", 
          path: "/settings",
          keywords: ["configuracion", "ajustes", "preferencias", "setup"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: FolderOpen, 
          label: "Mi Aprendizaje - Cursos", 
          path: "/mi-aprendizaje/cursos",
          keywords: ["cursos", "aprendizaje", "materias"],
          roles: ["estudiante"]
        },
        { 
          icon: FileText, 
          label: "Mi Aprendizaje - Materiales", 
          path: "/mi-aprendizaje/materiales",
          keywords: ["materiales", "archivos", "recursos"],
          roles: ["estudiante"]
        },
        { 
          icon: Globe, 
          label: "Mi Aprendizaje - Plataformas", 
          path: "/mi-aprendizaje/plataformas",
          keywords: ["plataformas", "herramientas"],
          roles: ["estudiante"]
        },
        { 
          icon: Calendar, 
          label: "Mi Aprendizaje - Calendario", 
          path: "/mi-aprendizaje/calendario",
          keywords: ["calendario", "eventos"],
          roles: ["estudiante"]
        },
        { 
          icon: GraduationCap, 
          label: "Mi Aprendizaje - Notas", 
          path: "/mi-aprendizaje/notas",
          keywords: ["notas", "calificaciones", "promedios", "rendimiento"],
          roles: ["estudiante"]
        },
        { 
          icon: History, 
          label: "Mi Aprendizaje - Historial de Notas", 
          path: "/mi-aprendizaje/notas/historial",
          keywords: ["historial", "trimestres", "notas", "promedio", "rendimiento"],
          roles: ["estudiante"]
        },
        { 
          icon: CheckSquare, 
          label: "Mi Aprendizaje - Tareas", 
          path: "/mi-aprendizaje/tareas",
          keywords: ["tareas", "asignaciones", "entregas", "pendientes", "completadas"],
          roles: ["estudiante"]
        },
        { 
          icon: User, 
          label: "Mi Perfil - Información Personal", 
          path: "/mi-perfil/personal",
          keywords: ["personal", "informacion", "datos"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: User, 
          label: "Mi Perfil - Ficha Médica", 
          path: "/mi-perfil/medica",
          keywords: ["medica", "salud", "ficha"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: Settings, 
          label: "Mi Perfil - Cuenta", 
          path: "/mi-perfil/cuenta",
          keywords: ["cuenta", "configuracion", "ajustes"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: Calendar, 
          label: "Comunidad - Calendario de Eventos", 
          path: "/comunidad/calendario",
          keywords: ["eventos", "calendario", "comunidad"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
        { 
          icon: Mail, 
          label: "Comunidad - Avisos y Noticias", 
          path: "/comunidad/noticias",
          keywords: ["noticias", "avisos", "comunidad"],
          roles: ["estudiante", "profesor", "directivo", "padre"]
        },
      ],
    },
    {
      group: "Otros Roles",
      items: [
        { 
          icon: Users, 
          label: "Administrador General", 
          path: "/administrador-general",
          keywords: ["administrador", "general"],
          roles: ["directivo"]
        },
        { 
          icon: Users, 
          label: "Transporte", 
          path: "/transporte",
          keywords: ["transporte"],
          roles: ["directivo"]
        },
        { 
          icon: Users, 
          label: "Tesorería", 
          path: "/tesoreria",
          keywords: ["tesoreria", "pagos"],
          roles: ["directivo"]
        },
        { 
          icon: Users, 
          label: "Nutrición", 
          path: "/nutricion",
          keywords: ["nutricion", "alimentacion"],
          roles: ["directivo"]
        },
        { 
          icon: Users, 
          label: "Cafetería", 
          path: "/cafeteria",
          keywords: ["cafeteria", "comida"],
          roles: ["directivo"]
        },
      ],
    },
  ];

  // Filtrar comandos según el rol del usuario
  const filteredCommands = useMemo(() => {
    if (!user?.rol) return [];
    
    return allCommands.map(group => ({
      ...group,
      items: group.items.filter(item => item.roles.includes(user.rol))
    })).filter(group => group.items.length > 0);
  }, [user?.rol]);

  const handleSelect = (path: string) => {
    setLocation(path);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="overflow-hidden p-0 shadow-2xl shadow-black/50 bg-white/5 backdrop-blur-xl border-white/10 max-w-2xl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command 
          className="bg-transparent text-white [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-white/80 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-14 [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
          filter={(value, search) => {
            // Búsqueda mejorada: el value ya incluye label + keywords
            const searchLower = search.toLowerCase();
            const valueLower = value.toLowerCase();
            
            // Buscar coincidencias exactas o parciales
            if (valueLower.includes(searchLower)) return 1;
            
            // Buscar palabras individuales
            const searchWords = searchLower.split(/\s+/).filter(w => w.length > 0);
            const valueWords = valueLower.split(/\s+/);
            
            // Verificar si todas las palabras de búsqueda están presentes
            const allWordsMatch = searchWords.every(sw => 
              valueWords.some(vw => vw.includes(sw) || sw.includes(vw))
            );
            
            return allWordsMatch ? 1 : 0;
          }}
        >
          <CommandInput 
            placeholder="Busca cualquier página o acción... (ej: crear tarea, calendario, perfil)" 
            className="text-white placeholder:text-white/50 border-white/10 bg-white/5 focus:bg-white/10 transition-colors"
            autoFocus
          />
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-xs text-white/60 font-medium">Acceso Rápido</p>
          </div>
          <CommandList className="max-h-[450px] overflow-y-auto">
            <CommandEmpty className="py-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="w-8 h-8 text-white/30 mb-2" />
                <p className="text-sm text-white/50">No se encontraron resultados.</p>
                <p className="text-xs text-white/40">Intenta con otras palabras o usa ⌘K para abrir de nuevo.</p>
              </div>
            </CommandEmpty>
            {filteredCommands.map((group) => (
              <CommandGroup 
                key={group.group} 
                heading={group.group}
              >
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <CommandItem
                      key={item.path}
                      value={`${item.label} ${item.keywords?.join(' ') || ''}`}
                      onSelect={() => handleSelect(item.path)}
                      className="text-white hover:bg-white/10 data-[selected]:bg-[#1e3cff]/30 data-[selected]:text-white cursor-pointer rounded-lg mx-1 transition-all duration-150"
                    >
                      <Icon className="w-4 h-4 text-white/70 data-[selected]:text-[#1e3cff]" />
                      <span className="font-medium">{item.label}</span>
                      {item.shortcut && (
                        <CommandShortcut className="text-white/40 text-xs">
                          {item.shortcut}
                        </CommandShortcut>
                      )}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Hook para manejar el atajo de teclado
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K para abrir/cerrar
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // Escape para cerrar
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open]);

  return { open, setOpen };
}
