CREATE TABLE IF NOT EXISTS "code_agent_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"code_agent_id" text NOT NULL,
	"version" text NOT NULL,
	"code" text NOT NULL,
	"code_storage_path" text,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"changelog" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"version" text DEFAULT '1.0.0' NOT NULL,
	"language" text NOT NULL,
	"code" text NOT NULL,
	"code_storage_path" text,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"runtime" text DEFAULT 'vm2' NOT NULL,
	"packages" jsonb,
	"environment" jsonb,
	"organization_id" text,
	"workspace_id" text,
	"user_id" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"deprecated" boolean DEFAULT false NOT NULL,
	"changelog" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_exec_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"code_agent_id" text,
	"workflow_execution_id" text,
	"node_id" text,
	"runtime" text NOT NULL,
	"language" text NOT NULL,
	"duration_ms" integer,
	"memory_mb" integer,
	"exit_code" integer,
	"success" boolean NOT NULL,
	"error_message" text,
	"tokens_used" integer,
	"validation_passed" boolean,
	"organization_id" text,
	"workspace_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "code_schemas" (
	"id" text PRIMARY KEY NOT NULL,
	"code_id" text NOT NULL,
	"code_type" text NOT NULL,
	"input_schema" jsonb,
	"output_schema" jsonb,
	"validation_type" text NOT NULL,
	"organization_id" text,
	"workspace_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agent_versions_code_agent_id_idx" ON "code_agent_versions" ("code_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agent_versions_version_idx" ON "code_agent_versions" ("version");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agent_versions_created_at_idx" ON "code_agent_versions" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_organization_id_idx" ON "code_agents" ("organization_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_workspace_id_idx" ON "code_agents" ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_user_id_idx" ON "code_agents" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_name_idx" ON "code_agents" ("name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_language_idx" ON "code_agents" ("language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_is_public_idx" ON "code_agents" ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_deprecated_idx" ON "code_agents" ("deprecated");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_agents_created_at_idx" ON "code_agents" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_code_agent_id_idx" ON "code_exec_logs" ("code_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_workflow_execution_id_idx" ON "code_exec_logs" ("workflow_execution_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_runtime_idx" ON "code_exec_logs" ("runtime");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_language_idx" ON "code_exec_logs" ("language");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_success_idx" ON "code_exec_logs" ("success");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_exec_logs_created_at_idx" ON "code_exec_logs" ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_schemas_code_id_idx" ON "code_schemas" ("code_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_schemas_code_type_idx" ON "code_schemas" ("code_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_schemas_validation_type_idx" ON "code_schemas" ("validation_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "code_schemas_created_at_idx" ON "code_schemas" ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_agent_versions" ADD CONSTRAINT "code_agent_versions_code_agent_id_code_agents_id_fk" FOREIGN KEY ("code_agent_id") REFERENCES "code_agents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_agents" ADD CONSTRAINT "code_agents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_agents" ADD CONSTRAINT "code_agents_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_agents" ADD CONSTRAINT "code_agents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_exec_logs" ADD CONSTRAINT "code_exec_logs_code_agent_id_code_agents_id_fk" FOREIGN KEY ("code_agent_id") REFERENCES "code_agents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_exec_logs" ADD CONSTRAINT "code_exec_logs_workflow_execution_id_workflow_executions_id_fk" FOREIGN KEY ("workflow_execution_id") REFERENCES "workflow_executions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_exec_logs" ADD CONSTRAINT "code_exec_logs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_exec_logs" ADD CONSTRAINT "code_exec_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_exec_logs" ADD CONSTRAINT "code_exec_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_schemas" ADD CONSTRAINT "code_schemas_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "code_schemas" ADD CONSTRAINT "code_schemas_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
