/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
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
  ChurchGroup
} from "../types";
import { 
  auth, 
  db, 
  handleFirestoreError, 
  OperationType 
} from "../lib/firebase";
import { 
  onSnapshot, 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  query,
  orderBy,
  where,
  getDocFromServer,
  deleteField
} from "firebase/firestore";
import { 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  getAuth
} from "firebase/auth";
import { initializeApp, deleteApp } from "firebase/app";
import firebaseConfig from "../../firebase-applet-config.json";

interface RequisitionContextType {
  requisitions: Requisition[];
  projects: Project[];
  alerts: BudgetAlert[];
  thresholds: AlertThreshold[];
  forecastData: ForecastMonth[];
  currentUser: UserProfile | null;
  users: UserProfile[];
  loading: boolean;
  biometricEnrolled: boolean;
  enrollBiometric: () => void;
  login: () => Promise<void>;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  signupWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  addRequisition: (req: Omit<Requisition, "id" | "status" | "submittedAt" | "updatedAt" | "approvalHistory">) => Promise<void>;
  updateRequisition: (id: string, updates: Partial<Requisition>) => Promise<void>;
  updateRequisitionStatus: (id: string, status: RequisitionStatus, decision: "APPROVE" | "REJECT" | "ESCALATE", note?: string, method?: any, rejectionReason?: string, approvalCode?: string) => Promise<void>;
  uploadReceipts: (id: string, receipts: string[]) => Promise<void>;
  deleteRequisition: (id: string) => Promise<void>;
  markAlertAsRead: (id: string) => Promise<void>;
  updateThreshold: (id: string, updates: Partial<AlertThreshold>) => Promise<void>;
  approveUser: (id: string) => Promise<void>;
  suspendUser: (id: string, isSuspended: boolean) => Promise<void>;
  updateUserRole: (id: string, role: UserRole) => Promise<void>;
  updateUserProfile: (id: string, updates: Partial<UserProfile>) => Promise<void>;
  adminRegisterUser: (email: string, pass: string, name: string, role: UserRole, group?: string, approverCode?: string) => Promise<void>;
  systemLogs: SystemLog[];
  addSystemLog: (action: string, details: string, metadata?: any) => Promise<void>;
  churchGroups: ChurchGroup[];
  addChurchGroup: (name: string, description?: string) => Promise<void>;
  deleteChurchGroup: (id: string) => Promise<void>;
  seedAllEcosystemData: () => Promise<void>;
  reports: SavedReport[];
  saveReport: (report: Omit<SavedReport, "id" | "timestamp" | "generatedBy" | "generatedById">) => Promise<void>;
  globalSearchTerm: string;
  setGlobalSearchTerm: (term: string) => void;
  activeToasts: BudgetAlert[];
  removeToast: (id: string) => void;
  readNoticeIds: string[];
  toggleNoticeRead: (id: string, forceRead?: boolean) => void;
}

const RequisitionContext = createContext<RequisitionContextType | undefined>(undefined);

export const RequisitionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [alerts, setAlerts] = useState<BudgetAlert[]>([]);
  const [thresholds, setThresholds] = useState<AlertThreshold[]>([]);
  const [churchGroups, setChurchGroups] = useState<ChurchGroup[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [forecastData, setForecastData] = useState<ForecastMonth[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [activeToasts, setActiveToasts] = useState<BudgetAlert[]>([]);
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

  const removeToast = useCallback((id: string) => {
    setActiveToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Track which alerts have already been sent to activeToasts
  const seenAlertsRef = React.useRef<Set<string>>(new Set());

  // Monitor for new high-priority alerts to show as toasts
  useEffect(() => {
    if (alerts.length === 0) return;

    // Latest 3 unread high/medium alerts from the last 5 minutes
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    const newPriorityAlerts = alerts.filter(a => 
      !a.isRead && 
      (a.severity === "HIGH" || a.severity === "MEDIUM") &&
      new Date(a.timestamp) > fiveMinutesAgo &&
      !seenAlertsRef.current.has(a.id)
    );

    if (newPriorityAlerts.length > 0) {
      newPriorityAlerts.forEach(a => seenAlertsRef.current.add(a.id));
      setActiveToasts(prev => {
        const combined = [...newPriorityAlerts, ...prev];
        // Keep only top 2
        return combined.slice(0, 2);
      });
    }
  }, [alerts]);

  // Connection Test
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('offline')) {
          console.error("Firebase is offline. Check configuration.");
        }
      }
    };
    testConnection();
  }, []);

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

  // Auth Sync
  useEffect(() => {
    let unsubUserDoc = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      unsubUserDoc(); // Clean up prior listener on state change

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        unsubUserDoc = onSnapshot(userRef, async (userSnap) => {
          let inviteConsumed = false;
          let invitedRole: UserRole | null = null;
          let invitedGroup: string | null = null;
          let invitedCode: string | null = null;

          const storedInviteStr = sessionStorage.getItem("requisition_invite");
          if (storedInviteStr) {
            try {
              const invite = JSON.parse(storedInviteStr);
              if (invite.email && firebaseUser.email && invite.email.toLowerCase() === firebaseUser.email.toLowerCase()) {
                invitedRole = invite.role;
                invitedGroup = invite.group || null;
                invitedCode = invite.code || null;
                inviteConsumed = true;
                sessionStorage.removeItem("requisition_invite");
              }
            } catch (e) {
              console.error("Failed parsing stored invitation:", e);
            }
          }

          if (userSnap.exists()) {
            const profile = userSnap.data() as UserProfile;
            
            if (inviteConsumed && invitedRole) {
              // Upgrade profile with invited attributes
              await setDoc(userRef, {
                role: invitedRole,
                isApproved: true,
                ...(invitedGroup && { group: invitedGroup }),
                ...(invitedCode && { approverCode: invitedCode }),
              }, { merge: true });
            } else if (firebaseUser.email === "gichaumburu@gmail.com" && (!profile.isApproved || profile.role !== UserRole.ADMIN)) {
              // Auto-promote bootstrap admin if info is missing or incorrect
              await setDoc(userRef, { role: UserRole.ADMIN, isApproved: true }, { merge: true });
            } else {
              setCurrentUser(profile);
              setLoading(false);
            }
          } else {
            // Create new profile
            const isAdmin = firebaseUser.email === "gichaumburu@gmail.com";
            const newProfile: UserProfile = {
              id: firebaseUser.uid,
              name: firebaseUser.displayName || "Anonymous User",
              email: firebaseUser.email || "",
              role: inviteConsumed && invitedRole ? invitedRole : (isAdmin ? UserRole.ADMIN : UserRole.CHURCH_GROUP),
              isActive: true,
              isApproved: inviteConsumed ? true : isAdmin,
              isSuspended: false,
              ...(inviteConsumed && invitedGroup && { group: invitedGroup }),
              ...(inviteConsumed && invitedCode && { approverCode: invitedCode }),
            };
            await setDoc(userRef, newProfile);
            
            if (!isAdmin && !inviteConsumed) {
              fetch("/api/notify-slack", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "USER_PENDING_APPROVAL",
                  details: `🚨 ACTION REQUIRED: New user registered via Google and is PENDING APPROVAL: ${newProfile.email}`,
                  performedBy: newProfile.email,
                  timestamp: new Date().toISOString(),
                  metadata: { email: newProfile.email }
                })
              }).catch(err => console.warn("Slack Background Notify Failed:", err));
            }
          }
        }, (err) => {
          console.error("User profile sync failed", err);
          setLoading(false);
        });
      } else {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      unsubUserDoc();
    };
  }, []);

  const addSystemLog = useCallback(async (action: string, details: string, metadata?: any) => {
    try {
      // Delay slightly if not fully authenticated yet to allow Firestore to sync the Auth token
      // This prevents the "Missing or insufficient permissions" race condition on login.
      if (!auth.currentUser) {
        await new Promise(resolve => setTimeout(resolve, 800));
      }

      const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const performedBy = currentUser ? `${currentUser.name} (${currentUser.role})` : (auth.currentUser?.email || "System");
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
      
      await setDoc(doc(db, "system_logs", logId), logDoc);

      // Notify Slack via our internal API proxy
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
        }).catch(err => console.warn("Slack background notify failed", err));
      } catch (slackErr) {
        console.warn("Failed to start Slack notification", slackErr);
      }
      
    } catch (err: any) {
      console.warn("Failed to add system log (possibly due to auth sync race condition):", err.message);
    }
  }, [currentUser]);

  const seedAllEcosystemData = useCallback(async () => {
    try {
      console.log("Starting prototype seeding...");
      
      // Seed Projects
      const mockProjects = [
        { id: "p1", name: "Youth Camp 2026", groupId: "Youth Camp 2026", allocatedBudget: 500000, spentAmount: 125000, status: "ACTIVE", color: "bg-indigo-500" },
        { id: "p2", name: "Sanctuary Renovation", groupId: "Sanctuary Renovation", allocatedBudget: 2500000, spentAmount: 1800000, status: "ACTIVE", color: "bg-emerald-500" },
        { id: "p3", name: "Musical Instruments", groupId: "Musical Instruments", allocatedBudget: 450000, spentAmount: 280000, status: "ACTIVE", color: "bg-amber-500" },
        { id: "p4", name: "Outreach Program", groupId: "Outreach Program", allocatedBudget: 300000, spentAmount: 45000, status: "ACTIVE", color: "bg-rose-500" },
        { id: "p5", name: "Sunday School Resources", groupId: "Sunday School Resources", allocatedBudget: 150000, spentAmount: 25000, status: "ACTIVE", color: "bg-sky-500" },
      ];
      console.log("Seeding projects...");
      for (const p of mockProjects) {
        await setDoc(doc(db, "projects", p.id), p);
      }

      // Seed Church Groups
      console.log("Seeding church groups...");
      const mockChurchGroups = [
        { id: "cg1", name: "Youth Camp 2026", description: "All activities related to the 2026 youth summer camp.", createdAt: new Date().toISOString() },
        { id: "cg2", name: "Sanctuary Renovation", description: "Funds for structural and aesthetic church improvements.", createdAt: new Date().toISOString() },
        { id: "cg3", name: "Musical Instruments", description: "Maintenance and acquisition of church music gear.", createdAt: new Date().toISOString() },
        { id: "cg4", name: "Outreach Program", description: "Community service and missionary work initiatives.", createdAt: new Date().toISOString() },
        { id: "cg5", name: "Sunday School Resources", description: "Materials and training for children's ministry.", createdAt: new Date().toISOString() },
      ];
      for (const cg of mockChurchGroups) {
        await setDoc(doc(db, "church_groups", cg.id), cg);
      }

      // Seed Thresholds
      const mockThresholds = [
        { id: "t1", type: "BUDGET_OVERSHOOT", threshold: 85, isEnabled: true, notifyEmail: true },
        { id: "t2", type: "LARGE_REQUEST", threshold: 150000, isEnabled: true, notifyEmail: true },
        { id: "t3", type: "EXPIRY_ALERT", threshold: 10, isEnabled: true, notifyEmail: true },
        { id: "t4", type: "CRITICAL_FUNDING", threshold: 95, isEnabled: true, notifyEmail: true },
      ];
      console.log("Seeding thresholds...");
      for (const t of mockThresholds) {
        await setDoc(doc(db, "thresholds", t.id), t);
      }

      // Seed Forecast
      console.log("Seeding forecasts...");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      for (const m of months) {
        const projected = 300000 + (Math.random() * 400000);
        const actual = m === "May" ? 420000 : (["Jan", "Feb", "Mar", "Apr"].includes(m) ? projected * 0.95 : 0);
        await setDoc(doc(db, "forecast", m), {
          month: m,
          projected: Math.floor(projected / 1000) * 1000,
          actual: Math.floor(actual / 1000) * 1000
        });
      }

      // Seed Users
      console.log("Seeding users...");
      const mockUsers = [
        { id: "u-admin", name: "System Admin", email: "gichaumburu@gmail.com", role: UserRole.ADMIN, isActive: true, isApproved: true, isSuspended: false },
        { id: "u-minister", name: "Rev. Dr. Patrick Mutua", email: "minister@standrews.org", role: UserRole.APPROVER_L1, approverCode: "111111", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-clerk", name: "Elder Mercy Wanjiku", email: "clerk@standrews.org", role: UserRole.APPROVER_L2, approverCode: "2222222", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-treasurer", name: "Deacon John Mwangi", email: "treasurer@standrews.org", role: UserRole.FINANCE, isActive: true, isApproved: true, isSuspended: false },
        { id: "u-youth-lead", name: "George Gichauri", email: "youth@standrews.org", role: UserRole.CHURCH_GROUP, group: "Youth Camp 2026", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-worship-lead", name: "Sarah Kemunto", email: "worship@standrews.org", role: UserRole.CHURCH_GROUP, group: "Musical Instruments", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-bg-lead", name: "Jane Doe", email: "guild@standrews.org", role: UserRole.CHURCH_GROUP, group: "Sanctuary Renovation", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-outreach", name: "David Kimani", email: "outreach@standrews.org", role: UserRole.CHURCH_GROUP, group: "Outreach Program", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-ss-lead", name: "Mary Atieno", email: "ss@standrews.org", role: UserRole.CHURCH_GROUP, group: "Sunday School Resources", isActive: true, isApproved: true, isSuspended: false },
        { id: "u-finance-asst", name: "Peter Omondi", email: "finance2@standrews.org", role: UserRole.FINANCE, isActive: true, isApproved: true, isSuspended: false }
      ];
      for (const u of mockUsers) {
        await setDoc(doc(db, "users", u.id), u);
      }

      // Seed Requisitions
      console.log("Seeding requisitions...");
      const statuses = [
        RequisitionStatus.DRAFT, 
        RequisitionStatus.SUBMITTED, 
        RequisitionStatus.APPROVED_L1, 
        RequisitionStatus.APPROVED_L2, 
        RequisitionStatus.DISBURSED, 
        RequisitionStatus.REJECTED
      ];
      
      const titles = [
        "Public Address System Upgrade", "Pioneers Camp Food Catering", "Sanctuary Paint & Varnish", 
        "Hymn Book Procurement", "Youth Seminar Materials", "Community Clean-up Logistics",
        "Sunday School Workbook Print", "Choir Uniform Repair", "Missionary Support Fund",
        "Electric Keyboard Maintenance", "Security Door Reinforcement", "First Aid Kit Replenishment",
        "Kitchen Appliance Servicing", "Evangelism Tract Printing", "Garden Maintenance Tools",
        "Lighting System Spares", "Plumbing Fittings Repair", "Desktop Computer Upgrade",
        "WiFi Expansion Router", "Worship Leader Mic Set"
      ];

      const requesterData = [
        { id: "u-youth-lead", name: "George Gichauri", group: "Youth Camp 2026" },
        { id: "u-worship-lead", name: "Sarah Kemunto", group: "Musical Instruments" },
        { id: "u-bg-lead", name: "Jane Doe", group: "Sanctuary Renovation" },
        { id: "u-outreach", name: "David Kimani", group: "Outreach Program" },
        { id: "u-ss-lead", name: "Mary Atieno", group: "Sunday School Resources" }
      ];
      
      for (let i = 1; i <= 40; i++) {
        const reqUser = requesterData[i % requesterData.length];
        const status = statuses[i % statuses.length];
        const date = new Date();
        date.setDate(date.getDate() - (i));

        const reqId = `req-seed-${i}`;
        const amount = 2000 + (Math.random() * 85000);
        
        const newReq: Requisition = {
          id: reqId,
          title: titles[i % titles.length] + (i > titles.length ? ` (Part ${Math.floor(i/titles.length) + 1})` : ""),
          description: `Comprehensive expenditure request transaction ${i} generated by the system seeding engine for cross-validation of the audit trail and budget tracking modules.`,
          amount: Math.floor(amount / 50) * 50,
          amountWords: "AUTOGENERATED_BY_SEEDER",
          projectId: mockProjects[i % mockProjects.length].id,
          groupId: reqUser.group,
          groupName: reqUser.group,
          requesterId: reqUser.id,
          requesterName: reqUser.name,
          status: status,
          submittedAt: date.toISOString(),
          updatedAt: date.toISOString(),
          approvalHistory: []
        };

        if (status !== RequisitionStatus.DRAFT && status !== RequisitionStatus.SUBMITTED) {
          newReq.approvalHistory = [
            {
              id: `an-seed-1-${i}`,
              approverId: "u-minister",
              approverName: "Rev. Dr. Patrick Mutua",
              role: UserRole.APPROVER_L1,
              note: "Request aligns with ministry goals. Approved for L1.",
              decision: "APPROVE",
              method: "CODE",
              timestamp: date.toISOString()
            }
          ];

          if (status === RequisitionStatus.APPROVED_L2 || status === RequisitionStatus.DISBURSED) {
            newReq.approvalHistory.push({
              id: `an-seed-2-${i}`,
              approverId: "u-clerk",
              approverName: "Elder Mercy Wanjiku",
              role: UserRole.APPROVER_L2,
              note: "Budget availability verified. Final approval granted.",
              decision: "APPROVE",
              method: "FINGERPRINT",
              timestamp: new Date(new Date(date).getTime() + 3600000).toISOString()
            });
          }

          if (status === RequisitionStatus.REJECTED) {
            newReq.approvalHistory[0].decision = "REJECT";
            newReq.approvalHistory[0].rejectionReason = "Insufficient documentation for catering vendor.";
          }
        }

        await setDoc(doc(db, "requisitions", reqId), newReq);
      }

      console.log("Finalizing seeding with system log...");
      await addSystemLog("PROTOTYPE_SEEDED", "Prototype ledger database seeded with 40 requisitions, 5 projects, and 10 ministry users.", { action: "SEED" });
      console.log("Seeding complete!");
    } catch (err) {
      console.error("Failed to seed prototype data:", err);
      // Re-throw to show in UI if needed
      throw err;
    }
  }, [addSystemLog]);

  // Real-time Sync for authenticated users
  useEffect(() => {
    if (!currentUser || !currentUser.isApproved || currentUser.isSuspended) {
      setRequisitions([]);
      setProjects([]);
      setAlerts([]);
      setThresholds([]);
      setUsers([]);
      setForecastData([]);
      setSystemLogs([]);
      return;
    }
    
    const shouldFilter = [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(currentUser.role) && currentUser.group;
    const filterGroup = currentUser.group;

    const unsubRequisitions = onSnapshot(query(collection(db, "requisitions"), orderBy("submittedAt", "desc")), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Requisition));
      if (shouldFilter) data = data.filter(req => req.groupId === filterGroup || req.groupName === filterGroup);
      setRequisitions(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "requisitions"));

    const unsubProjects = onSnapshot(collection(db, "projects"), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project));
      if (shouldFilter) data = data.filter(p => p.groupId === filterGroup || p.name === filterGroup);
      setProjects(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "projects"));

    const unsubAlerts = onSnapshot(query(collection(db, "alerts"), orderBy("timestamp", "desc")), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as BudgetAlert));
      if (shouldFilter && filterGroup) data = data.filter(a => a.message.includes(filterGroup));
      setAlerts(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "alerts"));

    const unsubThresholds = onSnapshot(collection(db, "thresholds"), (snap) => {
      setThresholds(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AlertThreshold)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "thresholds"));

    const unsubForecast = onSnapshot(collection(db, "forecast"), (snap) => {
      setForecastData(snap.docs.map(doc => doc.data() as ForecastMonth));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "forecast"));

    const unsubReports = onSnapshot(query(collection(db, "reports"), orderBy("timestamp", "desc")), (snap) => {
      setReports(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavedReport)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "reports"));

    let unsubLogs = () => {};
    if (currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.FINANCE) {
      unsubLogs = onSnapshot(query(collection(db, "system_logs"), orderBy("timestamp", "desc")), (snap) => {
        let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemLog));
        if (shouldFilter && filterGroup) data = data.filter(log => log.groupId === filterGroup || log.details.includes(filterGroup));
        setSystemLogs(data);
      }, (err) => handleFirestoreError(err, OperationType.LIST, "system_logs"));
    } else {
      setSystemLogs([]);
    }
      
    const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      if (shouldFilter && filterGroup) data = data.filter(u => u.group === filterGroup);
      setUsers(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, "users"));

    // Seed Data if empty (only for the first admin or as a system check)
    const seedInitialData = async () => {
      const projectsSnap = await getDoc(doc(db, "projects", "p1"));
      if (!projectsSnap.exists() && currentUser.role === UserRole.ADMIN) {
        await seedAllEcosystemData();
      }
    };
    seedInitialData();

    return () => {
      unsubRequisitions();
      unsubProjects();
      unsubAlerts();
      unsubThresholds();
      unsubForecast();
      unsubUsers();
      unsubLogs();
      unsubReports();
    };
  }, [currentUser, seedAllEcosystemData]);

  // Real-time Sync for Church Groups
  useEffect(() => {
    const unsubGroups = onSnapshot(collection(db, "church_groups"), (snap) => {
      setChurchGroups(snap.docs.map(doc => doc.data() as ChurchGroup));
    }, (err) => handleFirestoreError(err, OperationType.LIST, "church_groups"));
    return () => unsubGroups();
  }, []);

  // Automated background expiry notifications watcher (Admin only for writing alerts)
  useEffect(() => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN || requisitions.length === 0 || thresholds.length === 0) return;

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
        const usage = (project.spentAmount / project.allocatedBudget) * 100;
        if (usage >= budgetThreshold) {
          const alertId = `budget-${project.id}-${Math.floor(usage)}`;
          const alertExists = alerts.some(a => a.id === alertId || (a.message.includes(project.name) && a.type === "OVERSHOOT" && !a.isRead));

          if (!alertExists) {
            const newAlert: BudgetAlert = {
              id: alertId,
              type: "OVERSHOOT",
              severity: usage >= 100 ? "HIGH" : "MEDIUM",
              message: `PROJECT BUDGET ALERT: '${project.name}' has reached ${usage.toFixed(1)}% utilization (${project.spentAmount.toLocaleString()} / ${project.allocatedBudget.toLocaleString()}).`,
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
  }, [requisitions, alerts, thresholds, currentUser, db, addSystemLog]);

  // Automated background trigger for FINANCE alerts on L2 Approved status
  useEffect(() => {
    if (!currentUser || requisitions.length === 0) return;

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
  }, [requisitions, alerts, currentUser, db, addSystemLog]);

  // Recurring Requisitions Watcher
  useEffect(() => {
    if (!currentUser || requisitions.length === 0) return;

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
          const newDraft: Requisition = {
            ...req,
            id: draftId,
            status: RequisitionStatus.DRAFT,
            submittedAt: now.toISOString(),
            updatedAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
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
  }, [requisitions, currentUser, addSystemLog]);

  const login = async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      if (result.user) {
        await addSystemLog("USER_LOGIN", `User logged in via Google: ${result.user.email}`, { authProvider: "google", email: result.user.email });
      }
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error("Unauthorized Domain: The current hosting domain (Vercel or custom domain) has not been whitelisted. Please open Firebase Console -> Go to Authentication -> Settings -> Authorized Domains -> Add your current domain (e.g., your-app.vercel.app) to the list.");
      }
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
        throw new Error("Google Sign-in was interrupted. This usually happens if popups are blocked or the window was closed. Please use 'Sign in with Email' using the credentials shown below.");
      }
      throw error;
    }
  };

  const loginWithEmail = async (email: string, pass: string) => {
    try {
      const result = await signInWithEmailAndPassword(auth, email, pass);
      if (result.user) {
        // We do not await this immediately to prevent blocking the UI, 
        // and allow Auth state to sync to Firestore rules
        addSystemLog("USER_LOGIN", `User logged in via Email/Password: ${result.user.email}`, { authProvider: "password", email: result.user.email });
      }
    } catch (error: any) {
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found') {
        const mockUsers = [
          { name: "System Admin", email: "gichaumburu@gmail.com", role: UserRole.ADMIN },
          { name: "Rev. Dr. Patrick Mutua", email: "minister@standrews.org", role: UserRole.APPROVER_L1, approverCode: "111111" },
          { name: "Elder Mercy Wanjiku", email: "clerk@standrews.org", role: UserRole.APPROVER_L2, approverCode: "2222222" },
          { name: "Deacon John Mwangi", email: "treasurer@standrews.org", role: UserRole.FINANCE },
          { name: "George Gichauri", email: "youth@standrews.org", role: UserRole.CHURCH_GROUP, group: "Youth Camp 2026" },
          { name: "Sarah Kemunto", email: "worship@standrews.org", role: UserRole.CHURCH_GROUP, group: "Musical Instruments" },
          { name: "Jane Doe", email: "guild@standrews.org", role: UserRole.CHURCH_GROUP, group: "Sanctuary Renovation" },
          { name: "David Kimani", email: "outreach@standrews.org", role: UserRole.CHURCH_GROUP, group: "Outreach Program" },
          { name: "Mary Atieno", email: "ss@standrews.org", role: UserRole.CHURCH_GROUP, group: "Sunday School Resources" },
          { name: "Peter Omondi", email: "finance2@standrews.org", role: UserRole.FINANCE }
        ];

        const mockUser = mockUsers.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (mockUser) {
          console.log(`Auto-provisioning mock user account: ${email}`);
          const secondaryAppName = `MockRegApp-${Math.random().toString(36).substring(2, 9)}`;
          let secondaryApp = null;
          try {
            secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
            const secondaryAuth = getAuth(secondaryApp);
            
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
            const newUid = userCredential.user.uid;
            await updateProfile(userCredential.user, { displayName: mockUser.name });
            
            await secondaryAuth.signOut();
            await deleteApp(secondaryApp);
            
            // Login FIRST so that we have the necessary Firestore permissions
            const retryResult = await signInWithEmailAndPassword(auth, email, pass);
            
            // Only update the doc if it doesn't exist, else we overwrite suspension states. 
            // the 'seeder' could have made it already, so we just set with merge
            const userRef = doc(db, "users", newUid);
            const newProfile = {
              id: newUid,
              name: mockUser.name,
              email: email,
              role: mockUser.role,
              isActive: true,
              isApproved: true,
              isSuspended: false, // Default states, but we let setDoc overwrite them if first time
              ...(mockUser.group && { group: mockUser.group }),
              ...(mockUser.approverCode && { approverCode: mockUser.approverCode }),
            };
            
            // Using setDoc without merge so that it perfectly matches the mock state
            // since this is basically a re-seed of that specific user.
            await setDoc(userRef, newProfile);
            
            if (retryResult.user) {
              addSystemLog("USER_LOGIN", `Mock user auto-provisioned and logged in: ${retryResult.user.email}`, { authProvider: "password", email: retryResult.user.email });
            }
            return;
          } catch (regError: any) {
            if (secondaryApp) await deleteApp(secondaryApp);
            if (regError.code === 'auth/email-already-in-use') {
              console.error("User exists but password was incorrect.");
              throw new Error("Invalid password for this mock account. Please use 'password123'");
            }
            console.error("Auto-provisioning failed", regError);
            throw regError;
          }
        }
      }
      console.error("Email login failed", error);
      throw error;
    }
  };

  const addChurchGroup = useCallback(async (name: string, description?: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
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
      await setDoc(doc(db, "church_groups", id), newGroup);
      await addSystemLog("GROUP_CREATED", `Church group '${name}' created by admin`, { groupId: id, name });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `church_groups/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const deleteChurchGroup = useCallback(async (id: string) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new Error("Unauthorized: Only Admins can manage church groups.");
    }
    try {
      await deleteDoc(doc(db, "church_groups", id));
      await addSystemLog("GROUP_DELETED", `Church group ID '${id}' deleted by admin`, { groupId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `church_groups/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const signupWithEmail = async (email: string, pass: string, name: string) => {
    try {
      // Duplicate Detection
      const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
      if (existingUser) {
        throw new Error("A user with this email already exists. Please login instead.");
      }

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      await updateProfile(userCredential.user, { displayName: name });
      
      const userRef = doc(db, "users", userCredential.user.uid);
      const newProfile: UserProfile = {
        id: userCredential.user.uid,
        name: name,
        email: email,
        role: UserRole.CHURCH_GROUP,
        isActive: true,
        isApproved: false,
        isSuspended: false,
      };
      await setDoc(userRef, newProfile);
      setCurrentUser(newProfile);
      await addSystemLog("USER_PENDING_APPROVAL", `🚨 ACTION REQUIRED: New user self-registered via Email and is PENDING APPROVAL: ${email}`, { email });
    } catch (error) {
      console.error("Signup failed", error);
      throw error;
    }
  };

  const logout = async () => {
    const userEmail = auth.currentUser?.email;
    await signOut(auth);
    if (userEmail) {
      await addSystemLog("USER_LOGOUT", `User logged out: ${userEmail}`, { email: userEmail });
    }
  };

  const approveUser = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "users", id), { isApproved: true });
      await addSystemLog("USER_APPROVAL", `Admin approved/activated user ID: ${id}`, { userId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, []);

  const suspendUser = useCallback(async (id: string, isSuspended: boolean) => {
    try {
      await updateDoc(doc(db, "users", id), { isSuspended });
      await addSystemLog("USER_SUSPENSION", `Admin changed suspension for user ID: ${id} to ${isSuspended}`, { userId: id, isSuspended });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, []);

  const updateUserRole = useCallback(async (id: string, role: UserRole) => {
    try {
      await updateDoc(doc(db, "users", id), { role });
      
      const isElevated = [UserRole.ADMIN, UserRole.FINANCE, UserRole.APPROVER_L1, UserRole.APPROVER_L2].includes(role);
      const actionTitle = isElevated ? "ELEVATED_ROLE_GRANTED" : "USER_ROLE_UPDATE";
      const detailsText = isElevated 
        ? `🚨 SECURITY NOTICE: Admin granted ELEVATED rights (${role}) to user ID: ${id}`
        : `Admin changed role of user ID: ${id} to ${role}`;
        
      // Ensure we await this so Slack fires properly before component unmount or next step
      await addSystemLog(actionTitle, detailsText, { userId: id, newRole: role, elevated: isElevated });
      
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, []);

  const updateUserProfile = useCallback(async (id: string, updates: Partial<UserProfile>) => {
    try {
      await updateDoc(doc(db, "users", id), updates);
      await addSystemLog("USER_PROFILE_UPDATE", `Profile updated for user ID: ${id}`, { userId: id, updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${id}`);
    }
  }, [addSystemLog]);

  const adminRegisterUser = useCallback(async (
    email: string,
    pass: string,
    name: string,
    role: UserRole,
    group?: string,
    approverCode?: string
  ) => {
    if (!currentUser || currentUser.role !== UserRole.ADMIN) {
      throw new Error("Unauthorized: Only Admins can register new users.");
    }

    // Duplicate Detection
    const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existingUser) {
      throw new Error(`User with email ${email} already exists.`);
    }

    const secondaryAppName = `AdminRegApp-${Math.random().toString(36).substring(2, 9)}`;
    let secondaryApp = null;
    try {
      secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
      const secondaryAuth = getAuth(secondaryApp);
      
      // Create user credentials in the secondary app securely without logging out the primary session
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
      const newUid = userCredential.user.uid;
      
      // Update display name on Auth profile
      await updateProfile(userCredential.user, { displayName: name });
      
      // Build profile document
      const newProfile: UserProfile = {
        id: newUid,
        name,
        email,
        role,
        isActive: true,
        isApproved: true,
        isSuspended: false,
      };

      if (group) {
        newProfile.group = group;
      }
      if (approverCode) {
        newProfile.approverCode = approverCode;
      }

      // Store in users collection via the primary database connection
      await setDoc(doc(db, "users", newUid), newProfile);
      
      await addSystemLog("USER_REGISTRATION", `Admin registered user: ${email} as ${role}`, {
        userId: newUid,
        email,
        role,
        group
      });

      // Explicitly sign out of the secondary auth
      await signOut(secondaryAuth);
    } catch (error) {
      console.error("Admin user registration failed:", error);
      throw error;
    } finally {
      if (secondaryApp) {
        try {
          await deleteApp(secondaryApp);
        } catch (e) {
          console.error("Failed to delete secondary app", e);
        }
      }
    }
  }, [currentUser]);

  const addRequisition = useCallback(async (reqData: any) => {
    const id = `req-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000); // 72 hours from now

    const newReq: Requisition = {
      ...reqData,
      id,
      status: RequisitionStatus.SUBMITTED,
      submittedAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      escalationLevel: 0,
      approvalHistory: [],
    };
    try {
      await setDoc(doc(db, "requisitions", id), newReq);
      await addSystemLog("REQUISITION_CREATED", `Requisition '${newReq.title}' created (amount KES ${newReq.amount.toLocaleString()})`, {
        requisitionId: id,
        title: newReq.title,
        amount: newReq.amount,
        group: newReq.groupName
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `requisitions/${id}`);
    }
  }, [addSystemLog]);

  const updateRequisitionStatus = useCallback(async (
    id: string, 
    status: RequisitionStatus, 
    decision: "APPROVE" | "REJECT" | "ESCALATE",
    note: string = "", 
    method: any = "CODE",
    rejectionReason?: string,
    approvalCode?: string
  ) => {
    const historyAction: ApprovalNote = {
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
    };

    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const req = reqSnap.data() as Requisition;

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

      await updateDoc(reqRef, updates);
      await addSystemLog("STATUS_CHANGE", `Requisition '${req.title}' decision: ${decision} -> New Status: ${status}`, {
        requisitionId: id,
        title: req.title,
        previousStatus: req.status,
        newStatus: status,
        decision,
        note
      });

      // If fully approved or disbursed, update project spent amount (only once)
      if (status === RequisitionStatus.APPROVED_L2 || (req.status !== RequisitionStatus.APPROVED_L2 && status === RequisitionStatus.DISBURSED)) {
         if (req.projectId) {
           const projectRef = doc(db, "projects", req.projectId);
           const projectSnap = await getDoc(projectRef);
           if (projectSnap.exists()) {
             await updateDoc(projectRef, { 
               spentAmount: projectSnap.data().spentAmount + req.amount 
             });
           }
         }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [currentUser, addSystemLog]);

  const enrollBiometric = useCallback(() => {
    setBiometricEnrolled(true);
  }, []);

  const deleteRequisition = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, "requisitions", id));
      await addSystemLog("REQUISITION_DELETED", `Requisition ID '${id}' deleted`, { requisitionId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `requisitions/${id}`);
    }
  }, [addSystemLog]);

  const updateRequisition = useCallback(async (id: string, updates: Partial<Requisition>) => {
    try {
      const reqRef = doc(db, "requisitions", id);
      const cleanedUpdates = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(reqRef, cleanedUpdates);
      await addSystemLog("REQUISITION_EDITED", `Requisition '${id}' updated by Administrator`, { requisitionId: id, updates });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [addSystemLog]);

  const uploadReceipts = useCallback(async (id: string, newReceipts: string[]) => {
    try {
      const reqRef = doc(db, "requisitions", id);
      const reqSnap = await getDoc(reqRef);
      if (!reqSnap.exists()) return;
      const data = reqSnap.data() as Requisition;
      const currentReceipts = data.receipts || [];
      const updatedReceipts = [...currentReceipts, ...newReceipts];
      
      await updateDoc(reqRef, {
        receipts: updatedReceipts,
        updatedAt: new Date().toISOString()
      });
      await addSystemLog("RECEIPTS_UPLOADED", `Uploaded ${newReceipts.length} receipts to Requisition ID: ${id}`, { requisitionId: id, currentReceiptCount: updatedReceipts.length });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `requisitions/${id}`);
    }
  }, [addSystemLog]);

  const markAlertAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "alerts", id), { isRead: true });
      await addSystemLog("ALERT_READ", `Alert ID '${id}' marked as read`, { alertId: id });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `alerts/${id}`);
    }
  }, [addSystemLog]);

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

  return (
    <RequisitionContext.Provider value={{
      requisitions,
      projects,
      alerts,
      thresholds,
      forecastData,
      currentUser,
      users,
      loading,
      churchGroups,
      addChurchGroup,
      deleteChurchGroup,
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
      adminRegisterUser,
      systemLogs,
      addSystemLog,
      seedAllEcosystemData,
      reports,
      saveReport,
      globalSearchTerm,
      setGlobalSearchTerm,
      activeToasts,
      removeToast,
      readNoticeIds,
      toggleNoticeRead
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
