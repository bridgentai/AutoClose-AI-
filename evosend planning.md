# EvoSend 2.0 — Planning

## Idea y arquitectura
[Contexto del proyecto:
Estamos desarrollando EvoSend 2.0, el módulo central de comunicación del LMS 
"Evo". El objetivo es que EvoSend sea el único canal de comunicación dentro 
de la plataforma, reemplazando correos internos, grupos externos de WhatsApp 
y comunicados impresos. La arquitectura debe sentirse tan natural como 
WhatsApp pero con la estructura y formalidad que una institución educativa 
necesita.

---

Arquitectura general de EvoSend 2.0:

EvoSend tiene un INBOX UNIFICADO con dos capas diferenciadas automáticamente:

1. EVOSEND ACADÉMICO
   - Grupos de chat por materia/curso (los que ya existen)
   - Mensajes directos estudiante → profesor, profesor → estudiante
   - Tono conversacional, burbujas de chat
   - Notificaciones estándar

2. EVOSEND INSTITUCIONAL
   - Comunicados de coordinadores y directivos
   - Circulares masivas a múltiples grupos
   - Acuse de lectura obligatorio ("Visto" / "Confirmado")
   - Se diferencia visualmente del académico (color, icono, header)
   - Queda en un tablón consultable de circulares

La diferenciación entre Académico e Institucional es AUTOMÁTICA según el 
rol del emisor y el contexto, no manual del usuario.

---

Componentes a desarrollar:

A) INBOX PRINCIPAL
   - Vista unificada de todos los mensajes con tabs o separación visual 
     clara entre Académico e Institucional
   - Badge de no leídos separado por categoría
   - Barra de búsqueda global en la parte superior

B) DIRECTORIO / PEOPLE FINDER
   - Buscador de miembros de la comunidad integrado al top del inbox
   - Resultados muestran: nombre, rol, materia/cargo asignado
   - Permisos por rol:
     * Estudiante → puede escribir solo a sus profesores y coordinadores 
       asignados, NO a otros estudiantes
     * Docente → puede escribir a colegas, directivos y sus estudiantes
     * Directivo/Coordinador → acceso total
     * Padre/Acudiente → solo profesores de sus hijos y coordinación
   - Al seleccionar un contacto, abre el chat o crea uno nuevo si no existe

C) MODOS DE COMPOSICIÓN DE MENSAJE
   Al crear un nuevo mensaje o dentro de un chat, el emisor puede elegir 
   el modo (según su rol):

   - MODO CONVERSACIÓN: burbuja simple, sin asunto, respuesta rápida. 
     Default para chats académicos.
   
   - MODO COMUNICADO: tiene campo de asunto, editor con formato básico 
     (negrita, listas, adjuntos), genera notificación prominente, 
     muestra estado de lectura al emisor. Disponible para docentes y 
     directivos.
   
   - MODO CIRCULAR: solo para coordinadores y directivos. Permite 
     seleccionar múltiples destinatarios o grupos completos. El mensaje 
     queda publicado en el tablón de circulares institucionales además 
     de llegar al inbox de cada destinatario.

D) CONTEXTO AUTOMÁTICO
   Cuando un usuario inicia un chat desde dentro de una actividad, tarea 
   o módulo del LMS, EvoSend debe precarga el contexto en el mensaje:
   "Escribiendo sobre: [Nombre de la actividad]". 
   Esto permite al receptor entender inmediatamente el motivo sin 
   preguntar.

E) FUNCIONALIDADES CLAVE PARA SER EL CANAL ÚNICO
   - Notificaciones push en móvil y escritorio
   - Respuesta rápida desde la notificación sin abrir el LMS
   - Historial permanente y buscable de todos los mensajes
   - Vista previa de archivos adjuntos (PDF, imágenes) dentro del chat
   - Estado de lectura visible para el emisor
   - Opción de silenciar grupos por período de tiempo
   - Mensajes fijados dentro de grupos (para anuncios importantes)

---

Stack y consideraciones técnicas:
[Aquí el desarrollador debe completar con el stack actual de Evo]

Lo que NO debe hacer este módulo:
- No debe redirigir a correo externo en ningún flujo
- No debe permitir que estudiantes se comuniquen entre sí fuera de 
  contextos grupales supervisados
- No debe requerir más de 2 clics para enviar un mensaje a alguien

El resultado debe sentirse como una sola aplicación coherente, no como 
dos módulos pegados. La experiencia de usuario debe ser tan fluida como 
WhatsApp Web pero con la estructura de comunicación que una institución 
educativa necesita.]

## Componente de referencia visual
["use client"

import { useState, useEffect } from "react"

// Icons as inline SVG components
const StarIcon = ({ active = false }: { active?: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={active ? "#3B82F6" : "none"} stroke="currentColor" strokeWidth="2">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
)

const ChatIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const CommandIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
  </svg>
)

const BellIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const UserIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const SearchIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
)

const PinIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="17" x2="12" y2="22" />
    <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
  </svg>
)

const MoreIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1" />
    <circle cx="19" cy="12" r="1" />
    <circle cx="5" cy="12" r="1" />
  </svg>
)

const AttachIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
  </svg>
)

const ReminderIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const SendIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
    <line x1="16" x2="16" y1="2" y2="6" />
    <line x1="8" x2="8" y1="2" y2="6" />
    <line x1="3" x2="21" y1="10" y2="10" />
  </svg>
)

const BellOutlineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

// Conversation data
const academicConversations = [
  { id: 1, name: "Biología", lastMessage: "Quiz de genética 1", time: "22:38", unread: 0, icon: "🧬" },
  { id: 2, name: "Filosofía, Religiones del Mundo", lastMessage: "quiz religiones", time: "22:38", unread: 0, icon: "📿" },
  { id: 3, name: "Literatura y Cultura", lastMessage: "La divina comedia", time: "22:38", unread: 0, icon: "📚" },
  { id: 4, name: "Language Arts", lastMessage: "Kiwi", time: "22:38", unread: 0, icon: "🌐" },
  { id: 5, name: "Sociales, Metodología", lastMessage: "Hola", time: "21:48", unread: 3, icon: "🌍" },
]

const familyConversations = [
  { id: 6, name: "Familia (Acudientes)", lastMessage: "Hola amor, ya quedé", time: "19:16", unread: 0, isFamily: true },
]

const institutionalConversations = [
  { id: 7, name: "Secretaría Académica", lastMessage: "Información importante sobre...", time: "18:30", unread: 2, icon: "🏛️" },
  { id: 8, name: "Coordinación", lastMessage: "Reunión padres de familia", time: "14:22", unread: 0, icon: "📋" },
  { id: 9, name: "Rectoría", lastMessage: "Circular: cambio horario", time: "09:15", unread: 1, icon: "🎓" },
]

// Message data
const messages = [
  { id: 1, type: "recordatorio", title: "Quiz de genética 1", description: "Preparar material de estudio", deadline: "28 abr", isPast: false, time: "10:30" },
  { id: 2, type: "recordatorio", title: "Entrega laboratorio", description: "Informe de mitosis celular", deadline: "25 abr", isPast: true, time: "09:15" },
  { id: 3, type: "recordatorio", title: "Exposición grupal", description: "Tema: Herencia genética", deadline: "30 abr", isPast: false, time: "08:45" },
  { id: 4, type: "recordatorio", title: "Revisión de tareas", description: "Cuaderno al día", deadline: "27 abr", isPast: false, time: "08:00" },
  { id: 5, type: "chat", sender: "Gisselle Rivera", content: "Buenos días a todos. Recuerden que el quiz de genética será la próxima semana. Por favor repasen los capítulos 4 y 5 del libro.", time: "11:42", isOwn: false },
  { id: 6, type: "chat", sender: "Tú", content: "Profesora, ¿el quiz incluye el tema de mutaciones?", time: "11:45", isOwn: true },
]

export default function EvoSend() {
  const [activeTab, setActiveTab] = useState<"academico" | "institucional">("academico")
  const [activeConversation, setActiveConversation] = useState(1)
  const [messageFilter, setMessageFilter] = useState<"todos" | "recordatorios" | "mensajes">("todos")
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isInstitutional = activeTab === "institucional"
  const accentColor = isInstitutional ? "#F59E0B" : "#3B82F6"
  const accentColorHover = isInstitutional ? "#D97706" : "#2563EB"

  const currentConversations = activeTab === "academico" 
    ? [...academicConversations, ...familyConversations]
    : institutionalConversations

  const filteredMessages = messages.filter(msg => {
    if (messageFilter === "todos") return true
    if (messageFilter === "recordatorios") return msg.type === "recordatorio"
    if (messageFilter === "mensajes") return msg.type === "chat"
    return true
  })

  return (
    <div 
      className="h-screen w-screen overflow-hidden flex font-sans"
      style={{
        background: "radial-gradient(circle at 20% 20%, #1E3A8A 0%, #0F172A 40%, #020617 100%)",
      }}
    >
      {/* Column 1 - Navigation Rail */}
      <div 
        className="w-16 flex flex-col items-center py-6 shrink-0"
        style={{
          background: "rgba(15,23,42,0.7)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex flex-col items-center gap-6 flex-1">
          {/* AI/Evo Icon */}
          <button 
            className="relative flex items-center justify-center w-10 h-10 transition-all duration-200"
            style={{ color: "#3B82F6", filter: "drop-shadow(0 0 8px rgba(59,130,246,0.5))" }}
          >
            <StarIcon active />
          </button>

          {/* Chat Icon - Active */}
          <button 
            className="relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-200"
            style={{ 
              background: "rgba(59,130,246,0.2)", 
              border: "1px solid rgba(59,130,246,0.3)",
              color: "white"
            }}
          >
            <ChatIcon />
          </button>

          {/* Command Icon */}
          <button 
            className="flex items-center justify-center w-10 h-10 transition-all duration-200 hover:opacity-100"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            <CommandIcon />
          </button>

          {/* Notifications Icon */}
          <button 
            className="relative flex items-center justify-center w-10 h-10 transition-all duration-200 hover:opacity-100"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            <BellIcon />
            <span 
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
              style={{ background: "#EF4444" }}
            >
              44
            </span>
          </button>

          {/* Profile Icon */}
          <button 
            className="flex items-center justify-center w-10 h-10 transition-all duration-200 hover:opacity-100"
            style={{ color: "rgba(255,255,255,0.45)" }}
          >
            <UserIcon />
          </button>
        </div>

        {/* Bottom Logo */}
        <div className="flex items-center gap-1 mt-auto">
          <div className="w-2 h-2 rounded-full bg-white" />
          <span className="text-[11px] text-white font-medium tracking-wide">evo</span>
        </div>
      </div>

      {/* Column 2 - Conversations Sidebar */}
      <div 
        className="w-[300px] flex flex-col shrink-0"
        style={{
          background: "linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {/* Header */}
        <div className="h-[72px] px-4 flex flex-col justify-center">
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-bold text-white tracking-[-0.02em]">EvoSend</h1>
            <div className="w-2 h-2 rounded-full bg-red-500" />
          </div>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.45)" }}>
            Comunicación en tiempo real
          </p>
        </div>

        {/* Tab Pills */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 relative">
            <button
              onClick={() => setActiveTab("academico")}
              className="h-7 px-4 text-[11px] font-semibold rounded-full transition-all duration-300 relative z-10"
              style={{
                background: activeTab === "academico" ? "#3B82F6" : "rgba(255,255,255,0.06)",
                color: activeTab === "academico" ? "white" : "rgba(255,255,255,0.55)",
                border: activeTab === "academico" ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Académico
            </button>
            <button
              onClick={() => setActiveTab("institucional")}
              className="h-7 px-4 text-[11px] font-semibold rounded-full transition-all duration-300 relative z-10"
              style={{
                background: activeTab === "institucional" ? "#F59E0B" : "rgba(255,255,255,0.06)",
                color: activeTab === "institucional" ? "white" : "rgba(255,255,255,0.55)",
                border: activeTab === "institucional" ? "none" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              Institucional
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div 
            className="flex items-center gap-2 h-9 px-3 rounded-[10px]"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <SearchIcon size={14} />
            <input 
              type="text"
              placeholder="Buscar conversación o persona..."
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/35 outline-none"
              style={{ color: "#E2E8F0" }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div 
          className="flex-1 overflow-y-auto px-2 evo-scrollbar"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(59,130,246,0.3) transparent",
          }}
        >
          {/* Section Label */}
          {activeTab === "academico" && (
            <div 
              className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase"
              style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)" }}
            >
              MATERIAS
            </div>
          )}

          {/* Conversation Items */}
          {currentConversations.map((conv, index) => {
            const isActive = conv.id === activeConversation
            const isFamily = "isFamily" in conv && conv.isFamily

            // Show family section label
            if (activeTab === "academico" && conv.id === 6) {
              return (
                <div key={`section-${conv.id}`}>
                  <div 
                    className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase"
                    style={{ letterSpacing: "0.1em", color: "rgba(255,255,255,0.25)" }}
                  >
                    FAMILIA
                  </div>
                  <ConversationItem 
                    conv={conv}
                    isActive={isActive}
                    isFamily={isFamily}
                    isInstitutional={isInstitutional}
                    accentColor={accentColor}
                    index={index}
                    mounted={mounted}
                    onClick={() => setActiveConversation(conv.id)}
                  />
                </div>
              )
            }

            return (
              <ConversationItem 
                key={conv.id}
                conv={conv}
                isActive={isActive}
                isFamily={isFamily}
                isInstitutional={isInstitutional}
                accentColor={accentColor}
                index={index}
                mounted={mounted}
                onClick={() => setActiveConversation(conv.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Column 3 - Message Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <div 
          className="h-[72px] px-5 flex items-center justify-between shrink-0"
          style={{
            background: "linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))",
            backdropFilter: "blur(20px)",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* Subject Avatar */}
            <div 
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm"
              style={{
                background: `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`,
                border: `1px solid ${accentColor}40`,
              }}
            >
              🧬
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-white tracking-[-0.02em]">Biología</h2>
              <p className="text-[12px]" style={{ color: "rgba(255,255,255,0.5)" }}>
                De: Gisselle Rivera (Profesora)
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {[
              { icon: <SearchIcon size={14} />, label: "Buscar" },
              { icon: <PinIcon />, label: "Fijados" },
              { icon: <MoreIcon />, label: "Más" },
            ].map((action, i) => (
              <button
                key={i}
                className="h-8 px-3 flex items-center gap-2 rounded-full transition-all duration-200"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.55)",
                }}
              >
                {action.icon}
                <span className="text-[11px] font-medium">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Message Type Toggle Bar */}
        <div 
          className="h-12 px-5 flex items-center gap-3 shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Vista:</span>
          <div className="flex gap-2">
            {(["todos", "recordatorios", "mensajes"] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setMessageFilter(filter)}
                className="h-[26px] px-3 text-[11px] font-medium rounded-full transition-all duration-200 capitalize"
                style={{
                  background: messageFilter === filter ? accentColor : "rgba(255,255,255,0.06)",
                  color: messageFilter === filter ? "white" : "rgba(255,255,255,0.55)",
                  border: messageFilter === filter ? "none" : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        {/* Message Area */}
        <div 
          className="flex-1 overflow-y-auto p-5 evo-scrollbar"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(59,130,246,0.3) transparent",
          }}
        >
          {/* Date Divider */}
          <div className="flex items-center gap-4 my-4">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span 
              className="px-3 py-1 text-[11px] rounded-full"
              style={{ 
                background: "rgba(255,255,255,0.06)", 
                color: "rgba(255,255,255,0.4)",
                border: "1px solid rgba(255,255,255,0.08)"
              }}
            >
              16 mar
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Messages */}
          <div className="space-y-2">
            {filteredMessages.map((msg, index) => (
              msg.type === "recordatorio" ? (
                <ReminderRow key={msg.id} message={msg} index={index} mounted={mounted} />
              ) : (
                <ChatMessage key={msg.id} message={msg} />
              )
            ))}
          </div>
        </div>

        {/* Message Input Area */}
        <div 
          className="h-[72px] px-5 flex items-center gap-3 shrink-0"
          style={{
            background: "linear-gradient(145deg, rgba(30,58,138,0.25), rgba(15,23,42,0.55))",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Attachment & Reminder buttons */}
          <div className="flex items-center gap-1">
            <button 
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              <AttachIcon />
            </button>
            <button 
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 hover:bg-white/5"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              <ReminderIcon />
            </button>
          </div>

          {/* Input */}
          <div 
            className="flex-1 relative h-11 rounded-[10px] flex items-center px-4 transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: isInputFocused ? "1px solid rgba(59,130,246,0.5)" : "1px solid rgba(255,255,255,0.1)",
              boxShadow: isInputFocused ? "0 0 12px rgba(59,130,246,0.15)" : "none",
            }}
          >
            <input 
              type="text"
              placeholder="Escribe un mensaje o usa @ para mencionar..."
              className="flex-1 bg-transparent text-[14px] outline-none"
              style={{ color: "#E2E8F0" }}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
            />
          </div>

          {/* Send Button */}
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-full text-white transition-all duration-200 hover:scale-105"
            style={{ 
              background: accentColor,
              boxShadow: "0 0 16px rgba(59,130,246,0.3)",
            }}
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}

// Conversation Item Component
interface ConversationItemProps {
  conv: {
    id: number
    name: string
    lastMessage: string
    time: string
    unread: number
    icon?: string
    isFamily?: boolean
  }
  isActive: boolean
  isFamily: boolean
  isInstitutional: boolean
  accentColor: string
  index: number
  mounted: boolean
  onClick: () => void
}

function ConversationItem({ conv, isActive, isFamily, isInstitutional, accentColor, index, mounted, onClick }: ConversationItemProps) {
  const avatarGradient = isFamily 
    ? "linear-gradient(135deg, #F59E0B40, #D9770620)"
    : isInstitutional
    ? "linear-gradient(135deg, #F59E0B40, #D9770620)"
    : "linear-gradient(135deg, #3B82F640, #1E40AF20)"

  const avatarBorder = isFamily || isInstitutional 
    ? "1px solid rgba(245,158,11,0.4)"
    : "1px solid rgba(59,130,246,0.4)"

  return (
    <button
      onClick={onClick}
      className="w-full h-[68px] flex items-center gap-3 px-3 rounded-[10px] transition-all duration-150 group"
      style={{
        background: isActive ? `${accentColor}26` : "transparent",
        borderLeft: isActive ? `3px solid ${accentColor}` : "3px solid transparent",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateX(0)" : "translateX(-8px)",
        transition: `all 150ms ease, opacity 300ms ease ${index * 30}ms, transform 300ms ease ${index * 30}ms`,
      }}
    >
      {/* Avatar */}
      <div 
        className="w-[42px] h-[42px] rounded-full flex items-center justify-center text-lg shrink-0"
        style={{ background: avatarGradient, border: avatarBorder }}
      >
        {conv.icon || (isFamily ? "👨‍👩‍👧" : conv.name.charAt(0))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 text-left">
        <p 
          className="text-[13px] font-semibold truncate"
          style={{ color: "#E2E8F0" }}
        >
          {conv.name}
        </p>
        <p 
          className="text-[12px] truncate"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {conv.lastMessage}
        </p>
      </div>

      {/* Right Side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
          {conv.time}
        </span>
        {conv.unread > 0 && (
          <span 
            className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
            style={{ background: accentColor }}
          >
            {conv.unread}
          </span>
        )}
      </div>
    </button>
  )
}

// Reminder Row Component
interface ReminderRowProps {
  message: {
    id: number
    title: string
    description: string
    deadline: string
    isPast: boolean
    time: string
  }
  index: number
  mounted: boolean
}

function ReminderRow({ message, index, mounted }: ReminderRowProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div 
      className="h-14 flex items-center gap-3 px-3 rounded-lg transition-all duration-200 group"
      style={{
        background: isHovered ? "rgba(255,255,255,0.03)" : "transparent",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: `all 200ms ease, opacity 300ms ease ${index * 50}ms, transform 300ms ease ${index * 50}ms`,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left Accent Bar */}
      <div 
        className="w-1 h-10 rounded-sm shrink-0"
        style={{ background: message.isPast ? "rgba(255,255,255,0.2)" : "#3B82F6" }}
      />

      {/* Content */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Tag */}
        <span 
          className="shrink-0 px-2 py-0.5 text-[10px] font-semibold uppercase rounded"
          style={{ 
            background: "rgba(245,158,11,0.15)", 
            color: "#F59E0B",
            letterSpacing: "0.08em"
          }}
        >
          RECORDATORIO
        </span>

        {/* Title */}
        <span 
          className="text-[14px] font-semibold truncate max-w-[200px]"
          style={{ color: "#E2E8F0" }}
        >
          {message.title}
        </span>

        {/* Separator */}
        <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>

        {/* Description */}
        <span 
          className="text-[12px] truncate max-w-[180px]"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {message.description}
        </span>

        {/* Deadline Chip */}
        <span 
          className="shrink-0 flex items-center gap-1 px-2 py-1 text-[11px] rounded-md"
          style={{ 
            background: "rgba(255,255,255,0.06)", 
            color: message.isPast ? "rgba(255,255,255,0.35)" : "#E2E8F0",
            border: "1px solid rgba(255,255,255,0.08)"
          }}
        >
          <CalendarIcon />
          {message.deadline}
        </span>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-3 shrink-0">
        <button 
          className="transition-all duration-200"
          style={{ color: isHovered ? "#F59E0B" : "rgba(255,255,255,0.4)" }}
        >
          <BellOutlineIcon />
        </button>
        <button 
          className="text-[12px] font-medium transition-opacity duration-200"
          style={{ color: "#3B82F6", opacity: isHovered ? 1 : 0 }}
        >
          Ir
        </button>
        <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
          {message.time}
        </span>
      </div>
    </div>
  )
}

// Chat Message Component
interface ChatMessageProps {
  message: {
    id: number
    sender: string
    content: string
    time: string
    isOwn: boolean
  }
}

function ChatMessage({ message }: ChatMessageProps) {
  return (
    <div className={`flex flex-col ${message.isOwn ? "items-end" : "items-start"} mb-3`}>
      {/* Sender Name */}
      {!message.isOwn && (
        <span 
          className="text-[11px] mb-1 ml-3"
          style={{ color: "rgba(255,255,255,0.45)" }}
        >
          {message.sender}
        </span>
      )}

      {/* Bubble */}
      <div 
        className="max-w-[70%] px-4 py-2.5"
        style={{
          background: message.isOwn 
            ? "rgba(59,130,246,0.25)" 
            : "rgba(255,255,255,0.07)",
          border: message.isOwn 
            ? "1px solid rgba(59,130,246,0.3)" 
            : "none",
          borderRadius: message.isOwn 
            ? "12px 12px 4px 12px" 
            : "12px 12px 12px 4px",
        }}
      >
        <p className="text-[14px]" style={{ color: "#E2E8F0" }}>
          {message.content}
        </p>
        <span 
          className="text-[10px] float-right mt-1 ml-3"
          style={{ color: "rgba(255,255,255,0.3)" }}
        >
          {message.time}
        </span>
      </div>
    </div>
  )
}
]

## Tu tarea
Analiza el componente de referencia y la arquitectura descrita.
Genera un plan de implementación detallado considerando:
1. Qué archivos crear o modificar en el proyecto actual
2. Qué componentes reutilizables extraer
3. Orden de implementación por prioridad
4. Qué partes del componente v0 necesitan adaptarse al stack actual