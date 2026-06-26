import pg from 'pg';

const dbUrl = process.env.DATABASE_URL;
console.log("Database URL (redacted):", dbUrl ? dbUrl.replace(/:[^@]+@/, ':***@') : "UNDEFINED");
console.log("Is literal '[YOUR-PASSWORD]' in URL?", dbUrl ? dbUrl.includes('[YOUR-PASSWORD]') : false);

if (dbUrl) {
  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  client.connect()
    .then(async () => {
      console.log("Success! Connected to PostgreSQL.");
      const res = await client.query("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';");
      console.log("Found tables:", res.rows[0]);
      await client.end();
    })
    .catch((err) => {
      console.error("PostgreSQL connection error:", err);
    });
} else {
  console.log("No DATABASE_URL configured.");
}
