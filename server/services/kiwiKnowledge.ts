/**
 * Conocimiento estático de EvoOS para el agente Kiwi.
 * Provee descripciones de módulos, rutas de navegación y
 * patrones de fallback según el rol del usuario.
 * Sin dependencias de DB ni de openai — solo texto puro.
 */

import { UserRole } from '../middleware/auth.js';

// ─── Glosario universal ──────────────────────────────────────────────────────

const GLOSARIO_EVO = `
GLOSARIO DE TÉRMINOS DE EVO.OS (usa solo estos términos, nunca inventes):
- group / grupo: salón de clase (ej: 11A, 10C). Contiene estudiantes inscritos vía enrollments
- section: agrupación de grupos (ej: "Bachillerato", "Primaria")
- subject: asignatura del catálogo institucional (Matemáticas, Ciencias, etc.)
- group_subject: materia asignada a un grupo específico con su profesor titular. Un grupo puede tener varias materias
- enrollment: vínculo entre un estudiante, un grupo y un período académico. Un estudiante pertenece a un solo grupo por período
- academic_period: período académico activo (año escolar o semestre). Casi toda la data está filtrada por este campo
- institution_id: UUID único del colegio. Todos los datos están aislados por institución — nunca mezcles datos de colegios distintos
- attendance.status: "present" (presente) o "absent" (ausente). Campo punctuality: "on_time" (puntual) o "late" (tarde)
- grades: nota registrada por actividad (assignment), con score, max_score y normalized_score (nota sobre la escala del colegio)
- announcement / comunicado: mensaje enviado a padres o grupos. Puede ser masivo o dirigido a un grupo o materia específica
- EvoSend: sistema de mensajería directa entre el colegio y las familias. Es distinto a los comunicados (announcements)
- Evo Drive: almacenamiento de archivos organizados por materia y grupo
`;

// ─── Descripciones de módulos ────────────────────────────────────────────────

interface ModuleInfo {
  nombre: string;
  ruta: string;
  descripcion: string;
}

const MODULOS: Record<string, ModuleInfo> = {
  dashboard: {
    nombre: 'Dashboard principal',
    ruta: '/directivo/dashboard',
    descripcion: 'Vista general con métricas clave del colegio: asistencia del día, alertas académicas activas, comunicados recientes y accesos rápidos a los módulos más usados.',
  },
  asistencia_directivo: {
    nombre: 'Asistencia (directivo)',
    ruta: '/directivo/asistencia',
    descripcion: 'Consulta y reportes de asistencia por grupo, materia y período. Muestra porcentajes de presencia, estudiantes con inasistencias frecuentes y registros históricos.',
  },
  asistencia_profesor: {
    nombre: 'Asistencia (profesor)',
    ruta: '/profesor/asistencia',
    descripcion: 'Registro diario de asistencia para los grupos y materias asignadas al profesor. Permite marcar presentes, ausentes y tardanzas.',
  },
  calificaciones_directivo: {
    nombre: 'Calificaciones (directivo)',
    ruta: '/directivo/calificaciones',
    descripcion: 'Notas de todos los grupos por materia y período académico. Permite ver promedios por grupo, comparar materias y detectar estudiantes en riesgo.',
  },
  calificaciones_profesor: {
    nombre: 'Calificaciones (profesor)',
    ruta: '/profesor/calificaciones',
    descripcion: 'Notas de los grupos asignados al profesor. Permite ingresar y editar calificaciones por actividad y categoría de evaluación.',
  },
  comunicados: {
    nombre: 'Comunicados',
    ruta: '/comunicados',
    descripcion: 'Lista de comunicados enviados y recibidos. Muestra estado (enviado, pendiente, leído), destinatarios y adjuntos.',
  },
  comunicados_nuevo: {
    nombre: 'Nuevo comunicado',
    ruta: '/comunicados/nuevo',
    descripcion: 'Formulario para crear un comunicado dirigido a uno o varios grupos, materias o a toda la institución.',
  },
  evo_send: {
    nombre: 'EvoSend',
    ruta: '/evo-send',
    descripcion: 'Mensajería directa en tiempo real entre el colegio y las familias. Permite conversaciones privadas, notificaciones y seguimiento de mensajes leídos.',
  },
  boletines: {
    nombre: 'Boletines',
    ruta: '/directivo/boletines',
    descripcion: 'Reporte académico oficial por estudiante y período. Incluye notas por materia, observaciones y resultado de cada período.',
  },
  reportes: {
    nombre: 'Reportes',
    ruta: '/directivo/reportes',
    descripcion: 'Analytics institucionales: estudiantes en riesgo académico, tasa de asistencia, comparativos por grupo y período. Exportables en PDF o Excel.',
  },
  horario: {
    nombre: 'Mi Horario',
    ruta: '/horario',
    descripcion: 'Horario semanal del usuario actual: clases, materias, grupos y horarios de cada sesión.',
  },
  tareas: {
    nombre: 'Tareas',
    ruta: '/tareas',
    descripcion: 'Lista de actividades asignadas: pendientes, entregadas y calificadas. Incluye fecha límite, descripción y estado de entrega.',
  },
  evo_drive: {
    nombre: 'Evo Drive',
    ruta: '/evo-drive',
    descripcion: 'Almacenamiento de archivos organizado por materia y grupo. Permite subir, compartir y descargar recursos educativos (PDFs, documentos, enlaces).',
  },
  enfermeria: {
    nombre: 'Enfermería',
    ruta: '/enfermeria',
    descripcion: 'Registros de atención médica de estudiantes: consultas, incidentes, medicamentos y seguimientos. Acceso restringido al personal de enfermería.',
  },
};

// ─── Módulos por rol ──────────────────────────────────────────────────────────

const MODULOS_POR_ROL: Record<string, string[]> = {
  directivo: [
    'dashboard',
    'asistencia_directivo',
    'calificaciones_directivo',
    'comunicados',
    'comunicados_nuevo',
    'evo_send',
    'boletines',
    'reportes',
    'evo_drive',
    'horario',
  ],
  rector: [
    'dashboard',
    'asistencia_directivo',
    'calificaciones_directivo',
    'boletines',
    'reportes',
    'horario',
  ],
  profesor: [
    'asistencia_profesor',
    'calificaciones_profesor',
    'comunicados',
    'comunicados_nuevo',
    'evo_send',
    'evo_drive',
    'horario',
    'tareas',
  ],
  estudiante: [
    'horario',
    'tareas',
    'evo_drive',
  ],
  padre: [
    'comunicados',
    'evo_send',
  ],
  'admin-general-colegio': [
    'evo_send',
    'evo_drive',
    'horario',
  ],
  school_admin: [
    'evo_send',
    'evo_drive',
    'horario',
  ],
  nutricion: [
    'enfermeria',
    'horario',
  ],
};

// ─── Rutas de fallback por rol ────────────────────────────────────────────────

const FALLBACK_ROUTES: Record<string, string> = {
  directivo: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo obtener datos de asistencia → /directivo/asistencia
- No puedo crear o enviar un comunicado → /comunicados/nuevo
- No puedo mostrar lista de comunicados → /comunicados
- No puedo obtener calificaciones del grupo → /directivo/calificaciones
- No puedo generar reporte de riesgo académico → /directivo/reportes
- No puedo mostrar boletines → /directivo/boletines
- No puedo mostrar el dashboard general → /directivo/dashboard
- No puedo acceder a archivos de Evo Drive → /evo-drive
- No puedo enviar mensaje directo → /evo-send`,

  rector: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo obtener datos de asistencia → /directivo/asistencia
- No puedo mostrar calificaciones → /directivo/calificaciones
- No puedo mostrar reporte de riesgo → /directivo/reportes
- No puedo mostrar boletines → /directivo/boletines
- No puedo mostrar el dashboard → /directivo/dashboard`,

  profesor: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo registrar asistencia → /profesor/asistencia
- No puedo ver o editar calificaciones → /profesor/calificaciones
- No puedo crear un comunicado → /comunicados/nuevo
- No puedo ver comunicados → /comunicados
- No puedo enviar mensaje directo → /evo-send
- No puedo acceder a Evo Drive → /evo-drive`,

  padre: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo ver comunicados recibidos → /comunicados
- No puedo enviar mensaje al colegio → /evo-send`,

  estudiante: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo ver tus tareas → /tareas
- No puedo mostrar tu horario → /horario
- No puedo acceder a archivos → /evo-drive`,

  'admin-general-colegio': `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo enviar un mensaje → /evo-send
- No puedo acceder a archivos → /evo-drive`,

  nutricion: `
RUTAS DE NAVEGACIÓN MANUAL (úsalas cuando una herramienta falla):
- No puedo acceder a registros de enfermería → /enfermeria`,
};

// ─── Instrucciones de fallback por rol ───────────────────────────────────────

const FALLBACK_INSTRUCTIONS: Record<string, string> = {
  directivo: `
INSTRUCCIONES DE FALLBACK PARA ESTE ROL:
Cuando una acción o consulta falla, sigue este orden:
1. Explica brevemente qué pasó sin tecnicismos (ej: "No pude obtener esa información en este momento")
2. Da la ruta exacta donde el usuario puede hacerlo de forma manual (ver mapa de rutas arriba)
3. Ofrece una alternativa relacionada que sí puedas ejecutar (ej: "¿Quieres que busque el reporte del período anterior?")

PATRÓN ESPECIAL — DATOS NO ENCONTRADOS EN DB:
Cuando el usuario pide datos y la consulta devuelve resultados vacíos, NUNCA digas "no hay nada" ni inventes datos.
En cambio responde exactamente así:
"No encontré datos para ese período. ¿Quieres que busque en otro período o prefieres verlo directamente en [ruta exacta]?"
Luego ofrece el período académico anterior como alternativa concreta.`,

  rector: `
INSTRUCCIONES DE FALLBACK PARA ESTE ROL:
1. Explica brevemente qué pasó (sin tecnicismos)
2. Da la ruta exacta del mapa de arriba
3. Ofrece ver el mismo dato en un período anterior si aplica`,

  profesor: `
INSTRUCCIONES DE FALLBACK PARA ESTE ROL:
1. Explica brevemente qué pasó (sin tecnicismos)
2. Da la ruta exacta del mapa de arriba
3. Ofrece una acción alternativa relacionada (ej: si no pudo registrar asistencia, ofrece ver el reporte del día anterior)`,

  padre: `
INSTRUCCIONES DE FALLBACK PARA ESTE ROL:
1. Explica en términos simples que no pudo obtener la información
2. Indica la ruta donde puede verlo directamente
3. Ofrece intentar con otro hijo/a si tiene más de uno registrado`,

  estudiante: `
INSTRUCCIONES DE FALLBACK PARA ESTE ROL:
1. Explica en términos simples que no pudo obtener la información
2. Indica la ruta donde puede verlo directamente`,

  default: `
INSTRUCCIONES DE FALLBACK:
1. Explica brevemente qué pasó (sin tecnicismos)
2. Indica al usuario que puede acceder directamente desde el menú principal`,
};

// ─── Función exportada ────────────────────────────────────────────────────────

/**
 * Construye un bloque de texto con el conocimiento de EvoOS relevante para el rol dado.
 * Incluye glosario, descripciones de módulos, rutas de fallback e instrucciones por rol.
 * Listo para concatenar al system prompt de Kiwi.
 */
export function buildEvoKnowledge(rol: UserRole): string {
  const parts: string[] = [];

  // 1. Glosario universal
  parts.push(GLOSARIO_EVO);

  // 2. Módulos disponibles para el rol
  const moduloKeys = MODULOS_POR_ROL[rol] ?? ['horario'];
  const moduloLines = moduloKeys
    .map((key) => {
      const m = MODULOS[key];
      if (!m) return null;
      return `- ${m.nombre} (${m.ruta}): ${m.descripcion}`;
    })
    .filter(Boolean)
    .join('\n');

  parts.push(`\nMÓDULOS DE EVO.OS DISPONIBLES PARA TU ROL:\n${moduloLines}`);

  // 3. Rutas de fallback del rol
  const routes = FALLBACK_ROUTES[rol] ?? '';
  if (routes) {
    parts.push(routes);
  }

  // 4. Instrucciones de fallback del rol
  const instructions = FALLBACK_INSTRUCTIONS[rol] ?? FALLBACK_INSTRUCTIONS.default;
  parts.push(instructions);

  return parts.join('\n');
}
