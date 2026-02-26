import { Schema, model, Types } from 'mongoose';

export type ChatMessageRole = 'system' | 'user' | 'assistant';

export interface IChatMessage {
  _id: Types.ObjectId;
  chatId: Types.ObjectId;
  role: ChatMessageRole;
  content: string;
  type?: string;
  structuredData?: Record<string, unknown>;
  createdAt: Date;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    chatId: { type: Schema.Types.ObjectId, ref: 'chats', required: true, index: true },
    role: { type: String, enum: ['system', 'user', 'assistant'], required: true },
    content: { type: String, required: true, default: '' },
    type: { type: String, default: 'text' },
    structuredData: { type: Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

chatMessageSchema.index({ chatId: 1, createdAt: 1 });

export const ChatMessage = model<IChatMessage>('chat_messages', chatMessageSchema);
