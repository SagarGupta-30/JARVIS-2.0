import { compactText } from "@/lib/utils";
import type {
  AgentMode,
  MemoryItem,
  ResponseTone,
  TrainingMode,
  UploadedContextFile,
} from "@/types";

function topMemories(memories: MemoryItem[]) {
  return memories
    .slice(0, 2)
    .map((memory) => `- ${memory.kind.replace(/_/g, " ")}: ${memory.value ?? memory.text}`)
    .join("\n");
}

function fileHints(files: UploadedContextFile[]) {
  if (!files.length) {
    return "";
  }

  return files
    .slice(0, 2)
    .map(
      (file) =>
        `- ${file.name}: ${compactText(file.content.replace(/\s+/g, " "), 180)}`,
    )
    .join("\n");
}

function detectLanguage(input: string) {
  const lower = input.toLowerCase();
  if (lower.includes("python")) return "python";
  if (lower.includes("java")) return "java";
  if (lower.includes("c++") || lower.includes("cpp")) return "cpp";
  if (lower.includes("typescript") || lower.includes("javascript") || lower.includes("node")) {
    return "ts";
  }
  return null;
}

function codeStarter(language: string | null) {
  if (language === "python") {
    return [
      "```python",
      "def solve():",
      "    # TODO: implement logic",
      "    pass",
      "",
      "if __name__ == \"__main__\":",
      "    solve()",
      "```",
    ].join("\n");
  }

  if (language === "java") {
    return [
      "```java",
      "public class Main {",
      "  public static void main(String[] args) {",
      "    // TODO: implement logic",
      "  }",
      "}",
      "```",
    ].join("\n");
  }

  if (language === "cpp") {
    return [
      "```cpp",
      "#include <bits/stdc++.h>",
      "using namespace std;",
      "",
      "int main() {",
      "  ios::sync_with_stdio(false);",
      "  cin.tie(nullptr);",
      "  // TODO: implement logic",
      "  return 0;",
      "}",
      "```",
    ].join("\n");
  }

  if (language === "ts") {
    return [
      "```ts",
      "function solve(): void {",
      "  // TODO: implement logic",
      "}",
      "",
      "solve();",
      "```",
    ].join("\n");
  }

  return "";
}

function styleLine(tone: ResponseTone, mode: TrainingMode) {
  if (mode === "focus") {
    return "Focus mode active: concise execution guidance only.";
  }

  if (tone === "technical") {
    return "Technical mode active: precise steps and implementation detail.";
  }

  if (tone === "friendly") {
    return "Friendly mode active: clear and encouraging guidance.";
  }

  return "Professional mode active: direct and practical guidance.";
}

function taskPlanByAgent(agent: AgentMode) {
  if (agent === "coder") {
    return [
      "1. Confirm input/output requirements and edge cases.",
      "2. Draft the algorithm and time complexity.",
      "3. Implement minimal working version.",
      "4. Test with normal + edge cases.",
      "5. Refactor for readability.",
    ].join("\n");
  }

  if (agent === "study") {
    return [
      "1. Define target concept and current gap.",
      "2. Break into 25-minute deep-work blocks.",
      "3. Use active recall after each block.",
      "4. Review weak points at day end.",
      "5. Repeat with spaced repetition tomorrow.",
    ].join("\n");
  }

  if (agent === "research") {
    return [
      "1. Clarify research question.",
      "2. Collect high-confidence sources.",
      "3. Compare claims and assumptions.",
      "4. Extract actionable conclusions.",
      "5. Flag unknowns for validation.",
    ].join("\n");
  }

  return [
    "1. Clarify objective.",
    "2. Choose fastest viable path.",
    "3. Execute in small checkpoints.",
    "4. Measure result.",
    "5. Iterate.",
  ].join("\n");
}

export function generateFallbackAssistantReply(input: {
  reason:
    | "missing_key"
    | "auth"
    | "quota"
    | "permission"
    | "model"
    | "generic";
  userMessage: string;
  agent: AgentMode;
  tone: ResponseTone;
  trainingMode: TrainingMode;
  memories: MemoryItem[];
  knowledgeSnippets: string[];
  files: UploadedContextFile[];
}) {
  const prompt = compactText(input.userMessage, 1000);
  const lower = prompt.toLowerCase();

  const reasonLine =
    input.reason === "quota"
      ? "Cloud model unavailable (quota/billing). Running local JARVIS fallback."
      : input.reason === "auth"
        ? "Cloud model unavailable (authentication). Running local JARVIS fallback."
        : input.reason === "permission"
          ? "Cloud model unavailable (permissions). Running local JARVIS fallback."
          : input.reason === "model"
            ? "Cloud model unavailable (model config). Running local JARVIS fallback."
            : input.reason === "missing_key"
              ? "Cloud model unavailable (missing key). Running local JARVIS fallback."
              : "Cloud model unavailable. Running local JARVIS fallback.";

  const lines: string[] = [
    reasonLine,
    styleLine(input.tone, input.trainingMode),
    "",
  ];

  const isGreeting = /\b(hi|hello|hey|yo)\b/.test(lower);
  const asksSummary = /\b(summarize|summary|tl;dr)\b/.test(lower);
  const asksCode = /\b(code|bug|debug|algorithm|implement|java|python|c\+\+|cpp|typescript|javascript)\b/.test(
    lower,
  );

  if (isGreeting && prompt.length < 40) {
    lines.push("Hello. Systems online. Give me the target and I will execute.");
  }

  if (asksSummary) {
    lines.push("Quick summary:");
    lines.push(`- ${compactText(prompt, 180)}`);
    if (input.knowledgeSnippets.length) {
      lines.push(`- External signal: ${input.knowledgeSnippets[0]}`);
    }
  } else if (asksCode) {
    lines.push("Execution plan:");
    lines.push(taskPlanByAgent("coder"));
    const starter = codeStarter(detectLanguage(lower));
    if (starter) {
      lines.push("\nStarter template:");
      lines.push(starter);
    }
  } else {
    lines.push("Execution plan:");
    lines.push(taskPlanByAgent(input.agent));
  }

  const memoryBlock = topMemories(input.memories);
  if (memoryBlock) {
    lines.push("\nApplied memory context:");
    lines.push(memoryBlock);
  }

  const fileBlock = fileHints(input.files);
  if (fileBlock) {
    lines.push("\nFile context used:");
    lines.push(fileBlock);
  }

  if (input.knowledgeSnippets.length) {
    lines.push("\nKnowledge signals:");
    for (const snippet of input.knowledgeSnippets.slice(0, 2)) {
      lines.push(`- ${snippet}`);
    }
  }

  lines.push("\nReply with your exact target outcome and I will produce a concrete result.");

  return lines.join("\n").trim();
}
