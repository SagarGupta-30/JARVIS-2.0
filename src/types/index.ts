export type ChatRole = "user" | "assistant" | "system";

export type AgentMode = "general" | "coder" | "study" | "research";

export type ResponseTone = "professional" | "friendly" | "technical";

export type TrainingMode = "passive" | "manual" | "focus";

export type VoiceGender = "auto" | "female" | "male";

export type VoiceLanguage = "en" | "hi" | "bilingual";

export type MemoryKind =
  | "preference"
  | "goal"
  | "habit"
  | "study_pattern"
  | "emotion"
  | "weak_subject"
  | "note"
  | "fact";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
}

export interface UploadedContextFile {
  name: string;
  type: string;
  content: string;
}

export interface MemoryItem {
  _id: string;
  userId: string;
  kind: MemoryKind;
  text: string;
  field?: string;
  value?: string;
  source: "manual" | "auto" | "system";
  confidence: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UserSettings {
  userId: string;
  agent: AgentMode;
  knowledgeMode: boolean;
  preferences: {
    responseTone: ResponseTone;
    theme: "jarvis" | "friday";
    wakeWordEnabled: boolean;
    voiceGender: VoiceGender;
    voiceLanguage: VoiceLanguage;
  };
  training: {
    autoLearning: boolean;
    mode: TrainingMode;
  };
}

export type ProductivityType = "task" | "note" | "reminder";

export interface ProductivityItem {
  _id: string;
  userId: string;
  type: ProductivityType;
  title: string;
  content?: string;
  completed: boolean;
  dueAt?: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
}

export interface WeatherSnapshot {
  location?: string;
  temperatureC?: number;
  condition?: string;
}

export interface ClientSystemStats {
  cores?: number;
  memoryGB?: number;
  networkType?: string;
  battery?: number;
}
