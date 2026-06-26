export interface PrimaryDatabaseStatus {
  activeDatabase: "supabase" | "firebase" | "none";
  firebaseEnabled: boolean;
  message: string;
}

export function getPrimaryDatabaseStatus(env: Record<string, string | undefined>): PrimaryDatabaseStatus {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes("YOUR_SUPABASE_URL")) {
    return {
      activeDatabase: "supabase",
      firebaseEnabled: false,
      message: "Supabase is configured as the primary database. Firebase is no longer required for the main workflow."
    };
  }

  return {
    activeDatabase: "none",
    firebaseEnabled: false,
    message: "No primary database is configured yet. Configure Supabase to enable data access."
  };
}
