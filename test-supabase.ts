import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";
const supabase = createClient(url, key);
supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: "http://localhost:3000", skipBrowserRedirect: true } }).then(res => console.log(res.data.url)).catch(console.error);
