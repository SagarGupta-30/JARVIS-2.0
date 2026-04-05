import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import {
  clearUserMemories,
  createMemory,
  ensureUserProfile,
  listMemories,
} from "@/lib/memory";
import type { MemoryKind } from "@/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    const limit = Number.parseInt(
      request.nextUrl.searchParams.get("limit") ?? "200",
      10,
    );

    await ensureUserProfile(userId);
    const memories = await listMemories(userId, Number.isNaN(limit) ? 200 : limit);

    return NextResponse.json({ memories });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load memories",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const body = (await request.json()) as {
      userId?: string;
      kind?: MemoryKind;
      text?: string;
      field?: string;
      value?: string;
      source?: "manual" | "auto" | "system";
      confidence?: number;
      tags?: string[];
    };

    const userId = body.userId ?? DEFAULT_USER_ID;

    if (!body.text?.trim()) {
      return NextResponse.json(
        { error: "Memory text is required" },
        { status: 400 },
      );
    }

    const memory = await createMemory({
      userId,
      kind: body.kind ?? "note",
      text: body.text,
      field: body.field,
      value: body.value,
      source: body.source ?? "manual",
      confidence: body.confidence ?? 0.8,
      tags: body.tags ?? [],
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create memory",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    await clearUserMemories(userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to clear memories",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
