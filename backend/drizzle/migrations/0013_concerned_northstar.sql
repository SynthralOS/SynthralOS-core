CREATE TABLE IF NOT EXISTS "scraper_events" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"workspace_id" text,
	"user_id" text,
	"url" text NOT NULL,
	"engine" text NOT NULL,
	"success" boolean NOT NULL,
	"latency_ms" integer,
	"content_length" integer,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_organization_id_idx" ON "scraper_events" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_workspace_id_idx" ON "scraper_events" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_user_id_idx" ON "scraper_events" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_url_idx" ON "scraper_events" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_engine_idx" ON "scraper_events" ("engine");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_success_idx" ON "scraper_events" ("success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_events_created_at_idx" ON "scraper_events" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_events" ADD CONSTRAINT "scraper_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_events" ADD CONSTRAINT "scraper_events_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_events" ADD CONSTRAINT "scraper_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
