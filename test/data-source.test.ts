import test from "node:test";
import assert from "node:assert/strict";
import { getPrimaryDatabaseStatus } from "../src/lib/dataSource";

test("prefers Supabase as the primary database when configured", () => {
  const status = getPrimaryDatabaseStatus({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_ANON_KEY: "anon-key",
    VITE_SUPABASE_URL: "",
    VITE_SUPABASE_ANON_KEY: ""
  });

  assert.equal(status.activeDatabase, "supabase");
  assert.equal(status.firebaseEnabled, false);
  assert.match(status.message, /Supabase/i);
});

test("reports an unconfigured state when no primary database is available", () => {
  const status = getPrimaryDatabaseStatus({});

  assert.equal(status.activeDatabase, "none");
  assert.equal(status.firebaseEnabled, false);
  assert.match(status.message, /No primary database/i);
});
