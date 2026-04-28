import OpenAI from 'openai';
import { sanitizeText, stripInternalStudentTokensForDisplay } from './llmSanitizer.js';

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
let lastHeliconeKey: string | null = null;

// Crear cliente OpenAI de forma lazy (solo cuando se necesite)
// Supports Helicone proxy for observability when HELICONE_API_KEY is set
function getOpenAIClient(): OpenAI | null {
  const apiKey = getOpenAIKey();
  if (!apiKey) {
    console.error('[OpenAI] No se pudo obtener una API key válida');
    return null;
  }
  
  const heliconeKey = (process.env.HELICONE_API_KEY || '').trim();
  
  if (!openaiClientCache || lastApiKey !== apiKey || lastHeliconeKey !== heliconeKey) {
    if (!openaiClientCache && process.env.LLM_DEBUG === 'true') {
      console.log('[OpenAI] Cliente OpenAI inicializado');
      console.log(`   Tipo: ${apiKey.startsWith('sk-proj-') ? 'Proyecto (sk-proj-)' : apiKey.startsWith('skproj') ? 'Proyecto (skproj)' : 'Estándar'}`);
      if (heliconeKey) console.log('   Helicone proxy: activo');
    }
    
    const clientOptions: ConstructorParameters<typeof OpenAI>[0] = { apiKey };

    if (heliconeKey) {
      clientOptions.baseURL = 'https://oai.helicone.ai/v1';
      clientOptions.defaultHeaders = {
        'Helicone-Auth': `Bearer ${heliconeKey}`,
        'Helicone-Property-App': 'evoOS',
      };
    }

    openaiClientCache = new OpenAI(clientOptions);
    lastApiKey = apiKey;
    lastHeliconeKey = heliconeKey;
  }
  
  return openaiClientCache;
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
