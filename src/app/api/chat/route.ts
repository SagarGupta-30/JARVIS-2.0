import { NextRequest } from "next/server";

import { extractSignalsFromMessage, shouldAutoLearn } from "@/lib/auto-learning";
import { commandHelpMessage, parseCommand } from "@/lib/commands";
import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { generateFallbackAssistantReply } from "@/lib/fallback-assistant";
import {
  DEFAULT_GEMINI_MODEL,
  generateGeminiText,
  getGeminiApiKey,
} from "@/lib/gemini";
import {
  clearUserMemories,
  createMemory,
  deleteMemoryByText,
  ensureUserProfile,
  getRelevantMemories,
  persistAutoSignals,
  updateUserSettings,
} from "@/lib/memory";
import { DEFAULT_CHAT_MODEL, getOpenAIClient } from "@/lib/openai";
import { buildSystemPrompt } from "@/lib/prompt";
import { compactText, createId } from "@/lib/utils";
import { fetchKnowledgeSnippets } from "@/lib/web-search";
import ConversationModel from "@/models/Conversation";
import type { ChatMessage, UploadedContextFile, UserSettings } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type ChatRequestBody = {
  userId?: string;
  messages?: ChatMessage[];
  agent?: UserSettings["agent"];
  knowledgeMode?: boolean;
  preferences?: Partial<UserSettings["preferences"]>;
  training?: Partial<UserSettings["training"]>;
  files?: UploadedContextFile[];
};

const STREAM_HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};

function streamText(
  text: string,
  onComplete?: () => Promise<void> | void,
  chunkDelayMs = 0,
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (chunkDelayMs <= 0) {
        controller.enqueue(encoder.encode(text));
        controller.close();
        await onComplete?.();
        return;
      }

      const chunks = text.split(/(\s+)/);
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise((resolve) => setTimeout(resolve, chunkDelayMs));
      }
      controller.close();
      await onComplete?.();
    },
  });

  return new Response(stream, {
    headers: STREAM_HEADERS,
  });
}

function summarizeLocally(input: string) {
  const sentences = input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .slice(0, 4);

  if (!sentences.length) {
    return "No summary available. Provide more text to summarize.";
  }

  return [
    "Summary:",
    ...sentences.map((sentence, index) => `${index + 1}. ${compactText(sentence, 180)}`),
  ].join("\n");
}

async function runCommand(
  body: ChatRequestBody,
  input: string,
  settings: UserSettings,
  dbReady: boolean,
  cloudSummarizer?: (text: string) => Promise<string | null>,
) {
  const parsed = parseCommand(input);

  if (!parsed) {
    return null;
  }

  const userId = body.userId ?? DEFAULT_USER_ID;
  if (parsed.type === "help") {
    return commandHelpMessage();
  }

  if (parsed.type === "remember") {
    if (!parsed.text) {
      return "Please provide text after /remember.";
    }

    if (!dbReady) {
      return "Memory backend is unavailable. Add MONGODB_URI to enable persistence.";
    }

    await createMemory({
      userId,
      kind: "note",
      text: parsed.text,
      source: "manual",
      confidence: 0.95,
      tags: ["manual"],
    });

    return `Stored memory: ${parsed.text}`;
  }

  if (parsed.type === "forget") {
    if (!parsed.text) {
      return "Please provide text after /forget.";
    }

    if (!dbReady) {
      return "Memory backend is unavailable. Nothing was removed.";
    }

    const deleted = await deleteMemoryByText(userId, parsed.text);
    return deleted
      ? `Removed ${deleted} memory item(s) matching "${parsed.text}".`
      : `No memory matched "${parsed.text}".`;
  }

  if (parsed.type === "update") {
    if (!parsed.field || !parsed.value) {
      return "Use /update <field>: <value>. Example: /update response_style: concise";
    }

    if (!dbReady) {
      return "Memory backend is unavailable. Update was not persisted.";
    }

    await createMemory({
      userId,
      kind: "preference",
      text: `${parsed.field} = ${parsed.value}`,
      field: parsed.field,
      value: parsed.value,
      source: "manual",
      confidence: 0.94,
      tags: ["manual", "preference"],
    });

    return `Updated memory field ${parsed.field} to "${parsed.value}".`;
  }

  if (parsed.type === "clear_memory") {
    if (!dbReady) {
      return "Memory backend is unavailable. Nothing to clear.";
    }

    await clearUserMemories(userId);
    return "All long-term memories were cleared.";
  }

  if (parsed.type === "summarize") {
    const text = parsed.text.trim();
    if (!text) {
      return "Please provide text after /summarize.";
    }

    if (cloudSummarizer) {
      try {
        const result = await cloudSummarizer(text);
        if (result) {
          return result;
        }
      } catch {
        // Ignore and continue to local summarization fallback.
      }
    }
    return summarizeLocally(text);
  }

  if (settings.training.mode === "focus") {
    return "Focus mode is active. Command not recognized. Use /help for supported commands.";
  }

  return "Command not recognized. Use /help to view available commands.";
}

function resolveProviderFailureReason(error: unknown): Parameters<
  typeof buildFallbackReply
>[0]["reason"] {
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? Number((error as { status?: unknown }).status)
      : undefined;

  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String((error as { message?: unknown }).message ?? "").toLowerCase()
      : "";

  const authFailure =
    status === 401 ||
    /incorrect api key|invalid api key|api key not valid|unauthorized/.test(
      message,
    );

  if (authFailure) {
    return "auth";
  }

  const modelFailure =
    status === 404 ||
    /model.*does not exist|model.*not found|invalid model/.test(message);

  if (modelFailure) {
    return "model";
  }

  const quotaFailure =
    status === 429 ||
    /insufficient_quota|exceeded your current quota|resource has been exhausted|billing|quota/.test(
      message,
    );

  if (quotaFailure) {
    return "quota";
  }

  const permissionFailure =
    status === 403 || /not allowed|permission|forbidden|access denied/.test(message);

  if (permissionFailure) {
    return "permission";
  }

  return "generic";
}

async function saveExchange(input: {
  userId: string;
  userMessage: string;
  assistantMessage: string;
  files: UploadedContextFile[];
}) {
  const attachments = input.files.map((file) => ({
    name: file.name,
    type: file.type || "text/plain",
    contentPreview: compactText(file.content, 220),
  }));

  await ConversationModel.create([
    {
      userId: input.userId,
      role: "user",
      content: input.userMessage,
      sessionId: "default",
      attachments,
    },
    {
      userId: input.userId,
      role: "assistant",
      content: input.assistantMessage,
      sessionId: "default",
      attachments: [],
    },
  ]);
}

function buildFallbackReply(input: {
  reason:
    | "missing_key"
    | "auth"
    | "quota"
    | "permission"
    | "model"
    | "generic";
  userMessage: string;
  settings: UserSettings;
  memories: Awaited<ReturnType<typeof getRelevantMemories>>;
  knowledgeSnippets: string[];
  files: UploadedContextFile[];
}) {
  return generateFallbackAssistantReply({
    reason: input.reason,
    userMessage: input.userMessage,
    agent: input.settings.agent,
    tone: input.settings.preferences.responseTone,
    trainingMode: input.settings.training.mode,
    memories: input.memories,
    knowledgeSnippets: input.knowledgeSnippets,
    files: input.files,
  });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ChatRequestBody;

  const userId = body.userId ?? DEFAULT_USER_ID;
  const messages = (body.messages ?? []).filter(
    (message) => message.role === "user" || message.role === "assistant",
  );

  if (!messages.length) {
    return new Response("No chat messages provided.", { status: 400 });
  }

  const latestUserMessage = [...messages]
    .reverse()
    .find((message) => message.role === "user");

  if (!latestUserMessage) {
    return new Response("No user message found.", { status: 400 });
  }

  const files = (body.files ?? []).map((file) => ({
    ...file,
    content: compactText(file.content, 2400),
  }));

  let dbReady = true;
  let settings: UserSettings = {
    userId,
    agent: body.agent ?? "general",
    knowledgeMode: body.knowledgeMode ?? false,
    preferences: {
      responseTone: body.preferences?.responseTone ?? "professional",
      theme: body.preferences?.theme ?? "jarvis",
      wakeWordEnabled: body.preferences?.wakeWordEnabled ?? false,
      voiceGender: body.preferences?.voiceGender ?? "female",
      voiceLanguage: body.preferences?.voiceLanguage ?? "bilingual",
    },
    training: {
      autoLearning: body.training?.autoLearning ?? true,
      mode: body.training?.mode ?? "passive",
    },
  };

  try {
    await connectToDatabase();
    settings = await ensureUserProfile(userId);

    settings = await updateUserSettings(userId, {
      agent: body.agent,
      knowledgeMode: body.knowledgeMode,
      preferences: body.preferences,
      training: body.training,
    });
  } catch {
    dbReady = false;
  }

  const geminiKey = getGeminiApiKey();
  const openAiClient = getOpenAIClient();

  const cloudSummarizer = async (text: string) => {
    if (geminiKey) {
      return generateGeminiText({
        model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Summarize the user's text in compact bullet points. Include key actions and risks.",
          },
          {
            role: "user",
            content: text,
          },
        ],
      });
    }

    if (!openAiClient) {
      return null;
    }

    const completion = await openAiClient.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_CHAT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "Summarize the user's text in compact bullet points. Include key actions and risks.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    return (
      completion.choices[0]?.message?.content?.trim() ||
      "Unable to summarize right now."
    );
  };

  const commandResult = await runCommand(
    body,
    latestUserMessage.content,
    settings,
    dbReady,
    cloudSummarizer,
  );

  if (commandResult !== null) {
    return streamText(
      commandResult,
      dbReady
        ? () =>
            saveExchange({
              userId,
              userMessage: latestUserMessage.content,
              assistantMessage: commandResult,
              files,
            })
        : undefined,
      3,
    );
  }

  const memories = dbReady
    ? await getRelevantMemories(userId, latestUserMessage.content, 10)
    : [];

  const knowledgeSnippets = settings.knowledgeMode
    ? await fetchKnowledgeSnippets(latestUserMessage.content)
    : [];

  const systemPrompt = buildSystemPrompt({
    agent: settings.agent,
    tone: settings.preferences.responseTone,
    trainingMode: settings.training.mode,
    memories,
    knowledgeSnippets,
    files,
    nowIso: new Date().toISOString(),
  });

  const conversationMessages = messages.slice(-14).map((message) => ({
    role: message.role,
    content: message.content,
  }));

  let providerError: unknown = null;

  if (geminiKey) {
    try {
      const geminiText = await generateGeminiText({
        model: process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL,
        temperature: settings.training.mode === "focus" ? 0.45 : 0.7,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          ...conversationMessages,
        ],
      });

      return streamText(
        geminiText,
        dbReady
          ? async () => {
              await saveExchange({
                userId,
                userMessage: latestUserMessage.content,
                assistantMessage: geminiText,
                files,
              });

              if (shouldAutoLearn(settings.training.mode, settings.training.autoLearning)) {
                const signals = extractSignalsFromMessage(latestUserMessage.content);
                await persistAutoSignals(userId, signals);
              }
            }
          : undefined,
        2,
      );
    } catch (error) {
      providerError = error;
    }
  }

  const client = openAiClient;

  if (!client) {
    const fallback = buildFallbackReply({
      reason: geminiKey
        ? resolveProviderFailureReason(providerError)
        : "missing_key",
      userMessage: latestUserMessage.content,
      settings,
      memories,
      knowledgeSnippets,
      files,
    });

    return streamText(
      fallback,
      dbReady
        ? async () => {
            await saveExchange({
              userId,
              userMessage: latestUserMessage.content,
              assistantMessage: fallback,
              files,
            });

            if (shouldAutoLearn(settings.training.mode, settings.training.autoLearning)) {
              const signals = extractSignalsFromMessage(latestUserMessage.content);
              await persistAutoSignals(userId, signals);
            }
          }
        : undefined,
      2,
    );
  }

  const openAiMessages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }> = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...conversationMessages,
  ];

  let completion:
    | Awaited<ReturnType<typeof client.chat.completions.create>>
    | null = null;

  try {
    completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_CHAT_MODEL,
      temperature: settings.training.mode === "focus" ? 0.45 : 0.7,
      stream: true,
      messages: openAiMessages,
    });
  } catch (error) {
    const reason = resolveProviderFailureReason(error);

    const fallbackMessage = buildFallbackReply({
      reason,
      userMessage: latestUserMessage.content,
      settings,
      memories,
      knowledgeSnippets,
      files,
    });

    return streamText(
      fallbackMessage,
      dbReady
        ? () =>
            saveExchange({
              userId,
              userMessage: latestUserMessage.content,
              assistantMessage: fallbackMessage,
              files,
            })
        : undefined,
      2,
    );
  }

  const encoder = new TextEncoder();
  let assistantOutput = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            assistantOutput += token;
            controller.enqueue(encoder.encode(token));
          }
        }

        controller.close();

        if (dbReady) {
          await saveExchange({
            userId,
            userMessage: latestUserMessage.content,
            assistantMessage: assistantOutput || "Acknowledged.",
            files,
          });

          if (shouldAutoLearn(settings.training.mode, settings.training.autoLearning)) {
            const signals = extractSignalsFromMessage(latestUserMessage.content);
            await persistAutoSignals(userId, signals);
          }
        }
      } catch {
        controller.enqueue(
          encoder.encode("\n\nSignal interruption detected. Please retry."),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: STREAM_HEADERS,
  });
}

export async function GET() {
  return new Response(
    `JARVIS chat endpoint online (${createId("session")}). Use POST for streaming responses.`,
  );
}
