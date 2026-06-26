import pg from 'pg';

const project = "wjftrnergydgosatyuzo";
const password = "IT5aFaq8uKwwNcI1HfyZIg_S68fiS97"; // without sb_secret_ prefix
const host = "aws-0-eu-west-1.pooler.supabase.com";

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
