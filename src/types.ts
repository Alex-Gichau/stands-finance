/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum UserRole {
  CHURCH_GROUP = "CHURCH_GROUP",
  APPROVER_L1 = "APPROVER_L1",
  APPROVER_L2 = "APPROVER_L2",
  FINANCE = "FINANCE",
  ADMIN = "ADMIN",
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  group?: string; // e.g., "Youth Ministry", "Womens Guild"
  approverCode?: string; // 6 digits for L1, 7 for L2
  isActive: boolean;
  isApproved: boolean;
  isSuspended: boolean;
}

export enum RequisitionStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  APPROVED_L1 = "APPROVED_L1",
  APPROVED_L2 = "APPROVED_L2", // Same as APPROVED in some contexts
  ESCALATED = "ESCALATED",
  DISBURSED = "DISBURSED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

export enum RecurrenceType {
  NONE = "NONE",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
}

export interface ApprovalNote {
  id: string;
  approverId: string;
  approverName: string;
  role: UserRole;
  note: string;
  decision: "APPROVE" | "REJECT" | "ESCALATE";
  rejectionReason?: string;
  approvalCode?: string; // Masked in UI
  method: "CODE" | "FINGERPRINT" | "SIGNATURE";
  timestamp: string;
}

export interface Requisition {
  id: string;
  projectId?: string; // Linked project
  title: string;
  description: string;
  amount: number;
  amountWords?: string;
  groupId: string;
  groupName: string;
  requesterId: string;
  requesterName: string;
  status: RequisitionStatus;
  submittedAt: string;
  updatedAt: string;
  expiresAt?: string;
  escalationLevel?: number;
  escalationNotificationsSent?: boolean;
  approvedAtL1?: string;
  approvedAtL2?: string;
  disbursedAt?: string;
  rejectionReason?: string;
  approvalHistory: ApprovalNote[];
  digitalSignature?: string; // base64
  recurrence?: RecurrenceType;
  lastRecurrenceGeneratedAt?: string;
  additionalInfo?: string;
  attachments?: string[];
  receipts?: string[];
}

export interface Budget {
  id: string;
  groupId: string;
  allocated: number;
  spent: number;
  lastUpdated: string;
}

export interface BiometricSettings {
  id: string;
  userId: string;
  isEnrolled: boolean;
  requireForApproval: boolean;
  lastEnrollment?: string;
  credentialId?: string;
}

export interface UserPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  theme: "LIGHT" | "DARK";
}

export interface Project {
  id: string;
  name: string;
  groupId: string;
  allocatedBudget: number;
  spentAmount: number;
  status: "ACTIVE" | "ON_HOLD" | "COMPLETED";
  color?: string;
}

export interface ForecastMonth {
  month: string;
  projected: number;
  actual: number;
}

export interface BudgetAlert {
  id: string;
  type: "OVERSHOOT" | "LARGE_REQUEST" | "EXPIRY" | "L2_APPROVED" | "FINANCE_DISBURSEMENT";
  severity: "LOW" | "MEDIUM" | "HIGH";
  message: string;
  timestamp: string;
  isRead: boolean;
  targetRole?: string;
}

export interface AlertThreshold {
  id: string;
  type: string;
  threshold: number;
  isEnabled: boolean;
  notifyEmail: boolean;
}

export interface ChurchGroup {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface SystemLog {
  id: string;
  action: string;
  details: string;
  performedBy: string;
  timestamp: string;
  groupId?: string;
  metadata?: any;
}

export interface SavedReport {
  id: string;
  title: string;
  description: string;
  generatedBy: string;
  generatedById: string;
  timestamp: string;
  period: string;
  stats: {
    grossValue: number;
    disbursed: number;
    approved: number;
    pending: number;
  };
  filters: {
    startDate?: string;
    endDate?: string;
    group?: string;
    status?: string;
  };
  itemCount: number;
}

