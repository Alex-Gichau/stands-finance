/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { 
  Requisition, 
  RequisitionStatus, 
  UserRole, 
  UserProfile, 
  Project, 
  BudgetAlert,
  AlertThreshold,
  ForecastMonth,
  SystemLog,
  SavedReport,
  ApprovalNote,
  RecurrenceType,
  ChurchGroup,
  LedgerBook,
  SearchFilter,
  PermissionConfig,
  SystemSettings,
  SupplementaryBudgetRequest,
  Vendor,
  Transaction,
  TransactionType,
  TransactionStatus,
  FiscalYear
} from "../types";
import { getProjectRequisitions } from "../utils/budgetUtils";
import { databaseService } from "../lib/databaseService";
import { uploadAttachmentsToLocalServer } from "../lib/utils";
import { initializeApp as initFirebaseApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updatePassword as updateAuthPassword
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCTAlP2_HARk1MYqUv1W_HxfIaRQCtC-HY",
  authDomain: "fintech-requisitions.firebaseapp.com",
  projectId: "fintech-requisitions",
  storageBucket: "fintech-requisitions.firebasestorage.app",
  messagingSenderId: "2730554389",
  appId: "1:2730554389:web:eaf336c107434ef442ca1c"
};

const firebaseApp = initFirebaseApp(firebaseConfig);
const auth = getAuth(firebaseApp);

const getAuthHeaders = async () => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (auth.currentUser) {
    try {
      const token = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${token}`;
    } catch (e) {
      console.warn("Failed to get Firebase ID token:", e);
    }
  }
  return headers;
};

export function normalizeUserProfile(u: any): UserProfile {
  if (!u) return u;
  let parsedGroups: string[] = [];
  if (u.groups) {
    if (Array.isArray(u.groups)) {
      parsedGroups = u.groups;
    } else if (typeof u.groups === "string" && u.groups.trim() !== "") {
      try {
        const parsed = JSON.parse(u.groups);
        if (Array.isArray(parsed)) {
          parsedGroups = parsed;
        } else {
          parsedGroups = [u.groups];
        }
      } catch (e) {
        parsedGroups = [u.groups];
      }
    } else if (typeof u.groups === "string") {
      parsedGroups = [];
    } else {
      parsedGroups = [];
    }
  } else {
    parsedGroups = u.group ? [u.group] : [];
  }
  return {
    ...u,
    groups: parsedGroups
  };
}

// @ts-ignore
const db = {}; // Dummy db to allow migration progress
// Supabase Auth usages replaced.
// auth stubs removed

// Supabase as Firestore Stubs
const collection = (db: any, table: string) => ({ table });
const doc = (db: any, table: string, id?: string) => {
  if (!id && typeof table !== 'string') {
     return { table: db.table, id: table }; // doc(collectionRef, id) form
  }
  return { table, id };
};

const getDocFromServer = async (docRef: any) => getDoc(docRef);
const deleteField = () => null;
const getFirestore = () => ({});
const initializeFirestore = (...args: any[]) => ({});

const mapCamelToSnake = (data: any): any => {
  if (data === null || data === undefined || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const snakeData: any = {};
  for (const [key, val] of Object.entries(data)) {
    let snakeKey = key;
    if (key === 'photoURL') {
      snakeKey = 'photo_url';
    } else {
      snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }
    snakeData[snakeKey] = val;
  }
  return snakeData;
};

const mapSnakeToCamel = (data: any): any => {
  if (data === null || data === undefined) {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(mapSnakeToCamel);
  }
  if (typeof data === "object") {
    const camelData: any = {};
    for (const [key, val] of Object.entries(data)) {
      let camelKey = key;
      if (key === 'photo_url') {
        camelKey = 'photoURL';
      } else {
        camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
      }
      let finalVal = mapSnakeToCamel(val);
      if (
        (camelKey === "amount" || 
         camelKey === "allocatedBudget" || 
         camelKey === "spentAmount" || 
         camelKey === "committedAmount" || 
         camelKey === "requisitionLimit" || 
         camelKey === "budgetLimit" || 
         camelKey === "allocated" || 
         camelKey === "spent" || 
         camelKey === "threshold") && 
        typeof finalVal === "string"
      ) {
        const parsed = Number(finalVal);
        if (!isNaN(parsed)) {
          finalVal = parsed;
        }
      }
      camelData[camelKey] = finalVal;
    }
    return camelData;
  }
  return data;
};

const setDoc = async (docRef: any, data: any, options?: any) => {
  let payload = mapCamelToSnake({ id: docRef.id, ...data });
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`setDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("setDoc failed:", err);
  }
};

const updateDoc = async (docRef: any, data: any) => {
  let payload = mapCamelToSnake(data);
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`updateDoc: Document not found, skipping update: table=${docRef.table}, id=${docRef.id}`);
        return;
      }
      console.error(`updateDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("updateDoc failed:", err);
  }
};

const deleteDoc = async (docRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, {
      method: "DELETE",
      headers
    });
    if (!res.ok) {
      console.error(`deleteDoc error: table=${docRef.table}, id=${docRef.id}, status=${res.status}`);
    }
  } catch (err) {
    console.error("deleteDoc failed:", err);
  }
};

const getDoc = async (docRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${docRef.table}/${docRef.id}`, { headers });
    if (!res.ok) return { exists: () => false, data: () => ({} as any), id: docRef.id };
    const data = await res.json();
    return { exists: () => true, data: () => mapSnakeToCamel(data), id: docRef.id };
  } catch (err) {
    console.error("getDoc failed:", err);
    return { exists: () => false, data: () => ({} as any), id: docRef.id };
  }
};

export function safeNormalizeAttachments(attachments: any): string[] {
  if (!attachments) return [];
  if (Array.isArray(attachments)) {
    return attachments.filter((x: any) => typeof x === 'string' || (x && typeof x === 'object')).map((x: any) => typeof x === 'string' ? x : JSON.stringify(x));
  }
  if (typeof attachments === 'string') {
    const trimmed = attachments.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => typeof x === 'string' ? x : JSON.stringify(x));
        }
      } catch (e) {
        console.error("Failed to parse stringified attachments array:", e);
      }
    }
    if (trimmed.length > 0) {
      return [trimmed];
    }
  }
  return [];
}

export function safeNormalizeReceipts(receipts: any): string[] {
  if (!receipts) return [];
  if (Array.isArray(receipts)) {
    return receipts.filter((x: any) => typeof x === 'string' || (x && typeof x === 'object')).map((x: any) => typeof x === 'string' ? x : JSON.stringify(x));
  }
  if (typeof receipts === 'string') {
    const trimmed = receipts.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => typeof x === 'string' ? x : JSON.stringify(x));
        }
      } catch (e) {
        console.error("Failed to parse stringified receipts array:", e);
      }
    }
    if (trimmed.length > 0) {
      return [trimmed];
    }
  }
  return [];
}

export function safeNormalizeApprovalHistory(history: any): any[] {
  if (!history) return [];
  if (Array.isArray(history)) {
    return history.map((x: any) => {
      if (typeof x === 'string') {
        try {
          return JSON.parse(x);
        } catch (e) {
          console.error("Failed to parse individual stringified history item:", e);
          return null;
        }
      }
      return x;
    }).filter(Boolean);
  }
  if (typeof history === 'string') {
    const trimmed = history.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map((x: any) => {
            if (typeof x === 'string') {
              try {
                return JSON.parse(x);
              } catch (e) {
                console.error("Failed to parse stringified history element:", e);
                return null;
              }
            }
            return x;
          }).filter(Boolean);
        }
      } catch (e) {
        console.error("Failed to parse stringified approvalHistory array:", e);
      }
    }
  }
  return [];
}

const limit = (val: number) => ({ type: 'limit', value: val });
const orderBy = (field: string, direction: string = 'asc') => ({ type: 'orderBy', field, direction });
const where = (field: string, op: string, value: any) => ({ type: 'where', field, op, value });

const query = (col: any, ...constraints: any[]) => {
  let q = { ...col };
  constraints.forEach(c => {
    if (c.type === 'limit') q.limitCount = c.value;
    if (c.type === 'orderBy') {
      q.orderColumn = c.field;
      q.ascending = c.direction !== 'desc';
    }
    if (c.type === 'where') {
      q.whereColumn = c.field;
      q.whereOp = c.op;
      q.whereValue = c.value;
    }
  });
  return q;
};

const getDocs = async (queryRef: any) => {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${queryRef.table}`, { headers });
    if (!res.ok) return { docs: [], empty: true, forEach: (cb: any) => {} };
    let data = await res.json();
    
    if (queryRef.whereColumn && queryRef.whereValue !== undefined) {
      const col = queryRef.whereColumn;
      const val = queryRef.whereValue;
      if (queryRef.whereOp === "==") data = data.filter((x: any) => x[col] === val);
      else if (queryRef.whereOp === ">") data = data.filter((x: any) => x[col] > val);
      else if (queryRef.whereOp === "<") data = data.filter((x: any) => x[col] < val);
    }
    
    const docs = data.map((d: any) => ({ data: () => mapSnakeToCamel(d), id: d.id, exists: () => true }));
    return { docs, empty: docs.length === 0, forEach: (cb: any) => docs.forEach(cb) };
  } catch (err) {
    console.error("getDocs failed:", err);
    return { docs: [], empty: true, forEach: (cb: any) => {} };
  }
};

const addDoc = async (col: any, data: any) => {
  try {
    const id = data.id || `doc-${Math.random().toString(36).substring(2, 11)}`;
    const payload = { ...data, id };
    const headers = await getAuthHeaders();
    const res = await fetch(`/api/db/${col.table}/${id}`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      console.error(`addDoc error: table=${col.table}, status=${res.status}`);
      return { id: "mock" };
    }
    return { id };
  } catch (err) {
    console.error("addDoc failed:", err);
    return { id: "mock" };
  }
};

const onSnapshot = (queryRef: any, callback: (snap: any) => void, errorCallback?: (err: any) => void) => {
  const fetchData = async () => {
    try {
      if (queryRef.id) { 
        const res = await getDoc(queryRef);
        callback(res);
      } else {
        const res = await getDocs(queryRef);
        callback(res);
      }
    } catch (err) {
      if (errorCallback) errorCallback(err);
      else console.warn("onSnapshot fetch failed:", err);
    }
  };
  
  fetchData();
  const interval = setInterval(fetchData, 5000);
  return () => clearInterval(interval);
};

const handleFirestoreError = (a: any, b: any, c: any) => {};
enum OperationType { READ, WRITE, DELETE, UPDATE, CREATE, LIST, GET }
const initializeApp = (...args: any[]) => {};
const deleteApp = async (a: any) => {};

// Temporary fix until migration is fully cleaned up
const isFirestoreQuotaExceeded = () => false;

// Helper to recursively remove any fields with value undefined to prevent Firestore write/update failures
function cleanFirestoreData(data: any): any {
  if (data === null || data === undefined) return data;
  if (typeof data === "object") {
    const cleaned: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) {
        cleaned[key] = cleanFirestoreData(val);
      }
    }
    return cleaned;
  }
  return data;
}

interface RequisitionContextType {
  requisitions: Requisition[];
  projects: Project[];
  alerts: BudgetAlert[];
  thresholds: AlertThreshold[];
  forecastData: ForecastMonth[];
  currentUser: UserProfile | null;
  users: UserProfile[];
  loading: boolean;
  authLoading: boolean;
  syncingTargets: Set<string>;
  biometricEnrolled: boolean;
  enrollBiometric: (enabled?: boolean) => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: (options?: { forceDirect?: boolean }) => Promise<void>;
  addRequisition: (req: Omit<Requisition, "id" | "status" | "submittedAt" | "updatedAt" | "approvalHistory"> & { status?: RequisitionStatus }) => Promise<void>;
  updateRequisition: (id: string, updates: Partial<Requisition>) => Promise<void>;
  updateRequisitionStatus: (id: string, status: RequisitionStatus, decision: "APPROVE" | "REJECT" | "ESCALATE", note?: string, method?: any, rejectionReason?: string, approvalCode?: string) => Promise<void>;
  uploadReceipts: (id: string, receipts: string[]) => Promise<void>;
  deleteRequisition: (id: string) => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  deleteAlert: (id: string) => Promise<void>;
  updateThreshold: (id: string, updates: Partial<AlertThreshold>) => Promise<void>;
  approveUser: (id: string) => Promise<void>;
  suspendUser: (id: string, isSuspended: boolean) => Promise<void>;
  updateUserRole: (id: string, role: UserRole) => Promise<void>;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  updateCurrentUserPassword: (pass: string) => Promise<void>;
  adminRegisterUser: (email: string, pass: string, name: string, role: UserRole, group?: string, approverCode?: string, groups?: string[]) => Promise<void>;
  adminResetUserPassword: (email: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  adminForceLogoutUser: (id: string) => Promise<void>;
  systemLogs: SystemLog[];
  addSystemLog: (action: string, details: string, metadata?: any) => Promise<void>;
  churchGroups: ChurchGroup[];
  lastGroupsSync: Date | null;
  addChurchGroup: (name: string, description?: string) => Promise<void>;
  deleteChurchGroup: (id: string) => Promise<void>;
  ledgerBooks: LedgerBook[];
  createLedgerBook: (ministryName: string, bookName: string, budgetLimit?: number) => Promise<void>;
  updateLedgerBookBudget: (id: string, newLimit: number) => Promise<void>;
  seedAllEcosystemData: () => Promise<void>;
  systemSettings: SystemSettings;
  updateSystemSettings: (updates: Partial<SystemSettings>) => Promise<void>;
  allocateBudgetForGroup: (groupId: string, amount: number, fiscalYear: number, accountNumber?: string) => Promise<void>;
  updateProjectBudget: (id: string, amount: number) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  closeFinancialYear: (year: number) => Promise<void>;
  openFinancialYear: (year: number) => Promise<void>;
  supplementaryRequests: SupplementaryBudgetRequest[];
  applySupplementaryBudget: (projectId: string, amount: number, justification: string) => Promise<void>;
  vendors: Vendor[];
  addVendor: (vendor: Omit<Vendor, "id" | "createdAt" | "addedBy" | "status">) => Promise<void>;
  updateVendor: (id: string, updates: Partial<Omit<Vendor, "id" | "createdAt" | "addedBy">>) => Promise<void>;
  deleteVendor: (id: string) => Promise<void>;
  reports: SavedReport[];
  saveReport: (report: Omit<SavedReport, "id" | "timestamp" | "generatedBy" | "generatedById">) => Promise<void>;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  searchFilter: SearchFilter;
  setSearchFilter: (filter: SearchFilter) => void;
  advancedSearchActive: boolean;
  setAdvancedSearchActive: (active: boolean) => void;
  advancedDateRangePreset: "ALL" | "WEEK" | "MONTH" | "CUSTOM";
  setAdvancedDateRangePreset: (preset: "ALL" | "WEEK" | "MONTH" | "CUSTOM") => void;
  advancedCustomStartDate: string;
  setAdvancedCustomStartDate: (date: string) => void;
  advancedCustomEndDate: string;
  setAdvancedCustomEndDate: (date: string) => void;
  advancedBudgetLine: string;
  setAdvancedBudgetLine: (line: string) => void;
  activeToasts: BudgetAlert[];
  removeToast: (id: string) => void;
  triggerToast: (toast: Omit<BudgetAlert, "id" | "isRead"> & { isRead?: boolean }) => void;
  readNoticeIds: string[];
  toggleNoticeRead: (id: string, forceRead?: boolean) => void;
  markAllNoticesRead: (ids: string[]) => void;
  permissionConfigs: PermissionConfig[];
  canAccess: (viewId: string) => boolean;
  canPerform: (actionId: keyof PermissionConfig["actions"]) => boolean;
  updateRolePermissions: (roleId: string, updates: any) => Promise<void>;
  transactions: Transaction[];
  fiscalYears: FiscalYear[];
  createFiscalYear: (year: number, label: string, status: "OPEN" | "CLOSED" | "ARCHIVED", notes?: string) => Promise<void>;
  toggleFiscalYearStatus: (id: string, status: "OPEN" | "CLOSED" | "ARCHIVED") => Promise<void>;
  setActiveFiscalYear: (year: number) => Promise<void>;
  cloneFiscalYearBudgets: (
    sourceYear: number, 
    targetYear: number, 
    targetLabel: string, 
    targetNotes?: string,
    setActiveImmediately?: boolean
  ) => Promise<void>;
  firestoreQuotaExceeded: boolean;
  setFirestoreQuotaExceeded: (val: boolean) => void;
  setSyncTargets: (targets: string[]) => void;
  systemLogLimit: number;
  setSystemLogLimit: (limit: number) => void;
  sendBulkEmail: (subject: string, content: string, recipients?: string[]) => Promise<{ success: boolean; total: number; successful: string[]; failed: any[]; simulated?: boolean; message?: string }>;
}

const RequisitionContext = createContext<RequisitionContextType | undefined>(undefined);

export const RequisitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [churchGroups, setChurchGroups] = useState<ChurchGroup[]>([]);
  const [lastGroupsSync, setLastGroupsSync] = useState<Date | null>(null);
  const [ledgerBooks, setLedgerBooks] = useState<LedgerBook[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [forecastData, setForecastData] = useState<ForecastMonth[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [systemLogLimit, setSystemLogLimit] = useState<number>(50);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({ currentFiscalYear: 2026, fiscalYearStatus: "OPEN" });
  const [supplementaryRequests, setSupplementaryRequests] = useState<SupplementaryBudgetRequest[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [permissionConfigs, setPermissionConfigs] = useState<PermissionConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const [firestoreQuotaExceeded, setFirestoreQuotaExceeded] = useState(() => {
    return isFirestoreQuotaExceeded();
  });
  const skipFirestore = true; // Route exclusively to local MongoDB/Mongoose server endpoints
  const [activeSyncTargets, setActiveSyncTargets] = useState<Set<string>>(new Set(['settings', 'alerts']));
  const [syncingTargets, setSyncingTargets] = useState<Set<string>>(new Set());

  const setSyncTargets = useCallback((targets: string[]) => {
    setActiveSyncTargets(new Set(['settings', 'alerts', ...targets]));
  }, []);

  const startSyncing = useCallback((target: string) => {
    setSyncingTargets(prev => new Set(prev).add(target));
  }, []);

  const stopSyncing = useCallback((target: string) => {
    setSyncingTargets(prev => {
      const next = new Set(prev);
      next.delete(target);
      return next;
    });
  }, []);

  const handleSyncError = useCallback((err: any, opType: OperationType, path: string) => {
    if (
      err?.code === "resource-exhausted" || 
      err?.message?.includes("Quota exceeded") || 
      String(err).includes("Quota exceeded")
    ) {
      setFirestoreQuotaExceeded(true);
      if (typeof window !== "undefined") {
        localStorage.setItem("firestore_actual_quota_exceeded", "true");
      }
      console.log(`[Firestore Quota Exceeded] onSnapshot failed for ${path}: continuing with local cache.`);
      return;
    }
    handleFirestoreError(err, opType, path);
  }, []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fiscalYears, setFiscalYears] = useState<FiscalYear[]>([]);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [searchFilter, setSearchFilter] = useState<SearchFilter>("ALL");
  const [advancedSearchActive, setAdvancedSearchActive] = useState(false);
  const [advancedDateRangePreset, setAdvancedDateRangePreset] = useState<"ALL" | "WEEK" | "MONTH" | "CUSTOM">("ALL");
  const [advancedCustomStartDate, setAdvancedCustomStartDate] = useState("");
  const [advancedCustomEndDate, setAdvancedCustomEndDate] = useState("");
  const [advancedBudgetLine, setAdvancedBudgetLine] = useState("ALL");
  const [activeToasts, setActiveToasts] = useState<BudgetAlert[]>([]);
  const fetchedTargetsRef = useRef<Set<string>>(new Set());

  // Stabilize sync targets key to prevent redundant effect triggers when reference changes but content is same
  const syncTargetsKey = Array.from(activeSyncTargets).sort().join(',');
  const [readNoticeIds, setReadNoticeIds] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("read_notification_ids");
        return saved ? JSON.parse(saved) : [];
      } catch (err) {
        console.error("Failed to parse read notices", err);
      }
    }
    return [];
  });

  const toggleNoticeRead = useCallback((id: string, forceRead?: boolean) => {
    setReadNoticeIds(prev => {
      let next;
      if (forceRead !== undefined) {
        if (forceRead) {
          next = prev.includes(id) ? prev : [...prev, id];
        } else {
          next = prev.filter(item => item !== id);
        }
      } else {
        next = prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id];
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("read_notification_ids", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save read notices", err);
        }
      }
      return next;
    });
  }, []);

  const markAllNoticesRead = useCallback((ids: string[]) => {
    setReadNoticeIds(prev => {
      const next = Array.from(new Set([...prev, ...ids]));
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("read_notification_ids", JSON.stringify(next));
        } catch (err) {
          console.error("Failed to save read notices", err);
        }
      }
      return next;
    });
  }, []);

  const canAccess = useCallback((viewId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;
    
    if (viewId === "finance") {
      return [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(currentUser.role);
    }
    
    if (viewId === "vendors") {
      const viewLevel = systemSettings.vendorListViewLevel || "ALL_USERS";
      if (viewLevel === "ADMINS_ONLY") {
        return currentUser.role === UserRole.ADMIN;
      }
      if (viewLevel === "FINANCE_UP") {
        return [UserRole.FINANCE, UserRole.ADMIN].includes(currentUser.role);
      }
      if (viewLevel === "APPROVERS_UP") {
        return [UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN].includes(currentUser.role);
      }
      return true; // ALL_USERS
    }
    
    const config = permissionConfigs.find(c => c.role === currentUser.role);
    if (!config) {
      const defaults: Record<string, string[]> = {
        [UserRole.CHURCH_GROUP]: ["dashboard", "requisitions", "notifications", "finance"],
        [UserRole.APPROVER_L1]: ["dashboard", "requisitions", "approvals", "notifications", "finance"],
        [UserRole.APPROVER_L2]: ["dashboard", "requisitions", "approvals", "notifications", "finance"],
        [UserRole.FINANCE]: ["dashboard", "requisitions", "finance", "reports", "notifications", "settings", "auditTrail", "transactions"],
        [UserRole.ADMIN]: ["dashboard", "requisitions", "vendors", "approvals", "finance", "reports", "users", "settings", "notifications", "auditTrail", "accessControl", "transactions"],
      };
      return defaults[currentUser.role]?.includes(viewId) ?? false;
    }
    
    return (config.access as any)[viewId] ?? false;
  }, [currentUser, permissionConfigs, systemSettings]);

  const canPerform = useCallback((actionId: keyof PermissionConfig["actions"]) => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.SUPER_ADMIN) return true;

    const config = permissionConfigs.find(c => c.role === currentUser.role);
    if (!config) {
      if (actionId === 'canCreateRequisition') return currentUser.role === UserRole.CHURCH_GROUP || currentUser.role === UserRole.ADMIN;
      if (actionId === 'canApproveL1') return currentUser.role === UserRole.APPROVER_L1 || currentUser.role === UserRole.ADMIN;
      if (actionId === 'canApproveL2') return currentUser.role === UserRole.APPROVER_L2 || currentUser.role === UserRole.ADMIN;
      if (actionId === 'canDisburse') return currentUser.role === UserRole.FINANCE || currentUser.role === UserRole.ADMIN;
      if (actionId === 'canDeleteRequisition') return currentUser.role === UserRole.ADMIN;
      if (actionId === 'canManageUsers') return currentUser.role === UserRole.ADMIN;
      if (actionId === 'canManageSettings') return currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCE;
      return false;
    }

    return config.actions[actionId] ?? false;
  }, [currentUser, permissionConfigs]);

  const updateRolePermissions = useCallback(async (roleId: string, updates: any) => {
    try {
      await setDoc(doc(db, "permissions", roleId), updates, { merge: true });
      await addSystemLog("PERMISSIONS_UPDATED", `Access rights modified for role: ${roleId}`, { roleId, updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `permissions/${roleId}`);
    }
  }, [db]);

  const removeToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const triggerToast = useCallback((toast: Omit<BudgetAlert, "id" | "isRead"> & { isRead?: boolean }) => {
    const id = `toast-${Math.random().toString(36).substr(2, 9)}`;
    const newToast: BudgetAlert = {
      ...toast,
      id,
      isRead: toast.isRead ?? false
    };
    setActiveToasts(prev => [newToast, ...prev].slice(0, 5));
  }, []);

  // Track which alerts have already been sent to activeToasts
  const seenAlertsRef = React.useRef<Set<string>>(new Set());

  // Monitor for new high-priority alerts to show as toasts
  useEffect(() => {
    if (alerts.length === 0) return;

    // Latest 3 unread high/medium alerts from the last 5 minutes
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const seenNew = new Set<string>();
    const newPriorityAlerts = alerts.filter(a => {
      if (!a || !a.id) return false;
      if (seenNew.has(a.id)) return false;
      seenNew.add(a.id);
      return !a.isRead && 
        (a.severity === "HIGH" || a.severity === "MEDIUM") &&
        new Date(a.timestamp) > fiveMinutesAgo &&
        !seenAlertsRef.current.has(a.id) &&
        !a.id.includes("budget-p") &&
        !a.id.includes("req-seed-");
    });

    if (newPriorityAlerts.length > 0) {
      newPriorityAlerts.forEach(a => seenAlertsRef.current.add(a.id));
      setActiveToasts(prev => {
        const combined = [...newPriorityAlerts, ...prev];
        const seen = new Set<string>();
        const unique = combined.filter(item => {
          if (!item || !item.id) return false;
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
        return unique.slice(0, 2);
      });
    }
  }, [alerts]);



  // Capture invitation parameter state
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("invite") === "true") {
      const email = params.get("email");
      const role = params.get("role") as UserRole;
      const group = params.get("group");
      const code = params.get("code");

      if (email && role) {
        sessionStorage.setItem("requisition_invite", JSON.stringify({ email, role, group, code }));
        console.log("Captured secure system invitation in session storage for:", email);
      }

      // Clear search parameters cleanly for aesthetic UI experience
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  // Auth Sync (Firebase Auth)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userEmail = firebaseUser.email?.toLowerCase();
        try {
          const res = await fetch(`/api/auth/get-profile-by-email?email=${encodeURIComponent(userEmail || "")}`);
          const data = await res.json();
          if (res.ok && data.exists && data.profile) {
            const dbUser = data.profile;
            
            // Self-healing / alignment: if the profile's ID in database is different from the Firebase Auth UID
            if (dbUser.id !== firebaseUser.uid) {
              console.log(`[Auth Sync] Mismatch detected for ${userEmail}. Re-linking profile to new Firebase UID: ${firebaseUser.uid}`);
              await fetch("/api/auth/link-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uid: firebaseUser.uid,
                  email: userEmail,
                  profileId: dbUser.id
                })
              });
              dbUser.id = firebaseUser.uid;
            }

            const isSuperAdmin = dbUser.role === UserRole.SUPER_ADMIN || dbUser.role === "SUPER_ADMIN";
            setCurrentUser(normalizeUserProfile({
              ...dbUser,
              approverCode: dbUser.approverCode || dbUser.approver_code,
              isActive: isSuperAdmin ? true : (dbUser.isActive !== undefined ? dbUser.isActive : (dbUser.is_active !== undefined ? dbUser.is_active : true)),
              isApproved: isSuperAdmin ? true : (dbUser.isApproved !== undefined ? dbUser.isApproved : (dbUser.is_approved !== undefined ? dbUser.is_approved : true)),
              isSuspended: dbUser.isSuspended !== undefined ? dbUser.isSuspended : (dbUser.is_suspended !== undefined ? dbUser.is_suspended : false),
              photoURL: dbUser.photoURL || dbUser.photo_url,
              tempPassword: dbUser.tempPassword || dbUser.temp_password,
              isOnline: dbUser.isOnline !== undefined ? dbUser.isOnline : (dbUser.is_online !== undefined ? dbUser.is_online : false),
              lastSeen: dbUser.lastSeen || dbUser.last_seen,
              idleTimeoutDuration: dbUser.idleTimeoutDuration || dbUser.idle_timeout_duration || 15
            } as UserProfile));
          } else {
            const defaultUser = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || userEmail || "User",
              email: userEmail || "",
              role: "CHURCH_GROUP" as UserRole,
              isActive: true,
              isApproved: true,
              isSuspended: false
            };
            setCurrentUser(defaultUser as any);
            await setDoc(doc(db, "users", firebaseUser.uid), defaultUser);
          }
        } catch (err) {
          console.warn("Could not fetch user profile from backend database, setting default:", err);
          const fallbackUser = {
            id: firebaseUser.uid,
            name: firebaseUser.displayName || userEmail || "User",
            email: userEmail || "",
            role: "CHURCH_GROUP" as UserRole,
            isActive: true,
            isApproved: true,
            isSuspended: false
          };
          setCurrentUser(fallbackUser as any);
          await setDoc(doc(db, "users", firebaseUser.uid), fallbackUser);
        }
        setAuthLoading(false);
      } else {
        setCurrentUser(null);
        setAuthLoading(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Sync currentUser with real-time polled users list from MongoDB
  useEffect(() => {
    if (!currentUser || !currentUser.id || users.length === 0) return;
    const dbProfile = users.find(u => u.id === currentUser.id || u.email.toLowerCase() === currentUser.email.toLowerCase());
    if (dbProfile) {
      const hasChanged = 
        dbProfile.role !== currentUser.role ||
        dbProfile.isApproved !== currentUser.isApproved ||
        dbProfile.isSuspended !== currentUser.isSuspended ||
        dbProfile.isActive !== currentUser.isActive ||
        dbProfile.group !== currentUser.group ||
        JSON.stringify(dbProfile.groups || []) !== JSON.stringify(currentUser.groups || []);

      if (hasChanged) {
        console.log("[Auth Sync] Aligning currentUser state with latest database profile:", dbProfile);
        setCurrentUser(prev => prev ? { ...prev, ...dbProfile } : null);
      }
    }
  }, [users, currentUser?.id, currentUser?.email]);

  const addSystemLog = useCallback(async (action: string, details: string, metadata?: any) => {
    try {
      // Ensure we have a current user or auth state before attempting to write logs
      // This prevents permission errors during early initialization
      if (!currentUser) return;

      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const performedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : "System";
      const timestamp = new Date().toISOString();
      
      const logDoc = {
        id: logId,
        action,
        details,
        performedBy,
        timestamp,
        ...(currentUser?.group && { groupId: currentUser.group }),
        ...(metadata && { metadata })
      };
      
      await databaseService.saveAuditLog(logDoc);

      // Notify Slack via our internal API proxy
      if (action !== "FINANCE_ALERT_TRIGGERED") {
        try {
          fetch("/api/notify-slack", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action,
              details,
              performedBy,
              timestamp,
              metadata
            })
          }).catch(err => console.log("Slack background notify failed", err));
        } catch (slackErr) {
          console.log("Failed to start Slack notification", slackErr);
        }
      }
      
    } catch (err: any) {
      console.log("Failed to add system log (possibly due to auth sync race condition):", err.message);
    }
  }, [currentUser]);

  const seedAllEcosystemData = useCallback(async () => {
    console.log("Mock data seeding is disabled.");
  }, []);

  const updateSystemSettings = useCallback(async (updates: Partial<SystemSettings>) => {
    try {
      if (skipFirestore) {
        setSystemSettings(prev => {
          const nextSettings = { ...prev, ...updates };
          localStorage.setItem("stands_cache_system_settings", JSON.stringify(nextSettings));
          return nextSettings;
        });
      } else {
        await setDoc(doc(db, "settings", "system"), updates, { merge: true });
      }
      await addSystemLog("SYSTEM_SETTINGS_UPDATE", `System settings updated: ${JSON.stringify(updates)}`, { updates });
      triggerToast({ type: "SYSTEM_INFO", message: "System settings saved successfully", severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, "settings/system");
    }
  }, [addSystemLog, triggerToast, skipFirestore]);

  const allocateBudgetForGroup = useCallback(async (groupId: string, amount: number, fiscalYear: number, accountNumber?: string) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.FINANCE) {
      throw new Error("Unauthorized: Only Admins, Super Admins, and Finance can allocate group budgets.");
    }

    try {
      console.log("Allocating budget:", { groupId, amount, fiscalYear, accountNumber, projects });
      const match = projects.find(p => 
        p.groupId === groupId && 
        (p.fiscalYear === fiscalYear || (!p.fiscalYear && fiscalYear === 2026))
      );
      console.log("Found match:", match);
      if (match) {
        console.log("Updating project:", match.id);
        const updatedProject = {
          ...match,
          allocatedBudget: amount,
          status: "ACTIVE" as const,
          fiscalYear: fiscalYear,
          ...(accountNumber ? { accountNumber } : {})
        };
        await databaseService.saveProject(updatedProject);
        await addSystemLog("BUDGET_ALLOCATED", `Updated budget for '${groupId}' to KES ${amount.toLocaleString()} for FY ${fiscalYear}${accountNumber ? ` with Account Number ${accountNumber}` : ""}`, { groupId, amount, fiscalYear, accountNumber });
      } else {
        const newProjId = "p-" + Math.random().toString(36).substring(2, 9);
        const newProject = {
          id: newProjId,
          name: groupId,
          groupId: groupId,
          allocatedBudget: amount,
          spentAmount: 0,
          status: "ACTIVE" as const,
          color: "bg-indigo-500",
          fiscalYear: fiscalYear,
          accountNumber: accountNumber || ""
        };
        console.log("Creating new project:", newProject);
        await databaseService.saveProject(newProject);
        await addSystemLog("BUDGET_CREATED", `Allocated initial budget for '${groupId}' of KES ${amount.toLocaleString()} for FY ${fiscalYear}${accountNumber ? ` with Account Number ${accountNumber}` : ""}`, { groupId, amount, fiscalYear, accountNumber });
      }

      triggerToast({ type: "SYSTEM_INFO", message: `Budget for ${groupId} allocated for FY ${fiscalYear}`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to allocate budget:", err);
      throw err;
    }
  }, [currentUser, db, projects, addSystemLog, triggerToast]);

  const closeFinancialYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can close financial accounts.");
    }

    try {
      const yearProjects = projects.filter(p => !p.fiscalYear || p.fiscalYear === year);
      for (const p of yearProjects) {
        await updateDoc(doc(db, "projects", p.id), { status: "CLOSED" });
      }

      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: "CLOSED"
      });

      await addSystemLog("FINANCIAL_YEAR_CLOSED", `Financial Year ${year} books closed successfully. No further disbursements or allocations permitted for this year.`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} has been CLOSED.`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to close financial year:", err);
      throw err;
    }
  }, [currentUser, db, projects, updateSystemSettings, addSystemLog, triggerToast]);

  const openFinancialYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can open financial accounts.");
    }

    try {
      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: "OPEN"
      });

      const currentYearProjects = projects.filter(p => p.fiscalYear === (year - 1) || (!p.fiscalYear && year === 2027));
      
      if (currentYearProjects.length > 0) {
        for (const prevP of currentYearProjects) {
          const exists = projects.some(p => p.groupId === prevP.groupId && p.fiscalYear === year);
          if (!exists) {
            const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
            const nextProj = {
              id: nextProjId,
              name: prevP.name,
              groupId: prevP.groupId,
              allocatedBudget: 0,
              spentAmount: 0,
              status: "ACTIVE" as const,
              color: prevP.color || "bg-indigo-500",
              fiscalYear: year
            };
            await setDoc(doc(db, "projects", nextProjId), nextProj);
          }
        }
      } else {
        for (const cg of churchGroups) {
          const exists = projects.some(p => p.groupId === cg.name && p.fiscalYear === year);
          if (!exists) {
            const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
            const nextProj = {
              id: nextProjId,
              name: cg.name,
              groupId: cg.name,
              allocatedBudget: 0,
              spentAmount: 0,
              status: "ACTIVE" as const,
              color: "bg-indigo-500",
              fiscalYear: year
            };
            await setDoc(doc(db, "projects", nextProjId), nextProj);
          }
        }
      }

      await addSystemLog("FINANCIAL_YEAR_OPENED", `Financial Year ${year} books opened. Budget lines ready for deployment.`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} opened successfully!`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to open financial year:", err);
      throw err;
    }
  }, [currentUser, db, projects, churchGroups, updateSystemSettings, addSystemLog, triggerToast]);

  const updateProjectBudget = useCallback(async (id: string, amount: number) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can modify budgets.");
    }
    try {
      const projRef = doc(db, "projects", id);
      await updateDoc(projRef, { allocatedBudget: amount });
      await addSystemLog("BUDGET_ADJUSTMENT", `Admin adjusted budget for project ID ${id} to KES ${amount}`, { projectId: id, amount });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `projects/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const deleteProject = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can delete budgets.");
    }
    try {
      await deleteDoc(doc(db, "projects", id));
      await addSystemLog("BUDGET_DELETED", `Admin deleted budget line ID: ${id}`, { projectId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `projects/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const createFiscalYear = useCallback(async (year: number, label: string, status: "OPEN" | "CLOSED" | "ARCHIVED", notes?: string) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can define fiscal years.");
    }

    try {
      const yearId = year.toString();
      const newFiscalYear: FiscalYear = {
        id: yearId,
        year,
        label,
        status,
        createdAt: new Date().toISOString(),
        notes: notes || ""
      };
      
      await setDoc(doc(db, "fiscal_years", yearId), cleanFirestoreData(newFiscalYear));

      await addSystemLog("FISCAL_YEAR_CREATED", `Admin defined new Financial Year ${year}: ${label}`, { year, label, status });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${year} has been created.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `fiscal_years/${year}`);
    }
  }, [currentUser, db, addSystemLog, triggerToast]);

  const toggleFiscalYearStatus = useCallback(async (id: string, status: "OPEN" | "CLOSED" | "ARCHIVED") => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can modify fiscal years.");
    }

    try {
      await updateDoc(doc(db, "fiscal_years", id), { status });
      
      // If of the same currently active year, sync system settings
      if (systemSettings.currentFiscalYear === parseInt(id)) {
        await updateSystemSettings({ fiscalYearStatus: status });
      }

      await addSystemLog("FISCAL_YEAR_STATUS_TOGGLED", `Admin toggled Financial Year ${id} status to ${status}`, { id, status });
      triggerToast({ type: "SYSTEM_INFO", message: `Financial Year ${id} status toggled to ${status}.`, severity: "MEDIUM", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `fiscal_years/${id}`);
    }
  }, [currentUser, db, systemSettings, updateSystemSettings, addSystemLog, triggerToast]);

  const setActiveFiscalYear = useCallback(async (year: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can set the active fiscal year.");
    }

    try {
      const targetYearInfo = fiscalYears.find(f => f.year === year);
      const targetStatus = targetYearInfo ? targetYearInfo.status : "CLOSED";

      // Toggle active year in system settings
      await updateSystemSettings({
        currentFiscalYear: year,
        fiscalYearStatus: targetStatus
      });

      // Mirror the project copies creation if it is OPEN
      if (targetStatus === "OPEN") {
        const currentYearProjects = projects.filter(p => p.fiscalYear === (year - 1) || (!p.fiscalYear && year === 2027));
        
        if (currentYearProjects.length > 0) {
          for (const prevP of currentYearProjects) {
            const exists = projects.some(p => p.groupId === prevP.groupId && p.fiscalYear === year);
            if (!exists) {
              const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
              await setDoc(doc(db, "projects", nextProjId), {
                id: nextProjId,
                name: prevP.name,
                groupId: prevP.groupId,
                allocatedBudget: 0,
                spentAmount: 0,
                status: "ACTIVE",
                color: prevP.color || "bg-indigo-500",
                fiscalYear: year
              });
            }
          }
        } else {
          for (const cg of churchGroups) {
            const exists = projects.some(p => p.groupId === cg.name && p.fiscalYear === year);
            if (!exists) {
              const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
              await setDoc(doc(db, "projects", nextProjId), {
                id: nextProjId,
                name: cg.name,
                groupId: cg.name,
                allocatedBudget: 0,
                spentAmount: 0,
                status: "ACTIVE",
                color: "bg-indigo-500",
                fiscalYear: year
              });
            }
          }
        }
      }

      await addSystemLog("FISCAL_YEAR_ACTIVATED", `Admin set currently active Financial Year to ${year}`, { year });
      triggerToast({ type: "SYSTEM_INFO", message: `Active Financial Year switched to ${year} (${targetStatus})!`, severity: "HIGH", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to switch active fiscal year:", err);
      throw err;
    }
  }, [currentUser, db, fiscalYears, projects, churchGroups, updateSystemSettings, addSystemLog, triggerToast]);

  const cloneFiscalYearBudgets = useCallback(async (
    sourceYear: number, 
    targetYear: number, 
    targetLabel: string, 
    targetNotes?: string,
    setActiveImmediately?: boolean
  ) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Admins and Super Admins can execute the New Year Setup wizard.");
    }

    try {
      // 1. Create target fiscal year if it doesn't exist
      const yearId = targetYear.toString();
      const existingFy = fiscalYears.find(f => f.year === targetYear);
      if (!existingFy) {
        const newFiscalYear: FiscalYear = {
          id: yearId,
          year: targetYear,
          label: targetLabel,
          status: "OPEN",
          createdAt: new Date().toISOString(),
          notes: targetNotes || ""
        };
        await setDoc(doc(db, "fiscal_years", yearId), cleanFirestoreData(newFiscalYear));
      }

      // 2. Map existing active projects of source year to duplicate in target year
      const sourceProjects = projects.filter(p => p.fiscalYear === sourceYear || (!p.fiscalYear && sourceYear === 2026));
      let clonedCount = 0;
      let totalValueCloned = 0;

      for (const p of sourceProjects) {
        // Find if target project already exists to avoid duplicate entries
        const targetProjMatch = projects.find(tp => tp.groupId === p.groupId && tp.fiscalYear === targetYear);
        if (!targetProjMatch) {
          const nextProjId = "p-" + Math.random().toString(36).substring(2, 9);
          const nextProject = {
            id: nextProjId,
            name: p.name,
            groupId: p.groupId,
            allocatedBudget: p.allocatedBudget,
            spentAmount: 0,
            status: "ACTIVE" as const,
            color: p.color || "bg-indigo-500",
            fiscalYear: targetYear
          };
          await setDoc(doc(db, "projects", nextProjId), cleanFirestoreData(nextProject));
          clonedCount++;
          totalValueCloned += p.allocatedBudget;
        } else {
          // Overwrite existing budget for high consistency
          const projRef = doc(db, "projects", targetProjMatch.id);
          await updateDoc(projRef, {
            allocatedBudget: p.allocatedBudget,
            status: "ACTIVE"
          });
          clonedCount++;
          totalValueCloned += p.allocatedBudget;
        }
      }

      // 3. Mark active if selected
      if (setActiveImmediately) {
        await updateSystemSettings({
          currentFiscalYear: targetYear,
          fiscalYearStatus: "OPEN"
        });
      }

      await addSystemLog("FISCAL_YEAR_CLONED", `Admin cloned ${clonedCount} group budget allocations (totaling KES ${totalValueCloned.toLocaleString()}) from FY ${sourceYear} to FY ${targetYear}.`, { sourceYear, targetYear, clonedCount, totalValueCloned, setActiveImmediately });
      
      triggerToast({ 
        type: "SYSTEM_INFO", 
        message: `FY ${targetYear} successfully configured. ${clonedCount} allocations cloned.`, 
        severity: "HIGH", 
        timestamp: new Date().toISOString() 
      });
    } catch (err) {
      console.error("Failed to clone fiscal year budgets:", err);
      throw err;
    }
  }, [currentUser, db, fiscalYears, projects, addSystemLog, triggerToast, updateSystemSettings]);

  const applySupplementaryBudget = useCallback(async (projectId: string, amount: number, justification: string) => {
    if (!currentUser) throw new Error("Authentication required");
    
    try {
      const budgetId = "sup-" + Math.random().toString(36).substring(2, 9);
      const proj = projects.find(p => p.id === projectId);
      const projectName = proj ? proj.name : "Church Allocation";
      
      const requestData = {
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        requesterEmail: currentUser.email,
        role: currentUser.role,
        projectId,
        projectName,
        amount,
        justification,
        submittedAt: new Date().toISOString(),
        status: "PENDING"
      };

      await setDoc(doc(db, "supplementary_budgets", budgetId), requestData);
      
      // Add alert for Admin/Super Admin
      const alertId = "alert-" + Math.random().toString(36).substring(2, 9);
      await setDoc(doc(db, "alerts", alertId), {
        id: alertId,
        type: "THRESHOLD_WARN",
        severity: "MEDIUM",
        message: `Supplementary budget request (KES ${amount.toLocaleString()}) submitted by ${currentUser.name} for project: ${projectName}`,
        timestamp: new Date().toISOString(),
        isRead: false,
        targetRole: UserRole.SUPER_ADMIN
      });

      await addSystemLog("SUPPLEMENTARY_BUDGET_APPLY", `Supplementary budget of KES ${amount} submitted on terminal by ${currentUser.name} for ${projectName}`, { projectId, amount });
    } catch (err) {
      console.error("Failed to submit supplementary budget:", err);
      throw err;
    }
  }, [currentUser, db, projects, addSystemLog]);

  const addVendor = useCallback(async (vendor: Omit<Vendor, "id" | "createdAt" | "addedBy" | "status">) => {
    try {
      const vendorId = "vendor-" + Math.random().toString(36).substring(2, 9);
      const addedBy = currentUser ? currentUser.name : "System";
      
      // Determine initial status based on user role
      const isAdminRole = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
      const status = isAdminRole ? "APPROVED" : "PENDING";

      const newVendor: Vendor = {
        id: vendorId,
        ...vendor,
        createdAt: new Date().toISOString(),
        addedBy,
        status
      };

      await setDoc(doc(db, "vendors", vendorId), newVendor);
      await addSystemLog("VENDOR_CREATE", `${isAdminRole ? 'Registered' : 'Requested to add'} new STANDS vendor: ${vendor.name}`, { vendorId, ...vendor, status });
    } catch (err) {
      console.error("Failed to add vendor:", err);
      throw err;
    }
  }, [currentUser, db, addSystemLog]);

  const updateVendor = useCallback(async (id: string, updates: Partial<Omit<Vendor, "id" | "createdAt" | "addedBy">>) => {
    try {
      const vendorRef = doc(db, "vendors", id);
      await updateDoc(vendorRef, updates as any);
      await addSystemLog("VENDOR_UPDATE", `Updated vendor: ${id}`, { vendorId: id, updates });
    } catch (err) {
      console.error("Failed to update vendor:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  const deleteVendor = useCallback(async (id: string) => {
    try {
      const vendorRef = doc(db, "vendors", id);
      const vendorSnap = await getDoc(vendorRef);
      const vendorName = vendorSnap.exists() ? (vendorSnap.data() as Vendor).name : id;
      
      await deleteDoc(vendorRef);
      await addSystemLog("VENDOR_DELETE", `Deleted STANDS vendor: ${vendorName}`, { vendorId: id });
    } catch (err) {
      console.error("Failed to delete vendor:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  // System Settings Sync
  useEffect(() => {
    if (skipFirestore) return;
    const unsub = onSnapshot(doc(db, "settings", "system"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.currentFiscalYear === undefined) {
          setDoc(doc(db, "settings", "system"), { ...data, currentFiscalYear: 2026, fiscalYearStatus: "OPEN" }, { merge: true }).catch(() => {});
        }
        setSystemSettings(snap.data() as SystemSettings);
      } else {
        setDoc(doc(db, "settings", "system"), { currentFiscalYear: 2026, fiscalYearStatus: "OPEN" }).catch(() => {});
      }
    }, (err) => handleSyncError(err, OperationType.GET, "settings/system"));
    return () => unsub();
  }, [handleSyncError]);

  // background-refresh local caching strategy using localStorage
  useEffect(() => {
    if (currentUser && currentUser.id) {
      if (typeof window !== "undefined") {
        try {
          const cachedReqs = localStorage.getItem(`stands_cache_reqs_${currentUser.id}`);
          if (cachedReqs) {
            const parsed = JSON.parse(cachedReqs);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setRequisitions(parsed);
            }
          }

          const cachedProjects = localStorage.getItem(`stands_cache_projects_${currentUser.id}`);
          if (cachedProjects) {
            const parsed = JSON.parse(cachedProjects);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setProjects(parsed);
            }
          }

          const cachedVendors = localStorage.getItem(`stands_cache_vendors_${currentUser.id}`);
          if (cachedVendors) {
            const parsed = JSON.parse(cachedVendors);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setVendors(parsed);
            }
          }

          const cachedSettings = localStorage.getItem("stands_cache_system_settings");
          if (cachedSettings) {
            setSystemSettings(JSON.parse(cachedSettings));
          }
        } catch (err) {
          console.log("[Cache] Failed to load cached data:", err);
        }
      }
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && requisitions.length > 0) {
      try {
        localStorage.setItem(`stands_cache_reqs_${currentUser.id}`, JSON.stringify(requisitions));
      } catch (err) {
        console.log("[Cache] Failed to cache requisitions:", err);
      }
    }
  }, [requisitions, currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && projects.length > 0) {
      try {
        localStorage.setItem(`stands_cache_projects_${currentUser.id}`, JSON.stringify(projects));
      } catch (err) {
        console.log("[Cache] Failed to cache projects:", err);
      }
    }
  }, [projects, currentUser?.id]);

  useEffect(() => {
    if (currentUser && currentUser.id && vendors.length > 0) {
      try {
        localStorage.setItem(`stands_cache_vendors_${currentUser.id}`, JSON.stringify(vendors));
      } catch (err) {
        console.log("[Cache] Failed to cache vendors:", err);
      }
    }
  }, [vendors, currentUser?.id]);

  useEffect(() => {
    if (systemSettings) {
      try {
        localStorage.setItem("stands_cache_system_settings", JSON.stringify(systemSettings));
      } catch (err) {
        console.log("[Cache] Failed to cache system settings:", err);
      }
    }
  }, [systemSettings]);

  // Stable properties of currentUser to avoid redundant subscription triggers
  const currentUserId = currentUser?.id || "";
  const currentUserRole = currentUser?.role || "";
  const currentUserGroup = currentUser?.group || "";
  const currentUserIsApproved = currentUser?.isApproved || currentUser?.role === UserRole.SUPER_ADMIN || false;
  const currentUserIsSuspended = currentUser?.isSuspended || false;
  const currentUserGroupsJSON = JSON.stringify(currentUser?.groups || []);

  // Real-time Sync for authenticated users (with filtering based on prototype settings)
  useEffect(() => {
    if (!currentUser || !currentUserId || !currentUserIsApproved || currentUserIsSuspended) {
      setRequisitions([]);
      setProjects([]);
      setAlerts([]);
      setThresholds([]);
      setUsers([]);
      setForecastData([]);
      setSystemLogs([]);
      setFiscalYears([]);
    }
  }, [currentUser, currentUserId, currentUserIsApproved, currentUserIsSuspended]);

  // Lazy Requisitions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('requisitions')) return;
    const hidePrototype = true;
    const isGroupUser = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    // Optimization: Filter by group on server if there's only one group to reduce initial load
    let baseQuery = query(collection(db, "requisitions"), orderBy("submittedAt", "desc"), limit(100));
    
    // Server-side filtering for group users with a single primary group
    if (isGroupUser && parsedGroups.length === 1) {
      baseQuery = query(
        collection(db, "requisitions"), 
        where("groupName", "==", parsedGroups[0]),
        orderBy("submittedAt", "desc"), 
        limit(100)
      );
    }

    let isFirstSnap = true;

    const unsubRequisitions = onSnapshot(baseQuery, (snap) => {
      let data = snap.docs.map(doc => {
        const r = doc.data() as any;
        return {
          id: doc.id,
          ...r,
          attachments: safeNormalizeAttachments(r?.attachments),
          receipts: safeNormalizeReceipts(r?.receipts),
          approvalHistory: safeNormalizeApprovalHistory(r?.approvalHistory || r?.approval_history)
        } as Requisition;
      });
      // Client-side additional filtering for non-standard access or multiple groups
      if (isGroupUser && parsedGroups.length > 1) {
        data = data.filter(req => parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName));
      }
      if (hidePrototype) data = data.filter(req => !req.id.startsWith("req-seed-"));

      if (isFirstSnap) {
        isFirstSnap = false;
      } else {
        let hasAdded = false;
        let hasModified = false;
        
        snap.docChanges().forEach(change => {
          if (change.type === "added") {
            const reqId = change.doc.id;
            if (!change.doc.metadata.hasPendingWrites && !reqId.startsWith("req-seed-")) {
              hasAdded = true;
            }
          } else if (change.type === "modified") {
            const reqId = change.doc.id;
            if (!change.doc.metadata.hasPendingWrites && !reqId.startsWith("req-seed-")) {
              hasModified = true;
            }
          }
        });

        if (hasAdded || hasModified) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: `Data Updated: ${hasAdded && hasModified ? "New & Updated Requisitions Synced" : hasAdded ? "New Requisition Added" : "Requisitions Updated/Approved"}`,
            timestamp: new Date().toISOString()
          });
        }
      }

      setRequisitions(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "requisitions"));

    return () => unsubRequisitions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    triggerToast
  ]);

  // Lazy Projects Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('projects')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      if (shouldFilter) data = data.filter(p => parsedGroups.includes(p.groupId) || parsedGroups.includes(p.name));
      if (hidePrototype) data = data.filter(p => !["p1", "p2", "p3", "p4", "p5"].includes(p.id));
      setProjects(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "projects"));

    return () => unsubProjects();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Alerts Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('alerts')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    const unsubAlerts = onSnapshot(query(collection(db, "alerts"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetAlert));
      if (shouldFilter && parsedGroups.length > 0) data = data.filter(a => parsedGroups.some(g => a.message.includes(g)));
      if (hidePrototype) {
        data = data.filter(a => !a.id.includes("req-seed-") && !a.id.match(/budget-p[0-9]+/));
      }
      setAlerts(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "alerts"));

    return () => unsubAlerts();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // One-time Fiscal Years Fetch
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('fiscal_years') || fetchedTargetsRef.current.has('fiscal_years')) return;
    
    const fetchFiscalYears = async () => {
      try {
        fetchedTargetsRef.current.add('fiscal_years');
        const snap = await getDocs(collection(db, "fiscal_years"));
        setFiscalYears(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FiscalYear)));
      } catch (err) {
        fetchedTargetsRef.current.delete('fiscal_years');
        handleSyncError(err, OperationType.LIST, "fiscal_years");
      }
    };
    fetchFiscalYears();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Transactions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('transactions')) return;
    const hidePrototype = true;

    const unsubTransactions = onSnapshot(query(collection(db, "transactions"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      if (hidePrototype) data = data.filter(t => !t.id.startsWith("trans-seed-"));
      setTransactions(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "transactions"));

    return () => unsubTransactions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Forecast Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('forecast')) return;

    const unsubForecast = onSnapshot(collection(db, "forecast"), (snap) => {
      setForecastData(snap.docs.map(doc => doc.data() as ForecastMonth));
    }, (err) => handleSyncError(err, OperationType.LIST, "forecast"));

    return () => unsubForecast();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Reports Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('reports')) return;
    const hidePrototype = true;

    const unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc"), limit(50)), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedReport));
      if (hidePrototype) data = data.filter(r => !r.id.startsWith("rep-seed-"));
      setReports(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "reports"));

    return () => unsubReports();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy System Logs Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('system_logs')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    let unsubLogs = () => {};
    if (currentUserRole === UserRole.ADMIN || currentUserRole === UserRole.SUPER_ADMIN || currentUserRole === UserRole.FINANCE) {
      unsubLogs = onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(systemLogLimit)), (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog));
        if (shouldFilter && parsedGroups.length > 0) data = data.filter(log => parsedGroups.includes(log.groupId || "") || parsedGroups.some(g => log.details.includes(g)));
        if (hidePrototype) data = data.filter(log => !log.id.startsWith("log-seed-"));
        setSystemLogs(data);
      }, (err) => handleSyncError(err, OperationType.LIST, "system_logs"));
    } else {
      setSystemLogs([]);
    }

    return () => unsubLogs();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    systemLogLimit
  ]);

  // Lazy Users Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('users')) return;
    const hidePrototype = true;
    const shouldFilter = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
    const filterGroups = JSON.parse(currentUserGroupsJSON) as string[];
    const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

    let isFirstSnap = true;

    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let data = snap.docs.map(doc => normalizeUserProfile({ id: doc.id, ...doc.data() } as UserProfile));
      if (shouldFilter && parsedGroups.length > 0) data = data.filter(u => parsedGroups.includes(u.group || "") || (u.groups && u.groups.some(g => parsedGroups.includes(g))));
      if (hidePrototype) data = data.filter(u => !u.id.startsWith("u-"));

      if (isFirstSnap) {
        isFirstSnap = false;
      } else {
        let userChanges = false;
        snap.docChanges().forEach(change => {
          if ((change.type === "added" || change.type === "modified") && !change.doc.metadata.hasPendingWrites) {
            if (!change.doc.id.startsWith("u-")) {
              userChanges = true;
            }
          }
        });

        if (userChanges) {
          triggerToast({
            type: "SYSTEM_INFO",
            severity: "LOW",
            message: "Data Updated: User directories synced in real-time.",
            timestamp: new Date().toISOString()
          });
        }
      }

      setUsers(data);
    }, (err) => handleSyncError(err, OperationType.LIST, "users"));

    return () => unsubUsers();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    syncTargetsKey,
    handleSyncError,
    triggerToast
  ]);

  // Lazy Permissions Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('permissions')) return;

    const unsubPermissions = onSnapshot(collection(db, "permissions"), (snap) => {
      setPermissionConfigs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PermissionConfig)));
    }, (err) => handleSyncError(err, OperationType.LIST, "permissions"));

    return () => unsubPermissions();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Lazy Thresholds Listener
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('thresholds')) return;
    const unsubThresholds = onSnapshot(collection(db, "thresholds"), (snap) => {
      setThresholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertThreshold)));
    }, (err) => handleSyncError(err, OperationType.LIST, "thresholds"));
    return () => unsubThresholds();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    syncTargetsKey,
    handleSyncError
  ]);

  // Real-time Presence Heartbeat (Supabase & Firestore Unified)
  useEffect(() => {
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;

    const updatePresence = async (onlineStatus: boolean) => {
      const nowStr = new Date().toISOString();
      const headers = await getAuthHeaders();

      fetch(`/api/db/users/${currentUserId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          is_online: onlineStatus,
          isOnline: onlineStatus,
          last_seen: nowStr,
          lastSeen: nowStr
        })
      }).catch(err => console.warn("Failed to update presence in MongoDB:", err));
    };

    // Trigger immediately on mount/load
    updatePresence(true);

    // Setup periodic heartbeat every 30 seconds
    const heartbeatInterval = setInterval(() => {
      updatePresence(true);
    }, 30000);

    const handleUnload = async () => {
      const headers = await getAuthHeaders();
      fetch(`/api/db/users/${currentUserId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_online: false, isOnline: false })
      }).catch(err => console.warn("Presence unload update error:", err));
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener("beforeunload", handleUnload);
      // Clean up presence (offline) when unmounting
      updatePresence(false);
    };
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    skipFirestore
  ]);

  // Real-time Sync for Ledger Books
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;
    const unsubLedgers = !activeSyncTargets.has('ledger_books') ? () => {} : onSnapshot(
      collection(db, "ledger_books"),
      (snap) => {
        setLedgerBooks(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LedgerBook)));
      },
      (err) => handleSyncError(err, OperationType.LIST, "ledger_books")
    );
    return () => unsubLedgers();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey,
    handleSyncError
  ]);

  // Real-time Sync for Supplementary Budget Requests
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended) return;
    const unsubSupplementary = !activeSyncTargets.has('supplementary_budget_requests') ? () => {} : onSnapshot(
      query(collection(db, "supplementary_budgets"), orderBy("submittedAt", "desc")),
      (snap) => {
        setSupplementaryRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplementaryBudgetRequest)));
      },
      (err) => {
         if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded") || String(err).includes("Quota exceeded")) {
           setFirestoreQuotaExceeded(true);
         }
         console.log("Supplementary budget sync failed/not initialized:", err);
      }
    );
    return () => unsubSupplementary();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey
  ]);

  // One-time Fetch for Vendors
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || !currentUserIsApproved || currentUserIsSuspended || !activeSyncTargets.has('vendors') || fetchedTargetsRef.current.has('vendors')) return;
    
    const fetchVendors = async () => {
      startSyncing('vendors');
      try {
        fetchedTargetsRef.current.add('vendors');
        const snap = await getDocs(query(collection(db, "vendors"), orderBy("createdAt", "desc")));
        setVendors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vendor)));
      } catch (err) {
        fetchedTargetsRef.current.delete('vendors');
        if (err?.code === "resource-exhausted" || err?.message?.includes("Quota exceeded") || String(err).includes("Quota exceeded")) {
          setFirestoreQuotaExceeded(true);
        }
        console.log("Vendors fetch failed:", err);
      } finally {
        stopSyncing('vendors');
      }
    };
    fetchVendors();
  }, [
    firestoreQuotaExceeded,
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    db,
    syncTargetsKey,
    startSyncing,
    stopSyncing
  ]);

  // Automated background expiry notifications watcher (Admin only for writing alerts)
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || (currentUserRole !== UserRole.ADMIN && currentUserRole !== UserRole.SUPER_ADMIN) || requisitions.length === 0 || thresholds.length === 0) return;

    const checkExpiryAlerts = async () => {
      const expiryThreshold = thresholds.find(t => t.type === "EXPIRY_ALERT")?.threshold ?? 15;
      const budgetThreshold = thresholds.find(t => t.type === "BUDGET_OVERSHOOT")?.threshold ?? 90;
      const now = new Date();

      // Check Expiry
      for (const req of requisitions) {
        if ([RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1].includes(req.status)) {
          const submittedDate = new Date(req.submittedAt);
          const diffTime = Math.abs(now.getTime() - submittedDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays >= expiryThreshold) {
            const alertId = `expiry-${req.id}`;
            const alertExists = alerts.some(a => a.id === alertId);

            if (!alertExists) {
              const newAlert: BudgetAlert = {
                id: alertId,
                type: "EXPIRY",
                severity: "HIGH",
                message: `Requisition '${req.title}' from ${req.groupName} was submitted ${diffDays} days ago and is now EXPIRED. Requires immediate action.`,
                timestamp: now.toISOString(),
                isRead: false
              };
              try {
                await setDoc(doc(db, "alerts", alertId), newAlert);
                await addSystemLog("REQUISITION_EXPIRED", `Alert triggered: Requisition '${req.title}' is expired (pending ${diffDays} days)`, { requisitionId: req.id, diffDays });
              } catch (e) {
                handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
              }
            }
          }
        }
      }

      // Check Budget Overshoot
      for (const project of projects) {
        const projectReqs = getProjectRequisitions(project, requisitions);
        const dynamicSpent = projectReqs
          .filter(r => [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED, RequisitionStatus.APPROVED_L2, RequisitionStatus.DISBURSED].includes(r.status))
          .reduce((sum, r) => sum + r.amount, 0);

        const usage = (dynamicSpent / project.allocatedBudget) * 100;
        if (usage >= budgetThreshold) {
          const alertId = `budget-${project.id}-${Math.floor(usage)}`;
          const alertExists = alerts.some(a => a.id === alertId || (a.message.includes(project.name) && a.type === "OVERSHOOT" && !a.isRead));

          if (!alertExists) {
            const newAlert: BudgetAlert = {
              id: alertId,
              type: "OVERSHOOT",
              severity: usage >= 100 ? "HIGH" : "MEDIUM",
              message: `PROJECT BUDGET ALERT: '${project.name}' has reached ${usage.toFixed(1)}% utilization (${dynamicSpent.toLocaleString()} / ${project.allocatedBudget.toLocaleString()}).`,
              timestamp: now.toISOString(),
              isRead: false
            };
            try {
              await setDoc(doc(db, "alerts", alertId), newAlert);
              await addSystemLog("BUDGET_OVERSHOOT", `Budget threshold reached for ${project.name}: ${usage.toFixed(1)}%`, { projectId: project.id, usage: usage.toFixed(1) });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
            }
          }
        }
      }
    };

    checkExpiryAlerts();
  }, [requisitions, alerts, projects, thresholds, firestoreQuotaExceeded, currentUserId, currentUserRole, db, addSystemLog]);

  // Automated background trigger for FINANCE alerts on L2 Approved status
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || requisitions.length === 0) return;

    const checkL2ApprovedAlerts = async () => {
      const now = new Date();
      for (const req of requisitions) {
        if (req.status === RequisitionStatus.APPROVED_L2) {
          const alertId = `finance-l2-ready-${req.id}`;
          const alertExists = alerts.some(a => a.id === alertId);

          if (!alertExists) {
            const newAlert: BudgetAlert = {
              id: alertId,
              type: "L2_APPROVED",
              severity: "HIGH",
              message: `ATTENTION FINANCE: Requisition '${req.title}' from ${req.groupName} has reached APPROVED L2 status. Please verify entries and initiate disbursement of KES ${req.amount.toLocaleString()}.`,
              timestamp: now.toISOString(),
              isRead: false,
              targetRole: UserRole.FINANCE
            };
            try {
              await setDoc(doc(db, "alerts", alertId), newAlert);
              await addSystemLog("FINANCE_ALERT_TRIGGERED", `Automated alert dispatched to FINANCE team for L2 Approved requisition: '${req.title}'`, { requisitionId: req.id });
            } catch (e) {
              handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
            }
          }
        }
      }
    };

    checkL2ApprovedAlerts();
  }, [requisitions, alerts, firestoreQuotaExceeded, currentUserId, db, addSystemLog]);

  // Recurring Requisitions Watcher
  useEffect(() => {
    if (skipFirestore) return;
    if (!currentUserId || requisitions.length === 0) return;

    const checkRecurring = async () => {
      const now = new Date();
      
      for (const req of requisitions) {
        if (!req.recurrence || req.recurrence === RecurrenceType.NONE) continue;

        // Check if we should generate a new one
        const lastGenerated = req.lastRecurrenceGeneratedAt ? new Date(req.lastRecurrenceGeneratedAt) : new Date(req.submittedAt);
        let shouldGenerate = false;
        
        if (req.recurrence === RecurrenceType.MONTHLY) {
          const nextDate = new Date(lastGenerated);
          nextDate.setMonth(nextDate.getMonth() + 1);
          if (now >= nextDate) shouldGenerate = true;
        } else if (req.recurrence === RecurrenceType.QUARTERLY) {
          const nextDate = new Date(lastGenerated);
          nextDate.setMonth(nextDate.getMonth() + 3);
          if (now >= nextDate) shouldGenerate = true;
        }

        if (shouldGenerate) {
          const draftId = `req-auto-${req.id}-${Date.now()}`;
          const expiryDays = systemSettings?.requisitionExpiryDays ?? 7;
          const newDraft: Requisition = {
            ...req,
            id: draftId,
            status: RequisitionStatus.DRAFT,
            submittedAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000).toISOString(),
            approvalHistory: [],
            recurrence: RecurrenceType.NONE, // Spawned ones are one-off
            lastRecurrenceGeneratedAt: undefined
          };
          
          try {
            await setDoc(doc(db, "requisitions", draftId), newDraft);
            await updateDoc(doc(db, "requisitions", req.id), {
              lastRecurrenceGeneratedAt: now.toISOString()
            });
            await addSystemLog("AUTO_RECURRING", `Spawned recurring draft: ${req.title}`, { parentId: req.id });
          } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `requisitions/${draftId}`);
          }
        }
      }
    };

    checkRecurring();
  }, [requisitions, firestoreQuotaExceeded, currentUserId, db, addSystemLog, systemSettings]);

  // --- UNIFIED MONGODB DATA LOADER FOR ALL 15 DATASETS ---
  useEffect(() => {
    if (!currentUserId || currentUserIsSuspended) {
      setLoading(false);
      return;
    }

    let active = true;
    let pollInterval: any = null;

    const fetchAllFromMongoDB = async () => {
      const hidePrototype = true;
      const isGroupUser = currentUserRole === UserRole.CHURCH_GROUP || currentUserRole === UserRole.APPROVER_L1 || currentUserRole === UserRole.APPROVER_L2;
      let filterGroups: string[] = [];
      try {
        filterGroups = JSON.parse(currentUserGroupsJSON || "[]") as string[];
      } catch (e) {
        console.error("Failed to parse user groups JSON:", e);
      }
      const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUserGroup ? [currentUserGroup] : []);

      try {
        const headers = await getAuthHeaders();
        let response;
        try {
          response = await fetch("/api/db-all", { headers });
        } catch (fetchErr) {
          console.error("Network or 502 Error when fetching database:", fetchErr);
          return;
        }

        if (!response || !response.ok) {
          console.warn(`[DB Sync] Server returned status ${response?.status || "unknown"}`);
          return;
        }

        let dbData: any = null;
        try {
          dbData = await response.json();
        } catch (jsonErr) {
          console.error("[DB Sync] Malformed JSON received from backend:", jsonErr);
          return;
        }

        if (!active) return;
        if (!dbData || typeof dbData !== 'object') {
          console.warn("[DB Sync] Data received is not an object:", dbData);
          return;
        }

        // Process Requisitions
        try {
          if (dbData?.requisitions && Array.isArray(dbData.requisitions)) {
            let data = dbData.requisitions.map((r: any) => {
              if (!r) return null;
              return {
                id: r?.id || "",
                projectId: r?.project_id || r?.projectId || "",
                title: r?.title || "",
                description: r?.description || "",
                amount: Number(r?.amount) || 0,
                amountWords: r?.amount_words || r?.amountWords || "",
                groupId: r?.group_id || r?.groupId || "",
                groupName: r?.group_name || r?.groupName || "",
                requesterId: r?.requester_id || r?.requesterId || "",
                requesterName: r?.requester_name || r?.requesterName || "",
                requesterEmail: r?.requester_email || r?.requesterEmail || "",
                status: r?.status || "DRAFT",
                submittedAt: r?.submitted_at || r?.submittedAt || "",
                updatedAt: r?.updated_at || r?.updatedAt || "",
                expiresAt: r?.expires_at || r?.expiresAt || "",
                escalationLevel: Number(r?.escalation_level) || Number(r?.escalationLevel) || 0,
                escalationNotificationsSent: Boolean(r?.escalation_notifications_sent || r?.escalationNotificationsSent),
                approvedAtL1: r?.approved_at_l1 || r?.approvedAtL1 || "",
                approvedAtL2: r?.approved_at_l2 || r?.approvedAtL2 || "",
                disbursedAt: r?.disbursed_at || r?.disbursedAt || "",
                rejectionReason: r?.rejection_reason || r?.rejectionReason || "",
                approvalHistory: safeNormalizeApprovalHistory(r?.approval_history || r?.approvalHistory || []),
                digitalSignature: r?.digital_signature || r?.digitalSignature || "",
                payableTo: r?.payable_to || r?.payableTo || "",
                recurrence: r?.recurrence || null,
                lastRecurrenceGeneratedAt: r?.last_recurrence_generated_at || r?.lastRecurrenceGeneratedAt || "",
                additionalInfo: r?.additional_info || r?.additionalInfo || null,
                attachments: safeNormalizeAttachments(r?.attachments),
                receipts: safeNormalizeReceipts(r?.receipts),
                flaggedForAudit: Boolean(r?.flagged_for_audit || r?.flaggedForAudit),
                inProcurement: Boolean(r?.in_procurement || r?.inProcurement),
                requiresMoreInfo: Boolean(r?.requires_more_info || r?.requiresMoreInfo),
                fiscalYear: Number(r?.fiscal_year || r?.fiscalYear) || undefined
              } as Requisition;
            }).filter(Boolean) as Requisition[];

            if (isGroupUser && parsedGroups.length > 0) {
              data = data.filter(req => req && req.groupId && (parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName)));
            }
            if (hidePrototype) {
              data = data.filter(req => req && req.id && !req.id.startsWith("req-seed-"));
            }
            setRequisitions(data);
          }
        } catch (reqErr) {
          console.error("[DB Sync] Error mapping requisitions:", reqErr);
        }

        // Process Projects
        try {
          if (dbData?.projects && Array.isArray(dbData.projects)) {
            let data = dbData.projects.map((p: any) => {
              if (!p) return null;
              return {
                id: p?.id || "",
                name: p?.name || "",
                groupId: p?.group_id || p?.groupId || "",
                allocatedBudget: Number(p?.allocated_budget) || Number(p?.allocatedBudget) || 0,
                spentAmount: Number(p?.spent_amount) || Number(p?.spentAmount) || 0,
                status: p?.status || "ACTIVE",
                color: p?.color || "",
                fiscalYear: p?.fiscal_year || p?.fiscalYear || 2026,
                requisitionLimit: Number(p?.requisition_limit) || Number(p?.requisitionLimit) || 0,
                accountNumber: p?.account_number || p?.accountNumber || ""
              } as Project;
            }).filter(Boolean) as Project[];

            if (isGroupUser && parsedGroups.length > 0) {
              data = data.filter(p => p && p.groupId && (parsedGroups.includes(p.groupId) || parsedGroups.includes(p.name)));
            }
            if (hidePrototype) {
              data = data.filter(p => p && p.id && !["p1", "p2", "p3", "p4", "p5"].includes(p.id));
            }
            setProjects(data);
          }
        } catch (projErr) {
          console.error("[DB Sync] Error mapping projects:", projErr);
        }

        // Process Alerts
        try {
          if (dbData?.alerts && Array.isArray(dbData.alerts)) {
            let data = dbData.alerts.map((a: any) => {
              if (!a) return null;
              return {
                id: a?.id || "",
                type: a?.type || "",
                severity: a?.severity || "",
                message: a?.message || "",
                timestamp: a?.timestamp || "",
                isRead: Boolean(a?.is_read || a?.isRead),
                targetRole: a?.target_role || a?.targetRole
              } as BudgetAlert;
            }).filter(Boolean) as BudgetAlert[];

            if (isGroupUser && parsedGroups.length > 0) {
              data = data.filter(a => a && a.message && parsedGroups.some(g => a.message.includes(g)));
            }
            if (hidePrototype) {
              data = data.filter(a => a && a.id && !a.id.includes("req-seed-") && !a.id.match(/budget-p[0-9]+/));
            }
            setAlerts(data);
          }
        } catch (alertErr) {
          console.error("[DB Sync] Error mapping alerts:", alertErr);
        }

        // Process Fiscal Years
        try {
          if (dbData?.fiscal_years && Array.isArray(dbData.fiscal_years)) {
            const data = dbData.fiscal_years.map((fy: any) => {
              if (!fy) return null;
              return {
                id: fy?.id || "",
                year: Number(fy?.year) || 2026,
                label: fy?.label || "",
                status: fy?.status || "CLOSED",
                createdAt: fy?.created_at || fy?.createdAt || "",
                notes: fy?.notes || ""
              } as FiscalYear;
            }).filter(Boolean) as FiscalYear[];
            setFiscalYears(data);
          }
        } catch (fyErr) {
          console.error("[DB Sync] Error mapping fiscal years:", fyErr);
        }

        // Process Transactions
        try {
          if (dbData?.transactions && Array.isArray(dbData.transactions)) {
            const data = dbData.transactions.map((tx: any) => {
              if (!tx) return null;
              return {
                id: tx?.id || "",
                externalRef: tx?.external_ref || tx?.externalRef || "",
                sourceSystem: tx?.source_system || tx?.sourceSystem || "",
                amount: Number(tx?.amount) || 0,
                type: tx?.type || "",
                status: tx?.status || "",
                description: tx?.description || "",
                category: tx?.category || "",
                timestamp: tx?.timestamp || "",
                performedBy: tx?.performed_by || tx?.performedBy || "",
                metadata: tx?.metadata || null
              } as Transaction;
            }).filter(Boolean) as Transaction[];
            setTransactions(data);
          }
        } catch (txErr) {
          console.error("[DB Sync] Error mapping transactions:", txErr);
        }

        // Process Forecast
        try {
          if (dbData?.forecast && Array.isArray(dbData.forecast)) {
            const data = dbData.forecast.map((f: any) => {
              if (!f) return null;
              return {
                month: f?.month || "",
                projected: Number(f?.projected) || 0,
                actual: Number(f?.actual) || 0
              } as ForecastMonth;
            }).filter(Boolean) as ForecastMonth[];
            setForecastData(data);
          }
        } catch (forecastErr) {
          console.error("[DB Sync] Error mapping forecast:", forecastErr);
        }

        // Process Reports
        try {
          if (dbData?.reports && Array.isArray(dbData.reports)) {
            const data = dbData.reports.map((r: any) => {
              if (!r) return null;
              return {
                id: r?.id || "",
                title: r?.title || "",
                description: r?.description || "",
                generatedBy: r?.generated_by || r?.generatedBy || "",
                generatedById: r?.generated_by_id || r?.generatedById || "",
                timestamp: r?.timestamp || "",
                period: r?.period || "",
                stats: r?.stats || null,
                filters: r?.filters || null,
                itemCount: Number(r?.item_count) || Number(r?.itemCount) || 0
              } as SavedReport;
            }).filter(Boolean) as SavedReport[];
            setReports(data);
          }
        } catch (reportErr) {
          console.error("[DB Sync] Error mapping reports:", reportErr);
        }

        // Process System Logs
        try {
          if (dbData?.audit_logs && Array.isArray(dbData.audit_logs)) {
            const data = dbData.audit_logs.map((l: any) => {
              if (!l) return null;
              return {
                id: l?.id?.toString() || `log-${Math.random()}`,
                action: l?.action || "",
                details: l?.details || "",
                performedBy: l?.performed_by || l?.performedBy || "",
                timestamp: l?.timestamp || "",
                groupId: l?.group_id || l?.groupId || "",
                metadata: l?.metadata || null
              } as SystemLog;
            }).filter(Boolean) as SystemLog[];
            setSystemLogs(data);
          }
        } catch (logErr) {
          console.error("[DB Sync] Error mapping system logs:", logErr);
        }

        // Process Users
        try {
          if (dbData?.users && Array.isArray(dbData.users)) {
            const data = dbData.users.map((u: any) => {
              if (!u) return null;
              return normalizeUserProfile({
                id: u?.id || "",
                name: u?.name || "",
                email: u?.email || "",
                role: u?.role || "",
                group: u?.group || "",
                groups: u?.groups || [],
                approverCode: u?.approver_code || u?.approverCode || "",
                isActive: Boolean(u?.is_active !== undefined ? u?.is_active : u?.isActive),
                isApproved: Boolean(u?.is_approved !== undefined ? u?.is_approved : u?.isApproved),
                isSuspended: Boolean(u?.is_suspended !== undefined ? u?.is_suspended : u?.isSuspended),
                phone: u?.phone || "",
                department: u?.department || "",
                photoURL: u?.photo_url || u?.photoURL || "",
                tempPassword: u?.temp_password || u?.tempPassword || "",
                isOnline: Boolean(u?.is_online || u?.isOnline),
                lastSeen: u?.last_seen || u?.lastSeen || "",
                idleTimeoutDuration: Number(u?.idle_timeout_duration) || Number(u?.idleTimeoutDuration) || 15
              } as UserProfile);
            }).filter(Boolean) as UserProfile[];
            setUsers(data);
          }
        } catch (userErr) {
          console.error("[DB Sync] Error mapping users:", userErr);
        }

        // Process Permissions
        try {
          if (dbData?.permissions && Array.isArray(dbData.permissions)) {
            const data = dbData.permissions.map((p: any) => {
              if (!p) return null;
              return {
                id: p?.id || "",
                role: p?.role || "",
                access: p?.access || null,
                actions: p?.actions || []
              } as PermissionConfig;
            }).filter(Boolean) as PermissionConfig[];
            setPermissionConfigs(data);
          }
        } catch (permErr) {
          console.error("[DB Sync] Error mapping permissions:", permErr);
        }

        // Process Thresholds
        try {
          if (dbData?.thresholds && Array.isArray(dbData.thresholds)) {
            const data = dbData.thresholds.map((t: any) => {
              if (!t) return null;
              return {
                id: t?.id || "",
                type: t?.type || "",
                threshold: Number(t?.threshold) || 0,
                isEnabled: Boolean(t?.is_enabled !== undefined ? t?.is_enabled : t?.isEnabled),
                notifyEmail: t?.notify_email || t?.notifyEmail || ""
              } as AlertThreshold;
            }).filter(Boolean) as AlertThreshold[];
            setThresholds(data);
          }
        } catch (threshErr) {
          console.error("[DB Sync] Error mapping thresholds:", threshErr);
        }

        // Process Church Groups
        try {
          if (dbData?.church_groups && Array.isArray(dbData.church_groups)) {
            const data = dbData.church_groups.map((cg: any) => {
              if (!cg) return null;
              return {
                id: cg?.id || "",
                name: cg?.name || "",
                description: cg?.description || "",
                createdAt: cg?.created_at || cg?.createdAt || ""
              } as ChurchGroup;
            }).filter(Boolean) as ChurchGroup[];
            setChurchGroups(data);
            setLastGroupsSync(new Date());
          }
        } catch (cgErr) {
          console.error("[DB Sync] Error mapping church groups:", cgErr);
        }

        // Process Ledger Books
        try {
          if (dbData?.ledger_books && Array.isArray(dbData.ledger_books)) {
            const data = dbData.ledger_books.map((lb: any) => {
              if (!lb) return null;
              return {
                id: lb?.id || "",
                ministryId: lb?.ministry_id || lb?.ministryId || "",
                ministryName: lb?.ministry_name || lb?.ministryName || "",
                bookName: lb?.book_name || lb?.bookName || "",
                description: lb?.description || "",
                createdAt: lb?.created_at || lb?.createdAt || "",
                createdBy: lb?.created_by || lb?.createdBy || "",
                creatorName: lb?.creator_name || lb?.creatorName || "",
                budgetLimit: Number(lb?.budget_limit) || Number(lb?.budgetLimit) || 0,
                spentAmount: Number(lb?.spent_amount) || Number(lb?.spentAmount) || 0,
                notes: lb?.notes || "",
                status: lb?.status || "ACTIVE"
              } as LedgerBook;
            }).filter(Boolean) as LedgerBook[];
            setLedgerBooks(data);
          }
        } catch (lbErr) {
          console.error("[DB Sync] Error mapping ledger books:", lbErr);
        }

        // Process Supplementary Budgets
        try {
          if (dbData?.supplementary_budgets && Array.isArray(dbData.supplementary_budgets)) {
            const data = dbData.supplementary_budgets.map((sb: any) => {
              if (!sb) return null;
              return {
                id: sb?.id || "",
                requesterId: sb?.requester_id || sb?.requesterId || "",
                requesterName: sb?.requester_name || sb?.requesterName || "",
                requesterEmail: sb?.requester_email || sb?.requesterEmail || "",
                role: sb?.role || "",
                projectId: sb?.project_id || sb?.projectId || "",
                projectName: sb?.project_name || sb?.projectName || "",
                amount: Number(sb?.amount) || 0,
                justification: sb?.justification || "",
                submittedAt: sb?.submitted_at || sb?.submittedAt || "",
                status: sb?.status || "PENDING"
              } as SupplementaryBudgetRequest;
            }).filter(Boolean) as SupplementaryBudgetRequest[];
            setSupplementaryRequests(data);
          }
        } catch (sbErr) {
          console.error("[DB Sync] Error mapping supplementary budgets:", sbErr);
        }

        // Process Vendors
        try {
          if (dbData?.vendors && Array.isArray(dbData.vendors)) {
            const data = dbData.vendors.map((v: any) => {
              if (!v) return null;
              return {
                id: v?.id || "",
                name: v?.name || "",
                contact: v?.contact || "",
                location: v?.location || "",
                offerings: v?.offerings || [],
                createdAt: v?.created_at || v?.createdAt || "",
                addedBy: v?.added_by || v?.addedBy || "",
                status: v?.status || "ACTIVE"
              } as Vendor;
            }).filter(Boolean) as Vendor[];
            setVendors(data);
          }
        } catch (vendorErr) {
          console.error("[DB Sync] Error mapping vendors:", vendorErr);
        }

      } catch (err) {
        console.info("Critical issue pulling data from MongoDB:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAllFromMongoDB();
    // Background polling interval to keep UI reactive even without websockets
    pollInterval = setInterval(fetchAllFromMongoDB, 5000);

    return () => {
      active = false;
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [
    currentUserId,
    currentUserIsApproved,
    currentUserIsSuspended,
    currentUserRole,
    currentUserGroup,
    currentUserGroupsJSON,
    systemSettings.prototypeDataEnabled,
    systemLogLimit
  ]);

  // Removed automatic data migration to Supabase



  const login = async () => {
    try {
      const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      if (result.user) {
        addSystemLog("USER_LOGIN", `User logged in via Google Auth: ${result.user.email}`, { authProvider: "google", email: result.user.email });
      }
    } catch (error: any) {
      console.log("Login warning", error);
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      email = email.trim().toLowerCase();
      
      const checkRes = await fetch(`/api/auth/check-pre-registered`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      const checkData = await checkRes.json();
      
      if (checkRes.ok && checkData.preRegistered && checkData.tempPasswordMatched) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
          if (userCredential.user) {
            await fetch("/api/auth/link-profile", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                uid: userCredential.user.uid,
                email: email,
                profileId: checkData.profileId
              })
            });
            await addSystemLog("USER_LOGIN", `Pre-provisioned user activated and logged in: ${email}`, { authProvider: "password", email });
            return;
          }
        } catch (signUpErr: any) {
          if (signUpErr.code === "auth/email-already-in-use") {
            const userCredential = await signInWithEmailAndPassword(auth, email, pass);
            if (userCredential.user) {
              await fetch("/api/auth/link-profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  uid: userCredential.user.uid,
                  email: email,
                  profileId: checkData.profileId
                })
              });
              await addSystemLog("USER_LOGIN", `User logged in via Email/Password: ${email}`, { authProvider: "password", email });
              return;
            }
          }
          throw signUpErr;
        }
      }
      
      const userCredential = await signInWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        await addSystemLog("USER_LOGIN", `User logged in via Email/Password: ${email}`, { authProvider: "password", email });
      }
    } catch (error: any) {
      console.error("Login with email failed:", error);
      try {
        fetch("/api/notify-slack", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "FAILED_LOGIN_ATTEMPT",
            details: `🛑 SECURITY ALERT: Failed login attempt for ${email}. Error: ${error.message || error.code}`,
            performedBy: email || "Anonymous",
            timestamp: new Date().toISOString(),
            metadata: { email, errorCode: error.code || "unknown" },
            level: "abnormal"
          })
        }).catch(err => console.log("Slack Notify Failed:", err));
      } catch (e) {}
      throw error;
    }
  };

  const addChurchGroup = useCallback(async (name: string, description?: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can manage church groups.");
    }
    const id = `cg-${Math.random().toString(36).substr(2, 9)}`;
    const newGroup: ChurchGroup = {
      id,
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    try {
      await databaseService.saveChurchGroup(newGroup);
      await addSystemLog("GROUP_CREATED", `Church group '${name}' created by admin`, { groupId: id, name });
    } catch (err) {
      console.error("Error creating church group", err);
      throw err;
    }
  }, [currentUser, addSystemLog]);

  const deleteChurchGroup = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can manage church groups.");
    }
    try {
      await databaseService.deleteChurchGroup(id);
      await addSystemLog("GROUP_DELETED", `Church group ID '${id}' deleted by admin`, { groupId: id });
    } catch (err) {
      console.error("Error deleting church group", err);
      throw err;
    }
  }, [currentUser, addSystemLog]);

  const createLedgerBook = useCallback(async (ministryName: string, bookName: string, budgetLimit: number = 0) => {
    if (!currentUser) throw new Error("Authentication required");
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline.");
    }

    const normalizedName = ministryName.trim();
    const existingBook = ledgerBooks.find(b => b.ministryName === normalizedName);
    if (existingBook) {
      throw new Error(`Invariance Violated: The ministry already has an active ledger book. Each ministry is strictly limited to one ledger book.`);
    }

    const id = `ledger-${Math.random().toString(36).substr(2, 9)}`;
    const newBook: LedgerBook = {
      id,
      ministryName: normalizedName,
      bookName: bookName.trim(),
      description: "Official Ministry Ledger Book",
      createdAt: new Date().toISOString(),
      createdBy: currentUser.email || currentUser.id || "system",
      creatorName: currentUser.name || "Unknown User",
      budgetLimit: budgetLimit,
      spentAmount: 0,
      status: "ACTIVE"
    };

    console.log("Creating ledger book with data:", cleanFirestoreData(newBook));
    try {
      await setDoc(doc(db, "ledger_books", id), cleanFirestoreData(newBook));
      await addSystemLog("LEDGER_BOOK_CREATED", `Created ledger book '${newBook.bookName}' for ministry '${newBook.ministryName}' with limit ${budgetLimit}`, {
        ledgerId: id,
        ministryName: newBook.ministryName,
        bookName: newBook.bookName,
        budgetLimit
      });
      triggerToast({ type: "SYSTEM_INFO", message: `Ledger book for ${newBook.ministryName} created successfully`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `ledger_books/${id}`);
    }
  }, [currentUser, ledgerBooks, addSystemLog, triggerToast]);

  const updateLedgerBookBudget = useCallback(async (id: string, newLimit: number) => {
    if (!currentUser) throw new Error("Authentication required");
    if (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN && currentUser.role !== UserRole.FINANCE) {
      throw new Error("Unauthorized: Only Admin, Super Admin, and Finance users can edit ledger books.");
    }
    if (newLimit < 0) throw new Error("Budget limit must be larger than or equal to 0.");

    try {
      const ledgerRef = doc(db, "ledger_books", id);
      const ledgerSnap = await getDoc(ledgerRef);
      if (!ledgerSnap.exists()) throw new Error("Ledger book not found.");
      const ledgerData = ledgerSnap.data() as LedgerBook;

      await updateDoc(ledgerRef, {
        budgetLimit: newLimit
      });

      await addSystemLog("LEDGER_BOOK_UPDATED", `Updated budget limit of ledger book '${ledgerData.ministryName}' to KES ${newLimit.toLocaleString()}`, { ledgerId: id, ministryName: ledgerData.ministryName, newLimit });
      triggerToast({ type: "SYSTEM_INFO", message: `Ledger book budget for ${ledgerData.ministryName} updated.`, severity: "LOW", timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to update ledger book budget:", err);
      throw err;
    }
  }, [currentUser, db, addSystemLog, triggerToast]);

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      email = email.trim().toLowerCase();
      const checkRes = await fetch(`/api/auth/get-profile-by-email?email=${encodeURIComponent(email)}`);
      const checkData = await checkRes.json();
      if (checkRes.ok && checkData.exists && !checkData.profile?.temp_password && !checkData.profile?.tempPassword) {
        throw new Error("A user with this email already exists. Please login instead.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      if (userCredential.user) {
        const uid = userCredential.user.uid;
        
        if (checkData.exists && checkData.profile) {
          await fetch("/api/auth/link-profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              uid,
              email,
              profileId: checkData.profile.id
            })
          });
        } else {
          const newProfile = {
            id: uid,
            name: name,
            email: email,
            role: "CHURCH_GROUP" as UserRole,
            is_active: true,
            is_approved: true,
            is_suspended: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          const headers = await getAuthHeaders();
          await fetch(`/api/db/users/${uid}`, {
            method: "POST",
            headers,
            body: JSON.stringify(newProfile)
          });
        }
        await addSystemLog("USER_PROVISIONED", `User successfully registered and approved via Email: ${email}`, { email });
      }
    } catch (error: any) {
      console.warn("Signup warning", error);
      if (error.code === "auth/email-already-in-use" || error.message?.includes('already registered')) {
        throw new Error("This email is already registered. Please login instead.");
      }
      throw error;
    }
  };

  const logout = async (options?: { forceDirect?: boolean }) => {
    const userEmail = auth.currentUser?.email;
    if (currentUserId) {
      try {
        await updateDoc(doc(db, "users", currentUserId), {
          isOnline: false,
          lastSeen: new Date().toISOString()
        });
      } catch (err) {
        console.warn("Failed to mark user offline on logout:", err);
      }
    }

    if (userEmail) {
      try {
        await addSystemLog("USER_LOGOUT", `👤 User logged out successfully: ${userEmail}`, { email: userEmail });
      } catch (logErr) {
        console.log("Failed to log logout event", logErr);
      }
    }
    
    if (typeof window !== "undefined") {
      localStorage.removeItem("override_authorized_user_email");
    }
    await signOut(auth);
  };

  const approveUser = useCallback(async (id: string) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        await databaseService.saveUserProfile({ ...existingUser, isApproved: true });
        await addSystemLog("USER_APPROVAL", `Admin approved/activated user ID: ${id}`, { userId: id });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [users]);

  const suspendUser = useCallback(async (id: string, isSuspended: boolean) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        await databaseService.saveUserProfile({ ...existingUser, isSuspended });
        await addSystemLog("USER_SUSPENSION", `Admin changed suspension for user ID: ${id} to ${isSuspended}`, { userId: id, isSuspended });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [users]);

  const updateUserRole = useCallback(async (id: string, role: UserRole) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        await databaseService.saveUserProfile({ ...existingUser, role });
        
        const isElevated = [UserRole.ADMIN, UserRole.FINANCE, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(role);
        const actionTitle = isElevated ? "ELEVATED_ROLE_GRANTED" : "USER_ROLE_UPDATE";
        const detailsText = isElevated 
          ? `🚨 SECURITY NOTICE: Admin granted ELEVATED rights (${role}) to user ID: ${id}`
          : `Admin changed role of user ID: ${id} to ${role}`;
          
        await addSystemLog(actionTitle, detailsText, { userId: id, newRole: role, elevated: isElevated });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [users]);

  const updateUserProfile = useCallback(async (id: string, updates: Partial<UserProfile>) => {
    try {
      const existingUser = users.find(u => u.id === id);
      if (existingUser) {
        await databaseService.saveUserProfile({ ...existingUser, ...updates });
        await addSystemLog("USER_PROFILE_UPDATE", `Profile updated for user ID: ${id}`, { userId: id, updates });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [users, addSystemLog]);

  const updateCurrentUserPassword = useCallback(async (newPassword: string) => {
    try {
      if (!auth.currentUser) {
        throw new Error("No active authenticated session found.");
      }
      
      await updateAuthPassword(auth.currentUser, newPassword);
      
      await addSystemLog("PASSWORD_CHANGED", `User ${auth.currentUser.email} updated their account password`);
      triggerToast({
        type: 'SECURITY_UPDATE',
        severity: 'MEDIUM',
        message: 'Your account password has been updated successfully.',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      if (error.code === "auth/requires-recent-login" || error.message?.includes('requires-recent-login')) {
        throw new Error("For security, updating password requires a recent login. Please log out, log back in, and try again.");
      }
      throw error;
    }
  }, [addSystemLog, triggerToast]);

  const adminRegisterUser = useCallback(async (
    email: string,
    pass: string,
    name: string,
    role: UserRole,
    group?: string,
    approverCode?: string,
    groups?: string[]
  ) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can register new users.");
    }

    // Duplicate Detection
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error(`User with email ${email} already exists.`);
    }

    try {
      // Instead of creating the Auth account immediately (which requires complex secondary apps),
      // we pre-provision the user in Firestore with a temporary password.
      // The manual password flow in loginWithEmail will handle the user's first login by
      // creating the real Auth account and transitioning this profile.
      
      const tempId = `pre-provisioned-${Math.random().toString(36).substring(2, 12)}`;
      
      const newProfile: UserProfile = {
        id: tempId,
        name,
        email: email.toLowerCase(),
        role,
        tempPassword: pass, // Stored encrypted/protected by security rules in production
        isActive: true,
        isApproved: true,
        isSuspended: false,
      };

      if (group) newProfile.group = group;
      if (groups) newProfile.groups = groups;
      if (approverCode) newProfile.approverCode = approverCode;

      // Store in users collection
      await setDoc(doc(db, "users", tempId), newProfile);
      
      await addSystemLog("USER_PRE_PROVISIONED", `Admin pre-registered user (manual activation required): ${email} as ${role}`, {
        tempId,
        email,
        role,
        group,
        groups
      });
    } catch (error) {
      console.error("Admin user pre-provisioning failed:", error);
      throw error;
    }
  }, [currentUser, db, users, addSystemLog]);

  const adminResetUserPassword = useCallback(async (email: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can reset user passwords.");
    }
    const { sendPasswordResetEmail } = await import("firebase/auth");
    await sendPasswordResetEmail(auth, email);
    await addSystemLog("PASSWORD_RESET_TRIGGERED", `Admin triggered password reset email for user: ${email}`, { email });
  }, [currentUser, addSystemLog]);
  
  const deleteUser = useCallback(async (id: string) => {
    if (!currentUser || (currentUser.role !== UserRole.ADMIN && currentUser.role !== UserRole.SUPER_ADMIN)) {
      throw new Error("Unauthorized: Only Admins can delete users.");
    }
    
    // Prevent self-deletion
    if (currentUser.id === id) {
      throw new Error("Cannot delete your own administrative account.");
    }

    const userToDelete = users.find(u => u.id === id);
    if (!userToDelete) {
      throw new Error("User not found.");
    }

    // Prevent deletion of Super Admins by regular Admins
    if (userToDelete.role === UserRole.SUPER_ADMIN && currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can delete other Super Admins.");
    }

    try {
      await deleteDoc(doc(db, "users", id));
      await addSystemLog("USER_DELETED", `User deleted: ${userToDelete.email} (${userToDelete.role})`, { 
        userId: id, 
        email: userToDelete.email, 
        role: userToDelete.role 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${id}`);
    }
  }, [currentUser, users, addSystemLog]);

  const adminForceLogoutUser = useCallback(async (id: string) => {
    if (!currentUser || currentUser.role !== UserRole.SUPER_ADMIN) {
      throw new Error("Unauthorized: Only Super Admins can force logout users.");
    }
    try {
      await setDoc(doc(db, "users", id), { forceLogout: true }, { merge: true });
      await addSystemLog("USER_FORCE_LOGOUT", `Super Admin forced logout for user ID: ${id}`, { userId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const syncProjectAmounts = useCallback(async (projectId: string) => {
    if (!projectId) return;
    try {
      const projectRef = doc(db, "projects", projectId);
      const projectSnap = await getDoc(projectRef);
      if (!projectSnap.exists()) return;
      const project = { id: projectSnap.id, ...projectSnap.data() } as Project;

      const reqSnap = await getDocs(collection(db, "requisitions"));
      const allReqs = reqSnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Requisition));
      const projectReqs = getProjectRequisitions(project, allReqs);
      
      let spentSum = 0;
      let committedSum = 0;
      
      projectReqs.forEach((req) => {
        if (req.status === RequisitionStatus.DISBURSED) {
          spentSum += req.amount;
        }
        
        if ([
          RequisitionStatus.SUBMITTED,
          RequisitionStatus.APPROVED_L1,
          RequisitionStatus.APPROVED_L2,
          RequisitionStatus.ESCALATED,
          RequisitionStatus.DISBURSED
        ].includes(req.status)) {
          committedSum += req.amount;
        }
      });
      
      await updateDoc(projectRef, {
        spentAmount: spentSum,
        committedAmount: committedSum
      });
    } catch (err) {
      console.error("Error syncing project amounts:", err);
    }
  }, [db]);

  const sendEmailNotification = useCallback(async (req: Requisition, status: string, details?: string) => {
    let targetEmail = req.requesterEmail;
    
    if (!targetEmail) {
      // Fallback: search in loaded users
      const user = users.find(u => u.id === req.requesterId || u.name === req.requesterName);
      if (user) targetEmail = user.email;
    }

    if (!targetEmail) {
      console.log("Cannot send email: Requisition has no requesterEmail and no matching user found", req.id);
      return;
    }
    
    try {
      await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetEmail,
          requesterName: req.requesterName,
          amount: req.amount,
          title: req.title,
          requisitionId: req.id,
          status: status,
          details: details
        })
      });
    } catch (err) {
      console.error("Failed to trigger email notification:", err);
    }
  }, [users]);

  const syncRequisitionToGoogleSheets = useCallback(async (req: Requisition) => {
    try {
      const response = await fetch("/api/sync-to-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requisition: req })
      });
      const data = await response.json();
      if (!response.ok) {
        console.log("Failed to sync to Google Sheets:", data.error);
      } else {
        console.log(`[Google Sheets] Synced Requisition ${req.id} successfully:`, data);

        // If newly uploaded Google Drive URLs were returned, persist them back to Firestore
        if (data.uploadedAttachments && Array.isArray(data.uploadedAttachments) && data.uploadedAttachments.length > 0) {
          const hasChanged = JSON.stringify(data.uploadedAttachments) !== JSON.stringify(req.attachments);
          if (hasChanged && !isFirestoreQuotaExceeded()) {
            try {
              await updateDoc(doc(db, "requisitions", req.id), {
                attachments: data.uploadedAttachments,
                updatedAt: new Date().toISOString()
              });
              console.log(`[Google Drive Sync] Successfully updated requisition ${req.id} firestore attachments with Drive URLs.`);
              setRequisitions(prev => prev.map(r => r.id === req.id ? { ...r, attachments: data.uploadedAttachments } : r));
            } catch (fsErr) {
              console.log("Failed to update firestore attachments with Google Drive URLs:", fsErr);
            }
          }
        }

        if (data.mode === "simulated_fallback") {
          addSystemLog("SYNC_WARM_WARNING", `Firestore synced to Local Google Sheet Simulation Ledger: '${req.title}'`, {
            requisitionId: req.id,
            mode: data.mode,
            sheetTitle: data.sheetTitle
          }).catch(() => {});
        } else {
          addSystemLog("SYNC_SUCCESSFUL", `Requisition synced to online sheet 'STANDS Financial Records FY${req.fiscalYear || 2026}': '${req.title}'`, {
            requisitionId: req.id,
            mode: data.mode,
            spreadsheetUrl: data.spreadsheetUrl,
            sheetTitle: data.sheetTitle
          }).catch(() => {});
        }
      }
      return data;
    } catch (err) {
      console.error("Error executing Google Sheets Sync:", err);
    }
  }, [addSystemLog]);

  const addRequisition = useCallback(async (reqData: any) => {
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and modifications/creations are currently locked.");
    }

    if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
      throw new Error("This fiscal year is ARCHIVED. Creation or submission of new requisitions is blocked.");
    }

    const id = `req-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiryDays = systemSettings?.requisitionExpiryDays ?? 7;
    const expiresAt = new Date(now.getTime() + expiryDays * 24 * 60 * 60 * 1000); // dynamic days from now

    // Requisition Limit Check: Every single requisition must be within the group's requisition limit
    const matchingProj = projects.find(p => p.id === reqData.projectId || p.groupId === reqData.groupId || p.name === reqData.groupName);
    if (matchingProj) {
      const requisitionLimit = matchingProj.requisitionLimit || matchingProj.allocatedBudget || 0;
      if (reqData.amount > requisitionLimit) {
        throw new Error(`Requisition Limit Violation: Action blocked. This requisition amount of KES ${reqData.amount.toLocaleString()} exceeds the group's ('${matchingProj.name}') maximum requisition limit of KES ${requisitionLimit.toLocaleString()}.`);
      }
    }

    const newReq: Requisition = {
      ...reqData,
      id,
      requesterEmail: reqData.requesterEmail || currentUser?.email || "",
      status: reqData.status || RequisitionStatus.SUBMITTED,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      escalationLevel: 0,
      approvalHistory: [],
      flaggedForAudit: reqData.amount > 100000,
      fiscalYear: systemSettings.currentFiscalYear || 2026,
    };

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore Daily limits exceeded. Adding requisition local state + Sheets Sync.");
      setRequisitions(prev => {
        if (prev.find(r => r.id === id)) return prev;
        return [newReq, ...prev];
      });
      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore daily write quota exceeded. Synchronized requisition '${newReq.title}' directly to Google Sheets for isolation target.`, {
        requisitionId: id,
        title: newReq.title,
        amount: newReq.amount,
        group: newReq.groupName
      }).catch(() => {});

      if (newReq.status === RequisitionStatus.SUBMITTED) {
        sendEmailNotification(newReq, "SUBMITTED");
      }
      await syncRequisitionToGoogleSheets(newReq);
      return;
    }

    try {
      await databaseService.saveRequisition(cleanFirestoreData(newReq));
      await addSystemLog("REQUISITION_CREATED", `Requisition '${newReq.title}' created (amount KES ${newReq.amount.toLocaleString()})`, {
        requisitionId: id,
        title: newReq.title,
        amount: newReq.amount,
        group: newReq.groupName
      });
      
      // Trigger Email for new submission
      if (newReq.status === RequisitionStatus.SUBMITTED) {
        sendEmailNotification(newReq, "SUBMITTED");
      }
      
      if (newReq.projectId) {
        await syncProjectAmounts(newReq.projectId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `requisitions/${id}`);
    }
  }, [addSystemLog, systemSettings, projects, syncProjectAmounts, setRequisitions, syncRequisitionToGoogleSheets]);

  const updateRequisitionStatus = useCallback(async (
    id: string, 
    status: RequisitionStatus, 
    decision: "APPROVE" | "REJECT" | "ESCALATE",
    note: string = "", 
    method: any = "CODE",
    rejectionReason?: string,
    approvalCode?: string
  ) => {
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and status updates are currently locked.");
    }

    if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
      throw new Error("This fiscal year is ARCHIVED. Approving or rejecting requisitions is blocked.");
    }

    const historyAction: ApprovalNote = cleanFirestoreData({
      id: `an-${Math.random().toString(36).substr(2, 9)}`,
      approverId: currentUser?.id || "sys",
      approverName: currentUser?.name || "System",
      role: currentUser?.role || UserRole.ADMIN,
      note,
      decision,
      rejectionReason,
      approvalCode, // In real app, this would be salted/hashed
      method,
      timestamp: new Date().toISOString(),
    });

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore limits exceeded. Executing updateRequisitionStatus offline fallback.");
      const req = requisitions.find(r => r.id === id);
      if (!req) return;

      // Security check: Restricted approver can only approve requisitions of their affiliated groups
      const isRestrictedRole = currentUser?.role ? [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(currentUser.role) : false;
      if (isRestrictedRole) {
        const filterGroups = currentUser?.groups || [];
        const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUser?.group ? [currentUser.group] : []);
        const belongsToAffiliatedGroup = parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName);
        if (!belongsToAffiliatedGroup) {
          throw new Error("Security Violation: You are not authorized to approve, reject, or modify requisitions for this church group.");
        }
      }

      const updates: any = {
        status,
        updatedAt: new Date().toISOString(),
        approvalHistory: [...req.approvalHistory, historyAction],
      };

      if (status === RequisitionStatus.APPROVED_L1) updates.approvedAtL1 = new Date().toISOString();
      if (status === RequisitionStatus.APPROVED_L2) updates.approvedAtL2 = new Date().toISOString();
      if (status === RequisitionStatus.DISBURSED) updates.disbursedAt = new Date().toISOString();

      const updatedReq: Requisition = {
        ...req,
        ...updates
      };

      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));

      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore write limits exceeded. Requisition '${req.title}' updated locally to status '${status}' and synced to Google Sheets.`, {
        requisitionId: id,
        newStatus: status
      }).catch(() => {});

      if (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED || status === RequisitionStatus.REJECTED) {
         sendEmailNotification(req, status, decision === "REJECT" ? (rejectionReason || note) : note);
      }

      await syncRequisitionToGoogleSheets(updatedReq);
      return;
    }

    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const req = reqSnap.data() as Requisition;

      // Security check: Restricted approver can only approve requisitions of their affiliated groups
      const isRestrictedRole = currentUser?.role ? [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(currentUser.role) : false;
      if (isRestrictedRole) {
        const filterGroups = currentUser?.groups || [];
        const parsedGroups = filterGroups.length > 0 ? filterGroups : (currentUser?.group ? [currentUser.group] : []);
        const belongsToAffiliatedGroup = parsedGroups.includes(req.groupId) || parsedGroups.includes(req.groupName);
        if (!belongsToAffiliatedGroup) {
          throw new Error("Security Violation: You are not authorized to approve, reject, or modify requisitions for this church group.");
        }
      }

      // Check if financial books for this year are CLOSED
      const activeYear = systemSettings.currentFiscalYear || 2026;
      if (systemSettings.fiscalYearStatus === "CLOSED" && (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED)) {
        throw new Error(`Forbidden: Financial books for the year ${activeYear} are CLOSED. No further approvals or disbursements can be processed until the next financial year is opened.`);
      }

      // Requisition limit enforcement for disburse and final L2 approval (per-request limit instead of cumulative budget limit)
      if (status === RequisitionStatus.DISBURSED || status === RequisitionStatus.APPROVED_L2) {
        if (req.projectId) {
          const projectRef = doc(db, "projects", req.projectId);
          const projectSnap = await getDoc(projectRef);
          if (projectSnap.exists()) {
            const projData = projectSnap.data();
            const requisitionLimit = projData.requisitionLimit || projData.allocatedBudget || 0;
            
            if (req.amount > requisitionLimit) {
              throw new Error(`Requisition Limit Violation: Action blocked. This requisition amount of KES ${req.amount.toLocaleString()} exceeds the group's ('${projData.name}') maximum requisition limit of KES ${requisitionLimit.toLocaleString()}.`);
            }
          }
        }
      }

      const updates: any = {
        status,
        updatedAt: new Date().toISOString(),
        approvalHistory: [...req.approvalHistory, historyAction],
      };

      if (status === RequisitionStatus.APPROVED_L1) updates.approvedAtL1 = new Date().toISOString();
      if (status === RequisitionStatus.APPROVED_L2) {
        updates.approvedAtL2 = new Date().toISOString();
        const alertId = `finance-l2-ready-${id}`;
        const newAlert = {
          id: alertId,
          type: "L2_APPROVED",
          severity: "HIGH",
          message: `ATTENTION FINANCE: Requisition '${req.title}' from ${req.groupName} has reached APPROVED L2 status. Please verify entries and initiate disbursement of KES ${req.amount.toLocaleString()}.`,
          timestamp: new Date().toISOString(),
          isRead: false,
          targetRole: UserRole.FINANCE
        };
        try {
          await setDoc(doc(db, "alerts", alertId), newAlert);
          await addSystemLog("FINANCE_ALERT_TRIGGERED", `Automated alert dispatched to FINANCE team for L2 Approved requisition: '${req.title}'`, { requisitionId: id, alertId });
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `alerts/${alertId}`);
        }
      }
      if (status === RequisitionStatus.DISBURSED) updates.disbursedAt = new Date().toISOString();

      await updateDoc(reqRef, cleanFirestoreData(updates));
      
      const updatedReq = { ...req, ...updates, id };
      await databaseService.saveRequisition(cleanFirestoreData(updatedReq));
      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));
      
      if (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED) {
        const syncedRecord = {
          ...req,
          ...updates,
          id
        };
        syncRequisitionToGoogleSheets(syncedRecord).catch(e => console.log("Background Google Sheets sync failed:", e));
      }
      
      // Trigger Email Notification for status update
      if (status === RequisitionStatus.APPROVED_L1 || status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED || status === RequisitionStatus.REJECTED) {
         sendEmailNotification(req, status, decision === "REJECT" ? (rejectionReason || note) : note);
      }

      await addSystemLog("STATUS_CHANGE", `Requisition '${req.title}' decision: ${decision} -> New Status: ${status}`, {
        requisitionId: id,
        title: req.title,
        previousStatus: req.status,
        newStatus: status,
        decision,
        note
      });

      // Auto-sync project spent and committed amounts in the database on any status transition
      if (req.projectId) {
        await syncProjectAmounts(req.projectId);
      }

      // Update Ledger Book spentAmount if newly approved L2 or disbursed
      if (status === RequisitionStatus.APPROVED_L2 || (req.status !== RequisitionStatus.APPROVED_L2 && status === RequisitionStatus.DISBURSED)) {
         const ledgerQuerySnap = await getDocs(query(collection(db, "ledger_books"), where("ministryName", "==", req.groupName)));
         if (!ledgerQuerySnap.empty) {
           const ledgerDoc = ledgerQuerySnap.docs[0];
           await updateDoc(ledgerDoc.ref, {
             spentAmount: (ledgerDoc.data().spentAmount || 0) + req.amount
           });
         }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [currentUser, addSystemLog, systemSettings, syncProjectAmounts, requisitions, setRequisitions, syncRequisitionToGoogleSheets]);

  const enrollBiometric = useCallback((enabled: boolean = true) => {
    setBiometricEnrolled(enabled);
  }, []);

  const deleteRequisition = useCallback(async (id: string) => {
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline. Deleting requisitions is locked.");
    }

    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      const projectId = reqSnap.exists() ? (reqSnap.data() as Requisition).projectId : null;

      await databaseService.deleteRequisition(id);
      await addSystemLog("REQUISITION_DELETED", `Requisition ID '${id}' deleted`, { requisitionId: id });

      if (projectId) {
        await syncProjectAmounts(projectId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `requisitions/${id}`);
    }
  }, [addSystemLog, syncProjectAmounts]);

  const updateRequisition = useCallback(async (id: string, updates: Partial<Requisition>) => {
    if (!navigator.onLine) {
      throw new Error("Offline Mode: You are offline. All financial data is in read-only mode, and modifications are currently locked.");
    }

    if (systemSettings?.fiscalYearStatus === "ARCHIVED") {
      throw new Error("This fiscal year is ARCHIVED. Editing requisitions is blocked.");
    }

    if (isFirestoreQuotaExceeded()) {
      console.log("[Quota Fallback] Firestore limits exceeded. Executing updateRequisition offline fallback.");
      const currentReq = requisitions.find(r => r.id === id);
      if (!currentReq) return;

      const newAmount = updates.amount !== undefined ? updates.amount : currentReq.amount;
      const cleanedUpdates = {
        ...updates,
        updatedAt: new Date().toISOString(),
        flaggedForAudit: newAmount > 100000 ? true : (updates.flaggedForAudit !== undefined ? updates.flaggedForAudit : (currentReq.flaggedForAudit || false))
      };

      const updatedReq: Requisition = {
        ...currentReq,
        ...cleanedUpdates
      };

      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));

      addSystemLog("QUOTA_FALLBACK_ACTIVE", `Firestore write limits exceeded. Requisition '${id}' edited locally and synced to Google Sheets.`, {
        requisitionId: id,
        updates
      }).catch(() => {});

      if (updates.status === RequisitionStatus.SUBMITTED && currentReq.status !== RequisitionStatus.SUBMITTED) {
        sendEmailNotification(updatedReq, "SUBMITTED").catch(() => {});
      }

      await syncRequisitionToGoogleSheets(updatedReq);
      return;
    }

    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const currentReq = reqSnap.data() as Requisition;
      
      const newAmount = updates.amount !== undefined ? updates.amount : currentReq.amount;
      const cleanedUpdates = {
        ...updates,
        updatedAt: new Date().toISOString(),
        flaggedForAudit: newAmount > 100000 ? true : (updates.flaggedForAudit !== undefined ? updates.flaggedForAudit : (currentReq.flaggedForAudit || false))
      };
      
      const updatedReq = { ...currentReq, ...cleanedUpdates };
      await databaseService.saveRequisition(cleanFirestoreData(updatedReq));
      setRequisitions(prev => prev.map(r => r.id === id ? updatedReq : r));
      await addSystemLog("REQUISITION_EDITED", `Requisition '${id}' updated`, { requisitionId: id, updates });

      if (updates.status === RequisitionStatus.SUBMITTED && currentReq.status !== RequisitionStatus.SUBMITTED) {
        sendEmailNotification(updatedReq, "SUBMITTED").catch(() => {});
      }

      await syncRequisitionToGoogleSheets(updatedReq);

      if (currentReq.projectId) {
        await syncProjectAmounts(currentReq.projectId);
      }
      if (updates.projectId && updates.projectId !== currentReq.projectId) {
        await syncProjectAmounts(updates.projectId);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [addSystemLog, db, systemSettings, syncProjectAmounts, requisitions, setRequisitions, syncRequisitionToGoogleSheets]);

  const uploadReceipts = useCallback(async (id: string, newReceipts: string[]) => {
    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const data = reqSnap.data() as Requisition;
      const currentReceipts = data.receipts || [];
      const localUploadedReceipts = await uploadAttachmentsToLocalServer(newReceipts);
      const updatedReceipts = [...currentReceipts, ...localUploadedReceipts];
      
      const updatedAt = new Date().toISOString();
      await updateDoc(reqRef, {
        receipts: updatedReceipts,
        updatedAt
      });
      setRequisitions(prev => prev.map(r => r.id === id ? { ...r, receipts: updatedReceipts, updatedAt } : r));
      await addSystemLog("RECEIPTS_UPLOADED", `Uploaded ${newReceipts.length} receipts to Requisition ID: ${id}`, { requisitionId: id, currentReceiptCount: updatedReceipts.length });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [addSystemLog, setRequisitions]);

  const markAlertAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "alerts", id), { isRead: true });
      await addSystemLog("ALERT_READ", `Alert ID '${id}' marked as read`, { alertId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `alerts/${id}`);
    }
  }, [addSystemLog]);

  const deleteAlert = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, "alerts", id));
      await addSystemLog("ALERT_DELETE", `Deleted system notification: ${id}`, { alertId: id });
    } catch (err) {
      console.error("Failed to delete alert:", err);
      throw err;
    }
  }, [db, addSystemLog]);

  const updateThreshold = useCallback(async (id: string, updates: Partial<AlertThreshold>) => {
    try {
      await updateDoc(doc(db, "thresholds", id), updates);
      await addSystemLog("THRESHOLD_UPDATED", `Budget threshold ID '${id}' updated`, { thresholdId: id, updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `thresholds/${id}`);
    }
  }, [addSystemLog]);

  const saveReport = useCallback(async (reportData: any) => {
    if (!currentUser) return;
    const id = `rep-${Date.now()}`;
    const report: SavedReport = {
      ...reportData,
      id,
      timestamp: new Date().toISOString(),
      generatedBy: currentUser.name,
      generatedById: currentUser.id
    };
    try {
      await setDoc(doc(db, "reports", id), report);
      await addSystemLog("REPORT_SAVED", `Audit report saved: ${report.title}`, { reportId: id, title: report.title, period: report.period });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reports/${id}`);
    }
  }, [currentUser, addSystemLog]);

  // Defensive deduplication to avoid "duplicate key" React warnings from backend data sync
  const uniqueRequisitions = React.useMemo(() => {
    const seen = new Set<string>();
    return requisitions.filter(r => {
      if (!r || !r.id) return false;
      if (seen.has(r.id)) return false;
      seen.add(r.id);
      return true;
    });
  }, [requisitions]);

  const uniqueProjects = React.useMemo(() => {
    const seen = new Set<string>();
    return projects.filter(p => {
      if (!p || !p.id) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [projects]);

  const uniqueAlerts = React.useMemo(() => {
    const seen = new Set<string>();
    return alerts.filter(a => {
      if (!a || !a.id) return false;
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  }, [alerts]);

  const uniqueThresholds = React.useMemo(() => {
    const seen = new Set<string>();
    return thresholds.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [thresholds]);

  const uniqueChurchGroups = React.useMemo(() => {
    const seen = new Set<string>();
    return churchGroups.filter(cg => {
      if (!cg || !cg.id) return false;
      if (seen.has(cg.id)) return false;
      seen.add(cg.id);
      return true;
    });
  }, [churchGroups]);

  const uniqueActiveToasts = React.useMemo(() => {
    const seen = new Set<string>();
    return activeToasts.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [activeToasts]);

  const uniqueLedgerBooks = React.useMemo(() => {
    const seen = new Set<string>();
    return ledgerBooks.filter(lb => {
      if (!lb || !lb.id) return false;
      if (seen.has(lb.id)) return false;
      seen.add(lb.id);
      return true;
    });
  }, [ledgerBooks]);

  const sendBulkEmail = useCallback(async (subject: string, content: string, recipients?: string[]) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/send-bulk-email", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ subject, content, recipients })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || `Bulk email dispatch failed with status: ${response.status}`);
      }
      return data;
    } catch (err: any) {
      console.error("Failed to trigger bulk email newsletter:", err);
      throw err;
    }
  }, []);

  const uniqueUsers = React.useMemo(() => {
    const seen = new Set<string>();
    return users.filter(u => {
      if (!u || !u.id) return false;
      if (seen.has(u.id)) return false;
      seen.add(u.id);
      return true;
    });
  }, [users]);

  const uniqueFiscalYears = React.useMemo(() => {
    const seen = new Set<string>();
    return fiscalYears.filter(fy => {
      if (!fy || !fy.id) return false;
      if (seen.has(fy.id)) return false;
      seen.add(fy.id);
      return true;
    });
  }, [fiscalYears]);

  const uniqueVendors = React.useMemo(() => {
    const seen = new Set<string>();
    return vendors.filter(v => {
      if (!v || !v.id) return false;
      if (seen.has(v.id)) return false;
      seen.add(v.id);
      return true;
    });
  }, [vendors]);

  const uniqueTransactions = React.useMemo(() => {
    const seen = new Set<string>();
    return transactions.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [transactions]);

  const uniqueReports = React.useMemo(() => {
    const seen = new Set<string>();
    return reports.filter(rep => {
      if (!rep || !rep.id) return false;
      if (seen.has(rep.id)) return false;
      seen.add(rep.id);
      return true;
    });
  }, [reports]);

  return (
    <RequisitionContext.Provider value={{
      requisitions: uniqueRequisitions,
      projects: uniqueProjects,
      alerts: uniqueAlerts,
      thresholds: uniqueThresholds,
      forecastData,
      currentUser,
      users: uniqueUsers,
      loading,
      authLoading,
      churchGroups: uniqueChurchGroups,
      lastGroupsSync,
      addChurchGroup,
      deleteChurchGroup,
      ledgerBooks: uniqueLedgerBooks,
      createLedgerBook,
      updateLedgerBookBudget,
      biometricEnrolled,
      enrollBiometric,
      login,
      loginWithEmail,
      signupWithEmail,
      logout,
      addRequisition,
      updateRequisition,
      updateRequisitionStatus,
      uploadReceipts,
      deleteRequisition,
      markAlertAsRead,
      updateThreshold,
      approveUser,
      suspendUser,
      updateUserRole,
      updateUserProfile,
      updateCurrentUserPassword,
      adminRegisterUser,
      adminResetUserPassword,
      deleteUser,
      adminForceLogoutUser,
      systemSettings,
      updateSystemSettings,
      allocateBudgetForGroup,
      updateProjectBudget,
      deleteProject,
      closeFinancialYear,
      openFinancialYear,
      supplementaryRequests,
      applySupplementaryBudget,
      vendors: uniqueVendors,
      addVendor,
      updateVendor,
      deleteVendor,
      systemLogs,
      addSystemLog,
      systemLogLimit,
      setSystemLogLimit,
      seedAllEcosystemData,
      reports: uniqueReports,
      saveReport,
      globalSearchTerm,
      setGlobalSearchTerm,
      searchFilter,
      setSearchFilter,
      advancedSearchActive,
      setAdvancedSearchActive,
      advancedDateRangePreset,
      setAdvancedDateRangePreset,
      advancedCustomStartDate,
      setAdvancedCustomStartDate,
      advancedCustomEndDate,
      setAdvancedCustomEndDate,
      advancedBudgetLine,
      setAdvancedBudgetLine,
      activeToasts: uniqueActiveToasts,
      removeToast,
      triggerToast,
      readNoticeIds,
      toggleNoticeRead,
      markAllNoticesRead,
      permissionConfigs,
      canAccess,
      canPerform,
      updateRolePermissions,
      deleteAlert,
      transactions: uniqueTransactions,
      fiscalYears: uniqueFiscalYears,
      createFiscalYear,
      toggleFiscalYearStatus,
      setActiveFiscalYear,
      cloneFiscalYearBudgets,
      firestoreQuotaExceeded,
      setFirestoreQuotaExceeded,
      setSyncTargets,
      syncingTargets,
      sendBulkEmail
    }}>
      {children}
    </RequisitionContext.Provider>
  );
};


export const useRequisitions = () => {
  const context = useContext(RequisitionContext);
  if (context === undefined) {
    throw new Error("useRequisitions must be used within a RequisitionProvider");
  }
  return context;
};

export const useActiveFiscalYear = () => {
  const { systemSettings } = useRequisitions();
  const year = systemSettings?.currentFiscalYear;
  return {
    year: year || null,
    isLoading: !year,
  };
};

export const getActiveFiscalYear = () => {
  const { systemSettings } = useRequisitions();
  return systemSettings?.currentFiscalYear || 2026;
};


