CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_message" text NOT NULL,
	"ai_message" text NOT NULL,
	"session_id" text NOT NULL,
	"workflow" varchar(255) NOT NULL,
	"workflow_id" text NOT NULL,
	"created_at" date DEFAULT now() NOT NULL,
	"updated_at" date DEFAULT now() NOT NULL
);
