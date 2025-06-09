import { asc, desc, inArray, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { chatsTable } from "@/db/schema";
import db from "@/app/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "10");
    const sortOrder =
      (searchParams.get("sortOrder") as "asc" | "desc") || "asc";
    const groupBy = searchParams.get("groupBy") || "simple"; // 'simple' or 'session'

    // Validate parameters
    if (page < 1) {
      return NextResponse.json(
        { error: "Page must be greater than 0" },
        { status: 400 }
      );
    }

    if (pageSize < 1 || pageSize > 100) {
      return NextResponse.json(
        { error: "Page size must be between 1 and 100" },
        { status: 400 }
      );
    }

    const offset = (page - 1) * pageSize;

    if (groupBy === "session") {
      // Approach 1: Get sessions with their complete chat histories
      const sessions = await db
        .selectDistinct({ sessionId: chatsTable.sessionId })
        .from(chatsTable)
        .limit(pageSize)
        .offset(offset);

      if (sessions.length === 0) {
        return NextResponse.json({
          data: [],
          pagination: {
            page,
            pageSize,
            totalSessions: 0,
            totalPages: 0,
          },
        });
      }

      const sessionIds = sessions.map((s) => s.sessionId);

      // Get all chats for these sessions
      const chatsForSessions = await db
        .select()
        .from(chatsTable)
        .where(inArray(chatsTable.sessionId, sessionIds))
        .orderBy(
          sortOrder === "asc"
            ? asc(chatsTable.createdAt)
            : desc(chatsTable.createdAt),
          chatsTable.sessionId
        );

      // Group by sessionId
      const groupedchatsTable = chatsForSessions.reduce((acc, chat) => {
        if (!acc[chat.sessionId]) {
          acc[chat.sessionId] = [];
        }
        acc[chat.sessionId].push(chat);
        return acc;
      }, {} as Record<string, typeof chatsForSessions>);

      // Get total session count for pagination
      const totalSessionsResult = await db
        .select({
          count: sql<number>`count(distinct ${chatsTable.sessionId})`,
        })
        .from(chatsTable);

      const totalSessions = totalSessionsResult[0].count;
      const totalPages = Math.ceil(totalSessions / pageSize);

      return NextResponse.json({
        data: groupedchatsTable,
        pagination: {
          page,
          pageSize,
          total: parseInt(totalSessions.toString(), 10),
          totalPages,
          groupBy: "session",
        },
      });
    } else {
      // Approach 2: Simple pagination of all chatsTable
      const result = await db
        .select()
        .from(chatsTable)
        .orderBy(
          sortOrder === "asc"
            ? asc(chatsTable.createdAt)
            : desc(chatsTable.createdAt)
        )
        .limit(pageSize)
        .offset(offset);

      // Get total count for pagination
      const totalCountResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(chatsTable);

      const totalCount = totalCountResult[0].count;
      const totalPages = Math.ceil(totalCount / pageSize);

      return NextResponse.json({
        data: result,
        pagination: {
          page,
          pageSize,
          total: parseInt(totalCount.toString(), 10),
          totalPages,
          groupBy: "simple",
        },
      });
    }
  } catch (error) {
    console.error("Error fetching chatsTable:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
