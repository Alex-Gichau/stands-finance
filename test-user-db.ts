import pg from 'pg';

const project = "wjftrnergydgosatyuzo";
const password_encoded = "Alexx%40admin.47";
const password_decoded = "Alexx@admin.47";
const host_pooler = "aws-0-eu-west-1.pooler.supabase.com";
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
