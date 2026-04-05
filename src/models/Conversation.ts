import mongoose, { Schema, type Model } from "mongoose";

interface Attachment {
  name: string;
  type: string;
  contentPreview: string;
}

export interface ConversationDocument {
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  sessionId: string;
  attachments: Attachment[];
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<Attachment>(
  {
    name: { type: String, required: true },
    type: { type: String, required: true },
    contentPreview: { type: String, required: true },
  },
  { _id: false },
);

const conversationSchema = new Schema<ConversationDocument>(
  {
    userId: { type: String, required: true, index: true },
    role: {
      type: String,
      required: true,
      enum: ["user", "assistant", "system"],
    },
    content: { type: String, required: true },
    sessionId: { type: String, default: "default" },
    attachments: { type: [attachmentSchema], default: [] },
  },
  {
    timestamps: true,
  },
);

conversationSchema.index({ userId: 1, createdAt: -1 });

const ConversationModel =
  (mongoose.models.Conversation as Model<ConversationDocument>) ||
  mongoose.model<ConversationDocument>("Conversation", conversationSchema);

export default ConversationModel;
