import { queryPg } from '../config/db-pg.js';

export interface AssignmentMaterialRow {
  id: string;
  assignment_id: string;
  type: string;
  url: string;
  file_name: string | null;
  mime_type: string | null;
  uploaded_at: string;
}

export async function findAssignmentMaterialsByAssignment(assignmentId: string): Promise<AssignmentMaterialRow[]> {
  const r = await queryPg<AssignmentMaterialRow>(
    'SELECT * FROM assignment_materials WHERE assignment_id = $1 ORDER BY uploaded_at',
    [assignmentId]
  );
  return r.rows;
}

export async function createAssignmentMaterial(row: {
  assignment_id: string;
  type: string;
  url: string;
  file_name?: string | null;
  mime_type?: string | null;
}): Promise<AssignmentMaterialRow> {
  const type = ['file', 'link', 'gdoc'].includes(row.type) ? row.type : 'link';
  const r = await queryPg<AssignmentMaterialRow>(
    `INSERT INTO assignment_materials (assignment_id, type, url, file_name, mime_type)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [row.assignment_id, type, row.url, row.file_name ?? null, row.mime_type ?? null]
  );
  return r.rows[0];
}
