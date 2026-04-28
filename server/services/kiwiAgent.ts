/**
 * Kiwi Agent v2 — powered by Vercel AI SDK v6.
 * Uses streamText with multi-step tool execution (ReAct loop)
 * via stopWhen(stepCountIs(N)).
 */

import { streamText, generateText, stepCountIs } from 'ai';
import type { ModelMessage, ToolSet, Tool } from 'ai';
import type { JSONValue } from '@ai-sdk/provider';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  buildSystemPrompt as buildKiwiSystemPrompt,
  buildRoleTools,
  shouldCompressMemory,
  buildMemoryCompressionPrompt,
  extractKeyFacts,
} from './kiwiContext.js';
import type { KiwiUserContext } from './kiwiContext.js';
import { buildEvoKnowledge } from './kiwiKnowledge.js';
import { executeKiwiAction } from './kiwiActions.js';
import { sanitizeText } from './llmSanitizer.js';
import {
  getRecentMessages,
  upsertUserMemory,
  logToolCall,
} from '../repositories/kiwiRepository.js';
import type { KiwiMessageRow } from '../repositories/kiwiRepository.js';

function getAIProvider() {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 20) return null;

  const heliconeKey = (process.env.HELICONE_API_KEY || '').trim();

  return createOpenAI({
    apiKey,
    ...(heliconeKey ? {
      baseURL: 'https://oai.helicone.ai/v1',
      headers: {
        'Helicone-Auth': `Bearer ${heliconeKey}`,
        'Helicone-Property-App': 'evoOS',
        'Helicone-Property-Feature': 'kiwi-agent',
      },
    } : {}),
  });
}

function buildZodSchema(params: Record<string, unknown> | undefined): z.ZodType {
  if (!params || !params.properties) {
    return z.object({});
  }

  const props = params.properties as Record<string, { type: string; description?: string; enum?: string[] }>;
  const required = (params.required as string[]) ?? [];
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(props)) {
    let field: z.ZodTypeAny;
    switch (prop.type) {
      case 'number':
        field = z.number().describe(prop.description ?? key);
        break;
      case 'boolean':
        field = z.boolean().describe(prop.description ?? key);
        break;
      default:
        if (prop.enum) {
          field = z.enum(prop.enum as [string, ...string[]]).describe(prop.description ?? key);
        } else {
          field = z.string().describe(prop.description ?? key);
        }
    }

    if (!required.includes(key)) {
      field = field.optional();
    }
    shape[key] = field;
  }

  return z.object(shape);
}

function buildAISDKTools(
  rol: string,
  institutionId: string,
  userId: string,
  userRole: string,
  onToolStep?: (toolName: string, status: 'start' | 'done') => void
) {
  const roleTools = buildRoleTools(rol);
  const tools: ToolSet = {};

  for (const t of roleTools) {
    const schema = buildZodSchema(t.parameters);
    const toolName = t.name;

    const toolInstance: Tool<JSONValue, JSONValue> = {
      description: t.description,
      inputSchema: schema as z.ZodType<JSONValue>,
      execute: async (params: JSONValue) => {
        onToolStep?.(toolName, 'start');
        const startMs = Date.now();
        const parsedParams = (params && typeof params === 'object' && !Array.isArray(params) ? params : {}) as Record<string, unknown>;
        let result: Awaited<ReturnType<typeof executeKiwiAction>>;
        try {
          result = await executeKiwiAction(
            toolName,
            parsedParams,
            institutionId,
            userId,
            userRole
          );
        } catch (execErr) {
          onToolStep?.(toolName, 'done');
          throw execErr;
        }
        const elapsedMs = Date.now() - startMs;
        onToolStep?.(toolName, 'done');

        logToolCall(
          institutionId,
          userId,
          null,
          userRole,
          toolName,
          parsedParams,
          result as unknown as Record<string, unknown>,
          result.success,
          elapsedMs
        ).catch(() => {});

        if (!result.success && 'requiresConfirmation' in result && result.requiresConfirmation) {
          return {
            __type: 'confirmation_required',
            preview: (result as { requiresConfirmation: true; preview: unknown }).preview,
          } as unknown as JSONValue;
        }

        return (result.success
          ? { success: true, data: (result as { success: true; data: unknown }).data }
          : { success: false, error: (result as { success: false; error: string }).error }) as unknown as JSONValue;
      },
    };
    (tools as Record<string, Tool<JSONValue, JSONValue>>)[toolName] = toolInstance;
  }

  return tools;
}

export interface KiwiAgentOptions {
  model?: 'gpt-4o' | 'gpt-4o-mini';
  maxOutputTokens?: number;
}

export interface KiwiAgentCallbacks {
  onChunk: (chunk: string) => void;
  onToolStep?: (toolName: string, status: 'start' | 'done') => void;
  onComplete: (fullResponse: string, tokensUsed: number) => void;
  onError: (error: Error) => void;
}

export async function runKiwiAgent(
  userMessage: string,
  kiwiContext: KiwiUserContext,
  callbacks: KiwiAgentCallbacks,
  options?: KiwiAgentOptions
): Promise<void> {
  const provider = getAIProvider();
  if (!provider) {
    callbacks.onError(new Error('OPENAI_API_KEY no está configurada.'));
    return;
  }

  try {
    const recentMessages = await getRecentMessages(kiwiContext.sessionId, 12);

    const history: ModelMessage[] = recentMessages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const systemPrompt =
      buildKiwiSystemPrompt(kiwiContext, kiwiContext.memory) +
      '\n\n' +
      buildEvoKnowledge(kiwiContext.rol);

    const tools = buildAISDKTools(
      kiwiContext.rol,
      kiwiContext.institutionId,
      kiwiContext.userId,
      kiwiContext.rol,
      callbacks.onToolStep
    );

    const { sanitized } = sanitizeText(userMessage);

    const modelId = options?.model ?? 'gpt-4o-mini';
    const tokenLimit = options?.maxOutputTokens ?? (modelId === 'gpt-4o' ? 4000 : 1200);

    const result = streamText({
      model: provider(modelId),
      system: systemPrompt,
      messages: [
        ...history,
        { role: 'user' as const, content: sanitized },
      ],
      tools,
      stopWhen: stepCountIs(5),
      temperature: 0.7,
      maxOutputTokens: tokenLimit,
      onError: ({ error }) => {
        console.error('[KiwiAgent] Stream error:', error);
      },
    });

    let fullResponse = '';
    let tokensUsed = 0;
    let hasConfirmation = false;

    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          fullResponse += part.text;
          callbacks.onChunk(part.text);
          break;

        case 'tool-result': {
          const rawOutput = (part as unknown as { output: unknown }).output;
          const toolOutput = (rawOutput && typeof rawOutput === 'object' && 'data' in (rawOutput as Record<string, unknown>))
            ? (rawOutput as { data: Record<string, unknown> }).data
            : (rawOutput as Record<string, unknown> | undefined);

          if (toolOutput?.__type === 'confirmation_required') {
            const confirmMsg = '__CONFIRM__:' + JSON.stringify(toolOutput.preview);
            callbacks.onChunk(confirmMsg);
            hasConfirmation = true;
          } else if (toolOutput?.__type === 'evo_doc') {
            const docMsg = '__EVO_DOC__:' + JSON.stringify(toolOutput);
            callbacks.onChunk(docMsg);
          }
          break;
        }

        case 'finish':
          tokensUsed = part.totalUsage?.totalTokens ?? 0;
          break;
      }
    }

    if (hasConfirmation) {
      callbacks.onComplete(fullResponse || '', tokensUsed);
    } else {
      callbacks.onComplete(fullResponse, tokensUsed);
    }

    if (shouldCompressMemory(recentMessages)) {
      compressMemory(
        provider,
        recentMessages,
        kiwiContext.userId,
        kiwiContext.institutionId,
        kiwiContext.rol
      ).catch((err) => {
        console.warn('[KiwiAgent] compressMemory failed (non-critical):', err?.message ?? err);
      });
    }
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

async function compressMemory(
  provider: ReturnType<typeof createOpenAI>,
  messages: KiwiMessageRow[],
  userId: string,
  institutionId: string,
  userRole: string
): Promise<void> {
  const compressionPrompt = buildMemoryCompressionPrompt(messages);

  const { text } = await generateText({
    model: provider('gpt-4o-mini'),
    prompt: compressionPrompt,
    maxOutputTokens: 200,
  });

  if (!text) return;

  const facts = extractKeyFacts(messages);
  const keyFacts = Object.values(facts).filter((v) => v.length > 0);

  await upsertUserMemory(userId, institutionId, userRole, text, keyFacts);
}
