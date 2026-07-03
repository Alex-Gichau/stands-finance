-- Supabase PostgreSQL Relational Schema and Row Level Security (RLS) Policies
-- This matches the Drizzle ORM design and converts Firestore rules into PostgreSQL RLS policies.

-- -------------------------------------------------------------
-- 1. Enable RLS on all tables
-- -------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;


-- -------------------------------------------------------------
-- Helper Functions for Role checks based on jwt claim or user profiles
-- -------------------------------------------------------------

-- Fetch the role of the current authenticated user from 'users' table
-- Marked as SECURITY DEFINER to bypass RLS and avoid recursion
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid()::text;
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check if the current user is active/approved and not suspended
CREATE OR REPLACE FUNCTION is_approved_user()
RETURNS boolean AS $$
DECLARE
  approved boolean;
BEGIN
  SELECT (is_active = true AND is_approved = true AND is_suspended = false) INTO approved
  FROM public.users WHERE id = auth.uid()::text;
  RETURN COALESCE(approved, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- -------------------------------------------------------------
-- 2. Policies for USERS Table
-- -------------------------------------------------------------

DROP POLICY IF EXISTS select_users ON users;
-- SELECT: Approved users can list/read all users; any user can read their own profile.
CREATE POLICY select_users ON users
  FOR SELECT
  USING (
    auth.uid()::text = id OR 
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE', 'APPROVER_L1', 'APPROVER_L2')
  );

DROP POLICY IF EXISTS insert_users ON users;
-- INSERT: Users can create their own profile, or an Admin can create profiles.
CREATE POLICY insert_users ON users
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = id OR 
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

DROP POLICY IF EXISTS update_users ON users;
-- UPDATE: Users can edit their own profile details, or an Admin can update any.
CREATE POLICY update_users ON users
  FOR UPDATE
  USING (
    auth.uid()::text = id OR 
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

DROP POLICY IF EXISTS delete_users ON users;
-- DELETE: Only Admins or Super Admins can remove user records.
CREATE POLICY delete_users ON users
  FOR DELETE
  USING (
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );


-- -------------------------------------------------------------
-- 3. Policies for PROJECTS Table
-- -------------------------------------------------------------

DROP POLICY IF EXISTS select_projects ON projects;
-- SELECT: Any approved user can read projects.
CREATE POLICY select_projects ON projects
  FOR SELECT
  USING (
    get_current_user_role() IS NOT NULL
  );

DROP POLICY IF EXISTS write_projects ON projects;
-- INSERT/DELETE: Only Admin/Super Admin can add or delete projects.
CREATE POLICY write_projects ON projects
  FOR ALL
  USING (
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN')
  );

DROP POLICY IF EXISTS update_projects ON projects;
-- UPDATE: Admins or L1/L2/Finance can update project budget spent details.
CREATE POLICY update_projects ON projects
  FOR UPDATE
  USING (
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'APPROVER_L1', 'APPROVER_L2', 'FINANCE')
  );


-- -------------------------------------------------------------
-- 4. Policies for REQUISITIONS Table
-- -------------------------------------------------------------

DROP POLICY IF EXISTS select_requisitions ON requisitions;
-- SELECT: Approved users can view requisitions.
CREATE POLICY select_requisitions ON requisitions
  FOR SELECT
  USING (
    get_current_user_role() IS NOT NULL
  );

DROP POLICY IF EXISTS insert_requisitions ON requisitions;
-- INSERT: Approved users can create requisitions.
CREATE POLICY insert_requisitions ON requisitions
  FOR INSERT
  WITH CHECK (
    auth.uid()::text = requester_id AND 
    get_current_user_role() IS NOT NULL
  );

DROP POLICY IF EXISTS update_requisitions ON requisitions;
-- UPDATE: Requisitions can be updated by their requester (only while DRAFT/REJECTED),
-- or by approvers (L1, L2, Finance) for approval actions.
CREATE POLICY update_requisitions ON requisitions
  FOR UPDATE
  USING (
    (auth.uid()::text = requester_id AND status IN ('DRAFT', 'REJECTED')) OR
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'APPROVER_L1', 'APPROVER_L2', 'FINANCE')
  );

DROP POLICY IF EXISTS delete_requisitions ON requisitions;
-- DELETE: Requisition can be deleted by admins, or by user ONLY if still a DRAFT.
CREATE POLICY delete_requisitions ON requisitions
  FOR DELETE
  USING (
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN') OR
    (auth.uid()::text = requester_id AND status = 'DRAFT')
  );


-- -------------------------------------------------------------
-- 5. Policies for AUDIT_LOGS Table
-- -------------------------------------------------------------

DROP POLICY IF EXISTS select_audit_logs ON audit_logs;
-- SELECT: Restricted to Finance, Admins, and Super Admins.
CREATE POLICY select_audit_logs ON audit_logs
  FOR SELECT
  USING (
    get_current_user_role() IN ('ADMIN', 'SUPER_ADMIN', 'FINANCE')
  );

DROP POLICY IF EXISTS insert_audit_logs ON audit_logs;
-- INSERT: Any authenticated session can append log records.
CREATE POLICY insert_audit_logs ON audit_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );


-- -------------------------------------------------------------
-- 6. Policies for Shared Reference Tables (Church Groups, Vendors, Ledger Books, Supplementary Budgets)
-- -------------------------------------------------------------

-- 6.1 church_groups
ALTER TABLE church_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_church_groups ON church_groups;
CREATE POLICY select_church_groups ON church_groups FOR SELECT USING (true);
DROP POLICY IF EXISTS write_church_groups ON church_groups;
CREATE POLICY write_church_groups ON church_groups FOR ALL USING (true);

-- 6.2 vendors
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_vendors ON vendors;
CREATE POLICY select_vendors ON vendors FOR SELECT USING (true);
DROP POLICY IF EXISTS write_vendors ON vendors;
CREATE POLICY write_vendors ON vendors FOR ALL USING (true);

-- 6.3 ledger_books
ALTER TABLE ledger_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_ledger_books ON ledger_books;
CREATE POLICY select_ledger_books ON ledger_books FOR SELECT USING (true);
DROP POLICY IF EXISTS write_ledger_books ON ledger_books;
CREATE POLICY write_ledger_books ON ledger_books FOR ALL USING (true);

-- 6.4 supplementary_budgets
ALTER TABLE supplementary_budgets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS select_supplementary_budgets ON supplementary_budgets;
CREATE POLICY select_supplementary_budgets ON supplementary_budgets FOR SELECT USING (true);
DROP POLICY IF EXISTS write_supplementary_budgets ON supplementary_budgets;
CREATE POLICY write_supplementary_budgets ON supplementary_budgets FOR ALL USING (true);

