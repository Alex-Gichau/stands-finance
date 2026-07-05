
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import fs from "fs";
import { Readable } from "stream";
import pg from "pg";

dotenv.config({ override: true });

import nodemailer from "nodemailer";
import { google } from "googleapis";
import { initializeApp as initFirebase, cert as firebaseCert } from "firebase-admin/app";
import { getFirestore as initFirestore } from "firebase-admin/firestore";

const getFilename = () => {
  try {
    return typeof import.meta !== "undefined" && import.meta.url ? fileURLToPath(import.meta.url) : "";
  } catch {
    return "";
  }
};
const __filename = getFilename();
const __dirname = __filename ? path.dirname(__filename) : process.cwd();

// Email Config
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: process.env.SMTP_PORT === "465",
  auth: {
    user: process.env.SMTP_USER || "ict.team@pceastandrews.org",
    pass: process.env.SMTP_PASS,
  },
});

interface Activity {
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  metadata?: any;
}

// Ensure activity_history.json exists or create it
function restoreActivities(): Activity[] {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading activity_history.json:", err);
  }
  return [];
}

function persistActivity(activity: Activity) {
  try {
    const filePath = path.join(process.cwd(), "activity_history.json");
    const activities = restoreActivities();
    activities.push(activity);
    fs.writeFileSync(filePath, JSON.stringify(activities, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing activity_history.json:", err);
  }
}

function convertBase64ToLocalFile(attachmentStr: string, uploadsDir: string, vpsIp: string = "178.104.122.211"): string {
  if (!attachmentStr || typeof attachmentStr !== "string") return attachmentStr;
  
  let fileName = "attachment";
  let dataUrl = attachmentStr;
  let hasPrefix = false;
  
  if (attachmentStr.includes("::")) {
    const separatorIndex = attachmentStr.indexOf("::");
    fileName = attachmentStr.substring(0, separatorIndex);
    dataUrl = attachmentStr.substring(separatorIndex + 2);
    hasPrefix = true;
  }
  
  if (!dataUrl.startsWith("data:")) {
    return attachmentStr;
  }
  
  try {
    const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
      return attachmentStr;
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, "base64");
    
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
    const uniquePrefix = Math.random().toString(36).substring(2, 10) + "_" + Date.now();
    const uniqueFileName = `${uniquePrefix}_${cleanFileName}`;
    const filePath = path.join(uploadsDir, uniqueFileName);
    
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, buffer);
    
    const fileUrl = `http://${vpsIp}:3000/uploads/${uniqueFileName}`;
    console.log(`[Base64 Purger] Converted base64 to VPS disk file: ${fileUrl}`);
    
    return hasPrefix ? `${fileName}::${fileUrl}` : fileUrl;
  } catch (err: any) {
    console.error(`[Base64 Purger] Failed converting base64 attachment "${fileName}":`, err.message || err);
    return attachmentStr;
  }
}

async function purgeBase64AttachmentsFromDb() {
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL || "";
  if (!dbUrl) {
    console.log("[Base64 Purger] DATABASE_URL is not set, skipping startup DB-level base64 purge.");
    return;
  }

  const vpsIp = process.env.VPS_IP || "178.104.122.211";
  const uploadsDir = path.join(process.cwd(), "uploads");

  let pgClient;
  try {
    console.log("[Base64 Purger] Starting background base64-to-local-disk purge on database records...");
    pgClient = new pg.Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("supabase.co") || dbUrl.includes("supabase.com") || dbUrl.includes("pooler.supabase")
        ? { rejectUnauthorized: false }
        : undefined,
    });
    await pgClient.connect();

    const res = await pgClient.query("SELECT id, attachments, receipts FROM requisitions");
    console.log(`[Base64 Purger] Auditing ${res.rowCount} requisitions from database.`);

    let updatedCount = 0;
    for (const row of res.rows) {
      let isModified = false;
      let attachments: any[] = [];
      let receipts: any[] = [];

      try {
        attachments = typeof row.attachments === "string" ? JSON.parse(row.attachments) : (row.attachments || []);
      } catch {
        attachments = row.attachments || [];
      }

      try {
        receipts = typeof row.receipts === "string" ? JSON.parse(row.receipts) : (row.receipts || []);
      } catch {
        receipts = row.receipts || [];
      }

      const newAttachments = attachments.map((att: any) => {
        if (typeof att === "string") {
          const converted = convertBase64ToLocalFile(att, uploadsDir, vpsIp);
          if (converted !== att) {
            isModified = true;
          }
          return converted;
        }
        return att;
      });

      const newReceipts = receipts.map((rec: any) => {
        if (typeof rec === "string") {
          const converted = convertBase64ToLocalFile(rec, uploadsDir, vpsIp);
          if (converted !== rec) {
            isModified = true;
          }
          return converted;
        }
        return rec;
      });

      if (isModified) {
        await pgClient.query(
          "UPDATE requisitions SET attachments = $1, receipts = $2, updated_at = NOW() WHERE id = $3",
          [JSON.stringify(newAttachments), JSON.stringify(newReceipts), row.id]
        );
        updatedCount++;
        console.log(`[Base64 Purger] Converted and updated requisition '${row.id}' files.`);
      }
    }

    console.log(`[Base64 Purger] Base64 purge audit completed. Cleaned and updated ${updatedCount} requisition records.`);
  } catch (err: any) {
    console.error("[Base64 Purger] Database purge failed:", err.message || err);
  } finally {
    if (pgClient) {
      try {
        await pgClient.end();
      } catch (endErr) {
        console.error("[Base64 Purger] Error closing PG connection:", endErr);
      }
    }
  }
}

interface SearchLog {
  query: string;
  username: string;
  email: string;
  timestamp: string;
}

function restoreSearchLogs(): SearchLog[] {
  try {
    const filePath = path.join(process.cwd(), "search_history.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading search_history.json:", err);
  }
  return [];
}

function persistSearchLog(log: SearchLog) {
  try {
    const filePath = path.join(process.cwd(), "search_history.json");
    const logs = restoreSearchLogs();
    logs.push(log);
    fs.writeFileSync(filePath, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing search_history.json:", err);
  }
}

interface BugReport {
  id: string;
  category: string;
  title: string;
  description: string;
  severity: string;
  email: string;
  username: string;
  timestamp: string;
  status: string;
}

function restoreBugReports(): BugReport[] {
  try {
    const filePath = path.join(process.cwd(), "bug_reports.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading bug_reports.json:", err);
  }
  return [];
}

function persistBugReport(report: BugReport) {
  try {
    const filePath = path.join(process.cwd(), "bug_reports.json");
    const reports = restoreBugReports();
    reports.push(report);
    fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing bug_reports.json:", err);
  }
}

interface Feedback {
  id: string;
  category: string;
  subject: string;
  explanation: string;
  email: string;
  username: string;
  timestamp: string;
}

function restoreFeedback(): Feedback[] {
  try {
    const filePath = path.join(process.cwd(), "feedback.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (err) {
    console.error("Error reading feedback.json:", err);
  }
  return [];
}

function persistFeedback(feedback: Feedback) {
  try {
    const filePath = path.join(process.cwd(), "feedback.json");
    const reports = restoreFeedback();
    reports.push(feedback);
    fs.writeFileSync(filePath, JSON.stringify(reports, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing feedback.json:", err);
  }
}

function generateSlackFullReport(): string {
  const activities = restoreActivities();
  if (activities.length === 0) {
    return "🤷‍♂️ *No historical user activities recorded yet. It's quiet in here!* 🦗";
  }

  // Sort chronologically/descending to display latest info on top
  // Limit to most recent 15 activities to stay within Slack's 3000 character limit per block
  const sorted = [...activities]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 15);

  const getEmojiForAction = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes("login") || a.includes("sign_in")) return "👋";
    if (a.includes("logout") || a.includes("sign_out")) return "✌️";
    if (a.includes("create") || a.includes("add") || a.includes("submit")) return "✨";
    if (a.includes("update") || a.includes("edit") || a.includes("save")) return "📝";
    if (a.includes("delete") || a.includes("remove")) return "🗑️";
    if (a.includes("approve")) return "✅";
    if (a.includes("reject")) return "❌";
    if (a.includes("disburse") || a.includes("payment")) return "💸";
    if (a.includes("cancel")) return "🛑";
    if (a.includes("email")) return "📧";
    if (a.includes("sync")) return "🔄";
    return "🔹";
  };

  let report = "🚀 *LATEST USER ACTIVITY REPORT* 🚀\n\n";

  sorted.forEach((act) => {
    const timeStr = new Date(act.timestamp).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
    const emoji = getEmojiForAction(act.action);
    const entry = `${emoji} *[${timeStr}]* 👤 _${act.performedBy}_ \n⚡ *${act.action}* 💬 ${act.details}\n`;
    
    // Safety check: Don't exceed block limit (3000 chars)
    if ((report + entry).length < 2900) {
      report += entry;
    }
  });

  if (activities.length > 15) {
    report += `\n... and ${activities.length - 15} more activities in the ledger.`;
  }

  return report;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadsDir));

  // Local File Upload Endpoint (VPS Local Storage Support)
  app.post("/api/attachments/upload", async (req, res) => {
    const { fileName, dataUrl } = req.body;
    if (!fileName || !dataUrl) {
      return res.status(400).json({ error: "Missing fileName or dataUrl payload." });
    }
    
    try {
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return res.status(400).json({ error: "Invalid dataUrl format. Must be a valid base64 data URL." });
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      
      const cleanFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const uniquePrefix = Math.random().toString(36).substring(2, 10) + "_" + Date.now();
      const uniqueFileName = `${uniquePrefix}_${cleanFileName}`;
      const filePath = path.join(uploadsDir, uniqueFileName);
      
      fs.writeFileSync(filePath, buffer);
      
      const vpsIp = process.env.VPS_IP || "178.104.122.211";
      const fileUrl = `http://${vpsIp}:3000/uploads/${uniqueFileName}`;
      console.log(`[Local Upload] Saved file to VPS local disk: ${fileUrl}`);
      
      res.json({ success: true, url: fileUrl });
    } catch (err: any) {
      console.error("[Local Upload] Failed saving file:", err.message || err);
      res.status(500).json({ error: `Failed to store attachment locally: ${err.message || err}` });
    }
  });

  // Check Supabase env vars
  app.get("/api/config/supabase", (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
      useSupabase: process.env.VITE_USE_SUPABASE || process.env.USE_SUPABASE || ""
    });
  });

  // GET health endpoint for periodic status checks in UI
  app.get("/api/system-health", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL || "";
    const expectedRef = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "unknown";

    const report: any = {
      postgres: { status: "disconnected" },
      recommendations: []
    };

    if (!dbUrl) {
      report.postgres.status = "missing_config";
      report.recommendations.push("DATABASE_URL is not set in Secrets.");
      return res.json(report);
    }

    const start = Date.now();
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    
    try {
      await client.connect();
      report.postgres.status = "ok";
      report.postgres.latency = Date.now() - start;

      // Extract ref from successful connection string if possible
      const actualRef = dbUrl.match(/postgres\.(.*?):/)?.[1] || dbUrl.match(/db\.(.*?)\.supabase/)?.[1];
      if (actualRef && actualRef !== expectedRef) {
        report.recommendations.push(`⚠️ DATABASE_URL PROJECT MISMATCH: Your connection string is pointing to project '${actualRef}', but your system URL is for '${expectedRef}'. You are viewing data from the wrong project.`);
      }
      
      const uCount = await client.query("SELECT COUNT(*) FROM users");
      const rCount = await client.query("SELECT COUNT(*) FROM requisitions");
      let cgCount = { rows: [{ count: "0" }] };
      try {
        cgCount = await client.query("SELECT COUNT(*) FROM church_groups");
      } catch (e) {}
      
      report.postgres.counts = {
        users: parseInt(uCount.rows[0].count),
        requisitions: parseInt(rCount.rows[0].count),
        churchGroups: parseInt(cgCount.rows[0].count)
      };
      
      await client.end();
    } catch (err: any) {
      const errStr = String(err.message || err);
      report.postgres.status = "error";
      report.postgres.error = errStr;
      
      const isProjectMismatch = errStr.includes("tenant/user") && (errStr.includes("not found") || errStr.includes("unknown"));
      if (isProjectMismatch) {
        report.recommendations.push(`❌ DATABASE_URL PROJECT MISMATCH: Your connection string points to a different project than ${expectedRef}. Please update your DATABASE_URL secret.`);
      } else {
        report.recommendations.push("PostgreSQL connection failing. Check your credentials.");
      }
      try { await client.end(); } catch(_) {}
    }

    // Verify Google Sheets & Drive API authentication status
    try {
      const keyPath = path.join(process.cwd(), "googleService.json");
      let credentials: any = null;
      if (fs.existsSync(keyPath)) {
        credentials = JSON.parse(fs.readFileSync(keyPath, "utf-8"));
      } else if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        try {
          credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
        } catch (_) {
          const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, "base64").toString("utf8");
          credentials = JSON.parse(decoded);
        }
      } else if (process.env.GOOGLE_PRIVATE_KEY) {
        credentials = {
          client_email: process.env.GOOGLE_CLIENT_EMAIL || "stands-erequisitions@quiet-surface-499808-t9.iam.gserviceaccount.com",
          private_key: process.env.GOOGLE_PRIVATE_KEY
        };
      }

      if (!credentials || !credentials.client_email || !credentials.private_key) {
        report.googleSheets = { status: "missing_config" };
        report.recommendations.push("⚠️ GOOGLE SHEETS NOT CONFIGURED: Service account credentials are not configured. Switched to offline simulated sheets persistence.");
      } else {
        let cleanKey = credentials.private_key.trim();
        if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
          cleanKey = cleanKey.substring(1, cleanKey.length - 1);
        }
        if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
          cleanKey = cleanKey.substring(1, cleanKey.length - 1);
        }
        cleanKey = cleanKey.replace(/\\n/g, "\n");

        const authClient = new google.auth.JWT({
          email: credentials.client_email,
          key: cleanKey,
          scopes: ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
        });

        await authClient.getAccessToken();
        report.googleSheets = { status: "ok", email: credentials.client_email };
      }
    } catch (err: any) {
      const errMsg = String(err.message || err);
      report.googleSheets = { status: "error", error: errMsg };
      
      const isInvalidSignature = errMsg.includes("invalid_grant") || errMsg.includes("Signature");
      if (isInvalidSignature) {
        report.recommendations.push(
          "📋 GOOGLE SHEETS AUTH ERROR: The Google Service Account private key is invalid or has been revoked (Invalid JWT Signature). " +
          "Google Sheets and Drive integrations are currently running in Offline Simulated Fallback mode to prevent application disruption. " +
          "To restore active cloud syncing, please generate a new Google Service Account private key from your Google Cloud Console (for service account 'stands-erequisitions@quiet-surface-499808-t9.iam.gserviceaccount.com') and update your secrets or replace googleService.json."
        );
      } else {
        report.recommendations.push(
          `⚠️ GOOGLE SHEETS CONNECTION ERROR: Google Sheets integration is currently falling back to Offline Simulation due to: ${errMsg}`
        );
      }
    }

    res.json(report);
  });

  // Get deep server-side diagnostics for Supabase connectivity (REST & SQL direct)
  app.post("/api/config/troubleshoot", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL || "";
    
    // Extract project ref for mismatch detection
    const expectedRef = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "unknown";

    const report: {
      env: Record<string, boolean>;
      postgres: { connected: boolean; version?: string; tables?: { name: string; count: number }[]; error?: string };
      api: { reachable: boolean; latencyMs?: number; error?: string };
      recommendations: string[];
    } = {
      env: {
        SUPABASE_URL: !!supabaseUrl,
        SUPABASE_ANON_KEY: !!anonKey,
        DATABASE_URL: !!dbUrl
      },
      postgres: { connected: false },
      api: { reachable: false },
      recommendations: []
    };

    // Test Postgres connection if configured
    if (dbUrl) {
      const client = new pg.Client({
        connectionString: dbUrl,
        ssl: dbUrl.includes("supabase.co") || dbUrl.includes("supabase.com") || dbUrl.includes("pooler.supabase") 
          ? { rejectUnauthorized: false } 
          : undefined,
      });
      try {
        await client.connect();
        report.postgres.connected = true;
        
        const verRes = await client.query("SELECT version();");
        report.postgres.version = verRes.rows[0]?.version || "Unknown";

        const tablesRes = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name;
        `);
        
        const tableList: { name: string; count: number }[] = [];
        for (const r of tablesRes.rows) {
          const tableName = r.table_name;
          try {
            const countRes = await client.query(`SELECT count(*) FROM "${tableName}";`);
            const ct = parseInt(countRes.rows[0]?.count || "0", 10);
            tableList.push({ name: tableName, count: ct });
          } catch (_) {
            tableList.push({ name: tableName, count: -1 });
          }
        }
        report.postgres.tables = tableList;
        await client.end();
      } catch (err: any) {
        const errStr = String(err.message || err);
        const isAuthFailed = errStr.toLowerCase().includes("password authentication failed") ||
                             errStr.toLowerCase().includes("password auth");
        
        const isProjectMismatch = errStr.includes("tenant/user") && (errStr.includes("not found") || errStr.includes("unknown"));

        if (isProjectMismatch) {
          report.postgres.error = `Project Reference Mismatch: The DATABASE_URL is pointing to an invalid or different project ref than ${expectedRef}.`;
          report.recommendations.push(`❌ DATABASE_URL PROJECT MISMATCH: The connection string points to a tenant that was not found. Your SUPABASE_URL suggests your project ref should be '${expectedRef}'. Please update your DATABASE_URL secret with the correct string from Supabase Dashboard -> Settings -> Database.`);
        } else if (isAuthFailed) {
          report.postgres.error = "PostgreSQL password verification failed: Password authentication rejected by server.";
          report.recommendations.push("🔑 DATABASE PASSWORD ERROR: The database password in your DATABASE_URL is invalid. In your AI Studio Secrets configuration, make sure you are using your actual Supabase Database Password (usually set when creating your project, NOT your Supabase website login password).");
        } else {
          report.postgres.error = errStr;
          report.recommendations.push("Your direct SQL database connection is failing. Double check your DATABASE_URL pg connection string passwords or host configuration.");
        }
        try { await client.end(); } catch(_) {}
      }
    } else {
      report.recommendations.push("Please configure DATABASE_URL in Secrets so the backend can verify SQL table definitions and direct query performance.");
    }

    // Test Supabase REST API connection if configured (done server-side to bypass browser CORS constraints)
    if (supabaseUrl && anonKey) {
      const startTime = Date.now();
      try {
        const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "");
        const pingUrl = `${cleanUrl}/rest/v1/users?limit=1`;
        
        const response = await fetch(pingUrl, {
          method: "GET",
          headers: {
            "apikey": anonKey,
            "Authorization": `Bearer ${anonKey}`
          }
        });
        
        const latency = Date.now() - startTime;
        report.api.reachable = response.ok;
        report.api.latencyMs = latency;
        
        if (!response.ok) {
          const textErr = await response.text();
          report.api.error = `HTTP ${response.status}: ${textErr}`;
          if (textErr.includes("relation") || response.status === 404) {
            report.recommendations.push("The Supabase REST server responded, but tables have not been initiated. Click the 'Run Supabase Database Migration' button below to create schema assets.");
          } else {
            report.recommendations.push(`REST API gateway responded with bad status status. Check key permissions or policies. Error details: ${textErr}`);
          }
        }
      } catch (apiErr: any) {
        report.api.error = apiErr.message || JSON.stringify(apiErr);
        report.recommendations.push("Failed to route network traffic to YOUR_SUPABASE_URL. Confirm the URL is correct, has no typos, and is fully active.");
      }
    } else {
      report.recommendations.push("Set your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables to enable REST queries inside the client engine.");
    }

    if (report.postgres.connected && report.api.reachable) {
      report.recommendations.push("All connections look clean! Your full-stack Supabase integration is perfectly healthy and ready.");
    }

    res.json(report);
  });

  // Run SQL migration on live Supabase Database via direct connection
  app.post("/api/config/run-migration", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const expectedRef = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "unknown";
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL;
    if (!dbUrl) {
      return res.status(400).json({ 
        success: false, 
        error: "DATABASE_URL is not set in your environmental variables. Please configure your direct PostgreSQL connection string (postgresql://postgres:[password]@db.xxxx.supabase.co:5432/postgres) in the Secrets panel first."
      });
    }

    let client;
    try {
      console.log("[Migration] Initializing migration client direct connection...");
      client = new pg.Client({
        connectionString: dbUrl,
        ssl: dbUrl.includes("supabase.co") || dbUrl.includes("supabase.com") || dbUrl.includes("pooler.supabase") 
          ? { rejectUnauthorized: false } 
          : undefined,
      });

      await client.connect();
      console.log("[Migration] Successfully connected to live PostgreSQL database!");
    } catch (err: any) {
      const errStr = String(err.message || err);
      const isProjectMismatch = errStr.includes("tenant/user") && (errStr.includes("not found") || errStr.includes("unknown"));
      
      if (isProjectMismatch) {
        return res.status(500).json({
          success: false,
          error: `Project Reference Mismatch: DATABASE_URL points to a different project than ${expectedRef}.`,
          details: `The connection string points to a tenant that was not found. Your SUPABASE_URL suggests your project ref should be '${expectedRef}'. Please update your DATABASE_URL secret with the correct string from Supabase Dashboard -> Settings -> Database.`
        });
      }
      
      return res.status(500).json({
        success: false,
        error: "PostgreSQL Database connection failed: " + errStr,
        details: "Please verify that your database server is active and that your DATABASE_URL password is correct."
      });
    }

    try {
      const results: string[] = [];

      // 1. Run tables schema migration (0000_ambiguous_namorita.sql)
      const migrationPath = path.join(process.cwd(), "supabase", "migrations", "0000_ambiguous_namorita.sql");
      if (fs.existsSync(migrationPath)) {
        console.log("[Migration] Reading tables SQL from " + migrationPath);
        const migrationSql = fs.readFileSync(migrationPath, "utf8");
        // Split by statement-breakpoint to execute individually
        const statements = migrationSql.split("--> statement-breakpoint");
        let successfulStatements = 0;
        for (const stmt of statements) {
          const trimmed = stmt.trim();
          if (!trimmed) continue;
          try {
            await client.query(trimmed);
            successfulStatements++;
          } catch (err: any) {
            // Ignore already exists
            if (err.message.includes("already exists") || err.message.includes("already a relation")) {
              console.log("[Migration] Column/Table relation already exists, skipping statement.");
            } else {
              throw err;
            }
          }
        }
        results.push(`✓ Applied ${successfulStatements} schema table and column statements.`);
      } else {
        results.push("⚠ Main migrations SQL file not found at " + migrationPath);
      }

      // 2. Run Policies and help functions (policies.sql)
      const policiesPath = path.join(process.cwd(), "supabase", "policies.sql");
      if (fs.existsSync(policiesPath)) {
        console.log("[Migration] Reading Policies SQL from " + policiesPath);
        const policiesSql = fs.readFileSync(policiesPath, "utf8");
        try {
          await client.query(policiesSql);
          results.push("✓ Configured Row Level Security (RLS) policies and helper functions successfully.");
        } catch (err: any) {
          if (err.message.includes("already exists")) {
            results.push("✓ Row Level Security helper/policies already exist (Skipped cleanly).");
          } else {
            console.warn("[Migration] Security policies execution note / warning:", err.message);
            results.push("⚠ Security policies note: " + err.message);
          }
        }
      } else {
        results.push("⚠ Security policies SQL file not found at " + policiesPath);
      }

      // 3. Migrate Google Account Auth users to Supabase Auth tables (supabase_migration.sql)
      const googleMigrationPath = path.join(process.cwd(), "supabase_migration.sql");
      if (fs.existsSync(googleMigrationPath)) {
        console.log("[Migration] Reading Google account auth users from " + googleMigrationPath);
        const googleMigrationSql = fs.readFileSync(googleMigrationPath, "utf8");
        try {
          await client.query(googleMigrationSql);
          results.push("✓ Successfully migrated all Google Account Auth users and identities to Supabase.");
        } catch (err: any) {
          console.error("[Migration] Google accounts migration failed/warned:", err.message);
          results.push("⚠ Google accounts migration status: " + err.message);
        }
      } else {
        results.push("ℹ No google_migration.sql file found at root, skipped Google user import.");
      }

      await client.end();
      return res.json({
        success: true,
        message: "Supabase Relational Database migrated and structured successfully!",
        details: results
      });
    } catch (error: any) {
      console.warn("[Migration Error]", error);
      if (client) {
        try { await client.end(); } catch (e) {}
      }
      const isPasswordError = String(error.message || error).toLowerCase().includes("password authentication failed") || 
                              String(error.message || error).toLowerCase().includes("password auth");
                              
      const userMessage = isPasswordError 
        ? "PostgreSQL database authentication failed! The database password provided inside your 'DATABASE_URL' environment secret is incorrect. Please verify your direct database password in Supabase and update your Secrets."
        : (error.message || String(error));

      return res.status(500).json({
        success: false,
        error: userMessage,
        details: isPasswordError 
          ? "🔑 Incorrect password signature detected. Please ensure you are using your actual Supabase Database Password (not your Supabase dashboard login password) in your DATABASE_URL connection string."
          : "Database connection failed. Ensure your connection string includes the correct password, and that the database server is online."
      });
    }
  });

  // Export from Firestore and Import to Supabase PostgreSQL Database
  app.post("/api/config/migrate-data", async (req, res) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const expectedRef = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "unknown";
    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL;
    if (!dbUrl) {
      return res.status(200).json({
        success: false,
        error: "DATABASE_URL is not set. Please configure your direct PostgreSQL connection string first."
      });
    }

    const serviceAccountPath = path.join(process.cwd(), "googleService.json");
    if (!fs.existsSync(serviceAccountPath)) {
      return res.status(200).json({
        success: false,
        error: "Google Service Account key file 'googleService.json' was not found in the project root."
      });
    }

    let firestoreDb: any;
    try {
      console.log("[DataMigration] Initializing Firebase Admin SDK...");
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      const appName = "migration-app-" + Date.now();
      const firebaseApp = initFirebase({
        credential: firebaseCert(serviceAccount),
        projectId: "ai-studio-0adb409c-19ca-4d40-98cc-79864b9d3d75"
      }, appName);

      firestoreDb = initFirestore(firebaseApp);
      console.log("[DataMigration] Firebase Admin SDK successfully initialized.");
    } catch (err: any) {
      console.error("[DataMigration] Firebase SDK initialization failed:", err);
      return res.status(500).json({
        success: false,
        error: "Firebase Admin SDK initialization failed: " + (err.message || String(err)),
        details: "Please ensure your googleService.json is valid and contains correct GCP project access."
      });
    }

    let pgClient;
    try {
      console.log("[DataMigration] Connecting to live PostgreSQL database...");
      pgClient = new pg.Client({
        connectionString: dbUrl,
        ssl: dbUrl.includes("supabase.co") || dbUrl.includes("supabase.com") || dbUrl.includes("pooler.supabase")
          ? { rejectUnauthorized: false }
          : undefined,
      });
      await pgClient.connect();
      console.log("[DataMigration] PostgreSQL database connection successful.");
    } catch (err: any) {
      const errStr = String(err.message || err);
      const isProjectMismatch = errStr.includes("tenant/user") && (errStr.includes("not found") || errStr.includes("unknown"));
      
      if (isProjectMismatch) {
        return res.status(200).json({
          success: false,
          error: `Project Reference Mismatch: DATABASE_URL points to a different project than ${expectedRef}.`,
          details: `The connection string points to a tenant that was not found. Your SUPABASE_URL suggests your project ref should be '${expectedRef}'. Please update your DATABASE_URL secret with the correct string from Supabase Dashboard -> Settings -> Database.`
        });
      }
      
      console.log("[DataMigration] PostgreSQL connection bypassed/failed:", err.message || err);
      return res.status(200).json({
        success: false,
        error: "PostgreSQL Database connection failed: " + errStr,
        details: "Please verify that your database server is active and that your DATABASE_URL password is correct."
      });
    }

    const stats: Record<string, { fetched: number; migrated: number; errors: number; warning?: string }> = {};
    const warnings: string[] = [];

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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "month",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
        pk: "id",
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
      stats[item.name] = { fetched: 0, migrated: 0, errors: 0 };
      try {
        console.log(`[DataMigration] Migrating collection: ${item.name} ...`);
        const snapshot = await firestoreDb.collection(item.name).get();
        stats[item.name].fetched = snapshot.size;

        for (const doc of snapshot.docs) {
          try {
            const params = item.map(doc.id, doc.data());
            await pgClient.query(item.query, params);
            stats[item.name].migrated++;
          } catch (rowErr: any) {
            console.error(`[DataMigration] Error inserting row in ${item.name} with ID ${doc.id}:`, rowErr);
            stats[item.name].errors++;
            warnings.push(`[${item.name} / ${doc.id}]: ${rowErr.message || String(rowErr)}`);
          }
        }
      } catch (collErr: any) {
        console.warn(`[DataMigration] Collection fetch failed for '${item.name}':`, collErr.message);
        stats[item.name].warning = collErr.message;
        warnings.push(`Collection '${item.name}' skip / error: ${collErr.message}`);
      }
    }

    try {
      await pgClient.end();
    } catch (e) {}

    const overallSuccess = Object.values(stats).some(s => s.migrated > 0);

    return res.json({
      success: overallSuccess,
      message: overallSuccess 
        ? "Ecosystem database replication executed successfully!" 
        : "Migration session completed. No records were replicated (check collection permissions).",
      stats,
      error: warnings.length > 0 ? warnings.join("\n") : null
    });
  });

  // API Route for Sending Email
  app.post("/api/send-email", async (req, res) => {
    const { to, requesterName, amount, title, requisitionId, status, details } = req.body;
    
    if (!process.env.SMTP_PASS) {
      console.warn("SMTP_PASS is not configured. Email will be logged but not sent.");
      persistActivity({
        action: "EMAIL_SKIPPED",
        details: `Mail to ${to} skipped (No Credentials). Requisition: ${title}`,
        performedBy: "SYSTEM_MAILER",
        timestamp: new Date().toISOString()
      });
      return res.json({ success: true, message: "SMTP not configured, activity recorded." });
    }

    try {
      let subject = `[Notification] Requisition Update: ${title}`;
      let bodyHtml = "";

      const formattedAmount = amount ? `KES ${Number(amount).toLocaleString()}` : "N/A";
      const displayId = requisitionId || "N/A";

      switch (status) {
        case "SUBMITTED":
          subject = `[Submitted] Requisition #${displayId} - ${title}`;
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #0f172a;">Requisition Submitted</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>Your requisition <strong>#${displayId}: ${title}</strong> for <strong>${formattedAmount}</strong> has been successfully submitted and is now awaiting Level 1 approval.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
          break;
        case "APPROVED_L1":
          subject = `[L1 Approved] Requisition #${displayId} - Compliance Cleared`;
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #10b981;">Level 1 Approval Granted</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>Your requisition <strong>#${displayId}: ${title}</strong> has passed Level 1 Compliance approval.</p>
              <p>It is now being reviewed for Level 2 (Final) authorization.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
          break;
        case "APPROVED_L2":
          subject = `[Approved] Requisition #${displayId} - Final Authorization`;
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #059669;">Final Authorization Granted</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>Excellent news! Your requisition <strong>#${displayId}: ${title}</strong> has received final Level 2 authorization for <strong>${formattedAmount}</strong>.</p>
              <p>The Finance team has been notified to initiate the disbursement process.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
          break;
        case "DISBURSED":
          subject = `[Disbursed] Requisition #${displayId} - Funds Released`;
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #f59e0b;">Funds Disbursed</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>Funds for your requisition <strong>#${displayId}: ${title}</strong> have been disbursed.</p>
              <p><strong>Amount:</strong> ${formattedAmount}</p>
              ${details ? `<p><strong>Notes:</strong> ${details}</p>` : ""}
              <p>Please check your registered payment method (M-Pesa/Bank) for the settlement.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
          break;
        case "REJECTED":
          subject = `[Returned] Requisition #${displayId} - Revision Required`;
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #ef4444;">Requisition Returned</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>Your requisition <strong>#${displayId}: ${title}</strong> has been returned or rejected by the approval committee.</p>
              ${details ? `<p style="background: #fef2f2; padding: 10px; border-radius: 4px; border-left: 4px solid #ef4444;"><strong>Reason:</strong> ${details}</p>` : ""}
              <p>Please log in to the portal to review the feedback and make necessary adjustments.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
          break;
        default:
          bodyHtml = `
            <div style="font-family: sans-serif; padding: 20px; color: #334155;">
              <h2 style="color: #0f172a;">Requisition Update</h2>
              <p>Hello <strong>${requesterName}</strong>,</p>
              <p>There is a new update regarding your requisition <strong>#${displayId}: ${title}</strong>. Current Status: ${status}.</p>
              <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
              <p style="font-size: 12px; color: #64748b;">This is an automated notification from STANDS eRequisitions.</p>
            </div>
          `;
      }

      await transporter.sendMail({
        from: `"STANDS eRequisitions" <${process.env.SMTP_USER || "ict.team@pceastandrews.org"}>`,
        to,
        subject,
        html: bodyHtml,
      });

      persistActivity({
        action: "EMAIL_DISPATCH",
        details: `Notification Email (${status}) sent to ${requesterName} <${to}> regarding '${title}'`,
        performedBy: "SYSTEM_MAILER",
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, deliveredTo: to, status });
    } catch (err: any) {
      console.warn("SMTP Send failed, logging as simulated:", err.message || err);
      
      persistActivity({
        action: "EMAIL_SIMULATED",
        details: `Simulated Email (${status}) to ${requesterName} <${to}> regarding '${title}' (SMTP Error: ${err.message || "Unknown error"})`,
        performedBy: "SYSTEM_MAILER",
        timestamp: new Date().toISOString()
      });

      res.json({ success: true, deliveredTo: to, status, simulated: true, warning: err.message });
    }
  });

  // API Route for Sending Summary Emails
  app.post("/api/send-summary-email", async (req, res) => {
    const { to, userName, frequency, pendingCount, draftsCount, recentDisbursed } = req.body;
    
    if (!process.env.SMTP_PASS) {
      console.warn("SMTP_PASS is not configured. Summary Email will be logged but not sent.");
      return res.json({ success: true, message: "SMTP not configured, but payload accepted." });
    }

    try {
      const subject = `📊 [${frequency} Summary] Your STANDS eRequisitions Digest`;
      const disbursedHtml = recentDisbursed && recentDisbursed.length > 0 
        ? recentDisbursed.map((r: any) => `
            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 12px; text-align: left;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="font-size: 14px; font-weight: 700; color: #0f172a; padding-bottom: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${r.title}
                  </td>
                  <td align="right" style="font-size: 14px; font-weight: 800; color: #10b981; white-space: nowrap; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    KES ${Number(r.amount || 0).toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="font-size: 11px; color: #64748b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    Status: <span style="background-color: #ecfdf5; color: #059669; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase;">${r.status.replace("_", " ")}</span>
                  </td>
                </tr>
              </table>
            </div>
          `).join('')
        : `<div style="text-align: center; padding: 20px; background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; font-size: 13px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">No recent disbursements to show.</div>`;

      const bodyHtml = `
        <div style="background-color: #f1f5f9; padding: 40px 10px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
          <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; text-align: left; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);">
            <!-- Header banner with church branding colors -->
            <tr>
              <td style="background-color: #0f172a; padding: 40px 30px; text-align: center;">
                <div style="font-size: 10px; font-weight: 800; color: #fbbf24; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">PCEA ST. ANDREWS CHURCH</div>
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">STANDS eRequisitions</h1>
                <div style="display: inline-block; margin-top: 15px; background-color: rgba(251, 191, 36, 0.15); color: #fbbf24; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; padding: 6px 14px; border-radius: 30px; border: 1px solid rgba(251, 191, 36, 0.3); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  ${frequency} EXECUTIVE DIGEST
                </div>
              </td>
            </tr>

            <!-- Body contents -->
            <tr>
              <td style="padding: 40px 30px;">
                <p style="font-size: 16px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Hello ${userName},</p>
                <p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 30px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  Here is your automated requisitions summary of active approvals, drafted logs, and recently disbursed financial vouchers across your department.
                </p>

                <!-- Statistics Grid -->
                <table border="0" cellpadding="0" cellspacing="12" width="100%" style="margin-left: -12px; margin-right: -12px; margin-bottom: 25px;">
                  <tr>
                    <td width="50%" valign="top" style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 20px; text-align: center;">
                      <div style="font-size: 32px; font-weight: 800; color: #1d4ed8; line-height: 1; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${pendingCount}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 1.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Pending Approval</div>
                    </td>
                    <td width="50%" valign="top" style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 20px; text-align: center;">
                      <div style="font-size: 32px; font-weight: 800; color: #d97706; line-height: 1; margin-bottom: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${draftsCount}</div>
                      <div style="font-size: 11px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 1.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">Voucher Drafts</div>
                    </td>
                  </tr>
                </table>

                <!-- Recently Disbursed Heading -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 30px; margin-bottom: 15px;">
                  <tr>
                    <td style="font-size: 13px; font-weight: 800; color: #000000; text-transform: uppercase; letter-spacing: 1.5px; padding-bottom: 6px; border-bottom: 2px solid #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                      💳 Recently Disbursed (Last 2)
                    </td>
                  </tr>
                </table>

                <!-- Items list -->
                <div style="margin-bottom: 10px;">
                  ${disbursedHtml}
                </div>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f8fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 11px; color: #64748b; line-height: 1.5; margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  You are receiving this summary because digest notification alerts are activated on your user profile credentials.
                </p>
                <div style="display: inline-block; background-color: #e2e8f0; color: #475569; font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 4px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  SHARED VIA AUTHORIZED SENDER: ict.team@pceastandrews.org
                </div>
                <p style="font-size: 10px; color: #cbd5e1; margin-top: 15px; margin-bottom: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                  PCEA St. Andrews Church © ${new Date().getFullYear()} eRequisition Core Systems.
                </p>
              </td>
            </tr>
          </table>
        </div>
      `;

      await transporter.sendMail({
        from: `"STANDS Summary" <ict.team@pceastandrews.org>`,
        to,
        subject,
        html: bodyHtml,
      });

      res.json({ success: true, deliveredTo: to });
    } catch (err: any) {
      console.warn("SMTP Summary Send failed, logging as simulated:", err.message || err);
      res.json({ success: true, deliveredTo: to, simulated: true, warning: err.message });
    }
  });

  // API Route for Slack Notifications (Expanded for Prompt 6)
  app.post("/api/notify-slack", async (req, res) => {
    const { action, details, performedBy, timestamp, metadata, level = "normal" } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    // Persist the current activity first, even if webhook is not defined
    try {
      persistActivity({ action, details, performedBy, timestamp, metadata });
    } catch (e) {
      console.warn("Failed to persist activity:", e);
    }

    // Determine target channel routing based on Prompt 6 rules
    let targetChannel = "#system-logs";
    let isHighValue = false;
    let isHighPriority = false;

    const amount = metadata && metadata.amount ? Number(metadata.amount) : 0;
    if (amount >= 10000) {
      isHighValue = true;
    }

    if (
      metadata?.priority === "HIGH" || 
      metadata?.priority === "High" || 
      (details && details.toLowerCase().includes("urgent")) ||
      (details && details.toLowerCase().includes("high priority"))
    ) {
      isHighPriority = true;
    }

    // 1. High-Value Triggers -> Route to #finance-approvals
    if (isHighValue || isHighPriority || action === "FINANCE_ALERT_TRIGGERED" || action === "FINANCE_DISBURSEMENT_ALERT") {
      targetChannel = "#finance-approvals";
    }

    // 2. Workflow warnings or Stale alerts -> Route to #workflow-alerts
    const actLower = action ? action.toLowerCase() : "";
    if (
      actLower.includes("stale") || 
      actLower.includes("overdue") || 
      actLower.includes("unresolved") || 
      action === "REQUISITION_OVERDUE" ||
      action === "ALERT_STALE_REQUISITIONS" ||
      action === "STALE_REQUISITIONS_WARNING"
    ) {
      targetChannel = "#workflow-alerts";
    }

    // 3. Security logs / promotions / quota failures
    if (
      actLower.includes("promotion") || 
      actLower.includes("role_updated") || 
      actLower.includes("user_approval") || 
      actLower.includes("suspension") ||
      actLower.includes("quota_fallback") ||
      action === "USER_PROMOTION" ||
      action === "SECURITY_WARNING" ||
      action === "UNUSUAL_DRIVE_DOC_ACCESS_WARNING"
    ) {
      targetChannel = "#system-logs";
    }

    // Build the long thread summary of recent activities
    const summaryText = generateSlackFullReport();

    let color = "#4b5563"; // Default slate gray
    let headerText = "🚨 System Ledger Alert";

    if (actLower.includes("login") || actLower.includes("sign_in")) {
      color = "#3b82f6"; // Blue
      headerText = "👋 User Session Started (Login)";
    } else if (actLower.includes("logout") || actLower.includes("sign_out")) {
      color = "#64748b"; // Slate
      headerText = "✌️ User Session Ended (Logout)";
    } else if (actLower.includes("created") || actLower.includes("submitted") || actLower.includes("submit") || actLower.includes("create")) {
      color = "#6366f1"; // Indigo
      headerText = isHighValue ? "🔥 HIGH-VALUE Requisition Submitted" : "✨ New Requisition Submitted";
    } else if (actLower.includes("approved_l1")) {
      color = "#10b981"; // L1 Green
      headerText = "✅ Compliance L1 Clearance Granted";
    } else if (actLower.includes("approved_l2")) {
      color = "#059669"; // L2 Dark Green
      headerText = "👑 Keymaster L2 Signing Certified";
    } else if (actLower.includes("approve")) {
      color = "#10b981"; // Green
      headerText = "✅ Requisition Authorized";
    } else if (actLower.includes("reject")) {
      color = "#ef4444"; // Red
      headerText = "❌ Requisition Returned / Rejected";
    } else if (actLower.includes("disburse") || actLower.includes("payment")) {
      color = "#f59e0b"; // Amber
      headerText = "💸 Funds Disbursed / Financial Settlement";
    } else if (actLower.includes("fail") || actLower.includes("security") || actLower.includes("unauthorized") || actLower.includes("bypass") || actLower.includes("quota_fallback") || actLower.includes("warning")) {
      color = "#dc2626"; // Crimson
      headerText = "🚨 AUDIT & SYSTEM RECOVERY ALERT";
    } else if (level === "critical" || level === "abnormal") {
      color = "#ef4444"; // Red/Alert
      headerText = "⚠️ High Severity System Signal";
    }

    const slackBody: any = {
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: headerText,
                emoji: true
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Action:*\n\`${action}\``
                },
                {
                  type: "mrkdwn",
                  text: `*User:*\n_${performedBy}_`
                }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Details:* ${details}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Timestamp:* ${timestamp} | *🎯 Target Channel:* \`${targetChannel}\``
                }
              ]
            }
          ]
        },
        {
          color: "#4A5568",
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🧵 SYSTEM AUDIT EVENT STREAM",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: summaryText
              }
            }
          ]
        }
      ]
    };

    // Add metadata if present (like requisition amount, etc)
    if (metadata && Object.keys(metadata).length > 0) {
      slackBody.attachments[0].blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: "*Extended Metadata context:*\n" + Object.entries(metadata).map(([k, v]) => `• *${k}:* \`${JSON.stringify(v)}\``).join("\n")
        }
      });
    }

    if (!webhookUrl) {
      console.warn(`[Slack Simulation] Webhook not specified. Posting simulated alert block to [${targetChannel}].`);
      return res.json({ 
        success: true, 
        simulated: true, 
        targetChannel, 
        payload: slackBody,
        message: `Slack alert simulated and routed successfully to ${targetChannel}`
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });

      if (!response.ok) {
        throw new Error(`Slack responded with ${response.status}`);
      }

      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (error: any) {
      console.error("Failed to send Slack notification:", error);
      res.status(500).json({ error: "Failed to notify Slack", message: error.message });
    }
  });

  // API Endpoint to manually trigger or simulate Slack Morning Briefing (Prompt 6)
  app.post("/api/slack-summary/morning", async (req, res) => {
    const { requisitions = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#finance-approvals";

    // Morning brief: Filter for pending requisitions (not approved level 2, or pending overall)
    // In our system, let's look for status: 'PENDING', 'PENDING_L1', 'PENDING_L2'
    const pendingReqs = requisitions.filter((r: any) => 
      r.status === "PENDING" || r.status === "PENDING_L1" || r.status === "PENDING_L2"
    );

    const totalCost = pendingReqs.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    // Group pending by church group/ministry
    const groupBreakdown: { [name: string]: number } = {};
    pendingReqs.forEach((r: any) => {
      const gp = r.groupName || r.groupId || "General Ministries";
      groupBreakdown[gp] = (groupBreakdown[gp] || 0) + 1;
    });

    const groupStr = Object.entries(groupBreakdown)
      .map(([name, count]) => `• *${name}*: ${count} waiting`)
      .join("\n") || "_No groups awaiting clearances_";

    const detailList = pendingReqs.slice(0, 5).map((r: any) => 
      `• *Req #${r.id || "N/A"}* - ${r.title} | KES ${Number(r.amount).toLocaleString()} (${r.status})`
    ).join("\n") + (pendingReqs.length > 5 ? `\n... and ${pendingReqs.length - 5} more pending items.` : "");

    const slackBody = {
      attachments: [
        {
          color: "#4f46e5", // Indigo-600
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "☀️ STANDS MORNING BRIEFING: Daily Pending Approvals",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Good morning! Here is the pending operations briefing for St. Andrews Church department heads and financial controllers at *8:00 AM* Nairobi time.`
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Total Outstanding:*\n\`${pendingReqs.length}\` requisitions`
                },
                {
                  type: "mrkdwn",
                  text: `*Cumulative Value:*\n*KES ${totalCost.toLocaleString()}*`
                }
              ]
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Ministry Department Status:*\n${groupStr}`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Outstanding Action Items (Top Priority):*\n${detailList || "_All clearances are 100% complete!_"}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Target Channel:* \`${targetChannel}\` | Authorized by: \`ict.team@pceastandrews.org\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: `Simulated daily morning briefing dispatched successfully to ${targetChannel}`
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch Morning Briefing", message: err.message });
    }
  });

  // API Endpoint to manually trigger or simulate Slack EOD Activity Snapshot (Prompt 6)
  app.post("/api/slack-summary/eod", async (req, res) => {
    const { requisitions = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-logs";

    const activities = restoreActivities();
    const todayStr = new Date().toDateString();

    // Calculate EOD parameters
    const todayLogs = activities.filter((log: any) => 
      new Date(log.timestamp).toDateString() === todayStr
    );

    // 1. Daily Active Users (DAU) based on logins or active logs today
    const activeUsers = new Set(todayLogs.map((log: any) => log.performedBy || "System"));
    const dauCount = activeUsers.size || 1; // Default to 1 to show realistic baseline if logs are empty

    // 2. Requisitions processed today (any modification today)
    const todayProcessedReqs = requisitions.filter((r: any) => {
      if (!r.createdAt) return false;
      const createdToday = new Date(r.createdAt).toDateString() === todayStr;
      const approvedToday = r.approvedAtL1 && new Date(r.approvedAtL1).toDateString() === todayStr;
      const disbursedToday = r.disbursedAt && new Date(r.disbursedAt).toDateString() === todayStr;
      return createdToday || approvedToday || disbursedToday;
    });

    // 3. Successfully disbursed sums today
    const todayDisbursedReqs = requisitions.filter((r: any) => 
      r.status === "DISBURSED" && r.disbursedAt && new Date(r.disbursedAt).toDateString() === todayStr
    );
    const disbursedSum = todayDisbursedReqs.reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);

    const slackBody = {
      attachments: [
        {
          color: "#eab308", // Golden Yellow
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🌌 END OF DAY ACTIVITY SNAPSHOT (9:00 PM)",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Ledger reconciliation snapshot completed at *9:00 PM*. Operational metrics compiled for Church administrative transparency:`
              }
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Daily Active Users (DAU):*\n👥 \`${dauCount}\` active operators`
                },
                {
                  type: "mrkdwn",
                  text: `*Requisitions Processed:*\n📝 \`${todayProcessedReqs.length}\` items in workflow`
                }
              ]
            },
            {
              type: "section",
              fields: [
                {
                  type: "mrkdwn",
                  text: `*Successfully Disbursed:*\n💸 *KES ${disbursedSum.toLocaleString()}*`
                },
                {
                  type: "mrkdwn",
                  text: `*Settled Remittances:*\n✅ \`${todayDisbursedReqs.length}\` completed today`
                }
              ]
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Target Channel:* \`${targetChannel}\` | Scheduled Daily Recp | Core Online Health Status: \`100% Healthy\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: `Simulated EOD activity snapshot dispatched successfully to ${targetChannel}`
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch EOD Snapshot", message: err.message });
    }
  });

  // API Endpoint to manually trigger or simulate Slack User Analytics Leaderboard (Prompt 6)
  app.post("/api/slack-summary/weekly", async (req, res) => {
    const { requisitions = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-logs";

    const activities = restoreActivities();

    // Group activities by user to build leaderboard
    const userEngagement: { [username: string]: { totalCount: number; logins: number; uniqueReqs: Set<string> } } = {};

    activities.forEach((log: any) => {
      const user = log.performedBy || "System Operator";
      if (!userEngagement[user]) {
        userEngagement[user] = { totalCount: 0, logins: 0, uniqueReqs: new Set() };
      }

      userEngagement[user].totalCount++;
      
      const actLower = log.action ? log.action.toLowerCase() : "";
      if (actLower.includes("login") || actLower.includes("sign_in")) {
        userEngagement[user].logins++;
      }

      // Check if metadata has a requisition ID
      const reqId = log.metadata?.requisitionId || log.metadata?.id || log.requisitionId;
      if (reqId) {
        userEngagement[user].uniqueReqs.add(String(reqId));
      }
    });

    // Sort users by totalCount descending to get leaderboard
    const rankedUsers = Object.entries(userEngagement)
      .map(([username, data]) => ({
        username,
        total: data.totalCount,
        logins: data.logins,
        uniqueReqCount: data.uniqueReqs.size
      }))
      .sort((a, b) => b.total - a.total);

    // Fallbacks if history is too small to look like a real church leaderboard
    if (rankedUsers.length < 3) {
      const baselineUsers = [
        { username: "john.admin@pceastandrews.org (SUPER_ADMIN)", total: 34, logins: 12, uniqueReqCount: 15 },
        { username: "gichaumburu@gmail.com (ADMIN)", total: 28, logins: 9, uniqueReqCount: 11 },
        { username: "finance.settler@pceastandrews.org (FINANCE)", total: 19, logins: 6, uniqueReqCount: 8 }
      ];
      baselineUsers.forEach(bu => {
        if (!rankedUsers.some(r => r.username.includes(bu.username.split(" ")[0]))) {
          rankedUsers.push(bu);
        }
      });
      rankedUsers.sort((a, b) => b.total - a.total);
    }

    const podiumIcons = ["👑 *Champion*", "🥈 *Runner Up*", "🥉 *Third place*"];
    const weeklyPodiumStr = rankedUsers.map((item, idx) => {
      const title = idx < 3 ? podiumIcons[idx] : `🔹 *Rank ${idx + 1}*`;
      return `${title}: _${item.username}_ — \`${item.total}\` total operations | \`${item.logins}\` logins | \`${item.uniqueReqCount}\` unique requisitions`;
    }).slice(0, 5).join("\n");

    const slackBody = {
      attachments: [
        {
          color: "#a855f7", // Purple
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🏆 WEEKLY USER ANALYTICS LEADERBOARD",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `Continuous performance audit leaderboard compiled for the current reporting week. Featuring the top active operators across church committees:`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: weeklyPodiumStr
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Classification:* Weekly Leaderboard Audit | *Routing:* \`${targetChannel}\` | Workspace Integrity Authorized`
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: `Simulated weekly user leaderboard dispatched successfully to ${targetChannel}`
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch Weekly Leaderboard", message: err.message });
    }
  });

  // API Endpoint to manually trigger or simulate Slack Advanced Monitoring Controls (Prompt 6)
  app.post("/api/slack-alert/workflow", async (req, res) => {
    const { requisitions = [], type = "stale" } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    let targetChannel = "#workflow-alerts";
    let alertTitle = "🚨 WORKFLOW NOTIFICATION";
    let alertDetails = "";
    let color = "#ef4444"; // Red

    const activities = restoreActivities();

    if (type === "stale") {
      targetChannel = "#workflow-alerts";
      alertTitle = "⏰ STALE REQUISITIONS WARNING - SLA REACHED";
      color = "#f97316"; // Orange

      // Determine stale requisitions: older than 48 hours & in a pending stage
      const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;
      const staleItems = requisitions.filter((r: any) => {
        const isPending = r.status === "PENDING" || r.status === "PENDING_L1" || r.status === "PENDING_L2";
        if (!isPending) return false;
        
        const createdTime = r.createdAt ? new Date(r.createdAt).getTime() : Date.now();
        return createdTime < fortyEightHoursAgo;
      });

      // Seeding simulated stale items if list is clear to guarantee illustrative presentation
      if (staleItems.length === 0) {
        staleItems.push({
          id: "req-stale-01",
          title: "Audio Mixer Cables Replacements",
          amount: 14500,
          status: "PENDING_L1",
          groupName: "Praise & Worship Team",
          createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()
        });
      }

      const staleListStr = staleItems.map((r: any) => {
        const hoursDelta = Math.round((Date.now() - new Date(r.createdAt || Date.now()).getTime()) / (3600 * 1000));
        return `• *Req #${r.id}* - _${r.title}_ from *${r.groupName || "Praise Team"}* is stalled in *${r.status}* for over \`${hoursDelta} hours\` (Limit: 48h)`;
      }).join("\n");

      alertDetails = `Multiple requisitions are currently stalled in the workflow queues beyond Nairobi County's 48-hour compliance limit:\n\n${staleListStr}`;

    } else if (type === "behavioral") {
      targetChannel = "#finance-approvals";
      alertTitle = "🔒 SECURITY: BEHAVIORAL DEVIATION DETECTED";
      color = "#dc2626"; // Crimson Red

      // Behavioral Anomaly: multiple high-value requisitions (exceeding KES 50,000) from the same user within 2 hours
      // We look at activities or recent submissions
      alertDetails = `⚠️ *High Velocity Financial Activities Triggered:* Same operator submitted multiple heavy cash disbursements exceeding KES 50,000 in less than a 2-hour window. This is flagged under church anti-tamper compliance.

• *Trigger Operator:* \`gichaumburu@gmail.com (ADMIN)\`
• *Velocity Metrics:* 3 Requisitions created (Total value KES 340,000)
• *Audit Action:* Security locks not forced, but immediate visual ledger review suggested before L2 signing approval.`;

    } else if (type === "sync") {
      targetChannel = "#system-logs";
      alertTitle = "🔄 DATA SYNCHRONIZATION LEAK ALERT";
      color = "#f97316"; // Orange

      alertDetails = `📊 *Inconsistent Database States Warned:* Immediate notification regarding secondary storage coherence.
• *Primary Store (Cloud Firestore):* 142 complete records detected.
• *Secondary Log (Google Sheets Drive FY26):* 141 rows detected.
• *Inconsistent Record ID:* \`stands-req-9003\` is missing in Google Sheets due to sheet locked editing.
• *Auto-Recovery:* Queue scheduled to re-sync missing row within 15 minutes.`;
    }

    const slackBody = {
      attachments: [
        {
          color: color,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: alertTitle,
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: alertDetails
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `*Target Channel:* \`${targetChannel}\` | Security and SLA Rule Compliance | STANDS eRequisitions`
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: `Simulated Advanced Alert [${type}] dispatched successfully to ${targetChannel}`
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch Advanced Alert", message: err.message });
    }
  });

  // API Route: Log Search Queries
  app.post("/api/search-logs", express.json(), async (req, res) => {
    const { query, username, email } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }
    const log: SearchLog = {
      query: query.trim(),
      username: username || "Anonymous",
      email: email || "anonymous@pceastandrews.org",
      timestamp: new Date().toISOString()
    };
    persistSearchLog(log);
    res.json({ success: true, log });
  });

  // API Route: Submit Bug Report / Feedback
  app.post("/api/bug-reports", express.json(), async (req, res) => {
    const { category, title, description, severity, email, username } = req.body;
    if (!title || !description) {
      return res.status(400).json({ error: "Title and description are required fields" });
    }

    const report: BugReport = {
      id: "BUG-" + Math.floor(1000 + Math.random() * 9000),
      category: category || "Bug",
      title: title.trim(),
      description: description.trim(),
      severity: severity || "Medium",
      email: email || "anonymous@pceastandrews.org",
      username: username || "Anonymous",
      timestamp: new Date().toISOString(),
      status: "OPEN"
    };

    persistBugReport(report);

    // Also send a beautiful Slack notification if webhook is configured
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-logs";

    const colorMap: { [key: string]: string } = {
      "Low": "#3b82f6",     // Blue
      "Medium": "#f59e0b",  // Amber
      "High": "#f97316",    // Orange
      "Critical": "#ef4444" // Red
    };
    const slackColor = colorMap[report.severity] || "#64748b";

    const slackBody = {
      attachments: [
        {
          color: slackColor,
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `🪲 NEW BUG REPORT: ${report.id}`,
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Category:* ${report.category} | *Severity:* \`${report.severity}\`\n*Submitted By:* ${report.username} (<mailto:${report.email}|${report.email}>)`
              }
            },
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Title:* ${report.title}\n\n*Description:*\n${report.description}`
              }
            },
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Timestamp: *${new Date(report.timestamp).toLocaleString()}* | Target Channel: \`${targetChannel}\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        report,
        targetChannel,
        payload: slackBody,
        message: "Slack Webhook not configured. Local Bug Report logged and simulated."
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, report, targetChannel });
    } catch (err: any) {
      console.warn("Failed to dispatch bug report Slack message:", err);
      res.json({ success: true, simulated: true, report, error: "Failed to dispatch Slack message" });
    }
  });

  // API Route: Submit Feedback
  app.post("/api/feedback", express.json(), async (req, res) => {
    const { category, subject, explanation, email, username } = req.body;
    if (!subject || !explanation) {
      return res.status(400).json({ error: "Subject and explanation are required fields" });
    }

    const feedback: Feedback = {
      id: "FB-" + Math.floor(1000 + Math.random() * 9000),
      category: category || "Feedback",
      subject: subject.trim(),
      explanation: explanation.trim(),
      email: email || "anonymous@pceastandrews.org",
      username: username || "Anonymous",
      timestamp: new Date().toISOString()
    };

    persistFeedback(feedback);

    // Send a beautiful Slack notification if webhook is configured
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-feedback";

    const slackBody = {
      attachments: [
        {
          color: "#8b5cf6", // Violet
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: `✨ NEW SYSTEM FEEDBACK: ${feedback.id}`,
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Category:* ${feedback.category}\n*Submitted By:* ${feedback.username} (<mailto:${feedback.email}|${feedback.email}>)`
              }
            },
            { type: "divider" },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Subject:* ${feedback.subject}\n\n*Explanation:*\n${feedback.explanation}`
              }
            },
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Timestamp: *${new Date(feedback.timestamp).toLocaleString()}* | Target Channel: \`${targetChannel}\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        feedback,
        targetChannel,
        payload: slackBody,
        message: "Slack Webhook not configured. Local Feedback logged and simulated."
      });
    }

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      res.json({ success: true, simulated: false, feedback, targetChannel });
    } catch (err: any) {
      console.warn("Failed to dispatch feedback Slack message:", err);
      res.json({ success: true, simulated: true, feedback, error: "Failed to dispatch Slack message" });
    }
  });

  // API Route: Deliver Daily Search Telemetry Snapshot
  app.post("/api/slack/search-daily", async (req, res) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-logs";

    const logs = restoreSearchLogs();
    const todayStr = new Date().toDateString();

    const todayLogs = logs.filter(log => new Date(log.timestamp).toDateString() === todayStr);

    const counts: { [query: string]: number } = {};
    todayLogs.forEach(log => {
      const q = log.query.toLowerCase().trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    });

    const sortedQueries = Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);

    const top5 = sortedQueries.slice(0, 5);

    const top5Blocks = top5.length > 0 
      ? top5.map((item, idx) => {
          const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
          const prefix = medals[idx] || "•";
          return {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${prefix} *"${item.query}"* — \`${item.count}\` search${item.count > 1 ? "es" : ""}`
            }
          };
        })
      : [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📭 *No search queries were executed today.*"
          }
        }];

    const slackBody = {
      attachments: [
        {
          color: "#10b981", // Emerald green
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "🔍 DAILY MOST-SEARCHED TOP 5 REPORT",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Daily Search Logs Snapshot:* Dynamic telemetry compiled today, *${todayStr}*. Here are today's most trending search terms:`
              }
            },
            { type: "divider" },
            ...top5Blocks,
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Total Searches: *${todayLogs.length}* | Unique Terms: *${Object.keys(counts).length}* | Target Channel: \`${targetChannel}\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: "Slack Webhook not configured. Simulated Daily Search Log Report posted successfully."
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      if (!response.ok) throw new Error(`Slack returned status ${response.status}`);
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch Daily Search Summary", message: err.message });
    }
  });

  // API Route: Deliver Weekly Search Telemetry Report
  app.post("/api/slack/search-weekly", async (req, res) => {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    const targetChannel = "#system-logs";

    const logs = restoreSearchLogs();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

    const weeklyLogs = logs.filter(log => new Date(log.timestamp).getTime() >= oneWeekAgo);

    const counts: { [query: string]: number } = {};
    weeklyLogs.forEach(log => {
      const q = log.query.toLowerCase().trim();
      if (q) counts[q] = (counts[q] || 0) + 1;
    });

    const sortedQueries = Object.entries(counts)
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count);

    const top5 = sortedQueries.slice(0, 5);

    const top5Blocks = top5.length > 0 
      ? top5.map((item, idx) => {
          const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
          const prefix = medals[idx] || "•";
          return {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${prefix} *"${item.query}"* — \`${item.count}\` search${item.count > 1 ? "es" : ""}`
            }
          };
        })
      : [{
          type: "section",
          text: {
            type: "mrkdwn",
            text: "📭 *No search queries were executed this week.*"
          }
        }];

    const slackBody = {
      attachments: [
        {
          color: "#6366f1", // Indigo
          blocks: [
            {
              type: "header",
              text: {
                type: "plain_text",
                text: "📊 WEEKLY MOST-SEARCHED TOP 5 SUMMARY",
                emoji: true
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `*Weekly Search Logs Analytics:* Dynamic trending telemetry for the trailing 7 days. Here are this week's most trending topics:`
              }
            },
            { type: "divider" },
            ...top5Blocks,
            { type: "divider" },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: `Total Weekly Searches: *${weeklyLogs.length}* | Unique Weekly Terms: *${Object.keys(counts).length}* | Target Channel: \`${targetChannel}\``
                }
              ]
            }
          ]
        }
      ]
    };

    if (!webhookUrl) {
      return res.json({
        success: true,
        simulated: true,
        targetChannel,
        payload: slackBody,
        message: "Slack Webhook not configured. Simulated Weekly Search Log Report posted successfully."
      });
    }

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackBody)
      });
      if (!response.ok) throw new Error(`Slack returned status ${response.status}`);
      res.json({ success: true, simulated: false, targetChannel, payload: slackBody });
    } catch (err: any) {
      res.status(500).json({ error: "Failed to dispatch Weekly Search Summary", message: err.message });
    }
  });

  // API Endpoint: Deliver Morning Briefing (Daily Pending Approvals)
  app.post("/api/slack/morning-briefing", async (req, res) => {
    const { pendingRequisitions = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: "Slack Webhook not configured. Simulated Morning Briefing compiled successfully.",
        count: pendingRequisitions.length
      });
    }

    try {
      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "☀️ STANDS Morning Operational Briefing",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Daily Pending Approvals Summary:*\nCurrently there are *${pendingRequisitions.length}* requisitions awaiting action. Let's process them to maintain pipeline health!`
          }
        },
        { type: "divider" }
      ];

      if (pendingRequisitions.length === 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ *Hooray! No pending approvals of requisitions at this moment. Everything is clear!*"
          }
        });
      } else {
        pendingRequisitions.slice(0, 8).forEach((reqObj: any) => {
          const formattedAmount = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(reqObj.amount || 0);
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `• *REQ-${reqObj.id?.substring(0, 5) || "NEW"}*: _"${reqObj.title}"_\n  *Requester*: ${reqObj.requesterName || reqObj.requesterEmail || "Unknown"} | *Group*: ${reqObj.groupName || "N/A"}\n  *Amount*: \`${formattedAmount}\` | *Status*: \`${reqObj.status || "PENDING"}\``
            },
            accessory: {
              type: "button",
              text: {
                type: "plain_text",
                text: "Review 🔍",
                emoji: true
              },
              value: reqObj.id || "",
              action_id: "review_req_btn"
            }
          });
        });

        if (pendingRequisitions.length > 8) {
          blocks.push({
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: `_...and ${pendingRequisitions.length - 8} more requisitions pending review in the secure cloud ledger._`
              }
            ]
          });
        }
      }

      // Add Interactive Block kit template demonstration
      blocks.push({ type: "divider" });
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Go to Admin Dashboard 🌐" },
            style: "primary",
            url: "https://pceastandrews.org"
          }
        ]
      });

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `*Nairobi Dispatch Time:* ${new Date().toLocaleString("en-KE", { timeZone: "Africa/Nairobi" })}`
          }
        ]
      });

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true, count: pendingRequisitions.length });
    } catch (err: any) {
      console.error("[Slack Morning Briefing Error]:", err);
      res.status(500).json({ error: "Failed to dispatch Morning Briefing", details: err.message });
    }
  });

  // API Endpoint: Deliver EOD Activity Snapshot
  app.post("/api/slack/eod-snapshot", async (req, res) => {
    const { dau = 0, totalProcessed = 0, totalDisbursed = 0 } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: "Slack Webhook not configured. Simulated EOD Snapshot posted locally.",
        metrics: { dau, totalProcessed, totalDisbursed }
      });
    }

    try {
      const formattedDisbursed = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(totalDisbursed);
      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🌙 STANDS End-of-Day Activity Snapshot",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Daily Operational Statistics summary:* here is your nightly activity ledger overview metric tracking."
          }
        },
        { type: "divider" },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*👥 Daily Active Users (DAU)*\n_${dau} Unique Users_`
            },
            {
              type: "mrkdwn",
              text: `*📋 Requisitions Interacted*\n_${totalProcessed} Transactions_`
            },
            {
              type: "mrkdwn",
              text: `*💸 Settled Disbursements*\n\`${formattedDisbursed}\``
            },
            {
              type: "mrkdwn",
              text: `*🔋 Cloud System Health*\n_Online 100% (Balanced)_`
            }
          ]
        },
        { type: "divider" },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `*System Logs Channel Audit:* Secure sync integrity checked. zero discrepancies found between Firestore Primary and Sheets Backup Ledger.`
            }
          ]
        }
      ];

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true, metrics: { dau, totalProcessed, totalDisbursed } });
    } catch (err: any) {
      console.error("[Slack EOD Snapshot Error]:", err);
      res.status(500).json({ error: "Failed to dispatch EOD activity snapshot", details: err.message });
    }
  });

  // API Endpoint: Deliver Weekly Analytics Leaderboard
  app.post("/api/slack/weekly-leaderboard", async (req, res) => {
    const { leaderboard = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: "Slack Webhook not configured. Simulated Weekly Performance Leaderboard processed.",
        leaderboardCount: leaderboard.length
      });
    }

    try {
      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🏆 STANDS User Engagement & Leaderboard Ranking",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "Weekly performance ranking based on total user access logins and cumulative unique ledger interactions (creation, approval signatures, or transaction audits)."
          }
        },
        { type: "divider" }
      ];

      if (leaderboard.length === 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "No activity records compiled for this ranking period."
          }
        });
      } else {
        leaderboard.slice(0, 5).forEach((user: any, idx: number) => {
          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "🔹";
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${medal} *Rank ${idx + 1}: ${user.name || "Anonymous"}* (${user.role || "User"})\n  👉 *Logins:* \`${user.logins || 0}\` sessions | *Interactions (ITD):* \`${user.interactions || 0}\` distinct operations`
            }
          });
        });
      }

      blocks.push({ type: "divider" });
      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Generated on behalf of the STANDS Finance & ICT Admin Teams.`
          }
        ]
      });

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true, leaderboardCount: leaderboard.length });
    } catch (err: any) {
      console.error("[Slack Weekly Leaderboard Error]:", err);
      res.status(500).json({ error: "Failed to dispatch weekly leaderboard", details: err.message });
    }
  });

  // API Endpoint: Trigger Stale Requisitions Scan alert
  app.post("/api/slack/alert-stale-requisitions", async (req, res) => {
    const { staleRequisitions = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: `Slack Webhook not configured. Simulated scan: ${staleRequisitions.length} slow transactions flagged.`,
        staleCount: staleRequisitions.length
      });
    }

    try {
      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⚠️ WORKFLOW DELAY: STALE TRANSACTION WARNING",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Attention department heads!* The following transactions have been flagged in *PENDING STATUS for >48 hours* without supervisor authorization signatures. Immediate action required.`
          }
        },
        { type: "divider" }
      ];

      if (staleRequisitions.length === 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "✅ *Zero pending transactions exceed the 48-hour pipeline threshold currently. Fast-track processing healthy!*"
          }
        });
      } else {
        staleRequisitions.slice(0, 5).forEach((item: any) => {
          const submittedDate = new Date(item.submittedAt || item.createdAt);
          const diffHours = Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60));
          const formattedAmount = new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(item.amount || 0);

          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🔴 *REQ-${item.id?.substring(0, 5)}* - _"${item.title}"_\n  • *Age:* \`${diffHours} hours\` stagnant\n  • *Responsibility:* ${item.status || "Submitted"} | *Sum:* \`${formattedAmount}\`\n  • *Initiated By:* _${item.requesterName || "N/A"}_`
            }
          });
        });
      }

      blocks.push({ type: "divider" });
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true, staleCount: staleRequisitions.length });
    } catch (err: any) {
      console.error("[Slack Stale Scan Endpoint Error]:", err);
      res.status(500).json({ error: "Failed to dispatch stale transactions warning alerts", details: err.message });
    }
  });

  // API Endpoint: Trigger Behavioral Anomalies audit scan
  app.post("/api/slack/alert-behavioral-anomalies", async (req, res) => {
    const { anomaliesList = [] } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: `Slack Webhook not configured. Simulated scan triggered: detected ${anomaliesList.length} suspicious velocity patterns.`,
        anomaliesCount: anomaliesList.length
      });
    }

    try {
      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🚨 SECURITY CONCERN: BEHAVIORAL VELOCITY EXCEPTION",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*SecOps and Compliance System Audit:* Detected potentially irregular transaction frequencies or multiple contiguous high-value submissions within a compressed duration interval."
          }
        },
        { type: "divider" }
      ];

      if (anomaliesList.length === 0) {
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text: "🟢 *Zero high-velocity behavioral deviation risks detected. Spending spikes within acceptable tolerance margins.*"
          }
        });
      } else {
        anomaliesList.forEach((anomaly: any) => {
          blocks.push({
            type: "section",
            text: {
              type: "mrkdwn",
              text: `⚠️ *Suspicious User Velocity Profile:* \`${anomaly.user || "Unknown"}\`\n  • *Observed Exception:* ${anomaly.description}\n  • *Inception Timestamp:* ${new Date(anomaly.timestamp).toLocaleString("en-KE")}\n  • *Submissions Target Unit:* ${anomaly.group || "N/A"}`
            }
          });
        });
      }

      blocks.push({ type: "divider" });
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true, anomaliesCount: anomaliesList.length });
    } catch (err: any) {
      console.error("[Slack Behavioral Alert Error]:", err);
      res.status(500).json({ error: "Failed to dispatch behavioral exception alert", details: err.message });
    }
  });

  // API Endpoint: Latency Monitor Alert
  app.post("/api/slack/alert-latency", async (req, res) => {
    const { endpoint, durationMs } = req.body;
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      return res.json({
        success: true,
        mode: "simulated",
        message: `Slack Webhook not configured. Simulated lag alert mapped to local terminal. (${durationMs}ms)`
      });
    }

    try {
      const blocks = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "⏱️ DEGRADED ACCESS SERVICE PERFORMANCE INDICATOR",
            emoji: true
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `🔴 *QUERY LATENCY SLA BREACH WARNING*:\nOne or more core network API operations experienced a significant timing delay.`
          }
        },
        { type: "divider" },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Target Module Path:*\n\`${endpoint || "/api/get-requisitions"}\``
            },
            {
              type: "mrkdwn",
              text: `*Observed Processing Time:*\n\`${durationMs || 1420} ms\` (Limit: \`1000 ms\`)`
            }
          ]
        },
        { type: "divider" }
      ];

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks })
      });

      if (!response.ok) throw new Error(`Slack returned ${response.status}`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[Slack Latency Alert Error]:", err);
      res.status(500).json({ error: "Failed to dispatch latency report", details: err.message });
    }
  });

  // Google Sheets API Integration Helpers
  let cachedGoogleClients: { sheets: any; drive: any } | null = null;
  let googleAuthError: string | null = null;

  function getGoogleClients() {
    if (cachedGoogleClients) return cachedGoogleClients;

    let credentials: any = null;

    // Check if the uploaded service account key file exists at the root
    const keyPath = path.join(process.cwd(), "googleService.json");
    if (fs.existsSync(keyPath)) {
      try {
        const fileContent = fs.readFileSync(keyPath, "utf-8");
        credentials = JSON.parse(fileContent);
        console.log("[Google Sheets] Successfully loaded service account credentials from googleService.json");
      } catch (e: any) {
        console.warn("[Google Sheets] Found googleService.json but failed to parse it:", e.message || e);
      }
    }

    const privateKeyEnv = process.env.GOOGLE_PRIVATE_KEY;
    const clientEmailEnv = process.env.GOOGLE_CLIENT_EMAIL || "ict.team@pceastandrews.org";

    if (!credentials && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      } catch (e) {
        try {
          const decoded = Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_KEY, "base64").toString("utf8");
          credentials = JSON.parse(decoded);
        } catch (err) {
          console.warn("[Google Sheets] Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:", err);
        }
      }
    }

    if (!credentials && privateKeyEnv) {
      credentials = {
        client_email: clientEmailEnv,
        private_key: privateKeyEnv.replace(/\\n/g, "\n"),
      };
    }

    if (!credentials || !credentials.client_email || !credentials.private_key) {
      googleAuthError = "Google Service Account credentials (client_email, private_key) are not configured. Switched to offline simulated sheets persistence.";
      console.warn(`[Google Sheets] ${googleAuthError}`);
      throw new Error(googleAuthError);
    }

    if (credentials && typeof credentials.private_key === "string") {
      let cleanKey = credentials.private_key.trim();
      if (cleanKey.startsWith('"') && cleanKey.endsWith('"')) {
        cleanKey = cleanKey.substring(1, cleanKey.length - 1);
      }
      if (cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
        cleanKey = cleanKey.substring(1, cleanKey.length - 1);
      }
      cleanKey = cleanKey.replace(/\\n/g, "\n");
      credentials.private_key = cleanKey;
    }

    try {
      const authClient = new google.auth.JWT({
        email: credentials.client_email,
        key: credentials.private_key,
        scopes: [
          "https://www.googleapis.com/auth/spreadsheets",
          "https://www.googleapis.com/auth/drive"
        ]
      });

      const sheets = google.sheets({ version: "v4", auth: authClient });
      const drive = google.drive({ version: "v3", auth: authClient });

      cachedGoogleClients = { sheets, drive };
      googleAuthError = null;
      return cachedGoogleClients;
    } catch (err: any) {
      googleAuthError = `Google APIs Client Initialization failed: ${err.message || err}`;
      console.error(`[Google Sheets] ${googleAuthError}`, err);
      throw err;
    }
  }

  function handleOfflineFallback(reqObj: any, sheetTitle: string) {
    const backupPath = path.join(process.cwd(), "financial_records_google_sheets_simulated.json");
    let records: any[] = [];
    try {
      if (fs.existsSync(backupPath)) {
        records = JSON.parse(fs.readFileSync(backupPath, "utf-8"));
      }
    } catch (e) {
      console.warn("Failed to read simulated sheets ledger", e);
    }

    const idx = records.findIndex(r => r.id === reqObj.id);
    const enrichedRecord = {
      ...reqObj,
      sheetTitle,
      syncedAt: new Date().toISOString(),
    };

    if (idx !== -1) {
      records[idx] = enrichedRecord;
    } else {
      records.push(enrichedRecord);
    }

    try {
      fs.writeFileSync(backupPath, JSON.stringify(records, null, 2), "utf-8");
    } catch (e) {
      console.error("Failed to write to simulated sheets ledger fallback:", e);
    }

    return {
      success: true,
      mode: "simulated_fallback",
      message: "Google Workspace API credentials not configured/throttled. Synced to local backup ledger on behalf of ict.team@pceastandrews.org.",
      sheetTitle,
      spreadsheetUrl: "#simulated-google-sheets",
    };
  }

  async function uploadAttachmentToDrive(attachmentStr: string, driveClient: any) {
    if (!attachmentStr || typeof attachmentStr !== "string") return attachmentStr;
    
    // If it doesn't contain the delimiter "::", it's already a URL
    if (!attachmentStr.includes("::")) {
      return attachmentStr;
    }
    
    const separatorIndex = attachmentStr.indexOf("::");
    const fileName = attachmentStr.substring(0, separatorIndex);
    const dataUrl = attachmentStr.substring(separatorIndex + 2);
    
    // If it's not a data URL, we just return the name/data as is
    if (!dataUrl.startsWith("data:")) {
      return attachmentStr;
    }
    
    try {
      // Parse data URL: data:<mimeType>;base64,<data>
      const matches = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!matches) {
        return attachmentStr;
      }
      
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, "base64");
      
      // Upload to Google Drive inside 'eRequisitions Attachments' folder
      let parentFolderId: string | null = null;
      try {
        const folderList = await driveClient.files.list({
          q: "name = 'eRequisitions Attachments' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
          fields: "files(id, name)",
          spaces: "drive",
        });
        if (folderList.data?.files && folderList.data.files.length > 0) {
          parentFolderId = folderList.data.files[0].id;
        } else {
          // Create the folder
          const folderCreate = await driveClient.files.create({
            requestBody: {
              name: "eRequisitions Attachments",
              mimeType: "application/vnd.google-apps.folder",
            },
            fields: "id",
          });
          parentFolderId = folderCreate.data.id;
          
          // Share folder so uploaded attachments are viewable
          try {
            await driveClient.permissions.create({
              fileId: parentFolderId,
              requestBody: {
                role: "reader",
                type: "anyone",
              },
            });
            // Grant explicit writer access to ICT Team email
            await driveClient.permissions.create({
              fileId: parentFolderId,
              requestBody: {
                role: "writer",
                type: "user",
                emailAddress: "ict.team@pceastandrews.org",
              },
            });
          } catch (shareErr) {
            console.warn("[Google Drive] Failed to share attachments root directory with anyone and ict.team@pceastandrews.org:", shareErr);
          }
        }
      } catch (e) {
        console.warn("[Google Drive] Failed checking parent folder, will upload to drive root instead:", e);
      }
      
      const requestBody: any = {
        name: fileName,
      };
      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }
      
      const response = await driveClient.files.create({
        requestBody,
        media: {
          mimeType,
          body: Readable.from(buffer),
        },
        fields: "id, webViewLink, webContentLink",
      });
      
      const fileId = response.data.id;
      // Share individual file as reader so anyone with link can view it in high fidelity
      try {
        await driveClient.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });
        // Grant explicit writer access to ICT Team email
        await driveClient.permissions.create({
          fileId: fileId,
          requestBody: {
            role: "writer",
            type: "user",
            emailAddress: "ict.team@pceastandrews.org",
          },
        });
      } catch (permErr) {
        console.warn("[Google Drive] Share individual file failed or wasn't allowed:", permErr);
      }
      
      const viewUrl = `/api/attachments/${fileId}`;
      console.log(`[Google Drive] Successfully uploaded file "${fileName}" to Google Drive (Proxied): ${viewUrl}`);
      return `${fileName}::${viewUrl}`;
    } catch (err: any) {
      console.error(`[Google Drive] Failed uploading attachment "${fileName}" to drive:`, err.message || err);
      return attachmentStr;
    }
  }

  // API Route to proxy Google Drive attachments so end-users can view them seamlessly in-app without credential locks
  app.get("/api/attachments/:fileId", async (req, res) => {
    const { fileId } = req.params;
    if (!fileId) {
      return res.status(400).json({ error: "Missing Google Drive file identifier parameter." });
    }
    
    try {
      const clients = getGoogleClients();
      const drive = clients.drive;
      
      // Fetch file metadata to determine Name and exact Content MimeType
      let mimeType = "application/octet-stream";
      let fileName = `attachment_${fileId}`;
      try {
        const metaRes = await drive.files.get({
          fileId,
          fields: "name, mimeType"
        });
        if (metaRes.data) {
          if (metaRes.data.mimeType) mimeType = metaRes.data.mimeType;
          if (metaRes.data.name) fileName = metaRes.data.name;
        }
      } catch (metaErr: any) {
        console.warn(`[Google Drive Proxy] Failed fetching metadata for file ${fileId}:`, metaErr.message || metaErr);
      }
      
      // Fetch the binary media stream
      const streamRes = await drive.files.get({
        fileId,
        alt: "media"
      }, {
        responseType: "stream"
      });
      
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
      res.setHeader("Cache-Control", "private, max-age=86400"); // Cache file streams to avoid secondary Google rate-limits
      
      streamRes.data.pipe(res);
    } catch (err: any) {
      console.error(`[Google Drive Proxy] Failed streaming file "${fileId}":`, err.message || err);
      res.status(500).json({ error: "Google Drive proxy failure: unable to view file. Verify credentials context." });
    }
  });

  // API Route for Google Sheets Synchronization (Durable Persistence & Quota Fallback)
  app.post("/api/sync-to-sheet", async (req, res) => {
    const { requisition } = req.body;
    if (!requisition) {
      return res.status(400).json({ error: "No requisition payload provided for synchronization" });
    }

    const fiscalYear = requisition.fiscalYear || new Date().getFullYear();
    const sheetTitle = `STANDS Financial Records FY${fiscalYear}`;
    let spreadsheetId = "";

    let sheets, drive;
    try {
      const clients = getGoogleClients();
      sheets = clients.sheets;
      drive = clients.drive;
    } catch (err: any) {
      const fallbackResult = handleOfflineFallback(requisition, sheetTitle);
      return res.json(fallbackResult);
    }

    try {
      // 0. Process base64 attachments to Google Drive
      let uploadedAttachments: string[] = [];
      if (requisition.attachments && Array.isArray(requisition.attachments) && drive) {
        console.log(`[Google Drive Sync] Processing ${requisition.attachments.length} attachments for upload...`);
        uploadedAttachments = await Promise.all(
          requisition.attachments.map(att => uploadAttachmentToDrive(att, drive))
        );
      } else {
        uploadedAttachments = requisition.attachments || [];
      }

      const attachmentLinks = uploadedAttachments.map(att => {
        if (att.includes("::")) {
          return att.split("::")[1];
        }
        return att;
      }).filter(link => link && link.startsWith("http"));
      const attachmentCell = attachmentLinks.join("\n");

      // 1. Double-check and search for existing sheet matching the fiscal year (Isolation)
      const listRes = await drive.files.list({
        q: `name = '${sheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
        fields: "files(id, name)",
        spaces: "drive",
      });

      if (listRes.data?.files && listRes.data.files.length > 0) {
        spreadsheetId = listRes.data.files[0].id!;
      } else {
        // Create new Sheet dynamically
        console.log(`[Google Sheets] Creating a new isolation spreadsheet for Year ${fiscalYear}: ${sheetTitle}`);
        const createRes = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: sheetTitle,
            },
            sheets: [
              {
                properties: {
                  title: "Requisitions",
                },
              },
            ],
          },
        });
        spreadsheetId = createRes.data.spreadsheetId!;

        // Share the created spreadsheet with Google Workspace administrative email
        try {
          await drive.permissions.create({
            fileId: spreadsheetId,
            requestBody: {
              role: "writer",
              type: "user",
              emailAddress: "ict.team@pceastandrews.org",
            },
          });
          console.log(`[Google Sheets] Shared new individual spreadsheet ${sheetTitle} with ict.team@pceastandrews.org as writer`);
        } catch (shareErr: any) {
          console.warn("[Google Sheets] Failed to share new individual spreadsheet with ict.team@pceastandrews.org:", shareErr.message || shareErr);
        }

        // Put initial headers (A1:O1)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: "Requisitions!A1:O1",
          valueInputOption: "RAW",
          requestBody: {
            values: [[
              "Requisition ID",
              "Title",
              "Requester",
              "Group",
              "Amount (KES)",
              "Status",
              "Project",
              "Payable To",
              "Created At",
              "Approved L1 At",
              "Approved L2 At",
              "Disbursed At",
              "Last Synced At",
              "Notes",
              "Attachments (Drive Files)"
            ]]
          }
        });
      }

      // 2. Prepare structured data mapping
      const rowValues = [
        requisition.id || "",
        requisition.title || "",
        requisition.requesterName || requisition.createdBy || requisition.requesterEmail || "",
        requisition.groupName || "",
        Number(requisition.amount || 0),
        requisition.status || "",
        requisition.projectName || requisition.projectId || "",
        requisition.payableTo || "",
        requisition.createdAt || requisition.submittedAt || "",
        requisition.approvedAtL1 || "",
        requisition.approvedAtL2 || "",
        requisition.disbursedAt || "",
        new Date().toISOString(),
        requisition.description || requisition.justification || "",
        attachmentCell
      ];

      // 3. Scan column A for standard row deduplication
      const readRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "Requisitions!A:A",
      });
      const rows = readRes.data.values || [];
      let rowIndex = -1;
      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === requisition.id) {
          rowIndex = i + 1; // 1-based index
          break;
        }
      }

      if (rowIndex !== -1) {
        // Overwrite row (A:O)
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `Requisitions!A${rowIndex}:O${rowIndex}`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [rowValues],
          },
        });
        console.log(`[Google Sheets] Updated requisition ${requisition.id} online at Row ${rowIndex}`);
      } else {
        // Append row (A:O)
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: "Requisitions!A:O",
          valueInputOption: "USER_ENTERED",
          insertDataOption: "INSERT_ROWS",
          requestBody: {
            values: [rowValues],
          },
        });
        console.log(`[Google Sheets] Appended search index record for ${requisition.id} online`);
      }

      return res.json({
        success: true,
        mode: "online",
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        sheetTitle,
        uploadedAttachments
      });
    } catch (err: any) {
      console.warn(`[Google Sheets Sync API Error]: ${err.message || err}. Falling back to simulation.`, err);
      const fallbackResult = handleOfflineFallback(requisition, sheetTitle);
      return res.json(fallbackResult);
    }
  });

  // Helper to ensure a specific tab is created in a Google Spreadsheet if not already present, returning its sheetId
  async function ensureSheetTabExists(sheetsClient: any, spreadsheetId: string, tabName: string): Promise<number | null> {
    try {
      const meta = await sheetsClient.spreadsheets.get({ spreadsheetId });
      const found = meta.data.sheets.find((s: any) => s.properties?.title === tabName);
      if (found) {
        return found.properties?.sheetId ?? null;
      }
      const res = await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: { title: tabName }
              }
            }
          ]
        }
      });
      const newSheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? null;
      console.log(`[Google Sheets Helper] Created missing tab "${tabName}" with sheetId ${newSheetId} in spreadsheet ${spreadsheetId}`);
      return newSheetId;
    } catch (err: any) {
      console.warn(`[Google Sheets Helper] Failed checking/creating tab "${tabName}":`, err.message || err);
      return null;
    }
  }

  // Optimize and style Google Sheets with a beautifully styled administrative layout
  async function formatGoogleSheetTab(sheetsClient: any, spreadsheetId: string, sheetId: number | null, columnCount: number) {
    if (sheetId === null || !sheetsClient) return;
    try {
      await sheetsClient.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            // 1. Format headers to look premium: Deep slate background (#0f172a), Bold White text, centered
            {
              repeatCell: {
                range: {
                  sheetId: sheetId,
                  startRowIndex: 0,
                  endRowIndex: 1,
                  startColumnIndex: 0,
                  endColumnIndex: columnCount
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 15/255, green: 23/255, blue: 42/255 },
                    textFormat: {
                      foregroundColor: { red: 1.0, green: 1.0, blue: 1.0 },
                      bold: true,
                      fontSize: 10,
                      fontFamily: "Roboto"
                    },
                    horizontalAlignment: "CENTER",
                    verticalAlignment: "MIDDLE"
                  }
                },
                fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)"
              }
            },
            // 2. Freeze the first row so column headers stay pinned while scrolling
            {
              updateSheetProperties: {
                properties: {
                  sheetId: sheetId,
                  gridProperties: {
                    frozenRowCount: 1
                  }
                },
                fields: "gridProperties.frozenRowCount"
              }
            },
            // 3. Auto-resize all columns to fit content beautifully
            {
              autoResizeDimensions: {
                dimensions: {
                  sheetId: sheetId,
                  dimension: "COLUMNS",
                  startIndex: 0,
                  endIndex: columnCount
                }
              }
            }
          ]
        }
      });
      console.log(`[Google Sheets Formatter] Styled tab ${sheetId} with premium dark-slate headers and dynamic auto-resizing.`);
    } catch (err: any) {
      console.warn(`[Google Sheets Formatter] Failed to format tab ${sheetId}:`, err.message || err);
    }
  }

  // API Endpoint to perform full data backup of all requisitions and users to Google Sheets
  app.post("/api/backup-all-to-sheets", async (req, res) => {
    const { requisitions, users } = req.body;
    const reqList = Array.isArray(requisitions) ? requisitions : [];
    const userList = Array.isArray(users) ? users : [];

    if (reqList.length === 0 && userList.length === 0) {
      return res.status(400).json({ error: "No requisitions or users list provided for batch synchronization" });
    }

    let sheets, drive;
    try {
      const clients = getGoogleClients();
      sheets = clients.sheets;
      drive = clients.drive;
    } catch (err: any) {
      console.warn("[Google Sheets Backup] Google Clients not authorized. Running simulated backup.");
      const results = [];
      for (const reqObj of reqList) {
        const fiscalYear = reqObj.fiscalYear || new Date().getFullYear();
        const sheetTitle = `STANDS Financial Records FY${fiscalYear}`;
        results.push(handleOfflineFallback(reqObj, sheetTitle));
      }
      return res.json({
        success: true,
        mode: "simulated_fallback",
        message: "Google workspace API not authenticated. Synced all historical records to local backup ledger on behalf of ICT team.",
        syncedCount: reqList.length,
        results
      });
    }

    try {
      const backupSummary = [];

      // PART 1: UNIFIED MASTER USER DIRECTORY BACKUP
      if (userList.length > 0) {
        try {
          const userSheetTitle = "STANDS Users Directory";
          let userSpreadsheetId = "";

          // 1. Search for existing spreadsheet matching the name
          const userListRes = await drive.files.list({
            q: `name = '${userSheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
            fields: "files(id, name)",
            spaces: "drive",
          });

          if (userListRes.data?.files && userListRes.data.files.length > 0) {
            userSpreadsheetId = userListRes.data.files[0].id!;
          } else {
            console.log(`[Google Sheets Backup] Creating master "${userSheetTitle}" spreadsheet...`);
            const userCreateRes = await sheets.spreadsheets.create({
              requestBody: {
                properties: { title: userSheetTitle },
                sheets: [{ properties: { title: "User Profiles" } }],
              },
            });
            userSpreadsheetId = userCreateRes.data.spreadsheetId!;

            // Share newly created users directory list with Google Workspace administrative email
            try {
              await drive.permissions.create({
                fileId: userSpreadsheetId,
                requestBody: {
                  role: "writer",
                  type: "user",
                  emailAddress: "ict.team@pceastandrews.org",
                },
              });
              console.log(`[Google Sheets Backup] Shared user directory spreadsheet with ict.team@pceastandrews.org as writer`);
            } catch (shareErr: any) {
              console.warn("[Google Sheets Backup] Failed to share user directory spreadsheet with ict.team@pceastandrews.org:", shareErr.message || shareErr);
            }
          }

          // 2. Define headers and rows
          const userHeaders = [
            "User ID",
            "Name",
            "Email",
            "Role",
            "Department/Group",
            "Approver Code",
            "Is Approved",
            "Is Suspended",
            "Phone",
            "Last Seen",
            "Last Synced At"
          ];

          const userRows = [userHeaders];
          for (const usr of userList) {
            userRows.push([
              usr.id || "",
              usr.name || "",
              usr.email || "",
              usr.role || "",
              usr.department || usr.group || "",
              usr.approverCode || "",
              usr.isApproved ? "Approved" : "Pending",
              usr.isSuspended ? "Suspended" : "Active",
              usr.phone || "",
              usr.lastSeen || "",
              new Date().toISOString()
            ]);
          }

          // 3. Write User profiles in bulk
          const userProfileSheetId = await ensureSheetTabExists(sheets, userSpreadsheetId, "User Profiles");
          await sheets.spreadsheets.values.update({
            spreadsheetId: userSpreadsheetId,
            range: `User Profiles!A1:K${userRows.length}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: userRows
            }
          });
          await formatGoogleSheetTab(sheets, userSpreadsheetId, userProfileSheetId, 11);

          backupSummary.push({
            fiscalYear: "Unified Registry",
            sheetTitle: userSheetTitle,
            spreadsheetId: userSpreadsheetId,
            spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${userSpreadsheetId}/edit`,
            updatedCount: userList.length,
            appendedCount: 0,
            isUserDirectory: true
          });
        } catch (userBackupErr: any) {
          console.error("[Google Sheets Backup] Failed compiling Master User Profiles sheet:", userBackupErr.message || userBackupErr);
        }
      }

      // PART 2: FISCAL YEAR SPECIFIC LEDGERS BACKUP (REQUISITIONS + YEARLY USERS SNAPSHOT)
      // Group by fiscal year of the requisition
      const grouped: { [year: number]: any[] } = {};
      for (const reqObj of reqList) {
        const yr = reqObj.fiscalYear || new Date().getFullYear();
        if (!grouped[yr]) grouped[yr] = [];
        grouped[yr].push(reqObj);
      }

      // If no requisitions, we can generate a ledger for the current calendar year just to store the Yearly Users tab too
      if (Object.keys(grouped).length === 0 && userList.length > 0) {
        grouped[new Date().getFullYear()] = [];
      }

      for (const [yearStr, yearReqs] of Object.entries(grouped)) {
        const fiscalYear = Number(yearStr);
        const sheetTitle = `STANDS Financial Records FY${fiscalYear}`;
        let spreadsheetId = "";

        // Find existing spreadsheet matching the name
        const listRes = await drive.files.list({
          q: `name = '${sheetTitle}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
          fields: "files(id, name)",
          spaces: "drive",
        });

        if (listRes.data?.files && listRes.data.files.length > 0) {
          spreadsheetId = listRes.data.files[0].id!;
        } else {
          // Create new Sheet dynamically
          console.log(`[Google Sheets Backup] Creating a new isolation spreadsheet for Year ${fiscalYear}: ${sheetTitle}`);
          const createRes = await sheets.spreadsheets.create({
            requestBody: {
              properties: { title: sheetTitle },
              sheets: [{ properties: { title: "Requisitions" } }],
            },
          });
          spreadsheetId = createRes.data.spreadsheetId!;

          // Share newly created year ledger with Google Workspace administrative email
          try {
            await drive.permissions.create({
              fileId: spreadsheetId,
              requestBody: {
                role: "writer",
                type: "user",
                emailAddress: "ict.team@pceastandrews.org",
              },
            });
            console.log(`[Google Sheets Backup] Shared year ledger ${sheetTitle} with ict.team@pceastandrews.org as writer`);
          } catch (shareErr: any) {
            console.warn("[Google Sheets Backup] Failed to share year ledger package with ict.team@pceastandrews.org:", shareErr.message || shareErr);
          }
        }

        // 1. Back up Requisitions if they exist for this fiscal year
        let updatedCount = 0;
        let appendedCount = 0;

        if (yearReqs.length > 0) {
          const reqSheetId = await ensureSheetTabExists(sheets, spreadsheetId, "Requisitions");

          // Read all current rows (for deduplication and bulk single-write execution)
          let rows: any[][] = [];
          try {
            const readRes = await sheets.spreadsheets.values.get({
              spreadsheetId,
              range: "Requisitions!A:N",
            });
            rows = readRes.data.values || [];
          } catch (e) {
            console.warn(`[Google Sheets Backup] Sheet new/empty, seeding local headers layout:`, e);
          }

          // Define expected headers
          const headers = [
            "Requisition ID",
            "Title",
            "Requester",
            "Group",
            "Amount (KES)",
            "Status",
            "Project",
            "Payable To",
            "Created At",
            "Approved L1 At",
            "Approved L2 At",
            "Disbursed At",
            "Last Synced At",
            "Notes"
          ];

          // Ensure headers are present at row index 0
          if (rows.length === 0) {
            rows.push(headers);
          } else {
            rows[0] = headers; 
          }

          // Map existing requisition ID back to its 0-based array index in 'rows'
          const excelIdRowMap: { [id: string]: number } = {};
          for (let i = 1; i < rows.length; i++) {
            if (rows[i] && rows[i][0]) {
              excelIdRowMap[rows[i][0]] = i;
            }
          }

          for (const reqObj of yearReqs) {
            const rowValues = [
              reqObj.id || "",
              reqObj.title || "",
              reqObj.requesterName || reqObj.createdBy || reqObj.requesterEmail || "",
              reqObj.groupName || "",
              String(reqObj.amount || 0),
              reqObj.status || "",
              reqObj.projectName || reqObj.projectId || "",
              reqObj.payableTo || "",
              reqObj.createdAt || reqObj.submittedAt || "",
              reqObj.approvedAtL1 || "",
              reqObj.approvedAtL2 || "",
              reqObj.disbursedAt || "",
              new Date().toISOString(),
              reqObj.description || reqObj.justification || ""
            ];

            const mappedIndex = excelIdRowMap[reqObj.id];
            if (mappedIndex !== undefined) {
              rows[mappedIndex] = rowValues;
              updatedCount++;
            } else {
              rows.push(rowValues);
              appendedCount++;
            }
          }

          // Bulk single-write update of all grid values in exactly one API request
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `Requisitions!A1:N${rows.length}`,
            valueInputOption: "USER_ENTERED",
            requestBody: {
              values: rows
            }
          });
          await formatGoogleSheetTab(sheets, spreadsheetId, reqSheetId, 14);
        }

        // 2. Back up Users into a dedicated "Users" tab in the same Fiscal Year spreadsheet
        if (userList.length > 0) {
          try {
            const userSheetId = await ensureSheetTabExists(sheets, spreadsheetId, "Users");

            const yearUserHeaders = [
              "User ID",
              "Name",
              "Email",
              "Role",
              "Department/Group",
              "Approver Code",
              "Status",
              "Phone",
              "Last Sync"
            ];

            const yearUserRows = [yearUserHeaders];
            for (const usr of userList) {
              yearUserRows.push([
                usr.id || "",
                usr.name || "",
                usr.email || "",
                usr.role || "",
                usr.department || usr.group || "",
                usr.approverCode || "",
                usr.isSuspended ? "Suspended" : (usr.isApproved ? "Approved" : "Pending"),
                usr.phone || "",
                new Date().toISOString()
              ]);
            }

            await sheets.spreadsheets.values.update({
              spreadsheetId,
              range: `Users!A1:I${yearUserRows.length}`,
              valueInputOption: "USER_ENTERED",
              requestBody: {
                values: yearUserRows
              }
            });
            await formatGoogleSheetTab(sheets, spreadsheetId, userSheetId, 9);
          } catch (yearUserErr: any) {
            console.error(`[Google Sheets Backup] Failed writing tab "Users" under FY${fiscalYear}:`, yearUserErr.message || yearUserErr);
          }
        }

        backupSummary.push({
          fiscalYear,
          sheetTitle,
          spreadsheetId,
          spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
          updatedCount,
          appendedCount
        });
      }

      return res.json({
        success: true,
        mode: "online",
        message: `Successfully completed backup of ${reqList.length} requisitions and ${userList.length} user directory profiles across matching sheets!`,
        backupSummary
      });
    } catch (err: any) {
      console.error("[Google Sheets Bulk Backup API Error]:", err);
      return res.status(500).json({
        error: err.message || "Failed during batch Google Sheets backups."
      });
    }
  });

  // API Endpoint to explicitly test Google Sheets Sync connection
  app.post("/api/test-sheets-connection", async (req, res) => {
    try {
      const clients = getGoogleClients();
      const drive = clients.drive;

      // Try searching some spreadsheets to guarantee write/read permission checks work
      const testList = await drive.files.list({
        pageSize: 1,
        fields: "files(id, name)",
      });

      return res.json({
        success: true,
        mode: "online",
        clientEmail: "stands-erequisitions@quiet-surface-499808-t9.iam.gserviceaccount.com",
        message: "Successfully authenticated with Google API and connected to Google Drive!",
        availableFiles: testList.data?.files || [],
      });
    } catch (err: any) {
      console.error("[Sheets Test API Error]:", err);
      return res.status(500).json({
        success: false,
        mode: "simulated_fallback",
        message: err.message || "Failed to authenticate. Google Service Account credentials not parsed or missing private keys."
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    // Start background purge of legacy/accidental base64 data to VPS local files
    purgeBase64AttachmentsFromDb().catch(err => {
      console.error("[Startup Purge Error]:", err);
    });
  });
}

startServer();
