import OpenAI from "openai";

let client: OpenAI | null = null;

export const DEFAULT_CHAT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
export const DEFAULT_EMBEDDING_MODEL =
  process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new OpenAI({ apiKey });
  }

  return client;
}
