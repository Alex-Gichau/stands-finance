
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error("❌ DATABASE_URL is not set in environment variables!");
  process.exit(1);
}

async function applyPolicies() {
  console.log("🔄 Applying Fixed RLS Policies to Supabase...");
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("🟢 Connected to PostgreSQL!");

    const policiesPath = path.join(process.cwd(), 'supabase', 'policies.sql');
    const policiesSql = fs.readFileSync(policiesPath, 'utf8');

    console.log("🔄 Executing policies SQL...");
    await client.query(policiesSql);
    console.log("✅ Successfully applied fixed RLS policies!");

  } catch (err: any) {
    console.error("❌ FAILED to apply policies:", err.message || String(err));
  } finally {
    await client.end();
  }
}

applyPolicies();
