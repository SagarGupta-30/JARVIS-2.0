import { compactText } from "@/lib/utils";

export const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

type GeminiRole = "system" | "user" | "assistant";

export interface GeminiMessage {
  role: GeminiRole;
  content: string;
}

function normalizeMessages(messages: GeminiMessage[]) {
  type GeminiContent = { role: "user" | "model"; parts: Array<{ text: string }> };

  const systemMessages = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();

  const rawContents: GeminiContent[] = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: compactText(message.content, 12_000) }],
    }));

  const leadingModelText: string[] = [];
  while (rawContents.length && rawContents[0]?.role === "model") {
    const head = rawContents.shift();
    const text = head?.parts?.[0]?.text?.trim();
    if (text) {
      leadingModelText.push(text);
    }
  }

  if (leadingModelText.length) {
    rawContents.unshift({
      role: "user",
      parts: [
        {
          text: compactText(
            [
              "Conversation context from prior assistant messages:",
              ...leadingModelText,
            ].join("\n\n"),
            12_000,
          ),
        },
      ],
    });
  }

  const contents: GeminiContent[] = [];

  for (const item of rawContents) {
    const text = item.parts?.[0]?.text?.trim();
    if (!text) {
      continue;
    }

    const last = contents[contents.length - 1];
    if (last && last.role === item.role) {
      last.parts[0].text = compactText(`${last.parts[0].text}\n\n${text}`, 12_000);
      continue;
    }

    contents.push({
      role: item.role,
      parts: [{ text }],
    });
  }

  if (!contents.length) {
    contents.push({
      role: "user",
      parts: [{ text: "Continue." }],
    });
  }

  return {
    systemInstruction: systemMessages
      ? {
          parts: [{ text: compactText(systemMessages, 18_000) }],
        }
      : undefined,
    contents,
  };
}

export function getGeminiApiKey() {
  const key = process.env.GEMINI_API_KEY?.trim();
  return key || null;
}

export async function generateGeminiText(input: {
  messages: GeminiMessage[];
  temperature: number;
  model?: string;
}) {
  const apiKey = getGeminiApiKey();

  if (!apiKey) {
    throw Object.assign(new Error("Missing GEMINI_API_KEY"), { status: 401 });
  }

  const model = (input.model || DEFAULT_GEMINI_MODEL).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const normalized = normalizeMessages(input.messages);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(normalized.systemInstruction
        ? { system_instruction: normalized.systemInstruction }
        : {}),
      contents: normalized.contents,
      generationConfig: {
        temperature: input.temperature,
        maxOutputTokens: 2048,
      },
    }),
    cache: "no-store",
  });

  const payload = (await response.json()) as {
    error?: {
      message?: string;
      code?: number;
      status?: string;
    };
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };

  if (!response.ok || payload.error) {
    const message =
      payload.error?.message ||
      `Gemini request failed with status ${response.status}`;
    throw Object.assign(new Error(message), {
      status: payload.error?.code ?? response.status,
    });
  }

  const text =
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim() || "";

  if (!text) {
    throw Object.assign(new Error("Gemini returned an empty response"), {
      status: 502,
    });
  }

  return text;
}
