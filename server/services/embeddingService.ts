/**
 * Embedding + document chunking service for Kiwi RAG.
 * Uses OpenAI text-embedding-3-small for vector generation.
 * Chunks documents into ~500 token segments with overlap.
 */

import OpenAI from 'openai';
import {
  insertDocumentChunk,
  searchSimilarDocuments,
} from '../repositories/knowledgeDocumentRepository.js';
import type { SimilarDocResult } from '../repositories/knowledgeDocumentRepository.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 200;

function getEmbeddingClient(): OpenAI | null {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey || apiKey.length < 20) return null;

  const heliconeKey = (process.env.HELICONE_API_KEY || '').trim();
  const options: ConstructorParameters<typeof OpenAI>[0] = { apiKey };

  if (heliconeKey) {
    options.baseURL = 'https://oai.helicone.ai/v1';
    options.defaultHeaders = {
      'Helicone-Auth': `Bearer ${heliconeKey}`,
      'Helicone-Property-App': 'evoOS',
      'Helicone-Property-Feature': 'rag-embedding',
    };
  }

  return new OpenAI(options);
}

export function chunkText(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end < text.length) {
      const lastNewline = text.lastIndexOf('\n', end);
      const lastPeriod = text.lastIndexOf('. ', end);
      const breakAt = Math.max(lastNewline, lastPeriod);
      if (breakAt > start + CHUNK_SIZE * 0.5) {
        end = breakAt + 1;
      }
    } else {
      end = text.length;
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 20) {
      chunks.push(chunk);
    }

    start = end - CHUNK_OVERLAP;
    if (start < 0) start = 0;
    if (start >= text.length) break;
  }

  return chunks;
}

export async function generateEmbedding(text: string): Promise<number[] | null> {
  const client = getEmbeddingClient();
  if (!client) return null;

  try {
    const response = await client.embeddings.create({
      model: EMBEDDING_MODEL,
      input: text.slice(0, 8000),
    });
    return response.data[0]?.embedding ?? null;
  } catch (err) {
    console.error('[Embedding] Error generating embedding:', (err as Error).message);
    return null;
  }
}

export async function ingestDocument(params: {
  institutionId: string;
  title: string;
  content: string;
  createdById?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ docId: string; chunksCreated: number } | null> {
  const chunks = chunkText(params.content);
  if (chunks.length === 0) return null;

  const firstEmbedding = await generateEmbedding(`${params.title}\n\n${chunks[0]}`);
  if (!firstEmbedding) return null;

  const parentDoc = await insertDocumentChunk({
    institution_id: params.institutionId,
    title: params.title,
    content: chunks[0],
    chunk_index: 0,
    parent_doc_id: null,
    embedding: firstEmbedding,
    metadata: { ...params.metadata, totalChunks: chunks.length },
    created_by_id: params.createdById ?? null,
  });

  for (let i = 1; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i]);
    if (!embedding) continue;

    await insertDocumentChunk({
      institution_id: params.institutionId,
      title: params.title,
      content: chunks[i],
      chunk_index: i,
      parent_doc_id: parentDoc.id,
      embedding,
      metadata: params.metadata ?? {},
      created_by_id: params.createdById ?? null,
    });
  }

  return { docId: parentDoc.id, chunksCreated: chunks.length };
}

export async function searchKnowledge(
  institutionId: string,
  query: string,
  limit = 5
): Promise<SimilarDocResult[]> {
  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  return searchSimilarDocuments(institutionId, embedding, limit);
}
