import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import {
  ensureUserProfile,
  getUserSettings,
  updateUserSettings,
} from "@/lib/memory";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    await ensureUserProfile(userId);

    const settings = await getUserSettings(userId);

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load settings",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = (await request.json()) as {
      userId?: string;
      agent?: "general" | "coder" | "study" | "research";
      knowledgeMode?: boolean;
      preferences?: {
        responseTone?: "professional" | "friendly" | "technical";
        theme?: "jarvis" | "friday";
        wakeWordEnabled?: boolean;
      };
      training?: {
        autoLearning?: boolean;
        mode?: "passive" | "manual" | "focus";
      };
    };

    const userId = body.userId ?? DEFAULT_USER_ID;

    const settings = await updateUserSettings(userId, {
      agent: body.agent,
      knowledgeMode: body.knowledgeMode,
      preferences: body.preferences,
      training: body.training,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update settings",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
