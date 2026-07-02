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

const regions = [
  "us-east-1", "us-east-2", "us-west-1", "us-west-2",
  "eu-central-1", "eu-west-1", "eu-west-2", "eu-west-3", "eu-north-1",
  "ap-southeast-1", "ap-southeast-2", "ap-northeast-1", "ap-northeast-2", "ap-south-1",
  "sa-east-1", "ca-central-1"
];

async function run() {
  console.log(`Searching for the correct regional pooler for tenant postgres.${project}...`);
  
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    const connectionString = `postgresql://postgres.${project}:${password}@${host}:5432/postgres`;
    
    const client = new pg.Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000 // 3 sec timeout
    });

    try {
      await client.connect();
      console.log(`🟢 SUCCESS ON REGION [${region}]! Connected successfully using host: ${host}`);
      const res = await client.query("SELECT version();");
      console.log("Database version:", res.rows[0]);
      await client.end();
      return;
    } catch (err: any) {
      const msg = err.message || String(err);
      if (msg.includes("tenant/user") && msg.includes("not found")) {
        // Skip - wrong region
      } else if (msg.includes("password authentication failed")) {
        console.log(`🟡 REGION IDENTIFIED [${region}]! Host '${host}' exists and recognized the tenant, but password was rejected.`);
        await client.end().catch(() => {});
        return;
      } else {
        console.log(`❓ Region [${region}] returned error: ${msg}`);
        await client.end().catch(() => {});
      }
    }
  }
  console.log("❌ Regional scan complete. No region successfully authenticated or recognized the tenant.");
}

run();
