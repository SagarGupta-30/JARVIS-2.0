import mongoose, { Schema, type Model } from "mongoose";

export interface ProductivityItemDocument {
  userId: string;
  type: "task" | "note" | "reminder";
  title: string;
  content?: string;
  completed: boolean;
  dueAt?: Date;
  priority: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
}

const productivityItemSchema = new Schema<ProductivityItemDocument>(
  {
    userId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["task", "note", "reminder"],
      default: "task",
    },
    title: { type: String, required: true },
    content: { type: String, default: "" },
    completed: { type: Boolean, default: false },
    dueAt: { type: Date },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true,
  },
);

productivityItemSchema.index({ userId: 1, type: 1, createdAt: -1 });

const ProductivityItemModel =
  (mongoose.models.ProductivityItem as Model<ProductivityItemDocument>) ||
  mongoose.model<ProductivityItemDocument>(
    "ProductivityItem",
    productivityItemSchema,
  );

export default ProductivityItemModel;
