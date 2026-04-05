import mongoose, { Schema, type Model } from "mongoose";

export interface UserProfileDocument {
  userId: string;
  displayName: string;
  agent: "general" | "coder" | "study" | "research";
  knowledgeMode: boolean;
  preferences: {
    responseTone: "professional" | "friendly" | "technical";
    theme: "jarvis" | "friday";
    wakeWordEnabled: boolean;
    voiceGender: "auto" | "female" | "male";
    voiceLanguage: "en" | "hi" | "bilingual";
  };
  training: {
    autoLearning: boolean;
    mode: "passive" | "manual" | "focus";
  };
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<UserProfileDocument>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: "Commander" },
    agent: {
      type: String,
      enum: ["general", "coder", "study", "research"],
      default: "general",
    },
    knowledgeMode: { type: Boolean, default: false },
    preferences: {
      responseTone: {
        type: String,
        enum: ["professional", "friendly", "technical"],
        default: "professional",
      },
      theme: {
        type: String,
        enum: ["jarvis", "friday"],
        default: "jarvis",
      },
      wakeWordEnabled: { type: Boolean, default: false },
      voiceGender: {
        type: String,
        enum: ["auto", "female", "male"],
        default: "female",
      },
      voiceLanguage: {
        type: String,
        enum: ["en", "hi", "bilingual"],
        default: "bilingual",
      },
    },
    training: {
      autoLearning: { type: Boolean, default: true },
      mode: {
        type: String,
        enum: ["passive", "manual", "focus"],
        default: "passive",
      },
    },
  },
  { timestamps: true },
);

const UserProfileModel =
  (mongoose.models.UserProfile as Model<UserProfileDocument>) ||
  mongoose.model<UserProfileDocument>("UserProfile", userProfileSchema);

export default UserProfileModel;
