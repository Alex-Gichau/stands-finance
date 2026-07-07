import pg from 'pg';

async function testSupabase() {
  const dbUrl = process.env.DATABASE_URL || "";
  if (!dbUrl) {
    console.error("❌ DATABASE_URL is not set in environment variables!");
    return;
  }
  console.log("Database URL present: true");

  const client = new pg.Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("🟢 Successfully connected to PostgreSQL!");

    // List all tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log("Tables in database:", tablesRes.rows.map(r => r.table_name));

    // Count rows in key tables
    const tablesToCheck = ['users', 'requisitions', 'projects', 'alerts', 'transactions', 'budgets', 'fiscal_years'];
    for (const table of tablesToCheck) {
      try {
        const countRes = await client.query('SELECT COUNT(*) FROM "' + table + '"');
        console.log("- Table '" + table + "' count:", countRes.rows[0].count);
        
        if (parseInt(countRes.rows[0].count) > 0) {
          const sampleRes = await client.query('SELECT * FROM "' + table + '" LIMIT 1');
          console.log("  Sample row from '" + table + "':", JSON.stringify(sampleRes.rows[0]).substring(0, 150));
        }
      } catch (err: any) {
        console.log("- Table '" + table + "' check failed:", err.message);
      }
    }
  } catch (err: any) {
    console.error("❌ PostgreSQL error:", err.message);
  } finally {
    await client.end();
  }
}

testSupabase();
