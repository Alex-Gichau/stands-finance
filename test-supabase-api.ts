import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || 'https://wjftrnergydgosatyuzo.supabase.co/';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(url, anonKey);

async function run() {
  console.log("Testing Supabase API connection to url:", url);
  try {
    const { data, error } = await supabase.from('users').select('*').limit(5);
    if (error) {
      console.error("Supabase API error:", error);
    } else {
      console.log("Success! Fetched users from Supabase:", data);
    }
  } catch (err) {
    console.error("Connection failed:", err);
  }
}

run();
