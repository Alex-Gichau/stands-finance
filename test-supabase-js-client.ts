import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || "";
const anonKey = process.env.SUPABASE_ANON_KEY || "";

console.log("Supabase URL:", url);
console.log("Anon Key Length:", anonKey.length);

if (!url || !anonKey) {
  console.error("❌ Missing Supabase URL or Anon Key");
  process.exit(1);
}

const supabase = createClient(url, anonKey);

async function checkTables() {
  console.log("Attempting to read from 'users' table via Supabase JS client...");
  const { data, error } = await supabase.from("users").select("*").limit(5);
  
  if (error) {
    console.error("❌ Error reading 'users' table:", error);
  } else {
    console.log("🟢 SUCCESS! Read 'users' table successfully!");
    console.log("Data:", data);
  }
}

checkTables();
