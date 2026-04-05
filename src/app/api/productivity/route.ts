import { NextRequest, NextResponse } from "next/server";

import { DEFAULT_USER_ID } from "@/lib/constants";
import { connectToDatabase } from "@/lib/db";
import ProductivityItemModel from "@/models/ProductivityItem";
import type { ProductivityType } from "@/types";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();

    const userId = request.nextUrl.searchParams.get("userId") ?? DEFAULT_USER_ID;
    const type = request.nextUrl.searchParams.get("type") as
      | ProductivityType
      | null;

    const query: { userId: string; type?: ProductivityType } = { userId };
    if (type) {
      query.type = type;
    }

    const items = await ProductivityItemModel.find(query)
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    return NextResponse.json({
      items: items.map((item) => ({
        ...item,
        _id: String(item._id),
        dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : undefined,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
      })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to load productivity items",
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
      type?: ProductivityType;
      title?: string;
      content?: string;
      dueAt?: string;
      priority?: "low" | "medium" | "high";
    };

    const userId = body.userId ?? DEFAULT_USER_ID;

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const item = await ProductivityItemModel.create({
      userId,
      type: body.type ?? "task",
      title: body.title.trim(),
      content: body.content?.trim() ?? "",
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      priority: body.priority ?? "medium",
      completed: false,
    });

    return NextResponse.json(
      {
        item: {
          ...item.toObject(),
          _id: String(item._id),
          dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : undefined,
          createdAt: new Date(item.createdAt).toISOString(),
          updatedAt: new Date(item.updatedAt).toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to create productivity item",
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
      id?: string;
      userId?: string;
      title?: string;
      content?: string;
      completed?: boolean;
      dueAt?: string;
      priority?: "low" | "medium" | "high";
      type?: ProductivityType;
    };

    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const userId = body.userId ?? DEFAULT_USER_ID;

    const updateDoc: Record<string, unknown> = {};

    if (typeof body.title === "string") {
      updateDoc.title = body.title.trim();
    }

    if (typeof body.content === "string") {
      updateDoc.content = body.content.trim();
    }

    if (typeof body.completed === "boolean") {
      updateDoc.completed = body.completed;
    }

    if (typeof body.dueAt === "string") {
      updateDoc.dueAt = body.dueAt ? new Date(body.dueAt) : undefined;
    }

    if (typeof body.priority === "string") {
      updateDoc.priority = body.priority;
    }

    if (typeof body.type === "string") {
      updateDoc.type = body.type;
    }

    const item = await ProductivityItemModel.findOneAndUpdate(
      { _id: body.id, userId },
      { $set: updateDoc },
      { new: true },
    );

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    return NextResponse.json({
      item: {
        ...item.toObject(),
        _id: String(item._id),
        dueAt: item.dueAt ? new Date(item.dueAt).toISOString() : undefined,
        createdAt: new Date(item.createdAt).toISOString(),
        updatedAt: new Date(item.updatedAt).toISOString(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update productivity item",
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
    const id = request.nextUrl.searchParams.get("id");

    if (id) {
      await ProductivityItemModel.deleteOne({ _id: id, userId });
      return NextResponse.json({ ok: true });
    }

    await ProductivityItemModel.deleteMany({ userId });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to delete productivity item",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
