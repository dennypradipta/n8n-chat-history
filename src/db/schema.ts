import { date, pgTable, text, uuid, varchar } from "drizzle-orm/pg-core";

export const chatsTable = pgTable("chats", {
  id: uuid().primaryKey().defaultRandom(),
  userMessage: text("user_message").notNull(),
  aiMessage: text("ai_message").notNull(),
  sessionId: text("session_id").notNull(),
  workflow: varchar({ length: 255 }).notNull(),
  createdAt: date("created_at").defaultNow().notNull(),
  updatedAt: date("updated_at").defaultNow().notNull(),
});
