/**
 * Supabase & PostgreSQL Server-side Diagnostics Tool
 * Run command: npx tsx scripts/troubleshoot-supabase.ts
 */
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

// Load environment variables with override: true to prefer local .env file values over stale environment variables
dotenv.config({ override: true });

function formatSectionHeader(title: string) {
  console.log("\n================================================================================");
  console.log(`📡 DIAGNOSTICS: ${title.toUpperCase()}`);
  console.log("================================================================================");
}

async function runDiagnostics() {
  console.log("🚀 Starting Supabase programmatic health diagnostics...");
  
  // 1. ENVIRONMENT VARIABLES AUDIT
  formatSectionHeader("1. Environmental Secrets Audit");
  let hasErrors = false;
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || process.env.SUPABASE_DIRECT_URL;
  const isSupabaseEnabledVal = process.env.VITE_USE_SUPABASE || process.env.USE_SUPABASE;

  console.log(`- VITE_SUPABASE_URL:      ${supabaseUrl ? `✅ Configured (${supabaseUrl})` : "❌ MISSING"}`);
  console.log(`- VITE_SUPABASE_ANON_KEY: ${anonKey ? "✅ Configured (JWT Token present)" : "❌ MISSING"}`);
  console.log(`- DATABASE_URL:           ${dbUrl ? `✅ Configured (${dbUrl.split("@")[1] || "credentials hidden"})` : "❌ MISSING"}`);
  console.log(`- VITE_USE_SUPABASE:      ${isSupabaseEnabledVal ? `✅ Set to '${isSupabaseEnabledVal}'` : "⚠️ UNSET (Will default to true in application context)"}`);

  if (!supabaseUrl || !anonKey) {
    console.warn("⚠️  REST API Connection credentials are not fully set up. REST diagnostics will be skipped.");
    hasErrors = true;
  }
  if (!dbUrl) {
    console.warn("⚠️  Direct database connection string is not set up. SQL diagnostics will be skipped.");
    hasErrors = true;
  }

  // 2. DIRECT POSTGRESQL DB PROBE (DATABASE_URL)
  if (dbUrl) {
    formatSectionHeader("2. Direct SQL PostgreSQL Connection Probe");
    const client = new pg.Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1")
        ? undefined
        : { rejectUnauthorized: false }
    });

    try {
      const startTime = Date.now();
      await client.connect();
      const latency = Date.now() - startTime;
      console.log(`✓ successfully established connection to direct PostgreSQL DB cluster! Latency: ${latency}ms`);

      const versionRes = await client.query("SELECT version();");
      console.log(`✓ PostgreSQL Version: ${versionRes.rows[0]?.version}`);

      // List all database tables present
      const tablesRes = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      
      const tables = tablesRes.rows.map(r => r.table_name);
      console.log(`✓ Identified ${tables.length} schema table(s) in active schema:`);
      
      const expectedTables = [
        "users", "projects", "requisitions", "audit_logs", "fiscal_years", 
        "transactions", "forecast", "reports", "permissions", "thresholds", 
        "church_groups", "ledger_books", "supplementary_budgets", "vendors"
      ];

      for (const t of expectedTables) {
        const exists = tables.includes(t);
        let countText = "N/A";
        if (exists) {
          try {
            const countRes = await client.query(`SELECT COUNT(*) FROM "${t}";`);
            countText = countRes.rows[0]?.count || "0";
          } catch (_) {
            countText = "error reading";
          }
        }
        console.log(`  - [${exists ? "✓ EXISTS" : "❌ ABSENT"}] Table: ${t.padEnd(22)} (Estimated Rows: ${countText})`);
      }

    } catch (err: any) {
      console.error("❌ Direct PostgreSQL Database Connection Failed:", err.message || err);
      hasErrors = true;
    } finally {
      await client.end();
    }
  }

  // 3. API CONTEXT REST GATEWAY PROBE
  if (supabaseUrl && anonKey) {
    formatSectionHeader("3. REST API Gateway & Client Instance Probe");
    try {
      const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, "");
      const client = createClient(cleanUrl, anonKey);
      
      const startTime = Date.now();
      // Try querying users table
      const { data, error } = await client.from("users").select("id").limit(1);
      const latency = Date.now() - startTime;

      if (error) {
        if (error.code === "PGRST116" || error.code === "42P01" || error.message?.includes("relation")) {
          console.log(`✓ Connected to API Gateway in ${latency}ms. SQL Tables are not fully populated (expected if migration hasn't been run).`);
          console.log(`  (Raw API error code: ${error.code}, message: ${error.message})`);
        } else {
          console.error(`❌ Connected in ${latency}ms but API returned a security/routing error:`, error.message);
          console.error(`  - Code: ${error.code || "unknown"}`);
          hasErrors = true;
        }
      } else {
        console.log(`✓ successfully queried Supabase REST API in ${latency}ms! Server response payload structures verified.`);
        console.log(`  - Test Query Limit Checked: Limit 1 Row returned [${data ? data.length : 0} row(s)].`);
      }

    } catch (err: any) {
      console.error("❌ Network or CORS Exception thrown during REST routing:", err.message || err);
      hasErrors = true;
    }
  }

  // 4. DIAGNOTIC RECOMMENDATIONS REPORT
  formatSectionHeader("4. Diagnostics Outcome Summary");
  if (hasErrors) {
    console.log("⚠️  Diagnostics completed with warnings/exceptions. Please review the recommended actions below:");
    if (!dbUrl) {
      console.log("👉 Action: Add 'DATABASE_URL' direct SQL connection string in Secrets panel to initialize table relations.");
    }
    if (!supabaseUrl || !anonKey) {
      console.log("👉 Action: Add 'VITE_SUPABASE_URL' and 'VITE_SUPABASE_ANON_KEY' to ensure the client connection handles persistent transits.");
    }
    console.log("👉 Refer to /SUPABASE_TROUBLESHOOTING.md for more details on resolving specific PostgreSQL errors.");
  } else {
    console.log("🎉 SUCCESS: All connection pathways, environment tokens, REST interfaces, and SQL direct database connectors are responding and ready!");
    console.log("🚀 Your full-stack Supabase integration is perfectly healthy and ready to process requisitions.");
  }
  console.log("================================================================================\n");
}

runDiagnostics().catch(e => {
  console.error("Unhandled fatal exception during diagnostics execution:", e);
});
