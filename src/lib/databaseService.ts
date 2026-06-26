import { getSupabaseClient } from "./supabase";
import { 
  Requisition, 
  Project, 
  UserProfile, 
  SystemLog,
  BudgetAlert,
  FiscalYear,
  Transaction,
  ForecastMonth,
  SavedReport,
  PermissionConfig,
  AlertThreshold,
  ChurchGroup,
  LedgerBook,
  SupplementaryBudgetRequest,
  Vendor 
} from "../types";

export const databaseService = {
  // --- USER OPERATIONS ---
  async saveUserProfile(user: UserProfile): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    console.log(`[DatabaseService] Saving user profile to Supabase: ${user.email}`);
    const { error } = await supabase
      .from("users")
      .upsert({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        group: user.group || null,
        groups: user.groups || [],
        approver_code: user.approverCode || null,
        is_active: user.isActive,
        is_approved: user.isApproved,
        is_suspended: user.isSuspended,
        phone: user.phone || null,
        department: user.department || null,
        photo_url: user.photoURL || null,
        temp_password: user.tempPassword || null,
        is_online: user.isOnline || false,
        last_seen: user.lastSeen ? new Date(user.lastSeen).toISOString() : null,
        idle_timeout_duration: user.idleTimeoutDuration || 15,
        updated_at: new Date().toISOString()
      });

    if (error) throw error;
    console.log(`[DatabaseService] Successfully saved user to Supabase`);
  },

  // --- PROJECT OPERATIONS ---
  async saveProject(project: Project): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    console.log(`[DatabaseService] Saving project to Supabase: ${project.name}`);
    const { error } = await supabase
      .from("projects")
      .upsert({
        id: project.id,
        name: project.name,
        group_id: project.groupId,
        allocated_budget: project.allocatedBudget,
        spent_amount: project.spentAmount,
        status: project.status,
        color: project.color || null,
        fiscal_year: project.fiscalYear || null,
        requisition_limit: project.requisitionLimit || null,
        account_number: project.accountNumber || null
      });

    if (error) throw error;
    console.log(`[DatabaseService] Project successfully saved to Supabase: ${project.id}`);
  },

  async saveChurchGroup(group: ChurchGroup): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    console.log(`[DatabaseService] Saving church group to Supabase: ${group.name}`);
    const { error } = await supabase
      .from("church_groups")
      .upsert({
        id: group.id,
        name: group.name,
        description: group.description || null,
        created_at: group.createdAt ? new Date(group.createdAt).toISOString() : new Date().toISOString()
      });

    if (error) throw error;
  },

  async deleteChurchGroup(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { error } = await supabase.from("church_groups").delete().eq("id", id);
    if (error) throw error;
  },

  async saveLedgerBook(book: LedgerBook): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    console.log(`[DatabaseService] Saving ledger book to Supabase: ${book.ministryName}`);
    const { error } = await supabase
      .from("ledger_books")
      .upsert({
        id: book.id,
        ministry_id: book.ministryId || null,
        ministry_name: book.ministryName,
        book_name: book.bookName || null,
        description: book.description || null,
        created_at: book.createdAt ? new Date(book.createdAt).toISOString() : new Date().toISOString(),
        created_by: book.createdBy,
        creator_name: book.creatorName || null,
        budget_limit: book.budgetLimit,
        spent_amount: book.spentAmount,
        notes: book.notes || null,
        status: book.status || "ACTIVE"
      });

    if (error) throw error;
  },

  async updateLedgerBook(id: string, data: Partial<LedgerBook>): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    // Map camelCase to snake_case if necessary
    const mappedData: any = {};
    if (data.ministryId !== undefined) mappedData.ministry_id = data.ministryId;
    if (data.ministryName !== undefined) mappedData.ministry_name = data.ministryName;
    if (data.bookName !== undefined) mappedData.book_name = data.bookName;
    if (data.budgetLimit !== undefined) mappedData.budget_limit = data.budgetLimit;
    if (data.spentAmount !== undefined) mappedData.spent_amount = data.spentAmount;
    if (data.status !== undefined) mappedData.status = data.status;
    if (data.notes !== undefined) mappedData.notes = data.notes;

    const { error } = await supabase.from("ledger_books").update(mappedData).eq("id", id);
    if (error) throw error;
  },

  // --- REQUISITION OPERATIONS ---
  async saveRequisition(req: Requisition): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    
    console.log(`[DatabaseService] Saving requisition to Supabase: ${req.title}`);
    const { error } = await supabase
      .from("requisitions")
      .upsert({
        id: req.id,
        project_id: req.projectId || null,
        title: req.title,
        description: req.description,
        amount: req.amount,
        amount_words: req.amountWords || null,
        group_id: req.groupId,
        group_name: req.groupName,
        requester_id: req.requesterId,
        requester_name: req.requesterName,
        requester_email: req.requesterEmail || null,
        status: req.status,
        submitted_at: req.submittedAt ? new Date(req.submittedAt).toISOString() : null,
        updated_at: new Date(req.updatedAt || Date.now()).toISOString(),
        expires_at: req.expiresAt ? new Date(req.expiresAt).toISOString() : null,
        escalation_level: req.escalationLevel || 0,
        escalation_notifications_sent: req.escalationNotificationsSent || false,
        approved_at_l1: req.approvedAtL1 ? new Date(req.approvedAtL1).toISOString() : null,
        approved_at_l2: req.approvedAtL2 ? new Date(req.approvedAtL2).toISOString() : null,
        disbursed_at: req.disbursedAt ? new Date(req.disbursedAt).toISOString() : null,
        rejection_reason: req.rejectionReason || null,
        approval_history: req.approvalHistory || [],
        digital_signature: req.digitalSignature || null,
        payable_to: req.payableTo || null,
        recurrence: req.recurrence || "NONE",
        last_recurrence_generated_at: req.lastRecurrenceGeneratedAt ? new Date(req.lastRecurrenceGeneratedAt).toISOString() : null,
        additional_info: req.additionalInfo || null,
        attachments: req.attachments || [],
        receipts: req.receipts || [],
        flagged_for_audit: req.flaggedForAudit || false,
        in_procurement: req.inProcurement || false,
        requires_more_info: req.requiresMoreInfo || false,
        fiscal_year: req.fiscalYear || null
      });

    if (error) throw error;
    console.log(`[DatabaseService] Requisition successfully saved to Supabase: ${req.id}`);
  },

  async deleteRequisition(id: string): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { error } = await supabase.from("requisitions").delete().eq("id", id);
    if (error) throw error;
    console.log(`[DatabaseService] Requisition successfully deleted from Supabase: ${id}`);
  },

  async updateProject(id: string, data: any): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { error } = await supabase.from("projects").update(data).eq("id", id);
    if (error) throw error;
    console.log(`[DatabaseService] Project successfully updated in Supabase: ${id}`);
  },

  // --- SYSTEM LOGS OPERATIONS ---
  async saveAuditLog(log: SystemLog): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error("Supabase client not initialized.");
    const { error } = await supabase
      .from("audit_logs")
      .insert({
        action: log.action,
        details: log.details,
        performed_by: log.performedBy,
        timestamp: new Date(log.timestamp).toISOString(),
        group_id: log.groupId || null,
        metadata: log.metadata || null
      });
    if (error) throw error;
  },

  async clearAllPrototypeData(): Promise<{success: boolean, error?: string}> {
    console.log("[DatabaseService] clearAllPrototypeData not implemented yet");
    return { success: true };
  },

  async migrateFirestoreToSupabase(setProgress?: any): Promise<{success: boolean, error?: string}> {
    try {
      if (setProgress) setProgress("Initializing ecosystem data transfer...");
      const response = await fetch("/api/config/migrate-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      
      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Server responded with ${response.status}: ${text.slice(0, 200)}${text.length > 200 ? "..." : ""}`);
      }

      if (!response.ok || !data.success) {
        throw new Error(data.error || data.details || data.message || "Ecosystem data replication failed");
      }
      return data;
    } catch (err: any) {
      console.error("[DatabaseService] migration error:", err);
      // Handle the "Failed to fetch" error specifically
      const errorMessage = err.message === "Failed to fetch" 
        ? "Network error: Connection to migration server failed. Please ensure the server is running and your connection is stable."
        : (err.message || String(err));
      return { success: false, error: errorMessage };
    }
  }
};
