import { count, gte } from "drizzle-orm";

import { chatsTable } from "@/db/schema";
import db from "@/app/lib/db";

export async function GET() {
  try {
    const now = new Date();

    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [daily, monthly, yearly, allTime] = await Promise.all([
      db
        .select({ count: count() })
        .from(chatsTable)
        .where(gte(chatsTable.createdAt, startOfToday.toISOString()))
        .then((res) => Number(res[0]?.count || 0)),

      db
        .select({ count: count() })
        .from(chatsTable)
        .where(gte(chatsTable.createdAt, startOfMonth.toISOString()))
        .then((res) => Number(res[0]?.count || 0)),

      db
        .select({ count: count() })
        .from(chatsTable)
        .where(gte(chatsTable.createdAt, startOfYear.toISOString()))
        .then((res) => Number(res[0]?.count || 0)),

      db
        .select({ count: count() })
        .from(chatsTable)
        .then((res) => Number(res[0]?.count || 0)),
    ]);

    return Response.json({ data: { daily, monthly, yearly, allTime } });
  } catch (error) {
    console.error("Failed to fetch chat stats:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
