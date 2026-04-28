import React from 'react';
import { useAuth } from '@/lib/authContext';
import { Mail, FileCheck, MessageSquare, Calendar, School, Bot, Send, Loader2, Bell, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { NavBackButton } from '@/components/nav-back-button';
import { EvoDocCard } from '@/components/evo-doc-card';
import { useKiwiChatStream } from '@/hooks/useKiwiChatStream';

const SECTION_LABELS: Record<string, string> = {
  'junior-school': 'Junior School',
  'middle-school': 'Middle School',
  'high-school': 'High School',
};

const SECTION_COLORS: Record<string, string> = {
  'junior-school': 'from-green-500 to-emerald-600',
  'middle-school': 'from-blue-500 to-cyan-600',
  'high-school': 'from-[#002366] to-[#1e3cff]',
};

const CARD_STYLE = 'bg-white/5 border-white/10 backdrop-blur-md';

function AIChatBox() {
  const [, setLocation] = useLocation();
  const {
    messages,
    input,
    setInput,
    loading,
    isStreaming,
    activeToolStep,
    messagesEndRef,
    sendMessage,
    handleSendFromInput,
  } = useKiwiChatStream();

  return (
    <Card className={`${CARD_STYLE} cursor-pointer flex flex-col h-full`} onClick={() => setLocation('/chat')}>
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="text-white flex items-center gap-2 text-lg">
          <Bot className="w-5 h-5 text-[#00c8ff] animate-pulse" />
          Chat AI - Asistente
        </CardTitle>
        <CardDescription className="text-white/60 text-sm">
          Consulta información, genera reportes o solicita ayuda.
        </CardDescription>
      </CardHeader>

      <CardContent onClick={(e) => e.stopPropagation()} className="flex-1 flex flex-col p-4 pt-0 min-h-0">
        <div className="flex-1 space-y-3 overflow-y-auto pr-2 max-h-[250px]">
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full py-8">
              <div className="text-center">
                <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center bg-gradient-to-br from-[#002366] to-[#1e3cff]">
                  <MessageSquare className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-lg font-semibold text-white mb-1.5">Asistente AI</h2>
                <p className="text-white/60 text-sm">Escribe una pregunta para comenzar.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.emisor === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.emisor === 'user' ? (
                    msg.contextLabel === 'parent_notes' ? (
                      <details className="max-w-[85%] rounded-lg border border-white/15 bg-white/5 text-white open:bg-white/[0.07]">
                        <summary className="cursor-pointer list-none px-3 py-2 text-xs text-[#00c8ff]/90 font-medium [&::-webkit-details-marker]:hidden">
                          Contexto desde Notas (toca para expandir)
                        </summary>
                        <p className="px-3 pb-3 pt-0 text-[13px] leading-relaxed whitespace-pre-wrap text-white/85 border-t border-white/10">
                          {msg.contenido}
                        </p>
                      </details>
                    ) : (
                      <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-gradient-to-r from-[#002366] to-[#1e3cff] text-white">
                        <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                      </div>
                    )
                  ) : msg.type === 'evo_doc' && msg.structuredData ? (
                    <div className="max-w-[92%] w-full">
                      <EvoDocCard
                        title={String(msg.structuredData.title ?? 'Documento')}
                        description={String(msg.structuredData.description ?? '')}
                        period={String(msg.structuredData.period ?? '')}
                        docId={String(msg.structuredData.docId ?? '')}
                        compact
                      />
                    </div>
                  ) : msg.type === 'kiwi_confirm' && msg.structuredData ? (
                    <div className="max-w-[92%] px-3 py-3 rounded-lg text-sm bg-white/10 text-white border border-white/20 space-y-2">
                      <div className="text-xs font-semibold">Confirmación requerida</div>
                      <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-xs">
                        <div className="text-white/60">Título</div>
                        <div className="text-sm text-white">
                          {String((msg.structuredData.params as { title?: string })?.title ?? '')}
                        </div>
                        <div className="text-white/60 mt-1">Entrega</div>
                        <div className="text-sm text-white">
                          {String((msg.structuredData.params as { dueDate?: string })?.dueDate ?? '')}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-white/20 text-white/80"
                          onClick={() => setInput(`KIWI_CONFIRM ${JSON.stringify(msg.structuredData ?? {})}`)}
                        >
                          Editar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="bg-gradient-to-r from-[#002366] to-[#1e3cff]"
                          onClick={() => void sendMessage(`KIWI_CONFIRM ${JSON.stringify(msg.structuredData ?? {})}`)}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-[85%] px-3 py-2 rounded-lg text-sm bg-white/10 text-white border border-white/20">
                      <p className="text-[14px] leading-relaxed whitespace-pre-wrap">{msg.contenido}</p>
                    </div>
                  )}
                </div>
              ))}
              {(loading || isStreaming || activeToolStep) && (
                <div className="flex justify-start">
                  <div className="bg-white/10 px-3 py-2 rounded-lg flex items-center gap-2 text-white/70">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-sm italic">
                      {activeToolStep ? `${activeToolStep.replace(/_/g, ' ')}...` : 'Escribiendo...'}
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        <div className="border-t border-white/10 pt-3 mt-3 flex-shrink-0">
          <div className="flex gap-2 items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendFromInput();
                }
              }}
              placeholder="Escribe tu mensaje..."
              className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
              disabled={loading || isStreaming}
            />
            <Button
              onClick={(e) => { e.stopPropagation(); handleSendFromInput(); }}
              disabled={loading || isStreaming || !input.trim()}
              size="icon"
              className="w-10 h-10 bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 text-white"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AsistentePage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const seccionLabel = user?.seccion ? SECTION_LABELS[user.seccion] : 'Sin sección';
  const seccionColor = user?.seccion ? SECTION_COLORS[user.seccion] : 'from-gray-500 to-gray-600';

  return (
    <div data-testid="asistente-page">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-white mb-2 font-['Poppins']">
          Bienvenido/a, {user?.nombre?.split(' ')[0] || 'Asistente'}
        </h1>
        <div className="flex items-center gap-3">
          <p className="text-white/60">
            {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
          <span className={`px-3 py-1 rounded-full text-sm font-medium text-white bg-gradient-to-r ${seccionColor}`}>
            {seccionLabel}
          </span>
        </div>
      </div>

      <NavBackButton to="/dashboard" label="Dashboard" />
      {/* Cards estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Mensajes */}
        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/chat')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Mensajes</CardTitle>
            <Mail className="w-5 h-5 text-[#00c8ff]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">5</div>
            <p className="text-xs text-white/60 mt-1">Sin leer</p>
          </CardContent>
        </Card>

        {/* Permisos */}
        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/permisos')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Permisos</CardTitle>
            <FileCheck className="w-5 h-5 text-[#00c8ff]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">3</div>
            <p className="text-xs text-white/60 mt-1">Pendientes hoy</p>
          </CardContent>
        </Card>

        {/* Chat AI */}
        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/chat')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Chat AI</CardTitle>
            <MessageSquare className="w-5 h-5 text-[#00c8ff]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">24/7</div>
            <p className="text-xs text-white/60 mt-1">Disponible siempre</p>
          </CardContent>
        </Card>

        {/* Calendario */}
        <Card 
          className={`${CARD_STYLE} cursor-pointer hover:bg-white/10 transition-all`}
          onClick={() => setLocation('/calendar')}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-white">Calendario</CardTitle>
            <Calendar className="w-5 h-5 text-[#00c8ff]" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white font-['Poppins']">2</div>
            <p className="text-xs text-white/60 mt-1">Eventos esta semana</p>
          </CardContent>
        </Card>
      </div>

      {/* Paneles principales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Panel de Calendario General */}
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#00c8ff]" />
              Calendario General - {seccionLabel}
            </CardTitle>
            <CardDescription className="text-white/60">Eventos y actividades de la sección</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#002366] to-[#1e3cff] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">20</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Reunión de Padres</h4>
                  <p className="text-white/60 text-sm">Hoy - 3:00 PM</p>
                </div>
                <Bell className="w-4 h-4 text-yellow-400" />
              </div>
              
              <div className="p-4 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">22</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Entrega de Boletines</h4>
                  <p className="text-white/60 text-sm">Miércoles - 8:00 AM</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">25</span>
                </div>
                <div className="flex-1">
                  <h4 className="text-white font-medium">Día Cultural</h4>
                  <p className="text-white/60 text-sm">Sábado - Todo el día</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full border-white/10 text-white hover:bg-white/10 mt-2"
                onClick={() => setLocation('/calendar')}
              >
                Ver Calendario Completo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Chat AI integrado */}
        <AIChatBox />
      </div>

      {/* Panel inferior - Permisos y Mensajes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Permisos Recientes */}
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-[#00c8ff]" />
              Permisos Recientes
            </CardTitle>
            <CardDescription className="text-white/60">Últimos permisos gestionados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                  <div>
                    <p className="text-white text-sm font-medium">María García - 9A</p>
                    <p className="text-white/50 text-xs">Salida temprana</p>
                  </div>
                </div>
                <span className="text-yellow-400 text-xs font-medium">Pendiente</span>
              </div>

              <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <div>
                    <p className="text-white text-sm font-medium">Juan López - 10B</p>
                    <p className="text-white/50 text-xs">Permiso médico</p>
                  </div>
                </div>
                <span className="text-green-400 text-xs font-medium">Aprobado</span>
              </div>

              <div className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <div>
                    <p className="text-white text-sm font-medium">Ana Martínez - 11C</p>
                    <p className="text-white/50 text-xs">Retiro tercero</p>
                  </div>
                </div>
                <span className="text-green-400 text-xs font-medium">Aprobado</span>
              </div>

              <Button 
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 mt-2"
                onClick={() => setLocation('/permisos')}
              >
                Gestionar Permisos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Panel de Mensajes */}
        <Card className={CARD_STYLE}>
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#00c8ff]" />
              Mensajes Recientes
            </CardTitle>
            <CardDescription className="text-white/60">Comunicaciones pendientes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-3 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">CP</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm truncate">Coordinación Primaria</p>
                    <span className="text-white/50 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> 10:30
                    </span>
                  </div>
                  <p className="text-white/60 text-xs truncate">Recordatorio: Entrega de documentos...</p>
                </div>
                <div className="w-2 h-2 rounded-full bg-[#00c8ff] flex-shrink-0 mt-2"></div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">RH</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm truncate">Recursos Humanos</p>
                    <span className="text-white/50 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ayer
                    </span>
                  </div>
                  <p className="text-white/60 text-xs truncate">Capacitación de seguridad programada</p>
                </div>
              </div>

              <div className="p-3 bg-white/5 rounded-xl flex items-start gap-3 hover:bg-white/10 transition-all cursor-pointer">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#002366] to-[#1e3cff] flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-sm">DR</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-white font-medium text-sm truncate">Dirección</p>
                    <span className="text-white/50 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Lun
                    </span>
                  </div>
                  <p className="text-white/60 text-xs truncate">Actualización de protocolos</p>
                </div>
              </div>

              <Button 
                variant="outline" 
                className="w-full border-white/10 text-white hover:bg-white/10 mt-2"
                onClick={() => setLocation('/evo-send')}
              >
                Bandeja de entrada
              </Button>
              <Button 
                className="w-full bg-gradient-to-r from-[#002366] to-[#1e3cff] hover:opacity-90 mt-2"
                onClick={() => setLocation('/evo-send')}
              >
                <Send className="w-4 h-4 mr-2 inline" />
                Escribir a padres
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
