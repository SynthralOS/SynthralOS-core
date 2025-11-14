CREATE TABLE IF NOT EXISTS "proxy_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"proxy_id" text NOT NULL,
	"organization_id" text,
	"workspace_id" text,
	"user_id" text,
	"url" text NOT NULL,
	"status" text NOT NULL,
	"status_code" integer,
	"latency_ms" integer,
	"ban_reason" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proxy_pools" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"provider" text,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"username" text,
	"password" text,
	"country" text,
	"city" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_concurrent" integer DEFAULT 10,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "proxy_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"proxy_id" text NOT NULL,
	"organization_id" text,
	"score" integer NOT NULL,
	"success_rate" integer NOT NULL,
	"avg_latency_ms" integer,
	"ban_rate" integer NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"banned_requests" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"last_scored_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_proxy_id_idx" ON "proxy_logs" ("proxy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_organization_id_idx" ON "proxy_logs" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_workspace_id_idx" ON "proxy_logs" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_user_id_idx" ON "proxy_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_status_idx" ON "proxy_logs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_logs_created_at_idx" ON "proxy_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_pools_organization_id_idx" ON "proxy_pools" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_pools_type_idx" ON "proxy_pools" ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_pools_country_idx" ON "proxy_pools" ("country");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_pools_is_active_idx" ON "proxy_pools" ("is_active");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_pools_created_at_idx" ON "proxy_pools" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_scores_proxy_id_idx" ON "proxy_scores" ("proxy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_scores_organization_id_idx" ON "proxy_scores" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_scores_score_idx" ON "proxy_scores" ("score");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "proxy_scores_last_scored_at_idx" ON "proxy_scores" ("last_scored_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_logs" ADD CONSTRAINT "proxy_logs_proxy_id_proxy_pools_id_fk" FOREIGN KEY ("proxy_id") REFERENCES "proxy_pools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_logs" ADD CONSTRAINT "proxy_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_logs" ADD CONSTRAINT "proxy_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_logs" ADD CONSTRAINT "proxy_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_pools" ADD CONSTRAINT "proxy_pools_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_scores" ADD CONSTRAINT "proxy_scores_proxy_id_proxy_pools_id_fk" FOREIGN KEY ("proxy_id") REFERENCES "proxy_pools"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "proxy_scores" ADD CONSTRAINT "proxy_scores_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
