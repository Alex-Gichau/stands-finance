import pg from 'pg';

const dbUrl = process.env.DATABASE_URL || "";
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";

let project = supabaseUrl.match(/https:\/\/(.*?)\.supabase\.co/)?.[1] || "";
if (!project) {
  console.warn("⚠️ SUPABASE_URL is not set or doesn't match a standard Supabase domain. Project reference is empty.");
}
let password_encoded = "";
let password_decoded = "";
let host_pooler = "aws-0-eu-west-1.pooler.supabase.com";

if (dbUrl) {
  try {
    const parsed = new URL(dbUrl);
    password_decoded = decodeURIComponent(parsed.password || "");
    password_encoded = encodeURIComponent(password_decoded);
    
    const host = parsed.hostname;
    if (host.includes("pooler.supabase.com")) {
      host_pooler = host;
    }
    if (parsed.username && parsed.username.includes(".")) {
      project = parsed.username.split(".")[1];
    } else if (host.includes(".supabase.co")) {
      project = host.split(".")[0];
    }
  } catch (err) {
    const matchDirect = dbUrl.match(/postgresql:\/\/postgres:(.*?)@db\.(.*?)\.supabase\.co/);
    if (matchDirect) {
      password_encoded = matchDirect[1];
      password_decoded = decodeURIComponent(password_encoded);
      project = matchDirect[2];
    } else {
      const matchPooler = dbUrl.match(/postgresql:\/\/postgres\.(.*?):(.*?)@(.*?):/);
      if (matchPooler) {
        project = matchPooler[1];
        password_encoded = matchPooler[2];
        password_decoded = decodeURIComponent(password_encoded);
        host_pooler = matchPooler[3];
      }
    }
  }
}

const host_direct = `db.${project}.supabase.co`;

const urls = [
  // 1. Direct using encoded password
  `postgresql://postgres:${password_encoded}@${host_direct}:5432/postgres`,
  // 2. Direct using decoded password
  `postgresql://postgres:${password_decoded}@${host_direct}:5432/postgres`,
  // 3. Pooler 5432 using encoded password
  `postgresql://postgres.${project}:${password_encoded}@${host_pooler}:5432/postgres`,
  // 4. Pooler 5432 using decoded password
  `postgresql://postgres.${project}:${password_decoded}@${host_pooler}:5432/postgres`,
  // 5. Pooler 6543 using encoded password
  `postgresql://postgres.${project}:${password_encoded}@${host_pooler}:6543/postgres`,
  // 6. Pooler 6543 using decoded password
  `postgresql://postgres.${project}:${password_decoded}@${host_pooler}:6543/postgres`,
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
      console.log("🏆 WORKING CONNECTION STRING:", url);
      return;
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message || String(err)}`);
    }
  }
  console.log("\n❌ All connections failed.");
}

run();
