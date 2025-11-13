DO $$ BEGIN
 CREATE TYPE "osint_monitor_status" AS ENUM('active', 'paused', 'error', 'disabled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "osint_source" AS ENUM('twitter', 'reddit', 'news', 'forums', 'github', 'linkedin', 'youtube', 'web');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "osint_monitors" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"workspace_id" text,
	"name" text NOT NULL,
	"description" text,
	"source" "osint_source" NOT NULL,
	"status" "osint_monitor_status" DEFAULT 'active' NOT NULL,
	"config" jsonb NOT NULL,
	"schedule" jsonb,
	"filters" jsonb,
	"workflow_id" text,
	"alert_id" text,
	"last_run_at" timestamp,
	"next_run_at" timestamp,
	"last_error" text,
	"error_count" integer DEFAULT 0 NOT NULL,
	"result_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "osint_results" (
	"id" text PRIMARY KEY NOT NULL,
	"monitor_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"source" "osint_source" NOT NULL,
	"source_id" text NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"url" text,
	"author" text,
	"author_url" text,
	"published_at" timestamp NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"sentiment" text,
	"sentiment_score" integer,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_monitors" ADD CONSTRAINT "osint_monitors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_monitors" ADD CONSTRAINT "osint_monitors_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_monitors" ADD CONSTRAINT "osint_monitors_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_monitors" ADD CONSTRAINT "osint_monitors_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_results" ADD CONSTRAINT "osint_results_monitor_id_osint_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "osint_monitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "osint_results" ADD CONSTRAINT "osint_results_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
