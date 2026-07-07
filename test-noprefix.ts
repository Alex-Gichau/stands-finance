import pg from 'pg';

const dbUrl = process.env.DATABASE_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

let project = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "";
if (!project) {
  console.warn("⚠️ SUPABASE_URL is not set or doesn't match a standard Supabase domain. Project reference is empty.");
}
let password = "";
let host = "aws-0-eu-west-1.pooler.supabase.com";

if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    password = decodeURIComponent(parsed.password || "");
    const hostname = parsed.hostname;
    if (hostname.includes("pooler.supabase.com")) {
      host = hostname;
    }
    if (parsed.username && parsed.username.includes(".")) {
      project = parsed.username.split(".")[1];
    } else if (hostname.includes(".supabase.co")) {
      project = hostname.split(".")[0];
    }
  } catch (err) {
    const matchPooler = dbUrl.match(/postgresql:\/\/postgres\.(.*?):(.*?)@(.*?):/);
    if (matchPooler) {
      project = matchPooler[1];
      password = matchPooler[2];
      host = matchPooler[3];
    }
  }
}

// Strip sb_secret_ prefix if present to test "without sb_secret_ prefix" as intended in test-noprefix
if (password.startsWith("sb_secret_")) {
  password = password.replace(/^sb_secret_/, "");
}

const urls = [
  `postgresql://postgres.${project}:${password}@${host}:5432/postgres`,
  `postgresql://postgres:${password}@db.${project}.supabase.co:5432/postgres`
];

async function run() {
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    console.log(`\n--- Testing Connection with Password: ${password} ---`);
    const client = new pg.Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false }
    });

    try {
      await client.connect();
      console.log(`🟢 SUCCESS! Connected to PostgreSQL!`);
      const res = await client.query("SELECT version();");
      console.log("Database version:", res.rows[0]);
      await client.end();
      return;
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message || String(err)}`);
    }
  }
}

run();
