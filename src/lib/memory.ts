import MemoryModel, { type MemoryDocument } from "@/models/Memory";
import UserProfileModel from "@/models/UserProfile";
import { DEFAULT_EMBEDDING_MODEL, getOpenAIClient } from "@/lib/openai";
import { compactText, cosineSimilarity, overlapScore } from "@/lib/utils";
import type {
  AgentMode,
  MemoryItem,
  ResponseTone,
  TrainingMode,
  UserSettings,
  VoiceGender,
  VoiceLanguage,
} from "@/types";

function toMemoryItem(doc: MemoryDocument & { _id?: unknown }) {
  return {
    ...doc,
    _id: String(doc._id),
    createdAt: new Date(doc.createdAt).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  } as MemoryItem;
}

function toSettings(doc: Awaited<ReturnType<typeof UserProfileModel.findOne>>) {
  if (!doc) {
    throw new Error("User profile missing");
  }

  return {
    userId: doc.userId,
    agent: doc.agent,
    knowledgeMode: doc.knowledgeMode,
    preferences: {
      responseTone: doc.preferences.responseTone,
      theme: doc.preferences.theme,
      wakeWordEnabled: doc.preferences.wakeWordEnabled,
      voiceGender: doc.preferences.voiceGender ?? "female",
      voiceLanguage: doc.preferences.voiceLanguage ?? "bilingual",
    },
    training: {
      autoLearning: doc.training.autoLearning,
      mode: doc.training.mode,
    },
  } as UserSettings;
}

export async function ensureUserProfile(userId: string) {
  const profile = await UserProfileModel.findOneAndUpdate(
    { userId },
    {
      $setOnInsert: {
        userId,
        displayName: "Commander",
        agent: "general",
        knowledgeMode: false,
        preferences: {
          responseTone: "professional",
          theme: "jarvis",
          wakeWordEnabled: false,
          voiceGender: "female",
          voiceLanguage: "bilingual",
        },
        training: {
          autoLearning: true,
          mode: "passive",
        },
      },
    },
    { upsert: true, new: true },
  );

  return toSettings(profile);
}

export async function getUserSettings(userId: string) {
  const profile = await UserProfileModel.findOne({ userId });

  if (!profile) {
    return ensureUserProfile(userId);
  }

  return toSettings(profile);
}

export async function updateUserSettings(
  userId: string,
  updates: {
    agent?: AgentMode;
    knowledgeMode?: boolean;
    training?: {
      autoLearning?: boolean;
      mode?: TrainingMode;
    };
    preferences?: {
      responseTone?: ResponseTone;
      theme?: "jarvis" | "friday";
      wakeWordEnabled?: boolean;
      voiceGender?: VoiceGender;
      voiceLanguage?: VoiceLanguage;
    };
  },
) {
  await ensureUserProfile(userId);

  const updateDoc: Record<string, unknown> = {};

  if (typeof updates.agent === "string") {
    updateDoc.agent = updates.agent;
  }

  if (typeof updates.knowledgeMode === "boolean") {
    updateDoc.knowledgeMode = updates.knowledgeMode;
  }

  if (updates.training) {
    if (typeof updates.training.autoLearning === "boolean") {
      updateDoc["training.autoLearning"] = updates.training.autoLearning;
    }
    if (updates.training.mode) {
      updateDoc["training.mode"] = updates.training.mode;
    }
  }

  if (updates.preferences) {
    if (updates.preferences.responseTone) {
      updateDoc["preferences.responseTone"] = updates.preferences.responseTone;
    }
    if (updates.preferences.theme) {
      updateDoc["preferences.theme"] = updates.preferences.theme;
    }
    if (typeof updates.preferences.wakeWordEnabled === "boolean") {
      updateDoc["preferences.wakeWordEnabled"] = updates.preferences.wakeWordEnabled;
    }
    if (updates.preferences.voiceGender) {
      updateDoc["preferences.voiceGender"] = updates.preferences.voiceGender;
    }
    if (updates.preferences.voiceLanguage) {
      updateDoc["preferences.voiceLanguage"] = updates.preferences.voiceLanguage;
    }
  }

  const profile = await UserProfileModel.findOneAndUpdate(
    { userId },
    { $set: updateDoc },
    { new: true },
  );

  return toSettings(profile);
}

export async function listMemories(userId: string, limit = 200) {
  const items = await MemoryModel.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(limit)
    .lean();

  return items.map((item) => toMemoryItem(item as MemoryDocument & { _id: unknown }));
}

async function buildEmbedding(text: string) {
  if (process.env.ENABLE_SEMANTIC_MEMORY !== "true") {
    return null;
  }

  const client = getOpenAIClient();

  if (!client) {
    return null;
  }

  try {
    const response = await client.embeddings.create({
      model: DEFAULT_EMBEDDING_MODEL,
      input: compactText(text, 2000),
    });

    return response.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

export async function createMemory(input: {
  userId: string;
  kind: MemoryDocument["kind"];
  text: string;
  field?: string;
  value?: string;
  source?: MemoryDocument["source"];
  confidence?: number;
  tags?: string[];
}) {
  const normalizedText = compactText(input.text, 600);
  if (!normalizedText) {
    throw new Error("Memory text is required");
  }

  const duplicateQuery: Record<string, unknown> = {
    userId: input.userId,
    kind: input.kind,
    text: new RegExp(`^${escapeRegExp(normalizedText)}$`, "i"),
  };

  if (input.field) {
    duplicateQuery.field = input.field;
  }

  if (input.value) {
    duplicateQuery.value = input.value;
  }

  const duplicate = await MemoryModel.findOne(duplicateQuery);

  if (duplicate) {
    duplicate.updatedAt = new Date();
    duplicate.source = input.source ?? duplicate.source;
    duplicate.confidence = Math.max(input.confidence ?? 0.7, duplicate.confidence);
    duplicate.tags = Array.from(new Set([...(duplicate.tags ?? []), ...(input.tags ?? [])]));
    await duplicate.save();

    return toMemoryItem(duplicate.toObject() as MemoryDocument & { _id: unknown });
  }

  const embedding = await buildEmbedding(normalizedText);

  const created = await MemoryModel.create({
    ...input,
    text: normalizedText,
    source: input.source ?? "manual",
    confidence: input.confidence ?? 0.7,
    tags: input.tags ?? [],
    embedding: embedding ?? undefined,
  });

  return toMemoryItem(created.toObject() as MemoryDocument & { _id: unknown });
}

export async function updateMemoryById(
  id: string,
  userId: string,
  updates: Partial<
    Pick<
      MemoryDocument,
      "text" | "field" | "value" | "kind" | "confidence" | "tags"
    >
  >,
) {
  const updateDoc: Record<string, unknown> = {};

  if (typeof updates.text === "string") {
    updateDoc.text = compactText(updates.text, 600);
    updateDoc.embedding = await buildEmbedding(updates.text);
  }

  if (typeof updates.field === "string") {
    updateDoc.field = updates.field;
  }

  if (typeof updates.value === "string") {
    updateDoc.value = updates.value;
  }

  if (typeof updates.kind === "string") {
    updateDoc.kind = updates.kind;
  }

  if (typeof updates.confidence === "number") {
    updateDoc.confidence = updates.confidence;
  }

  if (Array.isArray(updates.tags)) {
    updateDoc.tags = updates.tags;
  }

  const item = await MemoryModel.findOneAndUpdate(
    { _id: id, userId },
    { $set: updateDoc },
    { new: true },
  );

  if (!item) {
    return null;
  }

  return toMemoryItem(item.toObject() as MemoryDocument & { _id: unknown });
}

export async function deleteMemoryById(id: string, userId: string) {
  await MemoryModel.deleteOne({ _id: id, userId });
}

export async function deleteMemoryByText(userId: string, text: string) {
  const pattern = compactText(text, 200);

  if (!pattern) {
    return 0;
  }

  const result = await MemoryModel.deleteMany({
    userId,
    text: { $regex: escapeRegExp(pattern), $options: "i" },
  });

  return result.deletedCount ?? 0;
}

export async function clearUserMemories(userId: string) {
  await MemoryModel.deleteMany({ userId });
}

export async function persistAutoSignals(
  userId: string,
  signals: Array<{
    kind: MemoryDocument["kind"];
    text: string;
    field?: string;
    value?: string;
    confidence: number;
    tags: string[];
  }>,
) {
  let saved = 0;

  for (const signal of signals) {
    try {
      await createMemory({
        userId,
        kind: signal.kind,
        text: signal.text,
        field: signal.field,
        value: signal.value,
        source: "auto",
        confidence: signal.confidence,
        tags: signal.tags,
      });
      saved += 1;
    } catch {
      // Skip individual signal failures to keep chat resilient.
    }
  }

  return saved;
}

export async function getRelevantMemories(
  userId: string,
  query: string,
  limit = 8,
) {
  const candidates = await MemoryModel.find({ userId })
    .sort({ updatedAt: -1 })
    .limit(180)
    .select("+embedding")
    .lean();

  if (!candidates.length) {
    return [];
  }

  const now = Date.now();
  const queryEmbedding = await buildEmbedding(query);

  const ranked = candidates
    .map((item) => {
      const lexical = overlapScore(
        `${item.text} ${(item.tags ?? []).join(" ")} ${item.value ?? ""}`,
        query,
      );

      const ageMs = now - new Date(item.updatedAt).getTime();
      const ageDays = ageMs / 86_400_000;
      const recency = 1 / (1 + ageDays / 20);

      const semantic =
        queryEmbedding && Array.isArray(item.embedding)
          ? cosineSimilarity(item.embedding, queryEmbedding)
          : 0;

      const score = lexical * 0.62 + recency * 0.23 + semantic * 0.15;

      return {
        item,
        score,
      };
    })
    .sort((a, b) => b.score - a.score);

  const selected = ranked
    .slice(0, limit)
    .map((entry) => toMemoryItem(entry.item as MemoryDocument & { _id: unknown }));

  return selected;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
