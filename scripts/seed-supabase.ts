import pg from "pg";
import { v4 as uuidv4 } from "uuid";

const dbUrl = "postgresql://postgres:Alexx%40admin.47@db.wjftrnergydgosatyuzo.supabase.co:5432/postgres";

async function seedDatabase() {
  console.log("🚀 Starting Production-Grade Database Seeding...");
  console.log("Connecting to PostgreSQL...");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("🟢 Connected to PostgreSQL successfully!");

    // Clean any existing empty constraints or items
    console.log("🧹 Cleaning existing data from target tables...");
    const tablesToClean = [
      "alerts", "audit_logs", "church_groups", "fiscal_years", "forecast",
      "ledger_books", "permissions", "projects", "reports", "requisitions",
      "supplementary_budgets", "thresholds", "transactions", "users", "vendors"
    ];
    for (const table of tablesToClean) {
      await client.query(`TRUNCATE TABLE "${table}" CASCADE`);
    }
    console.log("✅ All tables cleaned successfully.");

    // --- 1. SEED USERS ---
    console.log("👤 Seeding Users...");
    const users = [
      {
        id: "18a080c1-a016-5975-9735-ef5887edb906", // Matches ict.team@pceastandrews.com in supabase_migration.sql
        name: "PCEA St Andrew's ICT",
        email: "ict.team@pceastandrews.com",
        role: "SUPER_ADMIN",
        group: "ICT Department",
        groups: JSON.stringify(["ICT", "Administration"]),
        approver_code: "APP-ICT-01",
        is_active: true,
        is_approved: true,
        is_suspended: false,
        phone: "+254712345678",
        department: "ICT & Communications",
        photo_url: "https://lh3.googleusercontent.com/a/ACg8ocKyA8PimXbL-YRHVjiWJtbxozszJXAFv0EUbIj9s6fDRw1jgw=s96-c",
        temp_password: null,
        is_online: true,
        last_seen: new Date().toISOString(),
        idle_timeout_duration: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "user-approver-l1",
        name: "Elder Gichau Mburu",
        email: "gichaumburu@gmail.com",
        role: "ADMIN",
        group: "Kirk Session",
        groups: JSON.stringify(["Kirk Session", "Finance Committee"]),
        approver_code: "APP-L1-GM",
        is_active: true,
        is_approved: true,
        is_suspended: false,
        phone: "+254722334455",
        department: "Session Elder",
        photo_url: null,
        temp_password: null,
        is_online: false,
        last_seen: new Date().toISOString(),
        idle_timeout_duration: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "user-approver-l2",
        name: "Rev. Dr. George Kahuho",
        email: "pastor.kahuho@pceastandrews.com",
        role: "SUPER_ADMIN",
        group: "Kirk Session",
        groups: JSON.stringify(["Pastoral Team", "Session"]),
        approver_code: "APP-L2-GK",
        is_active: true,
        is_approved: true,
        is_suspended: false,
        phone: "+254733445566",
        department: "Pastoral",
        photo_url: null,
        temp_password: null,
        is_online: false,
        last_seen: new Date().toISOString(),
        idle_timeout_duration: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "user-finance",
        name: "Sarah Wanjiku",
        email: "finance@pceastandrews.com",
        role: "FINANCE",
        group: "Finance Department",
        groups: JSON.stringify(["Finance Committee"]),
        approver_code: "APP-FIN-01",
        is_active: true,
        is_approved: true,
        is_suspended: false,
        phone: "+254744556677",
        department: "Finance & Accounts",
        photo_url: null,
        temp_password: null,
        is_online: false,
        last_seen: new Date().toISOString(),
        idle_timeout_duration: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: "user-youth-leader",
        name: "James Mwangi",
        email: "youth.leader@pceastandrews.com",
        role: "CHURCH_GROUP",
        group: "Youth Fellowship",
        groups: JSON.stringify(["Youth Fellowship"]),
        approver_code: null,
        is_active: true,
        is_approved: true,
        is_suspended: false,
        phone: "+254755667788",
        department: "Youth Ministry",
        photo_url: null,
        temp_password: null,
        is_online: true,
        last_seen: new Date().toISOString(),
        idle_timeout_duration: 15,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    for (const u of users) {
      await client.query(`
        INSERT INTO users (
          id, name, email, role, "group", groups, approver_code, is_active, is_approved, is_suspended, 
          phone, department, photo_url, temp_password, is_online, last_seen, idle_timeout_duration, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        u.id, u.name, u.email, u.role, u.group, u.groups, u.approver_code, u.is_active, u.is_approved, u.is_suspended,
        u.phone, u.department, u.photo_url, u.temp_password, u.is_online, u.last_seen, u.idle_timeout_duration, u.created_at, u.updated_at
      ]);
    }
    console.log(`- Inserted ${users.length} Users.`);

    // --- 2. SEED FISCAL YEARS ---
    console.log("📅 Seeding Fiscal Years...");
    const fiscalYears = [
      { id: "fy-2026", year: 2026, label: "FY 2026/2027", status: "OPEN", notes: "Current active financial cycle", created_at: new Date().toISOString() },
      { id: "fy-2025", year: 2025, label: "FY 2025/2026", status: "CLOSED", notes: "Previous completed financial cycle", created_at: new Date(Date.now() - 365*24*60*60*1000).toISOString() }
    ];
    for (const fy of fiscalYears) {
      await client.query(`
        INSERT INTO fiscal_years (id, year, label, status, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [fy.id, fy.year, fy.label, fy.status, fy.notes, fy.created_at]);
    }
    console.log(`- Inserted ${fiscalYears.length} Fiscal Years.`);

    // --- 3. SEED CHURCH GROUPS ---
    console.log("⛪ Seeding Church Groups...");
    const groups = [
      { id: "grp-youth", name: "Youth Fellowship", description: "Young adult ministry activities and outreach" },
      { id: "grp-choir", name: "PCEA St Andrew's Choir", description: "Main sanctuary choir performances, instruments, and music sheets" },
      { id: "grp-womens", name: "Women's Guild", description: "Women's ministry activities, charity work, and fellowship seminars" },
      { id: "grp-mens", name: "Men's Fellowship (PCMF)", description: "Men's mentorship, training sessions, and developmental projects" },
      { id: "grp-sundayschool", name: "Sunday School Ministry", description: "Children's Bible curriculum materials, toys, and snacks" },
      { id: "grp-ict", name: "ICT Department", description: "Website maintenance, sanctuary audio-visual equipments, and software licensing" }
    ];
    for (const g of groups) {
      await client.query(`
        INSERT INTO church_groups (id, name, description, created_at)
        VALUES ($1, $2, $3, $4)
      `, [g.id, g.name, g.description, new Date().toISOString()]);
    }
    console.log(`- Inserted ${groups.length} Church Groups.`);

    // --- 4. SEED PROJECTS (BUDGETS) ---
    console.log("📁 Seeding Projects & Budgets...");
    const projects = [
      { id: "proj-youth-camp", name: "Annual Youth Fellowship Camp", group_id: "grp-youth", allocated_budget: 350000, spent_amount: 120000, status: "ACTIVE", color: "#3B82F6", fiscal_year: 2026, requisition_limit: 50000, account_number: "ACC-YTH-201" },
      { id: "proj-choir-uniform", name: "Choir Robes & Sound Instruments", group_id: "grp-choir", allocated_budget: 500000, spent_amount: 320000, status: "ACTIVE", color: "#10B981", fiscal_year: 2026, requisition_limit: 80000, account_number: "ACC-CHR-302" },
      { id: "proj-womens-guild-seminar", name: "Women's Leadership Summit 2026", group_id: "grp-womens", allocated_budget: 250000, spent_amount: 50000, status: "ACTIVE", color: "#EC4899", fiscal_year: 2026, requisition_limit: 40000, account_number: "ACC-WML-104" },
      { id: "proj-pcmf-mentorship", name: "Boy-Child Mentorship Outreach", group_id: "grp-mens", allocated_budget: 300000, spent_amount: 150000, status: "ACTIVE", color: "#F59E0B", fiscal_year: 2026, requisition_limit: 50000, account_number: "ACC-MEN-508" },
      { id: "proj-sunday-school-vacation", name: "Vacation Bible School (VBS)", group_id: "grp-sundayschool", allocated_budget: 200000, spent_amount: 85000, status: "ACTIVE", color: "#8B5CF6", fiscal_year: 2026, requisition_limit: 30000, account_number: "ACC-SUN-441" },
      { id: "proj-ict-sanctuary-streaming", name: "Sanctuary AV Streaming Upgrade", group_id: "grp-ict", allocated_budget: 1200000, spent_amount: 980000, status: "ACTIVE", color: "#6366F1", fiscal_year: 2026, requisition_limit: 200000, account_number: "ACC-ICT-901" }
    ];
    for (const p of projects) {
      await client.query(`
        INSERT INTO projects (
          id, name, group_id, allocated_budget, spent_amount, status, color, fiscal_year, requisition_limit, account_number, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        p.id, p.name, p.group_id, p.allocated_budget, p.spent_amount, p.status, p.color, p.fiscal_year, p.requisition_limit, p.account_number, new Date().toISOString()
      ]);
    }
    console.log(`- Inserted ${projects.length} Projects.`);

    // --- 5. SEED REQUISITIONS ---
    console.log("📝 Seeding Requisitions...");
    const requisitions = [
      {
        id: "req-01",
        project_id: "proj-youth-camp",
        title: "Downpayment for camp grounds booking",
        description: "Initial booking commitment fee deposit for the campsite facility in Naivasha for the annual youth convention.",
        amount: 45000,
        amount_words: "Forty-Five Thousand Shillings Only",
        group_id: "grp-youth",
        group_name: "Youth Fellowship",
        requester_id: "user-youth-leader",
        requester_name: "James Mwangi",
        requester_email: "youth.leader@pceastandrews.com",
        status: "DISBURSED",
        submitted_at: new Date(Date.now() - 15*24*60*60*1000).toISOString(),
        updated_at: new Date(Date.now() - 10*24*60*60*1000).toISOString(),
        expires_at: null,
        escalation_level: 0,
        escalation_notifications_sent: false,
        approved_at_l1: new Date(Date.now() - 14*24*60*60*1000).toISOString(),
        approved_at_l2: new Date(Date.now() - 12*24*60*60*1000).toISOString(),
        disbursed_at: new Date(Date.now() - 10*24*60*60*1000).toISOString(),
        rejection_reason: null,
        approval_history: JSON.stringify([
          { actor: "Elder Gichau Mburu", action: "APPROVED", role: "ADMIN", timestamp: new Date(Date.now() - 14*24*60*60*1000).toISOString() },
          { actor: "Rev. Dr. George Kahuho", action: "APPROVED", role: "SUPER_ADMIN", timestamp: new Date(Date.now() - 12*24*60*60*1000).toISOString() },
          { actor: "Sarah Wanjiku", action: "DISBURSED", role: "FINANCE", timestamp: new Date(Date.now() - 10*24*60*60*1000).toISOString() }
        ]),
        digital_signature: "SIG-JM-10294",
        payable_to: "Naivasha Great Rift Resort",
        recurrence: "NONE",
        last_recurrence_generated_at: null,
        additional_info: "Attached receipt of confirmation from resort manager",
        attachments: JSON.stringify([{ name: "Quotation_Booking.pdf", url: "https://example.com/quotation.pdf" }]),
        receipts: JSON.stringify([{ name: "Receipt_Naivasha.pdf", url: "https://example.com/receipt.pdf" }]),
        flagged_for_audit: false,
        in_procurement: false,
        requires_more_info: false,
        fiscal_year: 2026
      },
      {
        id: "req-02",
        project_id: "proj-choir-uniform",
        title: "Purchase of 30 Choir Custom Satin Robes",
        description: "Sewing material acquisition and labor payment for the premium gold-accented sanctuary choir uniforms.",
        amount: 75000,
        amount_words: "Seventy-Five Thousand Shillings Only",
        group_id: "grp-choir",
        group_name: "PCEA St Andrew's Choir",
        requester_id: "18a080c1-a016-5975-9735-ef5887edb906",
        requester_name: "PCEA St Andrew's ICT",
        requester_email: "ict.team@pceastandrews.com",
        status: "APPROVED_L1",
        submitted_at: new Date(Date.now() - 3*24*60*60*1000).toISOString(),
        updated_at: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
        expires_at: null,
        escalation_level: 0,
        escalation_notifications_sent: false,
        approved_at_l1: new Date(Date.now() - 2*24*60*60*1000).toISOString(),
        approved_at_l2: null,
        disbursed_at: null,
        rejection_reason: null,
        approval_history: JSON.stringify([
          { actor: "Elder Gichau Mburu", action: "APPROVED", role: "ADMIN", timestamp: new Date(Date.now() - 2*24*60*60*1000).toISOString() }
        ]),
        digital_signature: "SIG-ICT-9018",
        payable_to: "Royal Outfitters Kenya",
        recurrence: "NONE",
        last_recurrence_generated_at: null,
        additional_info: "Sizing details for choir members are fully finalized",
        attachments: JSON.stringify([{ name: "Robes_Quotation_Royal.pdf", url: "https://example.com/robes_quote.pdf" }]),
        receipts: JSON.stringify([]),
        flagged_for_audit: false,
        in_procurement: false,
        requires_more_info: false,
        fiscal_year: 2026
      },
      {
        id: "req-03",
        project_id: "proj-ict-sanctuary-streaming",
        title: "Sennheiser Wireless Vocal Mic Set",
        description: "Requesting purchase of high-fidelity Sennheiser microphone systems to eradicate voice dropping during preaching.",
        amount: 145000,
        amount_words: "One Hundred and Forty-Five Thousand Shillings Only",
        group_id: "grp-ict",
        group_name: "ICT Department",
        requester_id: "18a080c1-a016-5975-9735-ef5887edb906",
        requester_name: "PCEA St Andrew's ICT",
        requester_email: "ict.team@pceastandrews.com",
        status: "SUBMITTED",
        submitted_at: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
        updated_at: new Date(Date.now() - 1*24*60*60*1000).toISOString(),
        expires_at: null,
        escalation_level: 0,
        escalation_notifications_sent: false,
        approved_at_l1: null,
        approved_at_l2: null,
        disbursed_at: null,
        rejection_reason: null,
        approval_history: JSON.stringify([]),
        digital_signature: "SIG-ICT-8843",
        payable_to: "SoundMasters Ltd",
        recurrence: "NONE",
        last_recurrence_generated_at: null,
        additional_info: "Crucial for upcoming Kirk Session Ordination ceremony.",
        attachments: JSON.stringify([{ name: "Mic_Quotation_SoundMasters.pdf", url: "https://example.com/mic_quote.pdf" }]),
        receipts: JSON.stringify([]),
        flagged_for_audit: false,
        in_procurement: true,
        requires_more_info: false,
        fiscal_year: 2026
      },
      {
        id: "req-04",
        project_id: "proj-sunday-school-vacation",
        title: "Snacks, Juices and Workbooks for Children",
        description: "Procuring lunch bundles, colored books, stickers, and refreshments for 120 children attending VBS holidays.",
        amount: 35000,
        amount_words: "Thirty-Five Thousand Shillings Only",
        group_id: "grp-sundayschool",
        group_name: "Sunday School Ministry",
        requester_id: "user-youth-leader",
        requester_name: "James Mwangi",
        requester_email: "youth.leader@pceastandrews.com",
        status: "REJECTED",
        submitted_at: new Date(Date.now() - 10*24*60*60*1000).toISOString(),
        updated_at: new Date(Date.now() - 8*24*60*60*1000).toISOString(),
        expires_at: null,
        escalation_level: 0,
        escalation_notifications_sent: false,
        approved_at_l1: null,
        approved_at_l2: null,
        disbursed_at: null,
        rejection_reason: "Please request itemized quotation. Single general invoice cannot be processed by church auditors.",
        approval_history: JSON.stringify([
          { actor: "Elder Gichau Mburu", action: "REJECTED", role: "ADMIN", timestamp: new Date(Date.now() - 8*24*60*60*1000).toISOString() }
        ]),
        digital_signature: "SIG-JM-10113",
        payable_to: "Naivas Supermarket",
        recurrence: "NONE",
        last_recurrence_generated_at: null,
        additional_info: "Bulk pricing discount applies.",
        attachments: JSON.stringify([{ name: "Naivas_Single_Invoice.pdf", url: "https://example.com/invoice.pdf" }]),
        receipts: JSON.stringify([]),
        flagged_for_audit: false,
        in_procurement: false,
        requires_more_info: false,
        fiscal_year: 2026
      }
    ];

    for (const r of requisitions) {
      await client.query(`
        INSERT INTO requisitions (
          id, project_id, title, description, amount, amount_words, group_id, group_name, requester_id, requester_name, 
          requester_email, status, submitted_at, updated_at, expires_at, escalation_level, escalation_notifications_sent, 
          approved_at_l1, approved_at_l2, disbursed_at, rejection_reason, approval_history, digital_signature, payable_to, 
          recurrence, last_recurrence_generated_at, additional_info, attachments, receipts, flagged_for_audit, in_procurement, 
          requires_more_info, fiscal_year
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
      `, [
        r.id, r.project_id, r.title, r.description, r.amount, r.amount_words, r.group_id, r.group_name, r.requester_id, r.requester_name,
        r.requester_email, r.status, r.submitted_at, r.updated_at, r.expires_at, r.escalation_level, r.escalation_notifications_sent,
        r.approved_at_l1, r.approved_at_l2, r.disbursed_at, r.rejection_reason, r.approval_history, r.digital_signature, r.payable_to,
        r.recurrence, r.last_recurrence_generated_at, r.additional_info, r.attachments, r.receipts, r.flagged_for_audit, r.in_procurement,
        r.requires_more_info, r.fiscal_year
      ]);
    }
    console.log(`- Inserted ${requisitions.length} Requisitions.`);

    // --- 6. SEED AUDIT LOGS ---
    console.log("🪵 Seeding Audit Logs...");
    const auditLogs = [
      { action: "USER_LOGIN", details: "👤 User ict.team@pceastandrews.com logged in successfully via Google OAuth.", performed_by: "ict.team@pceastandrews.com", group_id: "grp-ict", metadata: JSON.stringify({ ip: "127.0.0.1", browser: "Chrome" }) },
      { action: "REQUISITION_CREATE", details: "📝 Requisition req-01 created and submitted by James Mwangi.", performed_by: "youth.leader@pceastandrews.com", group_id: "grp-youth", metadata: JSON.stringify({ reqId: "req-01", amount: 45000 }) },
      { action: "REQUISITION_APPROVE_L1", details: "✅ Requisition req-01 approved at L1 by Elder Gichau Mburu.", performed_by: "gichaumburu@gmail.com", group_id: "grp-youth", metadata: JSON.stringify({ reqId: "req-01" }) },
      { action: "BUDGET_ALLOCATION", details: "💰 Budget allocated for Sanctuary AV Streaming Upgrade project: KES 1,200,000.", performed_by: "finance@pceastandrews.com", group_id: "grp-ict", metadata: JSON.stringify({ project: "proj-ict-sanctuary-streaming", allocation: 1200000 }) }
    ];
    for (const log of auditLogs) {
      await client.query(`
        INSERT INTO audit_logs (action, details, performed_by, timestamp, group_id, metadata)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [log.action, log.details, log.performed_by, new Date().toISOString(), log.group_id, log.metadata]);
    }
    console.log(`- Inserted ${auditLogs.length} Audit Logs.`);

    // --- 7. SEED ALERTS ---
    console.log("🚨 Seeding Alerts...");
    const alerts = [
      { id: "alert-01", type: "BUDGET_WARNING", severity: "HIGH", message: "Sanctuary AV Streaming Upgrade has spent 81.6% of its allocated annual budget limit.", timestamp: new Date().toISOString(), is_read: false, target_role: "ADMIN" },
      { id: "alert-02", type: "REQUISITION_SUBMISSION", severity: "MEDIUM", message: "James Mwangi submitted a new requisition for Sennheiser Vocal Mic Set.", timestamp: new Date().toISOString(), is_read: false, target_role: "ADMIN" }
    ];
    for (const a of alerts) {
      await client.query(`
        INSERT INTO alerts (id, type, severity, message, timestamp, is_read, target_role)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [a.id, a.type, a.severity, a.message, a.timestamp, a.is_read, a.target_role]);
    }
    console.log(`- Inserted ${alerts.length} Alerts.`);

    // --- 8. SEED TRANSACTIONS ---
    console.log("💳 Seeding Transactions...");
    const transactions = [
      { id: "trans-01", external_ref: "MPESA-QDX928KJ32", source_system: "MPESA_C2B", amount: 45000, type: "EXPENSE", status: "COMPLETED", description: "Disbursal for booking camp grounds", category: "YOUTH", timestamp: new Date(Date.now() - 10*24*60*60*1000).toISOString(), performed_by: "Sarah Wanjiku", metadata: JSON.stringify({ reqId: "req-01" }) },
      { id: "trans-02", external_ref: "BANK-EFT-102948", source_system: "EQUITY_EFT", amount: 980000, type: "EXPENSE", status: "COMPLETED", description: "Payment for Sony sanctuary professional streaming cameras", category: "ICT", timestamp: new Date(Date.now() - 20*24*60*60*1000).toISOString(), performed_by: "Sarah Wanjiku", metadata: JSON.stringify({ projId: "proj-ict-sanctuary-streaming" }) }
    ];
    for (const t of transactions) {
      await client.query(`
        INSERT INTO transactions (id, external_ref, source_system, amount, type, status, description, category, timestamp, performed_by, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [t.id, t.external_ref, t.source_system, t.amount, t.type, t.status, t.description, t.category, t.timestamp, t.performed_by, t.metadata]);
    }
    console.log(`- Inserted ${transactions.length} Transactions.`);

    // --- 9. SEED FORECAST ---
    console.log("📈 Seeding Forecast...");
    const forecasts = [
      { month: "Jan", projected: 400000, actual: 380000 },
      { month: "Feb", projected: 450000, actual: 420000 },
      { month: "Mar", projected: 500000, actual: 490000 },
      { month: "Apr", projected: 600000, actual: 550000 },
      { month: "May", projected: 550000, actual: 0 },
      { month: "Jun", projected: 700000, actual: 0 }
    ];
    for (const f of forecasts) {
      await client.query(`
        INSERT INTO forecast (month, projected, actual)
        VALUES ($1, $2, $3)
      `, [f.month, f.projected, f.actual]);
    }
    console.log(`- Inserted ${forecasts.length} Forecast periods.`);

    // --- 10. SEED REPORTS ---
    console.log("📊 Seeding Reports...");
    const reports = [
      {
        id: "rep-01",
        title: "Q1 Financial Requisitions Audit Report",
        description: "Aggregated disbursement list and project budget consumption analytics for Kirk Session audit.",
        generated_by: "Sarah Wanjiku",
        generated_by_id: "user-finance",
        timestamp: new Date().toISOString(),
        period: "QUARTERLY",
        stats: JSON.stringify({ totalSpent: 1100000, activeBudgets: 2800000, complianceRate: "98.5%" }),
        filters: JSON.stringify({ fiscalYear: 2026, status: "DISBURSED" }),
        item_count: 24
      }
    ];
    for (const r of reports) {
      await client.query(`
        INSERT INTO reports (id, title, description, generated_by, generated_by_id, timestamp, period, stats, filters, item_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [r.id, r.title, r.description, r.generated_by, r.generated_by_id, r.timestamp, r.period, r.stats, r.filters, r.item_count]);
    }
    console.log(`- Inserted ${reports.length} Reports.`);

    // --- 11. SEED PERMISSIONS ---
    console.log("🔑 Seeding Permissions...");
    const permissions = [
      {
        id: "perm-admin",
        role: "ADMIN",
        access: JSON.stringify({ viewDashboard: true, manageBudgets: true, approveL1: true, approveL2: false, configureSettings: true }),
        actions: JSON.stringify(["APPROVE_L1", "REJECT", "ADD_PROJECT", "CREATE_ALERT"])
      },
      {
        id: "perm-super-admin",
        role: "SUPER_ADMIN",
        access: JSON.stringify({ viewDashboard: true, manageBudgets: true, approveL1: true, approveL2: true, configureSettings: true, manageUsers: true }),
        actions: JSON.stringify(["APPROVE_L1", "APPROVE_L2", "REJECT", "DISBURSE", "ADD_PROJECT", "CREATE_ALERT", "MANAGE_USERS"])
      },
      {
        id: "perm-church-group",
        role: "CHURCH_GROUP",
        access: JSON.stringify({ viewDashboard: true, manageBudgets: false, approveL1: false, approveL2: false, configureSettings: false }),
        actions: JSON.stringify(["CREATE_REQUISITION", "EDIT_REQUISITION", "CANCEL_REQUISITION"])
      },
      {
        id: "perm-finance",
        role: "FINANCE",
        access: JSON.stringify({ viewDashboard: true, manageBudgets: true, approveL1: false, approveL2: false, configureSettings: false, viewLedger: true }),
        actions: JSON.stringify(["DISBURSE", "PRINT_CHECK", "EXPORT_REPORT"])
      }
    ];
    for (const p of permissions) {
      await client.query(`
        INSERT INTO permissions (id, role, access, actions)
        VALUES ($1, $2, $3, $4)
      `, [p.id, p.role, p.access, p.actions]);
    }
    console.log(`- Inserted ${permissions.length} Role Permissions.`);

    // --- 12. SEED THRESHOLDS ---
    console.log("🎚️ Seeding Thresholds...");
    const thresholds = [
      { id: "thresh-01", type: "BUDGET_ALERT", threshold: 80, is_enabled: true, notify_email: true },
      { id: "thresh-02", type: "SINGLE_REQUISITION_MAX", threshold: 200000, is_enabled: true, notify_email: false }
    ];
    for (const t of thresholds) {
      await client.query(`
        INSERT INTO thresholds (id, type, threshold, is_enabled, notify_email)
        VALUES ($1, $2, $3, $4, $5)
      `, [t.id, t.type, t.threshold, t.is_enabled, t.notify_email]);
    }
    console.log(`- Inserted ${thresholds.length} Threshold Alerts settings.`);

    // --- 13. SEED LEDGER BOOKS ---
    console.log("📖 Seeding Ledger Books...");
    const ledgerBooks = [
      { id: "ledger-choir", ministry_id: "grp-choir", ministry_name: "PCEA St Andrew's Choir", book_name: "Choir General Ledger 2026", description: "Consolidated registers for instruments, robes, choir books and transport sheets.", created_by: "user-finance", creator_name: "Sarah Wanjiku", budget_limit: 500000, spent_amount: 320000, notes: "Maintained in clean compliance", status: "ACTIVE" },
      { id: "ledger-youth", ministry_id: "grp-youth", ministry_name: "Youth Fellowship", book_name: "Youth Fellowship Operations Ledger", description: "Accounts register for youth camp activities, retreats and missions.", created_by: "user-finance", creator_name: "Sarah Wanjiku", budget_limit: 350000, spent_amount: 120000, notes: "All vouchers verified", status: "ACTIVE" }
    ];
    for (const l of ledgerBooks) {
      await client.query(`
        INSERT INTO ledger_books (id, ministry_id, ministry_name, book_name, description, created_at, created_by, creator_name, budget_limit, spent_amount, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `, [l.id, l.ministry_id, l.ministry_name, l.book_name, l.description, new Date().toISOString(), l.created_by, l.creator_name, l.budget_limit, l.spent_amount, l.notes, l.status]);
    }
    console.log(`- Inserted ${ledgerBooks.length} Ledger Books.`);

    // --- 14. SEED SUPPLEMENTARY BUDGETS ---
    console.log("💰 Seeding Supplementary Budgets...");
    const suppBudgets = [
      { id: "supp-01", requester_id: "18a080c1-a016-5975-9735-ef5887edb906", requester_name: "PCEA St Andrew's ICT", requester_email: "ict.team@pceastandrews.com", role: "SUPER_ADMIN", project_id: "proj-ict-sanctuary-streaming", project_name: "Sanctuary AV Streaming Upgrade", amount: 150000, justification: "Required due to global shipping container fee surge which raised the price of professional optical zoom cameras by 15%.", status: "PENDING" }
    ];
    for (const s of suppBudgets) {
      await client.query(`
        INSERT INTO supplementary_budgets (id, requester_id, requester_name, requester_email, role, project_id, project_name, amount, justification, submitted_at, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [s.id, s.requester_id, s.requester_name, s.requester_email, s.role, s.project_id, s.project_name, s.amount, s.justification, new Date().toISOString(), s.status]);
    }
    console.log(`- Inserted ${suppBudgets.length} Supplementary Budget requests.`);

    // --- 15. SEED VENDORS ---
    console.log("🤝 Seeding Vendors...");
    const vendors = [
      { id: "vend-01", name: "SoundMasters Limited", contact: "+254711998877 / sales@soundmasters.co.ke", location: "Nairobi, Luthuli Avenue", offerings: "Sennheiser microphones, Yamaha audio mixers, JBL sanctuary speakers", status: "APPROVED" },
      { id: "vend-02", name: "Royal Outfitters Kenya", contact: "+254722887766 / stitch@royaloutfitters.ke", location: "Nairobi, Biashara Street", offerings: "Church choir robes, clergy vestments, altar banners", status: "APPROVED" }
    ];
    for (const v of vendors) {
      await client.query(`
        INSERT INTO vendors (id, name, contact, location, offerings, created_at, added_by, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [v.id, v.name, v.contact, v.location, v.offerings, new Date().toISOString(), "user-finance", v.status]);
    }
    console.log(`- Inserted ${vendors.length} Approved Vendors.`);

    console.log("\n✨ DATABASE SEEDING COMPLETED EXTREMELY SUCCESSFULLY! ✨");
  } catch (err: any) {
    console.error("❌ FAILED to seed database:", err.message || String(err));
  } finally {
    await client.end();
  }
}

seedDatabase();
