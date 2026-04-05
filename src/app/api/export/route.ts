import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import ConversationModel from "@/models/Conversation";
import MemoryModel from "@/models/Memory";
import ProductivityItemModel from "@/models/ProductivityItem";
import UserProfileModel from "@/models/UserProfile";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;

    const [profile, memories, history, productivity] = await Promise.all([
      UserProfileModel.findOne({ userId }).lean(),
      MemoryModel.find({ userId }).sort({ updatedAt: -1 }).lean(),
      ConversationModel.find({ userId }).sort({ createdAt: 1 }).lean(),
      ProductivityItemModel.find({ userId }).sort({ createdAt: -1 }).lean(),
    ]);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      userId,
      profile,
      memories,
      history,
      productivity,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to export user data",
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

    await Promise.all([
      MemoryModel.deleteMany({ userId }),
      ConversationModel.deleteMany({ userId }),
      ProductivityItemModel.deleteMany({ userId }),
      UserProfileModel.deleteOne({ userId }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete user data",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
