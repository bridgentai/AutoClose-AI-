/**
 * Definición de funciones/tools para OpenAI Function Calling
 * Cada función define qué puede hacer el AI según el formato de OpenAI
 */

export interface AIFunction {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  allowedRoles: string[]; // Roles que pueden usar esta función
}

/**
 * Obtiene todas las funciones disponibles según el rol del usuario
 */
export function getAvailableFunctions(role: string): AIFunction[] {
  const allFunctions = getAllFunctions();
  return allFunctions.filter(func => func.allowedRoles.includes(role));
}

/**
 * Obtiene todas las funciones del sistema
 */
function getAllFunctions(): AIFunction[] {
  return [
    // ========== FUNCIONES DE CONSULTA ==========
    {
      name: 'consultar_notas_estudiante',
      description: 'Consulta las notas de un estudiante. Solo el estudiante puede consultar sus propias notas. Los profesores pueden consultar notas de sus cursos completos usando consultar_notas_curso.',
      parameters: {
        type: 'object',
        properties: {
          estudianteId: {
            type: 'string',
            description: 'ID del estudiante. Para estudiantes, debe ser su propio ID.'
          }
        },
        required: ['estudianteId']
      },
      allowedRoles: ['estudiante']
    },
    {
      name: 'consultar_notas_curso',
      description: 'Consulta las notas de un curso completo. Solo disponible para profesores de ese curso.',
      parameters: {
        type: 'object',
        properties: {
          cursoId: {
            type: 'string',
            description: 'ID del curso del cual consultar las notas'
          }
        },
        required: ['cursoId']
      },
      allowedRoles: ['profesor']
    },
    {
      name: 'consultar_materias',
      description: 'Consulta las materias asignadas. Para estudiantes muestra sus materias, para profesores muestra sus cursos asignados.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      allowedRoles: ['estudiante', 'profesor']
    },
    {
      name: 'consultar_tareas',
      description: 'Consulta las tareas. Para estudiantes muestra sus tareas, para profesores muestra las tareas de sus cursos.',
      parameters: {
        type: 'object',
        properties: {
          estado: {
            type: 'string',
            enum: ['pendiente', 'entregada', 'calificada'],
            description: 'Filtrar tareas por estado (opcional)'
          },
          cursoId: {
            type: 'string',
            description: 'ID del curso para filtrar tareas (solo para profesores)'
          }
        },
        required: []
      },
      allowedRoles: ['estudiante', 'profesor']
    },
    {
      name: 'consultar_informacion_hijo',
      description: 'Consulta información académica de un hijo. Solo disponible para padres y solo pueden consultar información de sus propios hijos.',
      parameters: {
        type: 'object',
        properties: {
          hijoId: {
            type: 'string',
            description: 'ID del hijo del cual consultar información'
          }
        },
        required: ['hijoId']
      },
      allowedRoles: ['padre']
    },
    {
      name: 'consultar_calendario',
      description: 'Consulta eventos del calendario. Puede filtrar por curso y rango de fechas.',
      parameters: {
        type: 'object',
        properties: {
          cursoId: {
            type: 'string',
            description: 'ID del curso para filtrar eventos (opcional)'
          },
          startDate: {
            type: 'string',
            format: 'date',
            description: 'Fecha de inicio para filtrar eventos (formato YYYY-MM-DD, opcional)'
          },
          endDate: {
            type: 'string',
            format: 'date',
            description: 'Fecha de fin para filtrar eventos (formato YYYY-MM-DD, opcional)'
          }
        },
        required: []
      },
      allowedRoles: ['estudiante', 'profesor', 'padre', 'directivo']
    },
    {
      name: 'consultar_notificaciones',
      description: 'Consulta las notificaciones del usuario.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Número máximo de notificaciones a retornar (por defecto 20)'
          }
        },
        required: []
      },
      allowedRoles: ['estudiante', 'profesor', 'padre', 'directivo']
    },

    // ========== FUNCIONES DE ACCIÓN ==========
    {
      name: 'asignar_tarea',
      description: 'Crea una nueva tarea para un grupo (curso). IMPORTANTE: Los "cursos" son los GRUPOS (12C, 12D, 11C, etc.), NO las materias. Cuando el usuario dice "12C" o "curso 12C", se refiere al GRUPO 12C. El sistema buscará automáticamente la materia asignada al profesor que incluye ese grupo.',
      parameters: {
        type: 'object',
        properties: {
          titulo: {
            type: 'string',
            description: 'Título de la tarea'
          },
          descripcion: {
            type: 'string',
            description: 'Descripción de la tarea'
          },
          cursoId: {
            type: 'string',
            description: 'ID de la materia (NO usar directamente, preferir usar grupo)'
          },
          materiaId: {
            type: 'string',
            description: 'ID de la materia (NO usar directamente, preferir usar grupo)'
          },
          grupo: {
            type: 'string',
            description: 'Nombre del grupo (curso) al cual asignar la tarea (ej: "12C", "9B", "11D", "12D"). REQUERIDO en la mayoría de casos. Cuando el usuario dice "12C", "curso 12C", o "grupo 12C", usa este parámetro con el valor "12C". El sistema buscará automáticamente la materia asignada al profesor que incluye ese grupo.'
          },
          fechaEntrega: {
            type: 'string',
            format: 'date',
            description: 'Fecha de entrega de la tarea (formato YYYY-MM-DD)'
          },
          adjuntos: {
            type: 'array',
            items: { type: 'string' },
            description: 'Lista de URLs de archivos adjuntos (opcional)'
          }
        },
        required: ['titulo', 'descripcion', 'fechaEntrega']
      },
      allowedRoles: ['profesor']
    },
    {
      name: 'entregar_tarea',
      description: 'Entrega una tarea como estudiante. Solo puedes entregar tareas de tu curso.',
      parameters: {
        type: 'object',
        properties: {
          assignmentId: {
            type: 'string',
            description: 'ID de la tarea a entregar'
          },
          archivos: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                tipo: { type: 'string', enum: ['pdf', 'link', 'imagen', 'documento', 'otro'] },
                nombre: { type: 'string' },
                url: { type: 'string' }
              },
              required: ['tipo', 'nombre', 'url']
            },
            description: 'Lista de archivos adjuntos a la entrega'
          },
          comentario: {
            type: 'string',
            description: 'Comentario opcional para el profesor'
          }
        },
        required: ['assignmentId', 'archivos']
      },
      allowedRoles: ['estudiante']
    },
    {
      name: 'calificar_tarea',
      description: 'Califica una tarea entregada por un estudiante. Solo disponible para profesores en sus tareas.',
      parameters: {
        type: 'object',
        properties: {
          assignmentId: {
            type: 'string',
            description: 'ID de la tarea a calificar'
          },
          estudianteId: {
            type: 'string',
            description: 'ID del estudiante a calificar'
          },
          calificacion: {
            type: 'number',
            description: 'Calificación numérica (típicamente entre 0 y 5)'
          },
          retroalimentacion: {
            type: 'string',
            description: 'Retroalimentación para el estudiante (opcional)'
          }
        },
        required: ['assignmentId', 'estudianteId', 'calificacion']
      },
      allowedRoles: ['profesor']
    },
    {
      name: 'subir_nota',
      description: 'Registra una nota para un estudiante en una tarea. Solo disponible para profesores.',
      parameters: {
        type: 'object',
        properties: {
          tareaId: {
            type: 'string',
            description: 'ID de la tarea'
          },
          estudianteId: {
            type: 'string',
            description: 'ID del estudiante'
          },
          nota: {
            type: 'number',
            description: 'Valor de la nota (típicamente entre 0 y 5)'
          },
          logro: {
            type: 'string',
            description: 'Comentario o logro alcanzado (opcional)'
          }
        },
        required: ['tareaId', 'estudianteId', 'nota']
      },
      allowedRoles: ['profesor']
    },
    {
      name: 'modificar_fecha_tarea',
      description: 'Modifica la fecha de entrega de una tarea. Solo disponible para profesores que crearon la tarea o directivos.',
      parameters: {
        type: 'object',
        properties: {
          assignmentId: {
            type: 'string',
            description: 'ID de la tarea a modificar'
          },
          nuevaFecha: {
            type: 'string',
            format: 'date',
            description: 'Nueva fecha de entrega (formato YYYY-MM-DD)'
          }
        },
        required: ['assignmentId', 'nuevaFecha']
      },
      allowedRoles: ['profesor', 'directivo']
    },
    {
      name: 'enviar_comentario',
      description: 'Envía un comentario a otro usuario. El contexto determina dónde se envía el comentario.',
      parameters: {
        type: 'object',
        properties: {
          destinatarioId: {
            type: 'string',
            description: 'ID del usuario destinatario del comentario'
          },
          comentario: {
            type: 'string',
            description: 'Texto del comentario'
          },
          context: {
            type: 'string',
            enum: ['assignment', 'note', 'general'],
            description: 'Contexto del comentario: assignment (tarea), note (nota), general (general)'
          }
        },
        required: ['destinatarioId', 'comentario', 'context']
      },
      allowedRoles: ['estudiante', 'profesor', 'padre', 'directivo']
    },
    {
      name: 'crear_boletin',
      description: 'Crea un boletín académico para un curso. Solo disponible para profesores de ese curso o directivos.',
      parameters: {
        type: 'object',
        properties: {
          cursoId: {
            type: 'string',
            description: 'ID del curso para el cual crear el boletín'
          },
          periodo: {
            type: 'string',
            description: 'Período académico del boletín (ej: "Primer Periodo", "Segundo Periodo")'
          }
        },
        required: ['cursoId', 'periodo']
      },
      allowedRoles: ['profesor', 'directivo']
    },
    {
      name: 'consultar_estudiantes_curso',
      description: 'Consulta la lista de estudiantes de un curso. Solo disponible para profesores de ese curso.',
      parameters: {
        type: 'object',
        properties: {
          cursoId: {
            type: 'string',
            description: 'ID del curso del cual consultar estudiantes'
          }
        },
        required: ['cursoId']
      },
      allowedRoles: ['profesor']
    }
  ];
}

/**
 * Convierte las funciones a formato OpenAI tools
 */
export function getOpenAITools(role: string): any[] {
  const functions = getAvailableFunctions(role);
  
  return functions.map(func => ({
    type: 'function',
    function: {
      name: func.name,
      description: func.description,
      parameters: func.parameters,
    }
  }));
}

/**
 * Obtiene información de una función por nombre
 */
export function getFunctionByName(name: string): AIFunction | undefined {
  return getAllFunctions().find(func => func.name === name);
}

