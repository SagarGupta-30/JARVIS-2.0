import mongoose, { Schema, type Model } from "mongoose";

export interface MemoryDocument {
  userId: string;
  kind:
    | "preference"
    | "goal"
    | "habit"
    | "study_pattern"
    | "emotion"
    | "weak_subject"
    | "note"
    | "fact";
  text: string;
  field?: string;
  value?: string;
  source: "manual" | "auto" | "system";
  confidence: number;
  tags: string[];
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const memorySchema = new Schema<MemoryDocument>(
  {
    userId: { type: String, required: true, index: true },
    kind: {
      type: String,
      required: true,
      enum: [
        "preference",
        "goal",
        "habit",
        "study_pattern",
        "emotion",
        "weak_subject",
        "note",
        "fact",
      ],
      default: "note",
    },
    text: { type: String, required: true },
    field: { type: String },
    value: { type: String },
    source: {
      type: String,
      required: true,
      enum: ["manual", "auto", "system"],
      default: "manual",
    },
    confidence: { type: Number, default: 0.7 },
    tags: { type: [String], default: [] },
    embedding: { type: [Number], required: false, select: false },
  },
  {
    timestamps: true,
  },
);

memorySchema.index({ userId: 1, updatedAt: -1 });
memorySchema.index({ userId: 1, text: "text", tags: "text" });

const MemoryModel =
  (mongoose.models.Memory as Model<MemoryDocument>) ||
  mongoose.model<MemoryDocument>("Memory", memorySchema);

export default MemoryModel;
