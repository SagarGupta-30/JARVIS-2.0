import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import ConversationModel from "@/models/Conversation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    const limit = Number.parseInt(
      request.nextUrl.searchParams.get("limit") ?? "50",
      10,
    );

    const history = await ConversationModel.find({ userId })
      .sort({ createdAt: -1 })
      .limit(Number.isNaN(limit) ? 50 : limit)
      .lean();

    return NextResponse.json({
      messages: history
        .reverse()
        .map((item) => ({
          id: String(item._id),
          role: item.role,
          content: item.content,
          createdAt: new Date(item.createdAt).toISOString(),
        })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load history",
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
    await ConversationModel.deleteMany({ userId });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to clear history",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
