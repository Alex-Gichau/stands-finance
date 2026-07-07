import pg from 'pg';

const dbUrl = process.env.DATABASE_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

let project = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "";
if (!project) {
  console.warn("⚠️ SUPABASE_URL is not set or doesn't match a standard Supabase domain. Project reference is empty.");
}
let password = "";

if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    password = decodeURIComponent(parsed.password || "");
    if (parsed.username && parsed.username.includes(".")) {
      project = parsed.username.split(".")[1];
    } else if (parsed.hostname.includes(".supabase.co")) {
      project = parsed.hostname.split(".")[0];
    }
  } catch (err) {
    const matchPooler = dbUrl.match(/postgresql:\/\/postgres\.(.*?):(.*?)@/);
    if (matchPooler) {
      project = matchPooler[1];
      password = matchPooler[2];
    }
  }
}

const urls = [
  // 1. Direct connection
  `postgresql://postgres:${password}@db.${project}.supabase.co:5432/postgres`,
  // 2. Direct connection pooler (session mode)
  `postgresql://postgres.${project}:${password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`,
  // 3. Direct connection pooler (aws-1)
  `postgresql://postgres.${project}:${password}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`,
  // 4. Try transaction mode pooler (aws-0) on port 6543
  `postgresql://postgres.${project}:${password}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`,
];

async function run() {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n--- Testing Connection URL #${i + 1} ---`);
    console.log(`URL (redacted): ${url.replace(/:[^@:]+@/, ':***@')}`);
    
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`🟢 SUCCESS! Connected to PostgreSQL on URL #${i + 1}!`);
      const res = await client.query("SELECT version();");
      console.log("Database version:", res.rows[0]);
      await client.end();
      return url; // return the working url
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message || String(err)}`);
    }
  }
  console.log("\n❌ All connection options failed.");
  return null;
}

run();
