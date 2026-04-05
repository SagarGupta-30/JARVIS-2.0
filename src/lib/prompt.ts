import type {
  AgentMode,
  MemoryItem,
  ResponseTone,
  TrainingMode,
  UploadedContextFile,
} from "@/types";

const AGENT_GUIDANCE: Record<AgentMode, string> = {
  general:
    "General strategist mode: prioritize actionable, concise guidance and proactive next-step suggestions.",
  coder:
    "Coder mode: prioritize clean architecture, debugging precision, and runnable code examples.",
  study:
    "Study mode: teach with clarity, spaced repetition style prompts, and progress checkpoints.",
  research:
    "Research mode: synthesize evidence, identify assumptions, and propose verification steps.",
};

const TONE_GUIDANCE: Record<ResponseTone, string> = {
  professional: "Use a professional, confident tone.",
  friendly: "Use a warm, approachable tone while staying concise.",
  technical: "Use a technical and precise tone with compact detail.",
};

const TRAINING_GUIDANCE: Record<TrainingMode, string> = {
  passive:
    "Passive mode active: personalize responses from memory and adapt naturally.",
  manual:
    "Manual mode active: rely on explicit user instructions and slash commands for personalization changes.",
  focus:
    "Focus mode active: reduce distractions, keep answers concise, and steer user to priority tasks.",
};

function memoryToLine(memory: MemoryItem) {
  const key = memory.field ? `${memory.field}: ` : "";
  return `- [${memory.kind}] ${key}${memory.value ?? memory.text}`;
}

function fileSummary(files: UploadedContextFile[]) {
  if (!files.length) {
    return "";
  }

  return [
    "Attached context files:",
    ...files.map(
      (file) =>
        `- ${file.name} (${file.type || "text"})\n${file.content.slice(0, 900)}`,
    ),
  ].join("\n");
}

export function buildSystemPrompt(input: {
  agent: AgentMode;
  tone: ResponseTone;
  trainingMode: TrainingMode;
  memories: MemoryItem[];
  knowledgeSnippets: string[];
  files: UploadedContextFile[];
  nowIso: string;
}) {
  const parts: string[] = [];

  parts.push(
    "You are JARVIS, a world-class AI copilot inspired by Tony Stark's assistant.",
  );
  parts.push(
    "Core behavior: confident, concise, slightly witty, anticipatory, and deeply practical.",
  );
  parts.push(AGENT_GUIDANCE[input.agent]);
  parts.push(TONE_GUIDANCE[input.tone]);
  parts.push(TRAINING_GUIDANCE[input.trainingMode]);
  parts.push(
    "Always ground claims. If uncertain, state uncertainty and propose how to verify.",
  );
  parts.push(
    "For coding answers, prefer language-specific snippets and short implementation steps.",
  );
  parts.push(
    "For study answers, include one mini-checkpoint question unless user asks not to.",
  );
  parts.push(`Current timestamp: ${input.nowIso}.`);

  if (input.memories.length) {
    parts.push("User memory context:");
    parts.push(input.memories.map(memoryToLine).join("\n"));
  }

  if (input.knowledgeSnippets.length) {
    parts.push("Live knowledge snippets retrieved for this query:");
    for (const snippet of input.knowledgeSnippets) {
      parts.push(`- ${snippet}`);
    }
  }

  const attachedFiles = fileSummary(input.files);
  if (attachedFiles) {
    parts.push(attachedFiles);
  }

  parts.push(
    "When responding, stay concise by default, but include deeper detail when the user asks.",
  );

  return parts.join("\n\n");
}
