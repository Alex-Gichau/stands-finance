/**
 * Standalone Production-Grade Firestore to Supabase Migration Tool
 * Run command: npx tsx scripts/migrate-data.ts
 */
import { initializeApp as initFirebase, cert as firebaseCert } from "firebase-admin/app";
import { getFirestore as initFirestore } from "firebase-admin/firestore";
import pg from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables
dotenv.config({ override: true });

function logBox(title: string, colorCode: string = "\x1b[36m") {
  const line = "================================================================================";
  console.log(`\n${colorCode}${line}`);
  console.log(`📡 ECOSYSTEM MIGRATION: ${title.toUpperCase()}`);
  console.log(`${line}\x1b[0m`);
}

async function startMigration() {
  logBox("1. Pre-Flight Verification");

  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL;
  if (!dbUrl) {
    console.error("❌ ERROR: DATABASE_URL environmental variable is missing.");
    console.log("Please define your DATABASE_URL in your secrets configuration.");
    process.exit(1);
  }

  const serviceAccountPath = path.join(process.cwd(), "googleService.json");
  if (!fs.existsSync(serviceAccountPath)) {
    console.error(`❌ ERROR: Google Service Account file '${serviceAccountPath}' not found.`);
    console.log("Please ensure googleService.json is situated in your app root directory.");
    process.exit(1);
  }

  logBox("2. Connecting to Source and Destination Clusters");

  let firestoreDb: any;
  try {
    console.log("🔄 Reading Google service account key...");
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }

    console.log("🔄 Initializing Firebase Admin SDK client...");
    const firebaseApp = initFirebase({
      credential: firebaseCert(serviceAccount),
      projectId: "ai-studio-0adb409c-19ca-4d40-98cc-79864b9d3d75"
    }, "standalone-migration-" + Date.now());

    firestoreDb = initFirestore(firebaseApp);
    console.log("✅ Source Firestore SDK initialized successfully.");
  } catch (err: any) {
    console.error("❌ ERROR: Source cluster initialization failed.");
    console.error(err.message || String(err));
    process.exit(1);
  }

  let pgClient: pg.Client;
  try {
    console.log("🔄 Connecting to live Supabase Postgres database...");
    pgClient = new pg.Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
    });
    await pgClient.connect();
    console.log("✅ Destination cluster connection successfully authenticated.");
  } catch (err: any) {
    console.error("❌ ERROR: Destination PostgreSQL connection failed.");
    console.error(err.message || String(err));
    process.exit(1);
  }

  logBox("3. Migrating Database Collections", "\x1b[33m");

  // Helper to safely convert timestamps
  const parseTimestamp = (val: any) => {
    if (!val) return null;
    if (val.toDate && typeof val.toDate === "function") return val.toDate().toISOString();
    if (val._seconds !== undefined) return new Date(val._seconds * 1000).toISOString();
    const date = new Date(val);
    return isNaN(date.getTime()) ? null : date.toISOString();
  };

  // Helper to parse JSON values safely
  const parseJson = (val: any) => {
    if (val === undefined || val === null) return null;
    if (typeof val === "string") {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  };

  const collectionsToMigrate = [
    {
      name: "users",
      table: "users",
      query: `INSERT INTO users (
        id, name, email, role, "group", groups, approver_code, is_active, is_approved, is_suspended, 
        phone, department, photo_url, temp_password, is_online, last_seen, idle_timeout_duration, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role, "group" = EXCLUDED.group, 
        groups = EXCLUDED.groups, approver_code = EXCLUDED.approver_code, is_active = EXCLUDED.is_active, 
        is_approved = EXCLUDED.is_approved, is_suspended = EXCLUDED.is_suspended, phone = EXCLUDED.phone, 
        department = EXCLUDED.department, photo_url = EXCLUDED.photo_url, temp_password = EXCLUDED.temp_password, 
        is_online = EXCLUDED.is_online, last_seen = EXCLUDED.last_seen, idle_timeout_duration = EXCLUDED.idle_timeout_duration, 
        updated_at = NOW()`,
      map: (docId: string, d: any) => [
        docId,
        d.name || d.displayName || "Unknown User",
        d.email || "",
        d.role || "CHURCH_GROUP",
        d.group || null,
        JSON.stringify(parseJson(d.groups) || []),
        d.approverCode || d.approver_code || null,
        d.isActive !== undefined ? d.isActive : true,
        d.isApproved !== undefined ? d.isApproved : true,
        d.isSuspended !== undefined ? d.isSuspended : false,
        d.phone || null,
        d.department || null,
        d.photoURL || d.photoUrl || null,
        d.tempPassword || d.temp_password || null,
        d.isOnline !== undefined ? d.isOnline : false,
        parseTimestamp(d.lastSeen || d.last_seen),
        d.idleTimeoutDuration !== undefined ? d.idleTimeoutDuration : 15,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString(),
        parseTimestamp(d.updatedAt || d.updated_at) || new Date().toISOString()
      ]
    },
    {
      name: "projects",
      table: "projects",
      query: `INSERT INTO projects (
        id, name, group_id, allocated_budget, spent_amount, status, color, fiscal_year, requisition_limit, account_number, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name, group_id = EXCLUDED.group_id, allocated_budget = EXCLUDED.allocated_budget, 
        spent_amount = EXCLUDED.spent_amount, status = EXCLUDED.status, color = EXCLUDED.color, 
        fiscal_year = EXCLUDED.fiscal_year, requisition_limit = EXCLUDED.requisition_limit, account_number = EXCLUDED.account_number`,
      map: (docId: string, d: any) => [
        docId,
        d.name || "Unnamed Project",
        d.groupId || d.group_id || "default",
        Number(d.allocatedBudget || d.allocated_budget || 0),
        Number(d.spentAmount || d.spent_amount || 0),
        d.status || "ACTIVE",
        d.color || null,
        d.fiscalYear ? Number(d.fiscalYear) : null,
        d.requisitionLimit ? Number(d.requisitionLimit) : null,
        d.accountNumber || d.account_number || null,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString()
      ]
    },
    {
      name: "requisitions",
      table: "requisitions",
      query: `INSERT INTO requisitions (
        id, project_id, title, description, amount, amount_words, group_id, group_name, requester_id, requester_name, 
        requester_email, status, submitted_at, updated_at, expires_at, escalation_level, escalation_notifications_sent, 
        approved_at_l1, approved_at_l2, disbursed_at, rejection_reason, approval_history, digital_signature, payable_to, 
        recurrence, last_recurrence_generated_at, additional_info, attachments, receipts, flagged_for_audit, in_procurement, 
        requires_more_info, fiscal_year
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      ON CONFLICT (id) DO UPDATE SET
        project_id = EXCLUDED.project_id, title = EXCLUDED.title, description = EXCLUDED.description, amount = EXCLUDED.amount, 
        amount_words = EXCLUDED.amount_words, group_id = EXCLUDED.group_id, group_name = EXCLUDED.group_name, requester_id = EXCLUDED.requester_id, 
        requester_name = EXCLUDED.requester_name, requester_email = EXCLUDED.requester_email, status = EXCLUDED.status, 
        submitted_at = EXCLUDED.submitted_at, updated_at = EXCLUDED.updated_at, expires_at = EXCLUDED.expires_at, 
        escalation_level = EXCLUDED.escalation_level, escalation_notifications_sent = EXCLUDED.escalation_notifications_sent, 
        approved_at_l1 = EXCLUDED.approved_at_l1, approved_at_l2 = EXCLUDED.approved_at_l2, disbursed_at = EXCLUDED.disbursed_at, 
        rejection_reason = EXCLUDED.rejection_reason, approval_history = EXCLUDED.approval_history, digital_signature = EXCLUDED.digital_signature, 
        payable_to = EXCLUDED.payable_to, recurrence = EXCLUDED.recurrence, last_recurrence_generated_at = EXCLUDED.last_recurrence_generated_at, 
        additional_info = EXCLUDED.additional_info, attachments = EXCLUDED.attachments, receipts = EXCLUDED.receipts, 
        flagged_for_audit = EXCLUDED.flagged_for_audit, in_procurement = EXCLUDED.in_procurement, requires_more_info = EXCLUDED.requires_more_info, 
        fiscal_year = EXCLUDED.fiscal_year`,
      map: (docId: string, d: any) => [
        docId,
        d.projectId || d.project_id || null,
        d.title || "Unnamed Requisition",
        d.description || "",
        Number(d.amount || 0),
        d.amountWords || d.amount_words || null,
        d.groupId || d.group_id || "default",
        d.groupName || d.group_name || "Unknown Group",
        d.requesterId || d.requester_id || "default",
        d.requesterName || d.requester_name || "Unknown Requester",
        d.requesterEmail || d.requester_email || null,
        d.status || "DRAFT",
        parseTimestamp(d.submittedAt || d.submitted_at),
        parseTimestamp(d.updatedAt || d.updated_at) || new Date().toISOString(),
        parseTimestamp(d.expiresAt || d.expires_at),
        Number(d.escalationLevel || d.escalation_level || 0),
        d.escalationNotificationsSent || d.escalation_notifications_sent || false,
        parseTimestamp(d.approvedAtL1 || d.approved_at_l1),
        parseTimestamp(d.approvedAtL2 || d.approved_at_l2),
        parseTimestamp(d.disbursedAt || d.disbursed_at),
        d.rejectionReason || d.rejection_reason || null,
        JSON.stringify(parseJson(d.approvalHistory || d.approval_history) || []),
        d.digitalSignature || d.digital_signature || null,
        d.payableTo || d.payable_to || null,
        d.recurrence || "NONE",
        parseTimestamp(d.lastRecurrenceGeneratedAt || d.last_recurrence_generated_at),
        d.additionalInfo || d.additional_info || null,
        JSON.stringify(parseJson(d.attachments) || []),
        JSON.stringify(parseJson(d.receipts) || []),
        d.flaggedForAudit || d.flagged_for_audit || false,
        d.inProcurement || d.in_procurement || false,
        d.requiresMoreInfo || d.requires_more_info || false,
        d.fiscalYear ? Number(d.fiscalYear) : null
      ]
    },
    {
      name: "system_logs",
      table: "audit_logs",
      query: `INSERT INTO audit_logs (action, details, performed_by, timestamp, group_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)`,
      map: (docId: string, d: any) => [
        d.action || "LOG",
        d.details || "",
        d.performedBy || d.performed_by || "System",
        parseTimestamp(d.timestamp) || new Date().toISOString(),
        d.groupId || d.group_id || null,
        JSON.stringify(parseJson(d.metadata) || null)
      ]
    },
    {
      name: "alerts",
      table: "alerts",
      query: `INSERT INTO alerts (id, type, severity, message, timestamp, is_read, target_role) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, severity = EXCLUDED.severity, message = EXCLUDED.message, is_read = EXCLUDED.is_read`,
      map: (docId: string, d: any) => [
        docId,
        d.type || "INFO",
        d.severity || "LOW",
        d.message || "",
        parseTimestamp(d.timestamp) || new Date().toISOString(),
        d.isRead !== undefined ? d.isRead : false,
        d.targetRole || d.target_role || null
      ]
    },
    {
      name: "fiscal_years",
      table: "fiscal_years",
      query: `INSERT INTO fiscal_years (id, year, label, status, notes, created_at) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (id) DO UPDATE SET year = EXCLUDED.year, label = EXCLUDED.label, status = EXCLUDED.status, notes = EXCLUDED.notes`,
      map: (docId: string, d: any) => [
        docId,
        Number(d.year || 2026),
        d.label || String(d.year || 2026),
        d.status || "ACTIVE",
        d.notes || null,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString()
      ]
    },
    {
      name: "transactions",
      table: "transactions",
      query: `INSERT INTO transactions (id, external_ref, source_system, amount, type, status, description, category, timestamp, performed_by, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET external_ref = EXCLUDED.external_ref, source_system = EXCLUDED.source_system, amount = EXCLUDED.amount, type = EXCLUDED.type, status = EXCLUDED.status, description = EXCLUDED.description, category = EXCLUDED.category`,
      map: (docId: string, d: any) => [
        docId,
        d.externalRef || d.external_ref || null,
        d.sourceSystem || d.source_system || "SYSTEM",
        Number(d.amount || 0),
        d.type || "EXPENSE",
        d.status || "COMPLETED",
        d.description || "",
        d.category || "GENERAL",
        parseTimestamp(d.timestamp) || new Date().toISOString(),
        d.performedBy || d.performed_by || "System",
        JSON.stringify(parseJson(d.metadata) || null)
      ]
    },
    {
      name: "forecast",
      table: "forecast",
      query: `INSERT INTO forecast (month, projected, actual) VALUES ($1, $2, $3)
      ON CONFLICT (month) DO UPDATE SET projected = EXCLUDED.projected, actual = EXCLUDED.actual`,
      map: (docId: string, d: any) => [
        docId || d.month,
        Number(d.projected || 0),
        Number(d.actual || 0)
      ]
    },
    {
      name: "reports",
      table: "reports",
      query: `INSERT INTO reports (id, title, description, generated_by, generated_by_id, timestamp, period, stats, filters, item_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, stats = EXCLUDED.stats, filters = EXCLUDED.filters`,
      map: (docId: string, d: any) => [
        docId,
        d.title || "Report",
        d.description || "",
        d.generatedBy || d.generated_by || "System",
        d.generatedById || d.generated_by_id || "system",
        parseTimestamp(d.timestamp) || new Date().toISOString(),
        d.period || "MONTHLY",
        JSON.stringify(parseJson(d.stats) || {}),
        JSON.stringify(parseJson(d.filters) || {}),
        Number(d.itemCount || d.item_count || 0)
      ]
    },
    {
      name: "permissions",
      table: "permissions",
      query: `INSERT INTO permissions (id, role, access, actions) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, access = EXCLUDED.access, actions = EXCLUDED.actions`,
      map: (docId: string, d: any) => [
        docId,
        d.role || "CHURCH_GROUP",
        JSON.stringify(parseJson(d.access) || {}),
        JSON.stringify(parseJson(d.actions) || {})
      ]
    },
    {
      name: "thresholds",
      table: "thresholds",
      query: `INSERT INTO thresholds (id, type, threshold, is_enabled, notify_email) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (id) DO UPDATE SET type = EXCLUDED.type, threshold = EXCLUDED.threshold, is_enabled = EXCLUDED.is_enabled, notify_email = EXCLUDED.notify_email`,
      map: (docId: string, d: any) => [
        docId,
        d.type || "BUDGET_ALERT",
        Number(d.threshold || 0),
        d.isEnabled !== undefined ? d.isEnabled : true,
        d.notifyEmail !== undefined ? d.notifyEmail : false
      ]
    },
    {
      name: "church_groups",
      table: "church_groups",
      query: `INSERT INTO church_groups (id, name, description, created_at) VALUES ($1, $2, $3, $4)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description`,
      map: (docId: string, d: any) => [
        docId,
        d.name || "Group",
        d.description || null,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString()
      ]
    },
    {
      name: "ledger_books",
      table: "ledger_books",
      query: `INSERT INTO ledger_books (id, ministry_id, ministry_name, book_name, description, created_at, created_by, creator_name, budget_limit, spent_amount, notes, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (id) DO UPDATE SET ministry_id = EXCLUDED.ministry_id, ministry_name = EXCLUDED.ministry_name, book_name = EXCLUDED.book_name, budget_limit = EXCLUDED.budget_limit, spent_amount = EXCLUDED.spent_amount`,
      map: (docId: string, d: any) => [
        docId,
        d.ministryId || d.ministry_id || null,
        d.ministryName || d.ministry_name || "Unknown Ministry",
        d.bookName || d.book_name || null,
        d.description || null,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString(),
        d.createdBy || d.created_by || "system",
        d.creatorName || d.creator_name || null,
        Number(d.budgetLimit || d.budget_limit || 0),
        Number(d.spentAmount || d.spent_amount || 0),
        d.notes || null,
        d.status || "ACTIVE"
      ]
    },
    {
      name: "supplementary_budgets",
      table: "supplementary_budgets",
      query: `INSERT INTO supplementary_budgets (id, requester_id, requester_name, requester_email, role, project_id, project_name, amount, justification, submitted_at, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET requester_name = EXCLUDED.requester_name, requester_email = EXCLUDED.requester_email, amount = EXCLUDED.amount, status = EXCLUDED.status`,
      map: (docId: string, d: any) => [
        docId,
        d.requesterId || d.requester_id || "system",
        d.requesterName || d.requester_name || "Anonymous",
        d.requesterEmail || d.requester_email || "",
        d.role || "CHURCH_GROUP",
        d.projectId || d.project_id || "default",
        d.projectName || d.project_name || "Default Project",
        Number(d.amount || 0),
        d.justification || "",
        parseTimestamp(d.submittedAt || d.submitted_at) || new Date().toISOString(),
        d.status || "PENDING"
      ]
    },
    {
      name: "vendors",
      table: "vendors",
      query: `INSERT INTO vendors (id, name, contact, location, offerings, created_at, added_by, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, contact = EXCLUDED.contact, location = EXCLUDED.location, offerings = EXCLUDED.offerings, status = EXCLUDED.status`,
      map: (docId: string, d: any) => [
        docId,
        d.name || "Vendor",
        d.contact || null,
        d.location || null,
        d.offerings || null,
        parseTimestamp(d.createdAt || d.created_at) || new Date().toISOString(),
        d.addedBy || d.added_by || "system",
        d.status || "PENDING"
      ]
    }
  ];

  for (const item of collectionsToMigrate) {
    console.log(`\n🔄 Processing collection: ${item.name} ...`);
    try {
      const snapshot = await firestoreDb.collection(item.name).get();
      console.log(`📡 Fetched ${snapshot.size} records from Firestore collection '${item.name}'`);

      let successCount = 0;
      let errorCount = 0;

      for (const doc of snapshot.docs) {
        try {
          const params = item.map(doc.id, doc.data());
          await pgClient.query(item.query, params);
          successCount++;
        } catch (rowErr: any) {
          console.error(`  ❌ Failed row insert ID ${doc.id}:`, rowErr.message || String(rowErr));
          errorCount++;
        }
      }

      console.log(`✨ Status '${item.name}': Migrated ${successCount}/${snapshot.size} (Failed: ${errorCount})`);
    } catch (collErr: any) {
      console.warn(`  ⚠️ Skip collection '${item.name}':`, collErr.message);
    }
  }

  try {
    await pgClient.end();
  } catch (e) {}

  logBox("Ecosystem Replication Complete!", "\x1b[32m");
}

startMigration().catch(err => {
  console.error("❌ Migration failed with unhandled error:", err);
  process.exit(1);
});
