CREATE TABLE IF NOT EXISTS "email_triggers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text,
	"workflow_id" text NOT NULL,
	"node_id" text NOT NULL,
	"provider" text NOT NULL,
	"email" text NOT NULL,
	"credentials" jsonb NOT NULL,
	"folder" text DEFAULT 'INBOX',
	"last_checked_at" timestamp,
	"last_message_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"poll_interval" integer DEFAULT 60 NOT NULL,
	"filters" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_triggers" ADD CONSTRAINT "email_triggers_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
