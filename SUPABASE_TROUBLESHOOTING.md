# Supabase & PostgreSQL Manual Troubleshooting Runbook

This runbook describes the detailed, step-by-step procedures to verify, debug, and troubleshoot the Supabase API, RLS (Row-Level Security) policies, direct PostgreSQL database schema, and live data synchronization within the Finance & Procurement System application.

---

## Table of Contents
1. [Prerequisites & Core Infrastructure Secrets](#1-prerequisites--core-infrastructure-secrets)
2. [Step-by-Step API Connectivity Diagnostics](#2-step-by-step-api-connectivity-diagnostics)
3. [Step-by-Step PostgreSQL Relational Schema Diagnostics](#3-step-by-step-postgresql-relational-schema-diagnostics)
4. [Row-Level Security (RLS) Policy Troubleshooting](#4-row-level-security-rls-policy-troubleshooting)
5. [Automated Test Suite Execution (CLI Troubleshooting)](#5-automated-test-suite-execution-cli-troubleshooting)
6. [Common Error Codes & Resolutions Reference](#6-common-error-codes--resolutions-reference)

---

## 1. Prerequisites & Core Infrastructure Secrets

The application operates as a full-stack, server-side-safe architecture. Before testing, confirm that the following credentials have been registered in the **Secrets/Settings panel** of AI Studio (which manages `.env` variables):

| Secret Key Name | Format | Purpose | Description |
| :--- | :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | REST/GraphQL Interface | API Host URL for Client-side & Server-side Interceptor routing |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` | JWT Authorization Key | Public Anon key authorizing transactional client-side requests |
| `DATABASE_URL` | `postgresql://postgres:[pw]@db.[host].supabase.co:5432/postgres` | PostgreSQL Client | Direct database connector string for running schema updates and Drizzle migrations |
| `VITE_USE_SUPABASE` | `true` or `false` | System Flags | Set to `true` to active full interceptors routing |

---

## 2. Step-by-Step API Connectivity Diagnostics

If client queries are stalling, returning network errors, or reverting to the standard Local fallback sandbox, run through these procedures manually inside your browser's Developer Tools (F12) or Postman:

### Step 2.1: Verify Dynamic API Configuration Response
Send an HTTP GET request to check if the web server safely exposes the configured metadata:
* **Request URL:** `/api/config/supabase`
* **Response Payload Expectations:**
```json
{
  "url": "https://your-project.supabase.co",
  "anonKey": "your-anon-bearer-jwt-token...",
  "useSupabase": "true"
}
```
* **Failure Remediation:** If the values returned are empty or show mock values (e.g. `YOUR_SUPABASE_URL`), navigate to the **Secrets** editor in Google AI Studio and apply the correct values, then restart the developer server.

### Step 2.2: Verify Network Route Connection via REST Interface
Ping the project’s REST gateway directly using `curl` or browser console:
```bash
curl -i -X GET "https://your-project.supabase.co/rest/v1/" \
  -H "apikey: your-anon-key" \
  -H "Authorization: Bearer your-anon-key"
```
* **Success Indicator:** Status `200 OK` showing open route specifications.
* **CORS Failure (Status Code 0 or Network Error):** Ensure the requested client domain (e.g., your Cloud Run preview URL) is registered or allowed inside the CORS policies of your Supabase Workspace Settings: **Database -> API -> CORS Settings -> Allowed Origins** (usually `*` is safe for testing).

---

## 3. Step-by-Step PostgreSQL Relational Schema Diagnostics

If the API pings successfully but throws `42P01: relation x does not exist`, the SQL schema has not been migrated yet.

### Step 3.1: Execute Schema Migration
1. Go to the application's **Settings (System Admin)** workspace.
2. Under "Run Supabase Database Migration", inspect any printed error blocks.
3. Click **RUN SUPABASE DATABASE MIGRATION**.
4. This executes `supabase/migrations/0000_ambiguous_namorita.sql` inside your direct DB cluster.

### Step 3.2: Inspect Live Table Relations manually via Supabase Dashboard
1. Open your [Supabase Dashboard](https://supabase.com/dashboard/projects).
2. Select your Project -> **Table Editor**.
3. Confirm that the following primary relational tables exist:
   * `users`
   * `projects`
   * `requisitions`
   * `audit_logs` (corresponds to `system_logs` in Firestore)
   * `fiscal_years`
   * `transactions`
   * `forecast`
   * `reports`
   * `permissions`
   * `thresholds`
   * `church_groups`
   * `ledger_books`
   * `supplementary_budgets`
   * `vendors`

---

## 4. Row-Level Security (RLS) Policy Troubleshooting

If writes/updates are rejected with `401 Unauthorized` or silently complete but return 0 rows under query GET commands, checking RLS is paramount:

### Step 4.1: Checking Enablement
1. Navigate to **Supabase Dashboard -> Database -> Alter Table...** on each table.
2. Examine if **Enable Row Level Security (RLS)** is toggled.
3. If RLS is enabled without explicit matching policy configurations, ALL queries originating from client `anon` tokens will resolve to empty states.

### Step 4.2: Applying the Default Client Transit Policy
If you need immediate read/write access for all approved active users without complex JWT validation, apply a permissive transit policy to key tables:
```sql
-- Disable RLS temporarily to diagnose if policies are blocking you
ALTER TABLE requisitions DISABLE ROW LEVEL SECURITY;

-- Or add a general public bypass policy for anonymous browser access:
CREATE POLICY "Enable read/write for anon users" 
ON public.requisitions 
FOR ALL 
TO anon 
USING (true) 
WITH CHECK (true);
```
Check the full policy blueprints in `/supabase/policies.sql` to apply granular owner validation constraints.

---

## 5. Automated Test Suite Execution (CLI Troubleshooting)

We have built a dedicated programmatic diagnostic runner that runs server-side tests of your active configuration:

To execute this diagnostics test suite from the terminal terminal, run:
```bash
npx tsx scripts/troubleshoot-supabase.ts
```

This automated runner performs:
1. Environmental variable checks for API & DB connection configurations.
2. Direct PostgreSQL driver connection ping.
3. Active tables audit (counts rows inside each live table).
4. Direct API gateway probe using the REST/GET endpoint.
5. Auto-remediation guidance for any encountered diagnostic exceptions.

---

## 6. Common Error Codes & Resolutions Reference

### ❌ `42P01: relation "[table]" does not exist`
* **Root Cause:** A request was routed to a table that has not been initialized.
* **Resolution:** Run the migration query from the admin UI settings, or run:
  ```bash
  npx drizzle-kit push
  ```

### ❌ `PGRST116: JSON object requested, multiple or zero rows found`
* **Root Cause:** Calling `.maybeSingle()` or `.single()` on a query matching zero or multiple items.
* **Resolution:** Ensure the document ID actually exists, or double check if direct RLS permissions are blocking read permissions.

### ❌ `401 Unauthorized` / `JWT expired` or invalid API key
* **Root Cause:** The `VITE_SUPABASE_ANON_KEY` has expired or is invalid.
* **Resolution:** Copy the fresh `anon / public` API key from **Supabase Dashboard -> Project Settings -> API** and save it in AI Studio Secrets.

### ❌ Connection Refused on Client side but Backend succeeds
* **Root Cause:** Local network, VPN, proxy, or strict content security headers (CSP) blocking external requests on the browser.
* **Resolution:** Ensure domain connections to `*.supabase.co` are permitted. Fallback to using the server API backend proxies.
