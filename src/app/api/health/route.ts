import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasMongo = Boolean(process.env.MONGODB_URI);

  return NextResponse.json({
    ok: true,
    service: "jarvis-2.0",
    timestamp: new Date().toISOString(),
    env: {
      OPENAI_API_KEY: hasOpenAI ? "set" : "missing",
      GEMINI_API_KEY: hasGemini ? "set" : "missing",
      MONGODB_URI: hasMongo ? "set" : "missing",
      OPENAI_MODEL: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      GEMINI_MODEL: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
    },
  });
}
