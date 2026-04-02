/**
 * Servicio de contexto centralizado del agente Kiwi.
 * Define identidad, system prompts por rol, tools disponibles y lógica de memoria.
 * Sin llamadas directas a la DB — solo usa kiwiRepository (tipos) y llmSanitizer.
 * NO importa openai.ts para evitar dependencia circular.
 */

import { UserRole } from '../middleware/auth.js';
import type { KiwiMemoryRow, KiwiMessageRow } from '../repositories/kiwiRepository.js';
import { buildMinorProtectionRules } from './llmSanitizer.js';

// ─── Tipos exportados ────────────────────────────────────────────────────────

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface KiwiUserContext {
  userId: string;
  institutionId: string;
  rol: UserRole;
  nombre: string;
  sessionId: string;
  memory: KiwiMemoryRow | null;
}

// ─── Bloques de identidad base ───────────────────────────────────────────────

const KIWI_IDENTITY = `Eres Kiwi, el asistente educativo inteligente de EvoOS.
Eres un koala amigable y profesional que ayuda a la comunidad escolar con sus tareas diarias.

IDENTIDAD Y TONO:
- Habla siempre en español colombiano natural y cercano
- Sé claro, directo y eficiente — responde en 2 a 4 líneas salvo que el usuario pida más detalle
- Usa un tono cálido pero profesional; no seas excesivamente formal ni informal
- Cuando no entiendas algo, pide aclaración de manera amable y concisa

REGLAS ABSOLUTAS:
- NUNCA inventes datos, notas, nombres, fechas ni información que no tengas confirmada
- NUNCA actúes fuera de los permisos de tu rol actual
- SIEMPRE confirma antes de ejecutar acciones que modifiquen datos (crear, editar, eliminar)
- SIEMPRE usa las herramientas disponibles antes de decir que no puedes hacer algo
- Si una acción puede tener consecuencias importantes, describe qué vas a hacer y espera confirmación

MEMORIA DE CONVERSACIÓN:
- Usa el historial completo de la conversación antes de responder
- No vuelvas a pedir información que el usuario ya proporcionó en mensajes anteriores
- Acumula información de múltiples mensajes antes de actuar`;

const ROLE_SECTIONS: Record<string, string> = {
  estudiante: `
RESTRICCIONES DE ROL (estudiante):
- Solo puedes consultar TU propia información académica
- NO puedes ver notas, asistencia ni información de otros estudiantes
- NO puedes crear tareas, calificar ni acceder a funciones administrativas

HERRAMIENTAS DISPONIBLES:
- get_my_grades: Ver tus notas por materia y período académico
- get_my_attendance: Ver tu registro de asistencia
- get_pending_tasks: Ver tareas pendientes, entregadas o calificadas
- get_my_schedule: Ver tu horario de clases`,

  profesor: `
RESTRICCIONES DE ROL (profesor):
- Solo puedes acceder a información de TUS grupos y materias asignadas
- NO puedes ver información de materias que no te pertenecen
- NO puedes acceder a datos personales privados de estudiantes (dirección, teléfono, etc.)

TERMINOLOGÍA IMPORTANTE:
- "CURSOS" = GRUPOS (ej: 12C, 11A, 9B) — NO son materias
- "MATERIAS" = asignaturas que dictas (Matemáticas, Sociales, etc.)
- Cada materia puede tener varios grupos asignados

HERRAMIENTAS DISPONIBLES:
- list_my_courses: Ver tus materias y grupos asignados (y sus IDs de courseId)
- create_assignment: Crear/asignar una tarea a un grupo+materia (requiere confirmación antes de crear)
- get_my_schedule: Ver tu horario de clases`,

  padre: `
RESTRICCIONES DE ROL (padre/acudiente):
- Solo puedes consultar información de TUS hijos registrados
- NO puedes ver información de otros estudiantes
- NO puedes ver información de cursos completos

HERRAMIENTAS DISPONIBLES:
- get_child_grades: Ver notas académicas de tu hijo/a
- get_child_attendance: Ver asistencia de tu hijo/a
- get_comunicados: Ver comunicados recibidos del colegio
- contact_teacher: Enviar mensaje a un docente de tu hijo/a`,

  directivo: `
RESTRICCIONES DE ROL (directivo):
- Tienes acceso amplio a información institucional
- Respeta la privacidad de datos personales — no compartas información sensible innecesariamente
- NO puedes modificar configuraciones del sistema (eso es de admin-general-colegio)

HERRAMIENTAS DISPONIBLES:
- get_institution_analytics: Métricas generales de la institución
- get_attendance_report: Reporte de asistencia por grupo y período
- create_institutional_comunicado: Comunicado institucional masivo
- get_academic_risk_report: Reporte de estudiantes en riesgo académico

IMPORTANTE: Antes de llamar send_evosend_message necesitas el channelId. Si el usuario no lo provee, pregúntale a qué grupo o persona quiere enviar el mensaje, luego busca el channelId apropiado o pídele que lo seleccione desde EvoSend.`,

  // directora-academica no está en UserRole aún — se incluye aquí para soporte futuro
  'directora-academica': `
RESTRICCIONES DE ROL (directora académica):
- Tienes acceso completo a datos académicos institucionales
- Respeta la privacidad de datos personales en todos los reportes

HERRAMIENTAS DISPONIBLES:
- get_institution_analytics: Métricas generales de la institución
- get_attendance_report: Reporte de asistencia por grupo y período
- create_institutional_comunicado: Comunicado institucional masivo
- get_academic_risk_report: Reporte de estudiantes en riesgo académico
- get_subject_analytics: Analytics detallados por materia
- get_teacher_performance: Indicadores de desempeño docente
- generate_academic_report: Generar reporte académico exportable`,

  rector: `
RESTRICCIONES DE ROL (rector):
- Tienes vista ejecutiva de la institución
- Enfócate en decisiones estratégicas y visión general
- Respeta la privacidad de datos personales en todos los reportes

HERRAMIENTAS DISPONIBLES:
- get_institution_analytics: Métricas generales de la institución
- get_attendance_report: Reporte de asistencia por grupo y período
- get_academic_risk_report: Reporte de estudiantes en riesgo académico`,

  'admin-general-colegio': `
RESTRICCIONES DE ROL (administrador general):
- Tu función es la gestión administrativa del colegio
- No interactúes directamente con datos académicos de estudiantes
- Derива consultas académicas a directivos o profesores

HERRAMIENTAS DISPONIBLES:
- get_my_schedule: Ver horario`,

  school_admin: `
RESTRICCIONES DE ROL (school admin):
- Tu función es la gestión administrativa del colegio
- No interactúes directamente con datos académicos de estudiantes

HERRAMIENTAS DISPONIBLES:
- get_my_schedule: Ver horario`,
};

const FALLBACK_ROLE_SECTION = `
RESTRICCIONES DE ROL:
- Acceso mínimo al sistema
- Solo puedes consultar tu horario personal

HERRAMIENTAS DISPONIBLES:
- get_my_schedule: Ver tu horario`;

// ─── Tools por rol ───────────────────────────────────────────────────────────

const TOOL_GET_MY_SCHEDULE: ToolDefinition = {
  name: 'get_my_schedule',
  description: 'Ver el horario de clases del usuario actual',
};

const TOOLS_BY_ROLE: Record<string, ToolDefinition[]> = {
  estudiante: [
    { name: 'get_my_grades', description: 'Ver notas propias por materia y período académico' },
    { name: 'get_my_attendance', description: 'Ver registro de asistencia propio' },
    { name: 'get_pending_tasks', description: 'Ver tareas pendientes, entregadas o calificadas' },
    TOOL_GET_MY_SCHEDULE,
  ],
  profesor: [
    {
      name: 'list_my_courses',
      description: 'Lista tus cursos/materias asignadas (group_subjects) con sus IDs (courseId) para crear tareas.',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'create_assignment',
      description:
        'Crear/asignar una tarea en un courseId (group_subject_id) del profesor. Si no tienes courseId, usa list_my_courses primero. Requiere confirmación explícita antes de crear.',
      parameters: {
        type: 'object',
        properties: {
          courseId: { type: 'string', description: 'ID del group_subject (courseId) donde crear la tarea' },
          group: { type: 'string', description: 'Nombre del grupo (ej: 11H). Alternativa a courseId.' },
          subject: { type: 'string', description: 'Nombre de la materia (ej: Sociales). Requerido si usas group.' },
          title: { type: 'string', description: 'Título de la tarea' },
          description: { type: 'string', description: 'Descripción de la tarea' },
          dueDate: { type: 'string', description: 'Fecha de entrega (YYYY-MM-DD o ISO)' },
          requiresSubmission: { type: 'boolean', description: 'Si requiere entrega (default true)' },
          trimestre: { type: 'number', enum: [1, 2, 3], description: 'Trimestre/periodo académico (1-3)' },
          categoryId: { type: 'string', description: 'ID categoría/logro (opcional)' },
          categoryWeightPct: { type: 'number', description: 'Peso de la categoría (0-100, opcional)' },
          confirmed: { type: 'boolean', description: 'true solo si el usuario ya confirmó la creación' },
        },
        required: ['title', 'description', 'dueDate'],
      },
    },
    TOOL_GET_MY_SCHEDULE,
  ],
  padre: [
    { name: 'get_child_grades', description: 'Ver notas académicas de un hijo/a registrado' },
    { name: 'get_child_attendance', description: 'Ver asistencia de un hijo/a registrado' },
    { name: 'get_comunicados', description: 'Ver comunicados recibidos del colegio' },
    { name: 'contact_teacher', description: 'Enviar mensaje a un docente de un hijo/a' },
  ],
  directivo: [
    {
      name: 'get_institution_analytics',
      description: 'Ver métricas generales de la institución',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', description: 'Período académico opcional, usa el activo si no se especifica' },
        },
        required: [],
      },
    },
    {
      name: 'get_attendance_report',
      description: 'Reporte de asistencia por grupo y período',
      parameters: {
        type: 'object',
        properties: {
          groupId: { type: 'string', description: 'ID del grupo, opcional' },
          startDate: { type: 'string', description: 'Fecha inicio YYYY-MM-DD, opcional' },
          endDate: { type: 'string', description: 'Fecha fin YYYY-MM-DD, opcional' },
        },
        required: [],
      },
    },
    {
      name: 'create_institutional_comunicado',
      description: 'Crear comunicado institucional masivo',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del comunicado' },
          content: { type: 'string', description: 'Contenido del comunicado' },
          targetAudience: { type: 'string', enum: ['all', 'parents', 'teachers'], description: 'Audiencia: all=todos, parents=padres, teachers=profesores' },
          confirmed: { type: 'boolean', description: 'true solo si el usuario ya confirmó el envío' },
        },
        required: ['title', 'content', 'targetAudience'],
      },
    },
    {
      name: 'get_academic_risk_report',
      description: 'Reporte de estudiantes en riesgo académico',
      parameters: {
        type: 'object',
        properties: {
          threshold: { type: 'number', description: 'Nota mínima aprobatoria, default 60' },
        },
        required: [],
      },
    },
    // TODO: activar post-demo
    // { name: 'send_evosend_message', description: 'Envía un mensaje por EvoSend en un canal donde el directivo ya es miembro',
    //   parameters: { type: 'object', properties: {
    //     channelId: { type: 'string', description: 'ID del canal o hilo de EvoSend donde enviar' },
    //     channelType: { type: 'string', enum: ['group', 'direct'], description: 'Tipo de canal: group para grupos, direct para mensajes directos' },
    //     message: { type: 'string', description: 'Contenido del mensaje a enviar' },
    //     confirmed: { type: 'boolean', description: 'true solo si el usuario ya confirmó el envío' },
    //   }, required: ['channelId', 'channelType', 'message'] } },
    // { name: 'generate_boletin', description: 'Genera boletines académicos con IA para un grupo específico o todos los estudiantes del colegio',
    //   parameters: { type: 'object', properties: {
    //     scope: { type: 'string', enum: ['group', 'all'], description: 'group=un grupo específico, all=todo el colegio' },
    //     groupId: { type: 'string', description: 'ID del grupo, requerido si scope=group' },
    //     confirmed: { type: 'boolean', description: 'true solo si el usuario ya confirmó la generación' },
    //   }, required: ['scope'] } },
  ],
  rector: [
    { name: 'get_institution_analytics', description: 'Ver métricas generales de la institución' },
    { name: 'get_attendance_report', description: 'Reporte de asistencia por grupo y período' },
    { name: 'get_academic_risk_report', description: 'Reporte de estudiantes en riesgo académico' },
  ],
};

// directora-academica = directivo + 3 tools adicionales
// (rol no está en UserRole aún — soporte futuro)
TOOLS_BY_ROLE['directora-academica'] = [
  ...TOOLS_BY_ROLE.directivo,
  { name: 'get_subject_analytics', description: 'Analytics detallados por materia' },
  { name: 'get_teacher_performance', description: 'Indicadores de desempeño docente' },
  { name: 'generate_academic_report', description: 'Generar reporte académico exportable' },
];

TOOLS_BY_ROLE['admin-general-colegio'] = [TOOL_GET_MY_SCHEDULE];
TOOLS_BY_ROLE['school_admin'] = [TOOL_GET_MY_SCHEDULE];

// ─── Funciones exportadas ────────────────────────────────────────────────────

/**
 * Construye el system prompt completo para Kiwi según el rol y la memoria del usuario.
 * Incluye identidad, reglas de protección de menores (Ley 1581), memoria persistente
 * y las restricciones e instrucciones específicas del rol.
 */
export function buildSystemPrompt(
  user: KiwiUserContext,
  memory: KiwiMemoryRow | null
): string {
  const parts: string[] = [KIWI_IDENTITY];

  // Bloque de protección de menores — siempre presente
  parts.push('\n' + buildMinorProtectionRules());

  // Memoria persistente — solo si existe
  if (memory && memory.memory_summary) {
    const memoryBlock: string[] = ['\nLO QUE SÉ DE TI (memoria de sesiones anteriores):'];
    memoryBlock.push(memory.memory_summary);

    if (Array.isArray(memory.key_facts) && memory.key_facts.length > 0) {
      memoryBlock.push('Contexto adicional:');
      memory.key_facts.forEach((fact) => {
        if (fact && typeof fact === 'string') {
          memoryBlock.push(`- ${fact}`);
        } else if (fact && typeof fact === 'object') {
          memoryBlock.push(`- ${JSON.stringify(fact)}`);
        }
      });
    }

    parts.push(memoryBlock.join('\n'));
  }

  // Sección específica del rol
  const roleSection = ROLE_SECTIONS[user.rol] ?? FALLBACK_ROLE_SECTION;
  parts.push(roleSection);

  // Bloque de permisos actuales
  parts.push(`\nROL Y PERMISOS ACTUALES:\nRol: ${user.rol}\nInstitución: ${user.institutionId}\nSolo puedes acceder a información de tu institución. No compartas datos de otras instituciones.`);

  return parts.join('\n');
}

/**
 * Retorna las tools disponibles para un rol.
 * Acepta `UserRole | string` para soportar roles futuros (ej: directora-academica).
 */
export function buildRoleTools(rol: UserRole | string): ToolDefinition[] {
  return TOOLS_BY_ROLE[rol] ?? [TOOL_GET_MY_SCHEDULE];
}

/**
 * Retorna true si el historial supera los 12 mensajes — señal para comprimir la memoria.
 */
export function shouldCompressMemory(recentMessages: KiwiMessageRow[]): boolean {
  return recentMessages.length > 12;
}

/**
 * Arma el prompt para pedirle a gpt-4o-mini que comprima el historial en un resumen
 * de máximo 200 tokens sin incluir nombres reales ni datos sensibles.
 */
export function buildMemoryCompressionPrompt(messages: KiwiMessageRow[]): string {
  const formattedMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => `[${m.role}]: ${m.content}`)
    .join('\n');

  return `Eres un asistente que resume conversaciones académicas de forma compacta.

INSTRUCCIONES:
- Resume en máximo 200 tokens
- Extrae solo hechos relevantes para futuras conversaciones del mismo usuario
- NO incluyas nombres reales de estudiantes ni datos personales sensibles
- Si se mencionan personas, usa tokens anónimos (ej: "el estudiante [EST-XXXX]")
- Responde en español colombiano
- Formato: párrafo corto de texto plano, sin viñetas ni listas

CONVERSACIÓN A RESUMIR:
${formattedMessages}`;
}

/**
 * Extrae hechos clave simples del historial usando análisis de texto puro (sin OpenAI).
 * Retorna { preferredName, preferences, context } — campos faltantes quedan como ''.
 */
export function extractKeyFacts(messages: KiwiMessageRow[]): Record<string, string> {
  const userTexts = messages
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join(' ')
    .toLowerCase();

  // preferredName: "me llamo X", "soy X", "llámame X"
  let preferredName = '';
  const nameMatch =
    userTexts.match(/(?:me llamo|llámame|soy)\s+([a-záéíóúüñ]{2,20})/i);
  if (nameMatch) {
    preferredName = nameMatch[1].charAt(0).toUpperCase() + nameMatch[1].slice(1);
  }

  // preferences: primera oración con "prefiero", "me gusta", "siempre", "normalmente"
  let preferences = '';
  const prefMatch = userTexts.match(
    /(?:prefiero|me gusta|siempre|normalmente)[^.!?]{5,80}/i
  );
  if (prefMatch) {
    preferences = prefMatch[0].trim();
  }

  // context: palabras que aparecen 3+ veces (posibles materias o grupos recurrentes)
  const words = userTexts.split(/\s+/).filter((w) => w.length > 3);
  const freq: Record<string, number> = {};
  words.forEach((w) => { freq[w] = (freq[w] ?? 0) + 1; });
  const recurring = Object.entries(freq)
    .filter(([, count]) => count >= 3)
    .map(([word]) => word)
    .slice(0, 5)
    .join(', ');

  return {
    preferredName,
    preferences,
    context: recurring,
  };
}
