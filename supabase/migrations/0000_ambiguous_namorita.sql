CREATE TABLE "alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"target_role" text
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"details" text NOT NULL,
	"performed_by" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"group_id" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "church_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" text PRIMARY KEY NOT NULL,
	"year" integer NOT NULL,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "forecast" (
	"month" text PRIMARY KEY NOT NULL,
	"projected" double precision NOT NULL,
	"actual" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_books" (
	"id" text PRIMARY KEY NOT NULL,
	"ministry_id" text,
	"ministry_name" text NOT NULL,
	"book_name" text,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text NOT NULL,
	"creator_name" text,
	"budget_limit" double precision NOT NULL,
	"spent_amount" double precision DEFAULT 0 NOT NULL,
	"notes" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"access" jsonb NOT NULL,
	"actions" jsonb NOT NULL,
	CONSTRAINT "permissions_role_unique" UNIQUE("role")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_id" text NOT NULL,
	"allocated_budget" double precision NOT NULL,
	"spent_amount" double precision DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"color" text,
	"fiscal_year" integer,
	"requisition_limit" double precision,
	"account_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"generated_by" text NOT NULL,
	"generated_by_id" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"period" text NOT NULL,
	"stats" jsonb NOT NULL,
	"filters" jsonb NOT NULL,
	"item_count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requisitions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"amount" double precision NOT NULL,
	"amount_words" text,
	"group_id" text NOT NULL,
	"group_name" text NOT NULL,
	"requester_id" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text,
	"status" text NOT NULL,
	"submitted_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"escalation_level" integer DEFAULT 0,
	"escalation_notifications_sent" boolean DEFAULT false,
	"approved_at_l1" timestamp,
	"approved_at_l2" timestamp,
	"disbursed_at" timestamp,
	"rejection_reason" text,
	"approval_history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"digital_signature" text,
	"payable_to" text,
	"recurrence" text,
	"last_recurrence_generated_at" timestamp,
	"additional_info" text,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"receipts" jsonb DEFAULT '[]'::jsonb,
	"flagged_for_audit" boolean DEFAULT false,
	"in_procurement" boolean DEFAULT false,
	"requires_more_info" boolean DEFAULT false,
	"fiscal_year" integer
);
--> statement-breakpoint
CREATE TABLE "supplementary_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_id" text NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"role" text NOT NULL,
	"project_id" text NOT NULL,
	"project_name" text NOT NULL,
	"amount" double precision NOT NULL,
	"justification" text NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"threshold" double precision NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"notify_email" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"external_ref" text,
	"source_system" text NOT NULL,
	"amount" double precision NOT NULL,
	"type" text NOT NULL,
	"status" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"performed_by" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"group" text,
	"groups" jsonb DEFAULT '[]'::jsonb,
	"approver_code" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"is_suspended" boolean DEFAULT false NOT NULL,
	"phone" text,
	"department" text,
	"photo_url" text,
	"temp_password" text,
	"is_online" boolean DEFAULT false,
	"last_seen" timestamp,
	"idle_timeout_duration" integer DEFAULT 15,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"location" text,
	"offerings" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"added_by" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requisitions" ADD CONSTRAINT "requisitions_requester_id_users_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;