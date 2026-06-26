import { pgTable, text, serial, integer, timestamp, boolean, doublePrecision, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// 1. Users Table (mapping to Users collection)
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Supabase Auth UID
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").notNull(), // UserRole enum stored as string
  group: text("group"),
  groups: jsonb("groups").default([]),
  approverCode: text("approver_code"),
  isActive: boolean("is_active").default(true).notNull(),
  isApproved: boolean("is_approved").default(true).notNull(),
  isSuspended: boolean("is_suspended").default(false).notNull(),
  phone: text("phone"),
  department: text("department"),
  photoURL: text("photo_url"),
  tempPassword: text("temp_password"),
  isOnline: boolean("is_online").default(false),
  lastSeen: timestamp("last_seen"),
  idleTimeoutDuration: integer("idle_timeout_duration").default(15),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 2. Projects Table (mapping to Projects collection)
export const projects = pgTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  groupId: text("group_id").notNull(),
  allocatedBudget: doublePrecision("allocated_budget").notNull(),
  spentAmount: doublePrecision("spent_amount").default(0).notNull(),
  status: text("status").default("ACTIVE").notNull(), // ACTIVE, ON_HOLD, COMPLETED, CLOSED
  color: text("color"),
  fiscalYear: integer("fiscal_year"),
  requisitionLimit: doublePrecision("requisition_limit"),
  accountNumber: text("account_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Requisitions Table (mapping to Requisitions collection)
export const requisitions = pgTable("requisitions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").references(() => projects.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  amount: doublePrecision("amount").notNull(),
  amountWords: text("amount_words"),
  groupId: text("group_id").notNull(),
  groupName: text("group_name").notNull(),
  requesterId: text("requester_id").references(() => users.id).notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email"),
  status: text("status").notNull(), // RequisitionStatus enum as string (DRAFT, SUBMITTED, APPROVED_L1, APPROVED_L2, ESCALATED, DISBURSED, REJECTED, CANCELLED)
  submittedAt: timestamp("submitted_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  escalationLevel: integer("escalation_level").default(0),
  escalationNotificationsSent: boolean("escalation_notifications_sent").default(false),
  approvedAtL1: timestamp("approved_at_l1"),
  approvedAtL2: timestamp("approved_at_l2"),
  disbursedAt: timestamp("disbursed_at"),
  rejectionReason: text("rejection_reason"),
  approvalHistory: jsonb("approval_history").default([]).notNull(), // List of ApprovalNote objects
  digitalSignature: text("digital_signature"),
  payableTo: text("payable_to"),
  recurrence: text("recurrence"), // RecurrenceType enum (NONE, MONTHLY, QUARTERLY)
  lastRecurrenceGeneratedAt: timestamp("last_recurrence_generated_at"),
  additionalInfo: text("additional_info"),
  attachments: jsonb("attachments").default([]),
  receipts: jsonb("receipts").default([]),
  flaggedForAudit: boolean("flagged_for_audit").default(false),
  inProcurement: boolean("in_procurement").default(false),
  requiresMoreInfo: boolean("requires_more_info").default(false),
  fiscalYear: integer("fiscal_year"),
});

// 4. AuditLogs Table (mapping to system_logs/AuditLogs collection)
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  details: text("details").notNull(),
  performedBy: text("performed_by").notNull(), // User identifier or name
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  groupId: text("group_id"),
  metadata: jsonb("metadata"),
});

// 5. Alerts Table (mapping to Alerts collection)
export const alerts = pgTable("alerts", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  targetRole: text("target_role"),
});

// 6. FiscalYears Table (mapping to FiscalYears collection)
export const fiscalYears = pgTable("fiscal_years", {
  id: text("id").primaryKey(),
  year: integer("year").notNull(),
  label: text("label").notNull(),
  status: text("status").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  notes: text("notes"),
});

// 7. Transactions Table (mapping to Transactions collection)
export const transactions = pgTable("transactions", {
  id: text("id").primaryKey(),
  externalRef: text("external_ref"),
  sourceSystem: text("source_system").notNull(),
  amount: doublePrecision("amount").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  performedBy: text("performed_by").notNull(),
  metadata: jsonb("metadata"),
});

// 8. Forecast Table (mapping to Forecast collection)
export const forecast = pgTable("forecast", {
  month: text("month").primaryKey(),
  projected: doublePrecision("projected").notNull(),
  actual: doublePrecision("actual").notNull(),
});

// 9. Reports Table (mapping to Reports collection)
export const reports = pgTable("reports", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  generatedBy: text("generated_by").notNull(),
  generatedById: text("generated_by_id").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  period: text("period").notNull(),
  stats: jsonb("stats").notNull(),
  filters: jsonb("filters").notNull(),
  itemCount: integer("item_count").notNull(),
});

// 10. Permissions Table (mapping to Permissions collection)
export const permissions = pgTable("permissions", {
  id: text("id").primaryKey(),
  role: text("role").notNull().unique(),
  access: jsonb("access").notNull(),
  actions: jsonb("actions").notNull(),
});

// 11. Thresholds Table (mapping to Thresholds collection)
export const thresholds = pgTable("thresholds", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  threshold: doublePrecision("threshold").notNull(),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  notifyEmail: boolean("notify_email").default(false).notNull(),
});

// 12. ChurchGroups Table (mapping to ChurchGroups collection)
export const churchGroups = pgTable("church_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 13. LedgerBooks Table (mapping to LedgerBooks collection)
export const ledgerBooks = pgTable("ledger_books", {
  id: text("id").primaryKey(),
  ministryId: text("ministry_id"),
  ministryName: text("ministry_name").notNull(),
  bookName: text("book_name"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: text("created_by").notNull(),
  creatorName: text("creator_name"),
  budgetLimit: doublePrecision("budget_limit").notNull(),
  spentAmount: doublePrecision("spent_amount").default(0).notNull(),
  notes: text("notes"),
  status: text("status").default("ACTIVE").notNull(),
});

// 14. SupplementaryBudgets Table (mapping to Supplementary Budgets collection)
export const supplementaryBudgets = pgTable("supplementary_budgets", {
  id: text("id").primaryKey(),
  requesterId: text("requester_id").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  role: text("role").notNull(),
  projectId: text("project_id").notNull(),
  projectName: text("project_name").notNull(),
  amount: doublePrecision("amount").notNull(),
  justification: text("justification").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  status: text("status").default("PENDING").notNull(),
});

// 15. Vendors Table (mapping to Vendors collection)
export const vendors = pgTable("vendors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  contact: text("contact"),
  location: text("location"),
  offerings: text("offerings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  addedBy: text("added_by").notNull(),
  status: text("status").default("PENDING").notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  requisitions: many(requisitions),
}));

export const requisitionsRelations = relations(requisitions, ({ one }) => ({
  requester: one(users, {
    fields: [requisitions.requesterId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [requisitions.projectId],
    references: [projects.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  requisitions: many(requisitions),
}));
