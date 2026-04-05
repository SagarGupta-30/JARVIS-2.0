import type { AgentMode, MemoryKind, ResponseTone, TrainingMode } from "@/types";

export const DEFAULT_USER_ID = "local-operator";

export const AGENT_OPTIONS: AgentMode[] = [
  "general",
  "coder",
  "study",
  "research",
];

export const TONE_OPTIONS: ResponseTone[] = [
  "professional",
  "friendly",
  "technical",
];

export const TRAINING_MODES: TrainingMode[] = ["passive", "manual", "focus"];

export const MEMORY_KINDS: MemoryKind[] = [
  "preference",
  "goal",
  "habit",
  "study_pattern",
  "emotion",
  "weak_subject",
  "note",
  "fact",
];

export const STORAGE_KEYS = {
  userId: "jarvis.userId",
  soundEffects: "jarvis.soundEffects",
} as const;
