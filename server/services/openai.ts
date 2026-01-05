import OpenAI from 'openai';

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const OPENAI_API_KEY = process.env.OPENAI_API_KEY?.trim();

if (!OPENAI_API_KEY || OPENAI_API_KEY.includes('placeholder')) {
  console.warn('⚠️  OPENAI_API_KEY no está configurado o es un placeholder. El chat IA no funcionará correctamente.');
  if (process.env.OPENAI_API_KEY) {
    console.warn(`   Valor detectado (primeros 10 caracteres): ${process.env.OPENAI_API_KEY.substring(0, 10)}...`);
  }
}

const openai = OPENAI_API_KEY && !OPENAI_API_KEY.includes('placeholder') && OPENAI_API_KEY.trim().length > 0
  ? new OpenAI({ apiKey: OPENAI_API_KEY.trim() })
  : null;

export async function generateAIResponse(userMessage: string, context: {
  rol: string;
  colegioId: string;
  contextoTipo?: string;
}): Promise<string> {
  if (!openai) {
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

    const response = await openai.chat.completions.create({
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
