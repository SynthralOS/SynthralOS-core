CREATE TABLE IF NOT EXISTS "change_detection" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"workspace_id" text,
	"user_id" text,
	"url" text NOT NULL,
	"selector" text,
	"previous_content" text,
	"previous_hash" text,
	"current_content" text,
	"current_hash" text,
	"change_detected" boolean DEFAULT false NOT NULL,
	"change_type" text,
	"change_details" jsonb,
	"last_checked_at" timestamp DEFAULT now() NOT NULL,
	"last_changed_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"check_interval" integer DEFAULT 3600,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "scraper_selectors" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"workspace_id" text,
	"url" text NOT NULL,
	"field_name" text NOT NULL,
	"selector" text NOT NULL,
	"selector_type" text DEFAULT 'css' NOT NULL,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_success_at" timestamp,
	"last_failure_at" timestamp,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_organization_id_idx" ON "change_detection" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_workspace_id_idx" ON "change_detection" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_user_id_idx" ON "change_detection" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_url_idx" ON "change_detection" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_change_detected_idx" ON "change_detection" ("change_detected");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_is_active_idx" ON "change_detection" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "change_detection_last_checked_at_idx" ON "change_detection" ("last_checked_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_organization_id_idx" ON "scraper_selectors" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_workspace_id_idx" ON "scraper_selectors" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_url_idx" ON "scraper_selectors" ("url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_field_name_idx" ON "scraper_selectors" ("field_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_is_active_idx" ON "scraper_selectors" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scraper_selectors_created_at_idx" ON "scraper_selectors" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_detection" ADD CONSTRAINT "change_detection_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_detection" ADD CONSTRAINT "change_detection_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "change_detection" ADD CONSTRAINT "change_detection_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_selectors" ADD CONSTRAINT "scraper_selectors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "scraper_selectors" ADD CONSTRAINT "scraper_selectors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
