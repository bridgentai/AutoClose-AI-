import { Schema, model, Types } from 'mongoose';

export interface IAssignmentMaterial {
  assignmentId: Types.ObjectId;
  type: 'file' | 'link' | 'gdoc';
  url: string;
  fileName?: string;
  mimeType?: string;
  uploadedAt: Date;
}

const assignmentMaterialSchema = new Schema<IAssignmentMaterial>({
  assignmentId: { type: Schema.Types.ObjectId, ref: 'tareas', required: true },
  type: { type: String, enum: ['file', 'link', 'gdoc'], required: true },
  url: { type: String, required: true },
  fileName: { type: String },
  mimeType: { type: String },
  uploadedAt: { type: Date, default: Date.now },
});

export const AssignmentMaterial = model<IAssignmentMaterial>('assignment_materials', assignmentMaterialSchema);
