/// <reference types="vite/client" />
import { createClient } from "@supabase/supabase-js";

// Lazy-loaded Supabase Client to prevent startup crashes if keys are not configured yet
let supabaseClientInstance: any = null;
let dynamicSupabaseUrl: string | null = null;
let dynamicSupabaseAnonKey: string | null = null;
let attemptedDynamicFetch = false;
let lastFetchTime = 0;

const getViteEnv = () => {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  return env || {};
};

const hasValidSupabaseConfig = (url: string | null | undefined, key: string | null | undefined) => {
  const normalizedUrl = url?.trim() || "";
  const normalizedKey = key?.trim() || "";

  return normalizedUrl.length > 0 && normalizedKey.length > 0 && !normalizedUrl.includes("YOUR_SUPABASE_URL");
};

const fetchConfigSynchronously = (force = false) => {
  const now = Date.now();
  if (attemptedDynamicFetch && !force && dynamicSupabaseUrl) return;
  // If we already attempted but failed, wait at least 5 seconds before retrying, unless forced
  if (!force && attemptedDynamicFetch && !dynamicSupabaseUrl && now - lastFetchTime < 5000) return;

  attemptedDynamicFetch = true;
  lastFetchTime = now;
  if (typeof window === "undefined" || typeof XMLHttpRequest === "undefined") {
    return;
  }

  try {
    const xhr = new XMLHttpRequest();
    // Synchronous request to get live env variables backend-side
    xhr.open("GET", "/api/config/supabase", false);
    xhr.send();
    if (xhr.status === 200) {
      const data = JSON.parse(xhr.responseText);
      if (data.url && data.anonKey) {
        dynamicSupabaseUrl = data.url;
        dynamicSupabaseAnonKey = data.anonKey;
        console.log("[Supabase] Successfully loaded real credentials dynamically from the backend server api.");
      }
    }
  } catch (err) {
    console.info("[Supabase] Issue dynamically loading credentials from server API:", err);
  }
};

export const getSupabaseClient = (forceRefresh = false) => {
  if (supabaseClientInstance && !forceRefresh) {
    return supabaseClientInstance;
  }

  if (forceRefresh) {
    supabaseClientInstance = null;
  }

  let supabaseUrl = "";
  let supabaseAnonKey = "";
  const viteEnv = getViteEnv();

  fetchConfigSynchronously(forceRefresh);
  if (dynamicSupabaseUrl && dynamicSupabaseAnonKey) {
    supabaseUrl = dynamicSupabaseUrl;
    supabaseAnonKey = dynamicSupabaseAnonKey;
  } else {
    supabaseUrl = viteEnv.VITE_SUPABASE_URL || "";
    supabaseAnonKey = viteEnv.VITE_SUPABASE_ANON_KEY || "";
  }

  // Guard against missing keys
  if (!hasValidSupabaseConfig(supabaseUrl, supabaseAnonKey)) {
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
  const viteEnv = getViteEnv();
  const url = dynamicSupabaseUrl || viteEnv.VITE_SUPABASE_URL;
  const key = dynamicSupabaseAnonKey || viteEnv.VITE_SUPABASE_ANON_KEY;

  return hasValidSupabaseConfig(url, key);
};
