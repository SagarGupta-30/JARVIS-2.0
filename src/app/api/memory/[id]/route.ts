import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import { deleteMemoryById, updateMemoryById } from "@/lib/memory";
import type { MemoryKind } from "@/types";

export const runtime = "nodejs";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectToDatabase();

    const { id } = await context.params;
    const body = (await request.json()) as {
      userId?: string;
      text?: string;
      kind?: MemoryKind;
      field?: string;
      value?: string;
      confidence?: number;
      tags?: string[];
    };

    const userId = body.userId ?? DEFAULT_USER_ID;

    const memory = await updateMemoryById(id, userId, {
      text: body.text,
      kind: body.kind,
      field: body.field,
      value: body.value,
      confidence: body.confidence,
      tags: body.tags,
    });

    if (!memory) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    return NextResponse.json({ memory });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update memory",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await connectToDatabase();

    const { id } = await context.params;
    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;

    await deleteMemoryById(id, userId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete memory",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
