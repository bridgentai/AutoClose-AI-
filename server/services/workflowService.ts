/**
 * Workflow automation service — bridges Kiwi and n8n.
 * 
 * Outbound: Triggers n8n workflows via webhook URLs.
 * Inbound: /api/webhooks/n8n receives callbacks from n8n.
 *
 * n8n must be configured separately (Docker self-hosted or cloud).
 * Set N8N_WEBHOOK_BASE_URL in .env (e.g. https://n8n.example.com/webhook).
 */

export interface WorkflowTriggerResult {
  success: boolean;
  workflowId: string;
  message: string;
}

const WORKFLOW_DEFINITIONS: Record<string, {
  slug: string;
  description: string;
  requiredParams: string[];
}> = {
  academic_risk_alert: {
    slug: 'academic-risk-alert',
    description: 'Enviar alerta por email a padres de estudiantes en riesgo académico',
    requiredParams: ['threshold'],
  },
  attendance_reminder: {
    slug: 'attendance-reminder',
    description: 'Recordatorio de asistencia a padres de estudiantes con faltas recurrentes',
    requiredParams: [],
  },
  generate_boletines_batch: {
    slug: 'generate-boletines-batch',
    description: 'Generar boletines académicos en lote para un grupo o todo el colegio',
    requiredParams: ['scope'],
  },
  sync_google_calendar: {
    slug: 'sync-google-calendar',
    description: 'Sincronizar eventos del colegio con Google Calendar',
    requiredParams: [],
  },
};

export function listAvailableWorkflows(): Array<{ id: string; description: string }> {
  return Object.entries(WORKFLOW_DEFINITIONS).map(([id, def]) => ({
    id,
    description: def.description,
  }));
}

export async function triggerWorkflow(
  workflowId: string,
  institutionId: string,
  userId: string,
  params: Record<string, unknown>
): Promise<WorkflowTriggerResult> {
  const def = WORKFLOW_DEFINITIONS[workflowId];
  if (!def) {
    return {
      success: false,
      workflowId,
      message: `Workflow "${workflowId}" no existe. Disponibles: ${Object.keys(WORKFLOW_DEFINITIONS).join(', ')}`,
    };
  }

  for (const param of def.requiredParams) {
    if (!params[param]) {
      return {
        success: false,
        workflowId,
        message: `Falta el parámetro requerido: ${param}`,
      };
    }
  }

  const baseUrl = (process.env.N8N_WEBHOOK_BASE_URL || '').trim();
  if (!baseUrl) {
    return {
      success: false,
      workflowId,
      message: 'n8n no está configurado. Configura N8N_WEBHOOK_BASE_URL en .env para habilitar automatizaciones.',
    };
  }

  const webhookUrl = `${baseUrl}/${def.slug}`;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        institutionId,
        triggeredBy: userId,
        params,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        success: false,
        workflowId,
        message: `n8n respondió con error ${response.status}. Verifica que el workflow esté activo.`,
      };
    }

    return {
      success: true,
      workflowId,
      message: `Workflow "${def.description}" activado correctamente.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error(`[Workflow] Error triggering ${workflowId}:`, msg);
    return {
      success: false,
      workflowId,
      message: `Error al conectar con n8n: ${msg}`,
    };
  }
}
