CREATE TABLE IF NOT EXISTS "agent_trace_history" (
	"id" text PRIMARY KEY NOT NULL,
	"agent_id" text NOT NULL,
	"flow_id" text,
	"trace_id" text NOT NULL,
	"input_context" jsonb,
	"execution_nodes" jsonb,
	"output_summary" jsonb,
	"error" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "event_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"workspace_id" text,
	"event_type" text NOT NULL,
	"context" jsonb,
	"status" text NOT NULL,
	"latency_ms" integer,
	"trace_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feature_flags" (
	"id" text PRIMARY KEY NOT NULL,
	"flag_name" text NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"user_id" text,
	"workspace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_cost_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"agent_id" text,
	"model_name" text NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"rate_per_1k" integer NOT NULL,
	"cost_usd" integer NOT NULL,
	"trace_id" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "prompt_similarity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"agent_id" text,
	"similarity_score" integer NOT NULL,
	"flagged_reference" text,
	"action_taken" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_trace_history_agent_id_idx" ON "agent_trace_history" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_trace_history_flow_id_idx" ON "agent_trace_history" ("flow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_trace_history_trace_id_idx" ON "agent_trace_history" ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_trace_history_timestamp_idx" ON "agent_trace_history" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_logs_user_id_idx" ON "event_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_logs_workspace_id_idx" ON "event_logs" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_logs_event_type_idx" ON "event_logs" ("event_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_logs_trace_id_idx" ON "event_logs" ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_logs_timestamp_idx" ON "event_logs" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_flags_flag_name_idx" ON "feature_flags" ("flag_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_flags_user_id_idx" ON "feature_flags" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feature_flags_workspace_id_idx" ON "feature_flags" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_cost_logs_user_id_idx" ON "model_cost_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_cost_logs_agent_id_idx" ON "model_cost_logs" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_cost_logs_model_name_idx" ON "model_cost_logs" ("model_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_cost_logs_trace_id_idx" ON "model_cost_logs" ("trace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "model_cost_logs_timestamp_idx" ON "model_cost_logs" ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_similarity_logs_user_id_idx" ON "prompt_similarity_logs" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_similarity_logs_agent_id_idx" ON "prompt_similarity_logs" ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "prompt_similarity_logs_timestamp_idx" ON "prompt_similarity_logs" ("timestamp");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "model_cost_logs" ADD CONSTRAINT "model_cost_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "prompt_similarity_logs" ADD CONSTRAINT "prompt_similarity_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
