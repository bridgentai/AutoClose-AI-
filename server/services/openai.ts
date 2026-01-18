import OpenAI from 'openai';
import { getOpenAITools } from './aiFunctions';
import { executeAction } from './actionExecutor';
import { buildRoleContext, formatContextForPrompt } from './roleContextBuilder';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// La API key ahora se lee dinámicamente en cada llamada para asegurar que siempre use la más reciente del .env

// Función para obtener la API key dinámicamente (para asegurar que se lea del .env correctamente)
function getOpenAIKey(): string | null {
  console.log(process.env.OPENAI_API_KEY);
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
    if (!openaiClientCache) {
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

    const systemPrompt = `Eres AutoClose AI, un asistente educativo personalizado para instituciones académicas.

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

    const response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
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
 * Genera una respuesta de IA con Function Calling
 * Permite que el AI ejecute acciones en el sistema
 */
export async function generateAIResponseWithFunctions(
  userMessage: string,
  userId: string,
  role: string,
  colegioId: string,
  conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []
): Promise<string | { response: string; executedActions: string[] }> {
  const openaiClient = getOpenAIClient();
  if (!openaiClient) {
    throw new Error('OPENAI_API_KEY no está configurada. Por favor, configura una clave válida de OpenAI en el archivo .env');
  }

  try {
    // Construir contexto del rol
    const roleContext = await buildRoleContext(userId, role, colegioId);
    const contextPrompt = formatContextForPrompt(roleContext);

    // Construir system prompt dinámico según rol
    const systemPrompt = buildSystemPrompt(role, roleContext) + contextPrompt;

    // Obtener herramientas disponibles según rol
    const tools = getOpenAITools(role);

    // Construir mensajes
    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage }
    ];

    console.log('[OpenAI] Total de mensajes a enviar:', messages.length);
    console.log('[OpenAI] Historial incluido:', conversationHistory.length, 'mensajes');
    console.log('[OpenAI] Mensaje actual del usuario:', userMessage.substring(0, 100));
    
    // Verificar que el historial se esté pasando correctamente
    if (conversationHistory.length === 0 && messages.length === 2) {
      console.log('[OpenAI] ⚠️ ADVERTENCIA: No hay historial de conversación. El AI no tendrá contexto de mensajes anteriores.');
    } else if (conversationHistory.length > 0) {
      console.log('[OpenAI] ✅ Historial correcto. El AI tendrá contexto de', conversationHistory.length, 'mensajes anteriores.');
    }

    // Primera llamada a OpenAI
    let response = await openaiClient.chat.completions.create({
      model: 'gpt-4o',
      messages: messages as any,
      tools: tools.length > 0 ? tools : undefined,
      tool_choice: tools.length > 0 ? 'auto' : undefined,
      max_completion_tokens: 2000,
    });

    let finalResponse = response.choices[0].message.content || '';
    let functionCalls = response.choices[0].message.tool_calls || [];
    const executedActions: string[] = []; // Track executed actions

    // Procesar function calls si existen
    while (functionCalls.length > 0) {
      // Agregar la respuesta del asistente con function calls
      messages.push({
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
      messages.push(...functionResults as any);

      // Llamar nuevamente a OpenAI con los resultados
      response = await openaiClient.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as any,
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
        executedActions: executedActions
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
      if (currentKey) {
        console.error(`   API key detectada (primeros 20 chars): ${currentKey.substring(0, 20)}...`);
        console.error(`   API key detectada (últimos 10 chars): ...${currentKey.substring(currentKey.length - 10)}`);
      } else {
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
  const basePrompt = `Eres AutoClose AI, el asistente educativo inteligente de AutoClose. Tu función es ayudar a los usuarios a realizar tareas académicas mediante lenguaje natural.

IMPORTANTE: Responde SIEMPRE en español de Colombia. Sé claro, conciso y útil.

CONTEXTO Y MEMORIA:
- Tienes acceso completo al historial de la conversación
- DEBES recordar y usar TODA la información proporcionada en mensajes anteriores
- Si el usuario menciona algo en un mensaje, esa información está disponible en mensajes posteriores
- NO repitas preguntas sobre información que ya fue proporcionada
- Acumula información parcial hasta tener todo lo necesario para completar una acción
- Sé proactivo: si tienes suficiente información, procede sin pedir confirmación innecesaria`;

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
`,

    padre: `
RESTRICCIONES ESTRICTAS:
- Solo puedes consultar información de TUS HIJOS
- NO puedes acceder a información de otros estudiantes
- NO puedes ver información de cursos completos
- Solo puedes ver información académica (no datos privados)

FUNCIONES DISPONIBLES:
- consultar_informacion_hijo: Ver información académica completa de tu hijo (notas, tareas, materias)
- consultar_calendario: Ver eventos del calendario
- consultar_notificaciones: Ver tus notificaciones

EJEMPLOS DE USO:
- "¿Cómo van las notas de mi hijo?" → Usa consultar_informacion_hijo
- "¿Qué tareas tiene pendientes mi hijo?" → Usa consultar_informacion_hijo
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
