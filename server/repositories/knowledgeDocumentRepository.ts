import { queryPg } from '../config/db-pg.js';

export interface KnowledgeDocumentRow {
  id: string;
  institution_id: string;
  title: string;
  content: string;
  chunk_index: number;
  parent_doc_id: string | null;
  metadata: Record<string, unknown>;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SimilarDocResult {
  id: string;
  title: string;
  content: string;
  chunk_index: number;
  similarity: number;
  metadata: Record<string, unknown>;
}

export async function insertDocumentChunk(row: {
  institution_id: string;
  title: string;
  content: string;
  chunk_index: number;
  parent_doc_id?: string | null;
  embedding: number[];
  metadata?: Record<string, unknown>;
  created_by_id?: string | null;
}): Promise<KnowledgeDocumentRow> {
  const r = await queryPg<KnowledgeDocumentRow>(
    `INSERT INTO knowledge_documents
       (institution_id, title, content, chunk_index, parent_doc_id, embedding, metadata, created_by_id)
     VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8)
     RETURNING id, institution_id, title, content, chunk_index, parent_doc_id, metadata, created_by_id, created_at, updated_at`,
    [
      row.institution_id,
      row.title,
      row.content,
      row.chunk_index,
      row.parent_doc_id ?? null,
      JSON.stringify(row.embedding),
      JSON.stringify(row.metadata ?? {}),
      row.created_by_id ?? null,
    ]
  );
  return r.rows[0];
}

export async function searchSimilarDocuments(
  institutionId: string,
  embedding: number[],
  limit = 5,
  minSimilarity = 0.3
): Promise<SimilarDocResult[]> {
  const r = await queryPg<{
    id: string;
    title: string;
    content: string;
    chunk_index: number;
    similarity: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT id, title, content, chunk_index, metadata,
            1 - (embedding <=> $2::vector) AS similarity
     FROM knowledge_documents
     WHERE institution_id = $1
       AND embedding IS NOT NULL
       AND 1 - (embedding <=> $2::vector) >= $4
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [institutionId, JSON.stringify(embedding), limit, minSimilarity]
  );

  return r.rows.map((row: { id: string; title: string; content: string; chunk_index: number; similarity: string; metadata: Record<string, unknown> }) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    chunk_index: row.chunk_index,
    similarity: parseFloat(row.similarity),
    metadata: row.metadata,
  }));
}

export async function listDocumentsByInstitution(
  institutionId: string,
  limit = 50
): Promise<Array<{ id: string; title: string; chunk_index: number; created_at: string }>> {
  const r = await queryPg<{ id: string; title: string; chunk_index: number; created_at: string }>(
    `SELECT id, title, chunk_index, created_at::text
     FROM knowledge_documents
     WHERE institution_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [institutionId, limit]
  );
  return r.rows;
}

export async function deleteDocumentByParentId(parentDocId: string, institutionId: string): Promise<number> {
  const r = await queryPg(
    `DELETE FROM knowledge_documents WHERE parent_doc_id = $1 AND institution_id = $2`,
    [parentDocId, institutionId]
  );
  return r.rowCount ?? 0;
}

export async function deleteDocumentById(docId: string, institutionId: string): Promise<boolean> {
  await queryPg(
    `DELETE FROM knowledge_documents WHERE parent_doc_id = $1 AND institution_id = $2`,
    [docId, institutionId]
  );
  const r = await queryPg(
    `DELETE FROM knowledge_documents WHERE id = $1 AND institution_id = $2`,
    [docId, institutionId]
  );
  return (r.rowCount ?? 0) > 0;
}
