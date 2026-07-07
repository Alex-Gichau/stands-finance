/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

// Lazy-loaded Supabase Client to prevent startup crashes if keys are not configured yet
let supabaseClientInstance: any = null;
let dynamicSupabaseUrl: string | null = null;
let dynamicSupabaseAnonKey: string | null = null;
let attemptedDynamicFetch = false;

export const fetchConfigAsynchronously = async (force = false) => {
  if (attemptedDynamicFetch && !force) return;
  attemptedDynamicFetch = true;
  try {
    const res = await fetch("/api/config/supabase");
    if (res.ok) {
      const data = await res.json();
      if (data.url && data.anonKey) {
        dynamicSupabaseUrl = data.url;
        dynamicSupabaseAnonKey = data.anonKey;
        console.log("[Supabase] Successfully loaded credentials asynchronously from backend.");
      }
    }
  } catch (err) {
    console.warn("[Supabase] Issue asynchronously loading credentials:", err);
  }
};

// Start background fetch immediately on module load
fetchConfigAsynchronously().catch(() => {});

export const getSupabaseClient = (forceRefresh = false) => {
  if (supabaseClientInstance && !forceRefresh) {
    return supabaseClientInstance;
  }

  if (forceRefresh) {
    supabaseClientInstance = null;
  }

  let supabaseUrl = "";
  let supabaseAnonKey = "";

  if (dynamicSupabaseUrl && dynamicSupabaseAnonKey) {
    supabaseUrl = dynamicSupabaseUrl;
    supabaseAnonKey = dynamicSupabaseAnonKey;
  } else {
    supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
    supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
  }

  // Guard against missing keys
  if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes("YOUR_SUPABASE_URL")) {
    console.log("Supabase credentials are not fully configured yet. Dynamic DB operations will run on simulated PostgreSQL sandbox inside client.");
    return null;
  }

  // Remove /rest/v1/ if user accidentally appended it
  if (supabaseUrl.endsWith("/rest/v1/")) {
    supabaseUrl = supabaseUrl.replace("/rest/v1/", "");
  } else if (supabaseUrl.endsWith("/rest/v1")) {
    supabaseUrl = supabaseUrl.replace("/rest/v1", "");
  }

  try {
    supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseClientInstance;
  } catch (err) {
    console.info("Issue initializing Supabase client:", err);
    return null;
  }
};

/**
 * Check if Supabase mode is requested and properly configured.
 */
export const isSupabaseEnabled = (): boolean => {
  // Try to see if we have credentials loaded either from env or dynamic fetch
  const url = dynamicSupabaseUrl || import.meta.env.VITE_SUPABASE_URL;
  const key = dynamicSupabaseAnonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !key || url.includes("YOUR_SUPABASE_URL")) {
    return false;
  }
  
  return true;
};

