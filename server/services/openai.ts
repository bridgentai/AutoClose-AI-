import OpenAI from 'openai';
import { getOpenAITools } from './aiFunctions';
import { executeAction } from './actionExecutor';
import {
  buildRoleContext,
  formatContextForPrompt,
  buildSanitizerContextFromRoleContext,
} from './roleContextBuilder';
import { sanitizeMessages, sanitizeText, stripInternalStudentTokensForDisplay } from './llmSanitizer';
import {
  buildSystemPrompt as buildKiwiSystemPrompt,
  buildRoleTools,
  shouldCompressMemory,
  buildMemoryCompressionPrompt,
  extractKeyFacts,
} from './kiwiContext.js';
import type { KiwiUserContext } from './kiwiContext.js';
import { executeKiwiAction } from './kiwiActions.js';
import { buildEvoKnowledge } from './kiwiKnowledge.js';
import {
  getRecentMessages,
  upsertUserMemory,
} from '../repositories/kiwiRepository.js';
import type { KiwiMessageRow } from '../repositories/kiwiRepository.js';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// La API key ahora se lee dinámicamente en cada llamada para asegurar que siempre use la más reciente del .env

// Función para obtener la API key dinámicamente (para asegurar que se lea del .env correctamente)
function getOpenAIKey(): string | null {
  let rawKey = process.env.OPENAI_API_KEY || '';
  
  // Log detallado para debugging
  if (!rawKey) {
    console.error('[OpenAI] ❌ ERROR: OPENAI_API_KEY no está definida en process.env');
    console.error('   Verifica que el archivo .env esté en la raíz del proyecto');
    console.error('   Verifica que la línea sea: OPENAI_API_KEY=sk-proj-...');
    return null;
  }
  
  // Limpiar la key
  const cleanedKey = rawKey.trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, '')
    .replace(/\n/g, '')
    .replace(/\r/g, '');
  
  // Log solo si hay cambios después de limpiar
  if (cleanedKey.length !== rawKey.length) {
    console.log(`[OpenAI] Key limpiada: ${rawKey.length} -> ${cleanedKey.length} caracteres`);
  }
  
  if (!cleanedKey || cleanedKey.includes('placeholder') || cleanedKey.length < 20) {
    console.error('[OpenAI] ❌ ERROR: La API key está vacía, es un placeholder o es demasiado corta');
    console.error(`   Longitud: ${cleanedKey.length} caracteres`);
    return null;
  }
  
  // Verificar que no tenga asteriscos (indicador de truncado)
  if (cleanedKey.includes('*') || cleanedKey.includes('...')) {
    console.error('[OpenAI] ❌ ERROR: La API key contiene asteriscos, está truncada o enmascarada.');
    console.error('   Esto indica que la key en el .env está truncada o hay un problema al leerla.');
    console.error('   Solución: Copia la API key COMPLETA desde OpenAI Platform (sin asteriscos)');
    return null;
  }
  
  // Validar formato
  if (!cleanedKey.startsWith('sk-') && !cleanedKey.startsWith('skproj')) {
    console.error('[OpenAI] ❌ ERROR: La API key no tiene el formato correcto.');
    console.error(`   Debe empezar con "sk-" o "skproj"`);
    console.error(`   Primeros caracteres detectados: ${cleanedKey.substring(0, 15)}...`);
    return null;
  }
  
  return cleanedKey;
}

// Cache del cliente OpenAI para evitar crear múltiples instancias
let openaiClientCache: OpenAI | null = null;
let lastApiKey: string | null = null;

// Crear cliente OpenAI de forma lazy (solo cuando se necesite)
function getOpenAIClient(): OpenAI | null {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error('[OpenAI] ❌ No se pudo obtener una API key válida');
    return null;
  }
  
  // Si la key cambió o no hay cliente cacheado, crear uno nuevo
  if (!openaiClientCache || lastApiKey !== apiKey) {
    // Log solo la primera vez que se crea el cliente
    if (!openaiClientCache && process.env.LLM_DEBUG === 'true') {
      console.log('[OpenAI] ✅ Cliente OpenAI inicializado');
      console.log(`   Tipo: ${apiKey.startsWith('sk-proj-') ? 'Proyecto (sk-proj-)' : apiKey.startsWith('skproj') ? 'Proyecto (skproj)' : 'Estándar'}`);
      console.log(`   Longitud: ${apiKey.length} caracteres`);
    }
    
    openaiClientCache = new OpenAI({ apiKey });
    lastApiKey = apiKey;
  }
  
  return openaiClientCache;
}

// La inicialización del cliente se hace dinámicamente en cada función que lo necesita
// para asegurar que siempre lea la API key más reciente del .env

/**
 * Genera una respuesta de IA básica (sin Function Calling)
 * Mantiene compatibilidad con código existente
 */
export async function generateAIResponse(userMessage: string, context: {
  rol: string;
  colegioId: string;
  contextoTipo?: string;
}): Promise<string> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY no está configurada. Por favor, configura una clave válida de OpenAI en el archivo .env');
  }

  try {

    const systemPrompt = `Eres EvoOS, un asistente educativo personalizado para instituciones académicas.

Contexto:
- Rol del usuario: ${context.rol}
- Tipo de consulta: ${context.contextoTipo || 'general'}

Tu función es:
${context.rol === 'estudiante' ? 
  '- Ayudar al estudiante a comprender conceptos, resolver dudas académicas y guiar en sus tareas.\n- Ser paciente, claro y pedagógico.\n- Proporcionar explicaciones paso a paso cuando sea necesario.' :
  context.rol === 'profesor' ?
  '- Asistir al profesor en la planificación de clases, creación de materiales y metodologías educativas.\n- Sugerir recursos y estrategias pedagógicas.\n- Ayudar en la evaluación y seguimiento estudiantil.' :
  context.rol === 'directivo' ?
  '- Proporcionar análisis y métricas sobre el rendimiento institucional.\n- Sugerir mejoras en procesos administrativos y académicos.\n- Ayudar en la toma de decisiones estratégicas.' :
  '- Ayudar al padre/madre a entender el progreso académico de su hijo/a.\n- Explicar conceptos educativos y metodologías.\n- Proporcionar orientación sobre cómo apoyar el aprendizaje en casa.'
}

Importante:
- Responde en español de Colombia
- Sé conciso pero completo
- Usa un tono profesional pero amigable
- Si no tienes información específica del currículo, indica que es una respuesta general
`;

    const { sanitized: sanitizedSystem } = sanitizeText(systemPrompt);
    const { sanitized: safeUserMessage } = sanitizeText(userMessage);

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: sanitizedSystem },
        { role: 'user', content: safeUserMessage }
      ],
      max_completion_tokens: 1500,
    });

    return response.choices[0].message.content || 'Lo siento, no pude generar una respuesta.';
  } catch (error: any) {
    console.error('Error en OpenAI:', error.message);
    if (error.message?.includes('API key')) {
      throw new Error('La clave de API de OpenAI no es válida. Por favor, verifica OPENAI_API_KEY en el archivo .env');
    }
    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      throw new Error('Se ha excedido el límite de uso de la API de OpenAI. Por favor, intenta más tarde.');
    }
    throw new Error(`Error al generar respuesta de IA: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Genera una respuesta de IA con Function Calling.
 * Recibe historial + mensaje actual y construye [system, ...historial, userMessage]. Roles en minúscula.
 */
export async function generateAIResponseWithFunctions(
  userMessage: string,
  userId: string,
  role: string,
  colegioId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
): Promise<string | { response: string; executedActions: string[]; actionData?: Record<string, any> }> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY no está configurada. Por favor, configura una clave válida de OpenAI en el archivo .env');
  }

  try {
    const roleContext = await buildRoleContext(userId, role, colegioId);
    const contextPrompt = formatContextForPrompt(roleContext);
    const systemPrompt = buildSystemPrompt(role, roleContext) + contextPrompt;
    const tools = getOpenAITools(role);

    const historialNormalizado = conversationHistory.map((m) => ({
      role: (String(m.role ?? 'user').toLowerCase()) as 'user' | 'assistant',
      content: m.content ?? '',
    }));

    const messagesToSend: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...historialNormalizado,
      { role: 'user', content: userMessage ?? '' },
    ];

    const llmSanitizeCtx = buildSanitizerContextFromRoleContext(roleContext);
    const { messages: sanitizedMessages } = sanitizeMessages(messagesToSend as any[], llmSanitizeCtx);

    console.log(`[OpenAI] Enviando ${messagesToSend.length} mensajes al modelo gpt-4o`);

    let response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: sanitizedMessages as any,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      max_completion_tokens: 2000,
    });

    let finalResponse = response.choices[0].message.content || '';
    let functionCalls = response.choices[0].message.tool_calls || [];
    const executedActions: string[] = []; // Track executed actions
    const actionData: Record<string, any> = {}; // Track action data

    // Procesar function calls si existen
    while (functionCalls.length > 0) {
      // Agregar la respuesta del asistente con function calls
      messagesToSend.push({
        role: 'assistant',
        content: finalResponse || null,
        tool_calls: functionCalls.map((call: any) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.function.name,
            arguments: call.function.arguments
          }
        }))
      } as any);

      // Ejecutar todas las funciones llamadas
      const functionResults = await Promise.all(
        functionCalls.map(async (call: any) => {
          const functionName = call.function.name;
          let parameters: Record<string, any> = {};
          
          try {
            parameters = JSON.parse(call.function.arguments || '{}');
          } catch (e) {
            console.error('Error parsing function arguments:', e);
          }

          try {
            const result = await executeAction(functionName, parameters, userId, role, colegioId);
            
            // Track executed action if successful
            if (result.success) {
              executedActions.push(functionName);
              // Store action data for frontend
              if (result.data) {
                actionData[functionName] = result.data;
              }
            }
            
            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              name: functionName,
              content: JSON.stringify({
                success: result.success,
                data: result.data,
                message: result.message,
                error: result.error
              })
            };
          } catch (error: any) {
            return {
              tool_call_id: call.id,
              role: 'tool' as const,
              name: functionName,
              content: JSON.stringify({
                success: false,
                error: error.message || 'Error al ejecutar la función'
              })
            };
          }
        })
      );

      // Agregar resultados de funciones
      messagesToSend.push(...functionResults as any);

      const { messages: sanitizedLoopMessages } = sanitizeMessages(messagesToSend as any[], llmSanitizeCtx);

      // Llamar nuevamente a OpenAI con los resultados
      response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: sanitizedLoopMessages as any,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        max_completion_tokens: 2000,
      });

      finalResponse = response.choices[0].message.content || '';
      functionCalls = response.choices[0].message.tool_calls || [];
    }

    // Return response with executed actions if any actions were executed
    if (executedActions.length > 0) {
      return {
        response: finalResponse || 'Lo siento, no pude generar una respuesta.',
        executedActions: executedActions,
        actionData: Object.keys(actionData).length > 0 ? actionData : undefined,
      };
    }
    
    return finalResponse || 'Lo siento, no pude generar una respuesta.';
  } catch (error: any) {
    console.error('Error en OpenAI con Function Calling:', error.message);
    
    // Manejar errores específicos de autenticación
    if (error.status === 401 || error.message?.includes('401') || error.message?.includes('Incorrect API key')) {
      const currentKey = getOpenAIKey();
      console.error('❌ ERROR DE AUTENTICACIÓN: La API key de OpenAI es incorrecta o inválida.');
      console.error('   Verifica que:');
      console.error('   1. La API key en el archivo .env sea correcta y COMPLETA (sin asteriscos ni truncado)');
      console.error('   2. La API key no tenga espacios extra, comillas o caracteres especiales');
      console.error('   3. La API key empiece con "sk-" o "skproj"');
      console.error('   4. La API key tenga créditos disponibles en tu cuenta de OpenAI');
      console.error('   5. La API key no esté enmascarada o truncada (no debe tener asteriscos en el medio)');
      if (process.env.LLM_DEBUG === 'true' && currentKey) {
        console.error(`   API key detectada (primeros 20 chars): ${currentKey.substring(0, 20)}...`);
        console.error(`   API key detectada (últimos 10 chars): ...${currentKey.substring(currentKey.length - 10)}`);
      } else if (!currentKey) {
        console.error('   No se pudo leer la API key del .env');
      }
      throw new Error('La clave de API de OpenAI no es válida. Verifica que la API key en el archivo .env sea completa (sin asteriscos), correcta y tenga créditos disponibles.');
    }
    
    if (error.message?.includes('rate limit') || error.message?.includes('quota')) {
      throw new Error('Se ha excedido el límite de uso de la API de OpenAI. Por favor, intenta más tarde.');
    }
    
    throw new Error(`Error al generar respuesta de IA: ${error.message || 'Error desconocido'}`);
  }
}

/**
 * Construye el system prompt dinámico según el rol
 */
function buildSystemPrompt(role: string, context: any): string {
  const basePrompt = `Eres EvoOS, el asistente educativo inteligente de EvoOS. Tu función es ayudar a los usuarios a realizar tareas académicas mediante lenguaje natural.

IMPORTANTE: Responde SIEMPRE en español de Colombia. Sé claro, conciso y útil.

⚠️⚠️⚠️ CONTEXTO Y MEMORIA DE LA CONVERSACIÓN (CRÍTICO) ⚠️⚠️⚠️:
- Tienes acceso COMPLETO al historial de la conversación que se muestra arriba
- El historial incluye TODOS los mensajes previos (usuario y asistente) de esta conversación
- DEBES LEER y USAR el historial completo antes de responder
- Si el usuario mencionó algo en un mensaje anterior, esa información está DISPONIBLE y DEBES usarla
- NO vuelvas a pedir información que ya fue proporcionada en mensajes anteriores - REVISA el historial primero
- Acumula información de múltiples mensajes: si el usuario dice "permiso" en un mensaje y "para Juan" en otro, usa AMBOS
- Si falta información, pide SOLO lo que falta, mencionando explícitamente lo que ya tienes del historial
- Mantén el contexto: si están hablando de crear un permiso, continúa con ese tema sin cambiar de tema
- Ejemplo: Si en el historial el usuario dijo "quiero crear un permiso" y luego dice "para Juan", ya tienes que es un permiso para Juan. No preguntes "¿qué tipo de permiso?" sin mencionar que ya sabes que es para Juan.

⚠️ IMPORTANTE SOBRE TUS HERRAMIENTAS:
- Tienes acceso a funciones/tools que puedes usar para realizar acciones
- Cuando el usuario solicite algo que puedas hacer con una función disponible, DEBES usar esa función
- NUNCA digas que no puedes hacer algo si tienes una función disponible para hacerlo
- Revisa siempre tus herramientas disponibles antes de decir que no puedes hacer algo`;

  const roleSpecificPrompts: Record<string, string> = {
    estudiante: `
RESTRICCIONES ESTRICTAS:
- Solo puedes consultar información del ESTUDIANTE ACTUAL
- NO puedes ver notas de otros estudiantes
- NO puedes ver información de otros cursos
- NO puedes asignar tareas (solo profesores)
- NO puedes calificar tareas (solo profesores)
- NO puedes consultar notas de un curso completo (solo profesores pueden hacerlo)

FUNCIONES DISPONIBLES:
- consultar_notas_estudiante: Ver tus propias notas
- consultar_materias: Ver tus materias asignadas
- consultar_tareas: Ver tus tareas (puedes filtrar por estado: pendiente, entregada, calificada)
- entregar_tarea: Entregar una tarea con archivos adjuntos
- consultar_calendario: Ver eventos y fechas importantes
- consultar_notificaciones: Ver tus notificaciones

EJEMPLOS DE USO:
- "¿Cuántas materias voy perdiendo y cuáles son mis notas?" → Usa consultar_notas_estudiante
- "¿Qué tareas tengo pendientes?" → Usa consultar_tareas con estado="pendiente"
- "Entregar mi tarea de Matemáticas" → Usa entregar_tarea
`,

    profesor: `
RESTRICCIONES ESTRICTAS:
- Solo puedes acceder a información de TUS materias asignadas
- NO puedes acceder a información personal sensible de estudiantes (dirección, datos privados)
- NO puedes ver información de materias que no te pertenecen
- Puedes ver notas de curso completo SOLO de tus materias asignadas

TERMINOLOGÍA IMPORTANTE:
- "CURSOS" son los GRUPOS (ej: 12C, 12D, 11C, 11D, 9B, etc.), NO las materias
- "MATERIAS" son las asignaturas que dictas (ej: Sociales, Matemáticas, etc.)
- Cada materia puede tener varios grupos (cursos) asignados
- Cuando el usuario dice "12C" o "curso 12C", se refiere al GRUPO 12C, no a una materia

MEMORIA Y CONTEXTO (CRÍTICO):
- Tienes acceso COMPLETO al historial de la conversación en cada mensaje
- El historial incluye TODOS los mensajes previos (usuario y asistente)
- DEBES LEER y USAR la información del historial antes de responder
- Si el usuario mencionó algo en un mensaje anterior, esa información está DISPONIBLE para ti
- NO vuelvas a pedir información que ya fue proporcionada - REVISA el historial primero
- Acumula información de múltiples mensajes: si el usuario dice "12C" en un mensaje y "taller 5" en otro, usa AMBOS
- Si falta información, pide SOLO lo que falta, mencionando lo que ya tienes
- Ejemplo: Si ya tienes grupo y fecha, di "Ya tengo el grupo 12C y la fecha 25 de enero. Solo necesito el título y descripción de la tarea."

FUNCIONES DISPONIBLES:
- consultar_notas_curso: Ver notas de un grupo completo (solo tus grupos)
- consultar_materias: Ver tus materias asignadas (incluye información de grupos/cursos)
- consultar_tareas: Ver tareas de tus materias
- asignar_tarea: Crear una nueva tarea para un grupo (curso) específico
- calificar_tarea: Calificar una tarea entregada
- subir_nota: Registrar una nota para un estudiante
- modificar_fecha_tarea: Cambiar la fecha de entrega de una tarea
- enviar_comentario: Enviar comentario a un estudiante
- crear_boletin: Generar boletín académico para un grupo
- consultar_estudiantes_curso: Ver lista de estudiantes de un grupo
- consultar_calendario: Ver eventos del calendario
- consultar_notificaciones: Ver tus notificaciones
- crear_logros_calificacion: ⚠️ FUNCIÓN DISPONIBLE - Crear o configurar los logros de calificación (criterios de evaluación) para una materia. Los logros definen los porcentajes de cada tipo de evaluación (tareas, exámenes, proyectos, etc.) y deben sumar 100%. Cuando el usuario dice "crea los logros para [materia] de esta manera: tareas 30%, proyectos 30%, exámenes 40%", DEBES usar esta función inmediatamente. Puedes usar el nombre de la materia (ej: "Física 11H") o el ID del curso.

IMPORTANTE PARA ASIGNAR TAREAS:
- Cuando el usuario dice "12C", "12D", "11C", etc., se refiere a un GRUPO (curso)
- Usa el parámetro "grupo" con el nombre del grupo (ej: "12C", "9B", "11D")
- El sistema buscará automáticamente la materia asignada al profesor que incluye ese grupo
- NO uses "cursoId" o "materiaId" directamente a menos que sea absolutamente necesario
- El contexto muestra tus materias y los grupos (cursos) asignados a cada una
- Si el usuario proporciona información en múltiples mensajes, ACUMULA esa información antes de llamar a asignar_tarea

EJEMPLOS DE USO:
- Usuario: "asigna una tarea" → Responde pidiendo detalles
- Usuario: "para 12C el 25 Enero" → Recuerda grupo="12C" y fecha="2025-01-25", pide título y descripción
- Usuario: "el titulo es taller 5 y la descripcion es que tienen que armar un lego" → Ya tienes TODO: grupo="12C", fecha="2025-01-25", título="taller 5", descripción="que tienen que armar un lego". Llama a asignar_tarea con TODOS estos parámetros
- "Muéstrame las notas del 12C" → Usa consultar_notas_curso con el grupo correspondiente
- "Califica la tarea de Juan Pérez con 4.5" → Usa calificar_tarea
- "crea los logros en la parte de logros de calificación para fisica11h de esta manera: tareas 30 porciento, proyectos 30 porciento, y examenes 40 porceinto" → Usa crear_logros_calificacion con courseId="Física 11H" (o el ID si lo tienes) y logros=[{nombre:"tareas", porcentaje:30}, {nombre:"proyectos", porcentaje:30}, {nombre:"examenes", porcentaje:40}], reemplazar=true
- "configura los logros de calificación para Matemáticas 10A: tareas 25%, exámenes 50%, proyectos 25%" → Usa crear_logros_calificacion inmediatamente con los datos proporcionados
`,

    padre: `
⚠️⚠️⚠️ ATENCIÓN: ERES UN ASISTENTE PARA PADRES Y TIENES ACCESO COMPLETO A CREAR PERMISOS ⚠️⚠️⚠️

RESTRICCIONES ESTRICTAS:
- Solo puedes consultar información de TUS HIJOS
- NO puedes acceder a información de otros estudiantes
- NO puedes ver información de cursos completos
- Solo puedes ver información académica (no datos privados)

FUNCIONES DISPONIBLES (TIENES ACCESO COMPLETO A ESTAS FUNCIONES):
- consultar_informacion_hijo: Ver información académica completa de tu hijo (notas, tareas, materias)
- crear_permiso: ⚠️⚠️⚠️ FUNCIÓN DISPONIBLE Y ACTIVA ⚠️⚠️⚠️ - Crear un permiso de salida/transporte para tu hijo/a. ESTA FUNCIÓN ESTÁ DISPONIBLE EN TUS HERRAMIENTAS Y DEBES USARLA cuando el usuario solicite crear un permiso.
- consultar_calendario: Ver eventos del calendario
- consultar_notificaciones: Ver tus notificaciones

IMPORTANTE: La función "crear_permiso" está en tu lista de herramientas disponibles. Cuando el usuario solicite crear un permiso, DEBES usar esta función. NUNCA digas que no tienes acceso o que no puedes hacerlo.

MEMORIA Y CONTEXTO DE CONVERSACIÓN (CRÍTICO):
- El historial de conversación arriba contiene TODOS los mensajes previos de esta conversación
- DEBES LEER el historial completo antes de responder
- Si el usuario mencionó algo en un mensaje anterior, esa información está DISPONIBLE - úsala
- NO hagas preguntas sobre información que ya está en el historial
- Mantén el contexto: si están hablando de crear un permiso, continúa con ese tema
- Acumula información de múltiples mensajes antes de actuar
- Ejemplo: Si en el historial el usuario dijo "quiero crear un permiso" y luego dice "para Juan", ya sabes que es un permiso para Juan. No preguntes "¿qué tipo de permiso?" sin mencionar que ya sabes que es para Juan.

⚠️⚠️⚠️ INSTRUCCIONES CRÍTICAS SOBRE PERMISOS DE SALIDA/TRANSPORTE ⚠️⚠️⚠️:

DEFINICIÓN:
- "Permiso de salida" = "Permiso de transporte" = Autorización para que el estudiante salga del colegio usando un medio de transporte diferente al habitual
- Cuando el usuario dice "permiso de salida", "necesito hacer un permiso", "quiero un permiso", "permiso para mi hijo", etc., se refiere a crear un PERMISO DE TRANSPORTE/SALIDA
- TÚ TIENES ACCESO COMPLETO a crear estos permisos usando la función crear_permiso
- NUNCA digas que no puedes crear permisos. SIEMPRE puedes hacerlo.

TIPOS DE PERMISOS DE TRANSPORTE/SALIDA (5 opciones):
1. "ruta-a-carro": El estudiante normalmente usa ruta escolar, pero ese día saldrá en carro particular
2. "carro-a-ruta": El estudiante normalmente usa carro particular, pero ese día usará ruta escolar
3. "ruta-a-ruta": El estudiante cambiará de una ruta escolar a otra ruta escolar
4. "carro-a-carro": El estudiante cambiará de un carro particular a otro carro particular
5. "salida-caminando": El estudiante saldrá caminando (no requiere transporte)

CUANDO EL USUARIO SOLICITA UN PERMISO:
1. Inmediatamente reconoce que es un PERMISO DE TRANSPORTE/SALIDA
2. Pregunta qué tipo de permiso necesita (ruta a carro, carro a ruta, cambio de ruta, cambio de carro, o salida caminando)
3. Pide la información necesaria según el tipo
4. Una vez que tengas TODA la información, USA crear_permiso inmediatamente

⚠️⚠️⚠️ REGLAS CRÍTICAS DE CAMPOS REQUERIDOS POR TIPO (DEBES seguir estas reglas EXACTAMENTE) ⚠️⚠️⚠️:

1. "ruta-a-carro": El estudiante normalmente usa ruta, ese día sale en carro.
   REQUERIDOS: tipoPermiso, nombreEstudiante, fecha, numeroRutaActual, placaCarroSalida, nombreConductor, cedulaConductor
   NO REQUERIDOS: numeroRutaCambio, placaCarroActual
   → Solo pide: nombre del estudiante, fecha, número de ruta actual, placa del carro en el que sale, nombre del conductor, cédula del conductor

2. "carro-a-ruta": El estudiante normalmente usa carro, ese día usará ruta.
   REQUERIDOS: tipoPermiso, nombreEstudiante, fecha, numeroRutaCambio, placaCarroActual, placaCarroSalida, nombreConductor, cedulaConductor
   NO REQUERIDOS: numeroRutaActual
   → Solo pide: nombre del estudiante, fecha, número de ruta a la que cambia, placa del carro actual, placa del carro en el que sale, nombre del conductor, cédula del conductor

3. "ruta-a-ruta": Cambio de ruta escolar.
   REQUERIDOS: tipoPermiso, nombreEstudiante, fecha, numeroRutaActual, numeroRutaCambio
   NO REQUERIDOS: placaCarroActual, placaCarroSalida, nombreConductor, cedulaConductor
   → Solo pide: nombre del estudiante, fecha, número de ruta actual, número de ruta a la que cambia
   → NO pidas información de carro ni conductor (no aplica para este tipo)

4. "carro-a-carro": Cambio de carro particular.
   REQUERIDOS: tipoPermiso, nombreEstudiante, fecha, placaCarroActual, placaCarroSalida, nombreConductor, cedulaConductor
   NO REQUERIDOS: numeroRutaActual, numeroRutaCambio
   → Solo pide: nombre del estudiante, fecha, placa del carro actual, placa del carro nuevo, nombre del conductor, cédula del conductor
   → NO pidas información de rutas (no aplica para este tipo)

5. "salida-caminando": Salida a pie, no requiere transporte.
   REQUERIDOS: tipoPermiso, nombreEstudiante, fecha
   NO REQUERIDOS: Todos los demás campos (numeroRutaActual, numeroRutaCambio, placaCarroActual, placaCarroSalida, nombreConductor, cedulaConductor)
   → Solo pide: nombre del estudiante, fecha
   → NO pidas información de rutas ni carros (no aplica para este tipo)

EJEMPLOS DE CONVERSACIÓN:
Usuario: "Necesito hacer un permiso de salida"
→ TÚ: "¡Por supuesto! Puedo ayudarte a crear un permiso de transporte. ¿Qué tipo de permiso necesitas? Las opciones son: salida en carro (si normalmente usa ruta), cambio a ruta (si normalmente usa carro), cambio de ruta, cambio de carro, o salida caminando."

Usuario: "Mi hijo normalmente va en ruta pero mañana sale en carro"
→ TÚ: "Perfecto, es un permiso tipo 'ruta-a-carro'. Necesito: nombre completo del estudiante, fecha, número de ruta actual, placa del carro en el que saldrá, nombre del conductor y cédula del conductor."

Usuario: "Quiero un permiso para cambiar de ruta"
→ TÚ: "Perfecto, es un permiso tipo 'ruta-a-ruta'. Necesito: nombre completo del estudiante, fecha, número de ruta actual y número de ruta a la que cambiará."

Usuario: "Quiero un permiso para que mi hijo salga caminando el viernes"
→ TÚ: "Perfecto, es un permiso tipo 'salida-caminando'. Necesito: nombre completo del estudiante y la fecha exacta (formato YYYY-MM-DD)."

IMPORTANTE:
- Acumula información de múltiples mensajes del historial
- Si falta información, pregunta SOLO los campos requeridos para ese tipo específico
- NO pidas información que NO es requerida para ese tipo (ej: no pidas datos de carro si es "ruta-a-ruta")
- Una vez que tengas TODA la información requerida para ese tipo, crea el permiso INMEDIATAMENTE usando crear_permiso
- NUNCA digas que no puedes hacerlo - SIEMPRE puedes crear permisos
`,

    directivo: `
RESTRICCIONES:
- Tienes acceso amplio pero debes respetar la privacidad de los datos personales
- Puedes crear boletines y modificar fechas de tareas

FUNCIONES DISPONIBLES:
- consultar_notas_curso: Ver notas de cualquier curso
- consultar_materias: Ver todas las materias
- consultar_tareas: Ver todas las tareas
- modificar_fecha_tarea: Modificar fechas de tareas
- crear_boletin: Crear boletines académicos
- consultar_estudiantes_curso: Ver estudiantes de cualquier curso
- consultar_calendario: Ver eventos del calendario
- consultar_notificaciones: Ver notificaciones
`
  };

  return basePrompt + (roleSpecificPrompts[role] || '');
}

export type AcademicInsightRole =
  | 'profesor'
  | 'estudiante'
  | 'padre'
  | 'directivo'
  | 'boletin';

/** Context for AI-generated academic insights (Vista analítica multirrol) */
export interface AcademicInsightsContext {
  studentName: string;
  courseName: string;
  weightedAverage: number | null;
  byCategory: Array<{ categoryName: string; percentage: number; average: number; count: number }>;
  forecast?: { projectedFinalGrade: number; riskProbabilityPercent?: number } | null;
  risk?: { level: string; factors: string[] } | null;
  engineInsights?: string[];
  /** Comparativa grupal básica (para percentil/ranking) */
  groupComparison?: {
    groupAverage: number | null;
    percentile: number | null;
    rank: number | null;
    totalStudents: number;
  };
  /** Indicadores de compromiso (asistencia, puntualidad, tareas) en 0–1 */
  commitment?: {
    attendanceRate: number | null;
    punctualityRate: number | null;
    tasksCompletionRate: number | null;
    commitmentIndex: number | null;
  };
  /** Rol objetivo de la narrativa generada */
  role?: AcademicInsightRole;
}

/**
 * Generates a short natural-language academic summary for the analytics view.
 * Used when snapshot/forecast/risk exist or when we have grades from assignments+logros.
 */
export async function generateAcademicInsightsSummary(
  context: AcademicInsightsContext
): Promise<string> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    return 'Configura OPENAI_API_KEY en .env para ver el análisis con IA.';
  }

  const parts: string[] = [];
  parts.push(`Estudiante: [EST_1]. Materia: ${context.courseName}.`);
  if (context.weightedAverage != null) {
    parts.push(`Promedio ponderado actual: ${context.weightedAverage.toFixed(1)}/100.`);
  }
  if (context.byCategory.length > 0) {
    parts.push(
      'Desglose por categoría: ' +
        context.byCategory
          .map(
            (c) =>
              `${c.categoryName} (${c.percentage}%): ${c.average.toFixed(1)}/100, ${c.count} nota(s)`
          )
          .join('; ') +
        '.'
    );
  }
  if (context.forecast?.projectedFinalGrade != null) {
    parts.push(
      `Proyección final: ${context.forecast.projectedFinalGrade.toFixed(1)}/100.` +
        (context.forecast.riskProbabilityPercent != null
          ? ` Probabilidad de riesgo: ${context.forecast.riskProbabilityPercent}%.`
          : '')
    );
  }
  if (context.risk?.level) {
    parts.push(`Nivel de riesgo: ${context.risk.level}. Factores: ${(context.risk.factors || []).join(', ') || 'ninguno'}.`);
  }
  if (context.engineInsights?.length) {
    parts.push(`Insights del sistema: ${context.engineInsights.join('. ')}`);
  }
  if (context.groupComparison) {
    const { groupAverage, percentile, rank, totalStudents } = context.groupComparison;
    if (groupAverage != null) {
      parts.push(`Promedio del grupo: ${groupAverage.toFixed(1)}/100.`);
    }
    if (percentile != null && rank != null && totalStudents > 0) {
      parts.push(`Posición relativa: percentil ${percentile.toFixed(1)}, puesto ${rank} de ${totalStudents} estudiantes.`);
    }
  }
  if (context.commitment) {
    const { attendanceRate, punctualityRate, tasksCompletionRate, commitmentIndex } =
      context.commitment;
    const toPct = (v: number | null | undefined) =>
      v != null ? `${Math.round(v * 100)}%` : undefined;
    const pieces: string[] = [];
    const att = toPct(attendanceRate);
    const pun = toPct(punctualityRate);
    const tasks = toPct(tasksCompletionRate);
    if (att) pieces.push(`asistencia ${att}`);
    if (pun) pieces.push(`puntualidad ${pun}`);
    if (tasks) pieces.push(`entrega de tareas ${tasks}`);
    if (pieces.length > 0) {
      parts.push(
        `Compromiso observado: ${pieces.join(', ')}${
          commitmentIndex != null ? ` (índice global ${Math.round(commitmentIndex * 100)}%).` : '.'
        }`
      );
    }
  }

  const dataBlock = parts.join('\n');
  const { sanitized: sanitizedDataBlock } = sanitizeText(dataBlock, {
    studentNames: [context.studentName],
    teacherNames: [],
  });
  const role: AcademicInsightRole = context.role ?? 'profesor';

  const promptsByRole: Record<AcademicInsightRole, string> = {
    profesor:
      'Eres un asistente académico para un profesor. Genera un resumen breve (2 a 5 oraciones) en español (Colombia), claro, técnico‑pedagógico y orientado a acciones concretas en clase.',
    estudiante:
      'Eres un tutor académico enfocado en ayudar al estudiante a mejorar su desempeño. En 2 a 5 oraciones, en español (Colombia), usa lenguaje cercano y motivador. Destaca qué está haciendo bien, identifica la categoría o área que más debe reforzar según los datos, y da 1 o 2 acciones concretas para subir sus notas (por ejemplo: entregar a tiempo, repasar X, pedir ayuda en Y). El tono debe ser de apoyo y orientado a la mejora.',
    padre:
      'Eres un orientador académico que se comunica con familias. Escribe en segunda persona y comienza con "Tu hijo/a...". Resume en 2 a 5 oraciones la situación del estudiante en lenguaje muy claro, respetuoso y no técnico. Incluye sugerencias concretas para mejorar (hábitos, rutina, seguimiento en casa) y una recomendación breve de conversación con el docente si aplica.',
    directivo:
      'Eres un asesor académico para directivos de un colegio. En 2 a 5 oraciones da una visión ejecutiva del rendimiento y riesgo del estudiante en esta materia, con foco en decisiones de seguimiento institucional.',
    boletin:
      'Eres un asesor académico que redacta un párrafo para un boletín institucional. En 3 a 6 oraciones describe de forma formal el desempeño del estudiante, sus fortalezas, aspectos a mejorar y recomendaciones para el próximo periodo.',
  };

  const systemPrompt = promptsByRole[role];

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Contexto del estudiante y sus notas:\n${sanitizedDataBlock}\n\nImportante: en tu respuesta no incluyas códigos internos como [EST_1] ni la forma EST_1.\n- Si el rol es "padre": empieza con "Tu hijo/a..." y habla en segunda persona.\n- En otros roles: refiere al alumno como "el estudiante" o "el/la estudiante".\n\nGenera el resumen e insights en prosa (solo texto, sin viñetas).`,
        },
      ],
      max_tokens: 400,
    });
    const raw = response.choices[0]?.message?.content?.trim() || 'No se pudo generar el resumen.';
    return stripInternalStudentTokensForDisplay(raw);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAI] generateAcademicInsightsSummary error:', msg);
    return 'Error al generar el análisis con IA. Verifica OPENAI_API_KEY.';
  }
}

export interface DirectivoSectionAnalyticsContext {
  sectionName: string;
  promedioSeccion: number | null;
  cursos: Array<{
    nombre: string;
    promedio: number | null;
    estudiantes: number;
    enRiesgo: number;
    enAlerta: number;
    alDia: number;
  }>;
}

/**
 * Informe narrativo para la vista analítica de notas del director de sección (datos agregados).
 */
export async function generateDirectivoSectionAnalyticsSummary(
  context: DirectivoSectionAnalyticsContext
): Promise<string> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    return 'Configura OPENAI_API_KEY en .env para ver el análisis con IA.';
  }

  const lines: string[] = [];
  lines.push(`Sección: ${context.sectionName}.`);
  if (context.promedioSeccion != null) {
    lines.push(
      `Promedio general de la sección (escala 0–100, metodología jerárquica institucional): ${context.promedioSeccion.toFixed(1)}.`
    );
  }
  if (context.cursos.length > 0) {
    lines.push('Resumen por curso:');
    for (const c of context.cursos) {
      const p = c.promedio != null ? `${c.promedio.toFixed(1)}/100` : 'sin promedio calculable';
      lines.push(
        `- Curso ${c.nombre}: promedio ${p}; matrícula ${c.estudiantes}; estudiantes con promedio holístico bajo (<65): ${c.enRiesgo}; entre 65 y 74: ${c.enAlerta}; en 75 o más: ${c.alDia}.`
      );
    }
  }

  const { sanitized: safe } = sanitizeText(lines.join('\n'), {
    studentNames: [],
    teacherNames: [],
  });

  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres un asesor académico para directivos de colegios en Colombia. Con datos agregados por curso (sin nombres de estudiantes), redacta un informe breve de 4 a 8 oraciones en español: panorama del rendimiento de la sección, cursos prioritarios para seguimiento, lectura de la distribución de riesgo, y 2 o 3 recomendaciones accionables. Tono ejecutivo, claro y respetuoso. Solo prosa.',
        },
        { role: 'user', content: `Datos para analizar:\n${safe}` },
      ],
      max_tokens: 550,
    });
    return response.choices[0]?.message?.content?.trim() || 'No se pudo generar el análisis.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAI] generateDirectivoSectionAnalyticsSummary:', msg);
    return 'Error al generar el análisis con IA.';
  }
}

/**
 * Genera el resumen de boletín con OpenAI (3-4 oraciones).
 * Retorna null si no hay API key o hay error, para que la ruta use texto de respaldo.
 */
export async function generateBoletinResumen(prompt: string): Promise<string | null> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) return null;
  const { sanitized: safePrompt } = sanitizeText(prompt);
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres un orientador académico. Genera un boletín personalizado en español en 3-4 oraciones. Menciona fortalezas, áreas de mejora y una recomendación concreta. Sé empático y constructivo.',
        },
        { role: 'user', content: safePrompt },
      ],
      max_completion_tokens: 300,
    });
    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAI] generateBoletinResumen error:', msg);
    return null;
  }
}

// ─── Kiwi ─────────────────────────────────────────────────────────────────────

/**
 * Comprime el historial de mensajes en un resumen y lo persiste en ai_memory.
 * Fire-and-forget — nunca interrumpe el flujo principal.
 */
async function compressAndSaveMemory(
  messages: KiwiMessageRow[],
  userId: string,
  institutionId: string,
  userRole: string
): Promise<void> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) return;

  const compressionPrompt = buildMemoryCompressionPrompt(messages);
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: compressionPrompt }],
    max_tokens: 200,
  });

  const summary = response.choices[0]?.message?.content?.trim() ?? '';
  if (!summary) return;

  const facts = extractKeyFacts(messages);
  const keyFacts = Object.values(facts).filter((v) => v.length > 0);

  await upsertUserMemory(userId, institutionId, userRole, summary, keyFacts);
}

/**
 * Genera una respuesta de Kiwi con streaming y function calling.
 * Carga historial, construye el prompt por rol, llama gpt-4o-mini en streaming
 * y notifica al caller via callbacks. Nunca lanza excepciones al caller.
 */
export async function generateKiwiResponse(
  userMessage: string,
  kiwiContext: KiwiUserContext,
  onChunk: (chunk: string) => void,
  onComplete: (fullResponse: string, tokensUsed: number) => void,
  onError: (error: Error) => void
): Promise<void> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    onError(new Error('OPENAI_API_KEY no está configurada. Configura una clave válida en el archivo .env'));
    return;
  }

  try {
    // 1. Historial reciente
    const recentMessages = await getRecentMessages(kiwiContext.sessionId, 12);

    // 2. Construir mensajes para OpenAI
    const history = recentMessages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: buildKiwiSystemPrompt(kiwiContext, kiwiContext.memory) + '\n\n' + buildEvoKnowledge(kiwiContext.rol),
      },
      ...history,
      { role: 'user', content: sanitizeText(userMessage).sanitized },
    ];

    // 3. Tools del rol en formato OpenAI
    const roleTools = buildRoleTools(kiwiContext.rol);
    const openAITools = roleTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters ?? { type: 'object', properties: {} },
      },
    }));

    // 4. Primera llamada — streaming
    const stream = await openaiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: openAITools.length > 0 ? openAITools : undefined,
      tool_choice: openAITools.length > 0 ? 'auto' : undefined,
      max_tokens: 400,
      temperature: 0.7,
      stream: true,
      stream_options: { include_usage: true },
    });

    // 5. Procesar stream
    let fullResponse = '';
    let tokensUsed = 0;
    const accumulatedToolCalls: Record<number, {
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }> = {};

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;

      if (delta?.content) {
        fullResponse += delta.content;
        onChunk(delta.content);
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          if (!accumulatedToolCalls[idx]) {
            accumulatedToolCalls[idx] = { id: tc.id ?? '', type: 'function', function: { name: '', arguments: '' } };
          }
          if (tc.id) accumulatedToolCalls[idx].id = tc.id;
          if (tc.function?.name) accumulatedToolCalls[idx].function.name += tc.function.name;
          if (tc.function?.arguments) accumulatedToolCalls[idx].function.arguments += tc.function.arguments;
        }
      }

      if (chunk.usage?.total_tokens) {
        tokensUsed = chunk.usage.total_tokens;
      }
    }

    // 6. Ejecutar tool calls si los hay
    const toolCallsList = Object.values(accumulatedToolCalls);
    if (toolCallsList.length > 0) {
      // Ejecutar todas las tool calls con executeKiwiAction
      const kiwiResults = await Promise.all(
        toolCallsList.map(async (tc) => {
          let params: Record<string, unknown> = {};
          try { params = JSON.parse(tc.function.arguments || '{}'); } catch { /* ignore */ }

          const result = await executeKiwiAction(
            tc.function.name,
            params,
            kiwiContext.institutionId,
            kiwiContext.userId,
            kiwiContext.rol
          );
          return { tc, result };
        })
      );

      // Si alguna tool requiere confirmación del usuario: emitir señal al frontend y salir
      const pendingConfirmation = kiwiResults.find((r) => 'requiresConfirmation' in r.result && r.result.requiresConfirmation === true);
      if (pendingConfirmation) {
        const confirmMsg = '__CONFIRM__:' + JSON.stringify((pendingConfirmation.result as { requiresConfirmation: true; preview: unknown }).preview);
        onChunk(confirmMsg);
        onComplete(confirmMsg, tokensUsed);
        return;
      }

      // Construir tool results para el follow-up a OpenAI
      const toolResults = kiwiResults.map(({ tc, result }) => ({
        tool_call_id: tc.id,
        role: 'tool' as const,
        content: result.success
          ? JSON.stringify({ success: true, data: (result as { success: true; data: unknown }).data })
          : JSON.stringify({ success: false, error: (result as { success: false; error: string }).error ?? 'Error al ejecutar la acción' }),
      }));

      // Follow-up streaming con resultados de tools
      const followUpMessages = [
        ...messages,
        {
          role: 'assistant' as const,
          content: fullResponse || null,
          tool_calls: toolCallsList,
        } as any,
        ...toolResults,
      ];

      const followUpStream = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: followUpMessages,
        max_tokens: 400,
        temperature: 0.7,
        stream: true,
        stream_options: { include_usage: true },
      });

      fullResponse = '';
      for await (const chunk of followUpStream) {
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          fullResponse += delta.content;
          onChunk(delta.content);
        }
        if (chunk.usage?.total_tokens) {
          tokensUsed += chunk.usage.total_tokens;
        }
      }
    }

    // 7. Completar
    onComplete(fullResponse, tokensUsed);

    // 8. Comprimir memoria si corresponde (fire-and-forget)
    if (shouldCompressMemory(recentMessages)) {
      compressAndSaveMemory(
        recentMessages,
        kiwiContext.userId,
        kiwiContext.institutionId,
        kiwiContext.rol
      ).catch((err) => {
        console.warn('[Kiwi] compressAndSaveMemory falló (no crítico):', err?.message ?? err);
      });
    }
  } catch (err) {
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Genera análisis de asistencia para directivo (curso + mes).
 * Recibe un resumen estructurado en texto y devuelve recomendaciones en prosa.
 */
export async function generateAttendanceAnalysis(
  summaryText: string,
  courseName: string,
  monthLabel: string
): Promise<string> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    return 'Configura OPENAI_API_KEY en .env para ver el análisis con IA.';
  }
  const { sanitized: safeSummary } = sanitizeText(summaryText);
  try {
    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'Eres un analista académico. Analiza los datos de asistencia que te proporcionan. Identifica patrones, días problemáticos, estudiantes en riesgo y da recomendaciones concretas al directivo. Responde en español (Colombia), de forma clara y accionable. Usa párrafos breves, sin viñetas numeradas largas.',
        },
        {
          role: 'user',
          content: `Analiza estos datos de asistencia del curso ${courseName} del mes ${monthLabel}:\n\n${safeSummary}\n\nIdentifica patrones, días problemáticos, estudiantes en riesgo y da recomendaciones concretas al directivo.`,
        },
      ],
      max_tokens: 800,
    });
    return response.choices[0]?.message?.content?.trim() || 'No se pudo generar el análisis.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[OpenAI] generateAttendanceAnalysis error:', msg);
    return 'Error al generar el análisis con IA. Verifica OPENAI_API_KEY.';
  }
}
