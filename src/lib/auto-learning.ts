import type { MemoryKind, TrainingMode } from "@/types";

interface LearnedSignal {
  kind: MemoryKind;
  text: string;
  field?: string;
  value?: string;
  confidence: number;
  tags: string[];
}

const EMOTION_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\b(stressed|overwhelmed|burnt out|burned out|anxious)\b/i, label: "stressed" },
  { pattern: /\b(frustrated|stuck|confused)\b/i, label: "frustrated" },
  { pattern: /\b(confident|motivated|excited)\b/i, label: "motivated" },
  { pattern: /\b(tired|exhausted|sleepy)\b/i, label: "fatigued" },
];

function normalize(value: string) {
  return value.trim().replace(/[.?!]+$/, "");
}

export function shouldAutoLearn(mode: TrainingMode, autoLearning: boolean) {
  return autoLearning && mode === "passive";
}

export function extractSignalsFromMessage(message: string): LearnedSignal[] {
  const source = message.trim();

  if (!source) {
    return [];
  }

  const out: LearnedSignal[] = [];

  const weakSubject = source.match(/\bstruggl(?:e|ing) with\s+([a-z0-9\s+#\-.]+)/i);
  if (weakSubject?.[1]) {
    const value = normalize(weakSubject[1]);
    out.push({
      kind: "weak_subject",
      text: `Weak subject identified: ${value}`,
      field: "weak_subject",
      value,
      confidence: 0.82,
      tags: ["learning", "challenge"],
    });
  }

  const studyPattern = source.match(/\bstudy best at\s+([a-z0-9\s:#\-.]+)/i);
  if (studyPattern?.[1]) {
    const value = normalize(studyPattern[1]);
    out.push({
      kind: "study_pattern",
      text: `Studies best at ${value}`,
      field: "best_study_time",
      value,
      confidence: 0.86,
      tags: ["study", "habit"],
    });
  }

  const preference = source.match(/\b(?:i prefer|i like|prefer)\s+([a-z0-9\s,#\-.]+)/i);
  if (preference?.[1]) {
    const value = normalize(preference[1]);
    out.push({
      kind: "preference",
      text: `Preference captured: ${value}`,
      field: "preference",
      value,
      confidence: 0.72,
      tags: ["preference"],
    });
  }

  const goal = source.match(/\b(?:my goal is|i want to|i need to)\s+([a-z0-9\s,#\-.]+)/i);
  if (goal?.[1]) {
    const value = normalize(goal[1]);
    out.push({
      kind: "goal",
      text: `Goal captured: ${value}`,
      field: "goal",
      value,
      confidence: 0.75,
      tags: ["goal"],
    });
  }

  const habit = source.match(/\b(?:i usually|every day i|my routine is)\s+([a-z0-9\s,#\-.]+)/i);
  if (habit?.[1]) {
    const value = normalize(habit[1]);
    out.push({
      kind: "habit",
      text: `Habit captured: ${value}`,
      field: "habit",
      value,
      confidence: 0.71,
      tags: ["habit"],
    });
  }

  for (const emotionRule of EMOTION_PATTERNS) {
    if (emotionRule.pattern.test(source)) {
      out.push({
        kind: "emotion",
        text: `Emotional signal: ${emotionRule.label}`,
        field: "emotion",
        value: emotionRule.label,
        confidence: 0.68,
        tags: ["emotion"],
      });
      break;
    }
  }

  const unique = new Map<string, LearnedSignal>();
  for (const signal of out) {
    unique.set(`${signal.kind}:${signal.value ?? signal.text}`.toLowerCase(), signal);
  }

  return [...unique.values()];
}
