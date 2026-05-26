/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { RequisitionProvider, useRequisitions } from "./contexts/RequisitionContext";
import { cn } from "./lib/utils";
import { Sidebar } from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import { RequisitionsPanel, RequisitionDetailModal } from "./components/RequisitionsPanel";
import { NotificationHub } from "./components/NotificationHub";
import { ReceiptTemplateGenerator } from "./components/ReceiptTemplateGenerator";
import { ApprovalsPanel } from "./components/ApprovalsPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { UsersPanel } from "./components/UsersPanel";
import { WaitingRoom } from "./components/WaitingRoom";
import { ReportsPanel } from "./components/ReportsPanel";
import { FinanceLedgerPanel } from "./components/FinanceLedgerPanel";
import { UserRole } from "./types";
import { 
  Bell, 
  ArrowRight,
  LogOut,
  AlertCircle,
  Search,
  X,
  ShieldCheck,
  Lock,
  Clock,
  Trash2,
  Settings,
  UserCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

function AppContent() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [authMode, setAuthMode] = useState<"SELECT" | "EMAIL_LOGIN" | "EMAIL_SIGNUP">("SELECT");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showReportReminder, setShowReportReminder] = useState(true);
  const [reportState, setReportState] = useState<"IDLE" | "GENERATING" | "SUCCESS">("IDLE");
  const [selectedReqForNoticeDetail, setSelectedReqForNoticeDetail] = useState<any | null>(null);
  const [isGeneratingReceiptFromHub, setIsGeneratingReceiptFromHub] = useState<any | null>(null);
  
  const { 
    currentUser, 
    login, 
    loginWithEmail, 
    signupWithEmail, 
    logout, 
    loading,
    users,
    requisitions,
    approveUser,
    deleteRequisition,
    globalSearchTerm,
    setGlobalSearchTerm,
    activeToasts,
    removeToast,
    readNoticeIds,
    toggleNoticeRead
  } = useRequisitions();

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("recent_searches");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setRecentSearches(parsed.slice(0, 5));
          }
        } catch (e) {
          console.error("Failed to parse recent searches", e);
        }
      }
    }
  }, []);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsSearchFocused(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const saveRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    
    setRecentSearches(prev => {
      const filtered = prev.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
      const updated = [trimmed, ...filtered].slice(0, 5);
      if (typeof window !== "undefined") {
        localStorage.setItem("recent_searches", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const removeRecentSearch = (termToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const updated = prev.filter(s => s !== termToRemove);
      if (typeof window !== "undefined") {
        localStorage.setItem("recent_searches", JSON.stringify(updated));
      }
      return updated;
    });
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem("recent_searches");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (authMode === "EMAIL_SIGNUP" && (password.length < 8 || password.length > 15)) {
      setError("Password must be between 8 and 15 characters long.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (authMode === "EMAIL_LOGIN") {
        await loginWithEmail(email, password);
      } else {
        await signupWithEmail(email, password, name);
      }
    } catch (err: any) {
      let message = "Authentication failed";
      if (err.code === 'auth/invalid-credential') {
        message = "Incorrect email or password. Please verify your credentials or sign up if you don't have an account.";
      } else if (err.code === 'auth/user-not-found') {
        message = "No account found with this email. Please sign up.";
      } else if (err.code === 'auth/wrong-password') {
        message = "Incorrect password. Please try again.";
      } else if (err.code === 'auth/email-already-in-use') {
        message = "This email is already registered. Please login instead.";
      } else if (err.code === 'auth/weak-password') {
        message = "Password is too weak. Use at least 8 characters.";
      }
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Synchronizing Transactions...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient background effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_50%,#1e293b_0%,transparent_50%)] opacity-30" />
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px]" />

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-[2.5rem] shadow-2xl p-12 space-y-10 relative z-10"
        >
          <div className="text-center space-y-6">
            <div className="relative inline-block">
              <motion.div 
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="w-24 h-24 bg-primary rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-primary/20 ring-4 ring-primary/10"
              >
                <ShieldCheck size={48} className="text-white" />
              </motion.div>
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">St Andrews</h1>
              <p className="text-primary text-[11px] font-black uppercase tracking-[0.3em]">Requisition Control Transaction</p>
            </div>
          </div>
          
          {authMode === "SELECT" ? (
            <div className="space-y-4">
              <button 
                onClick={login}
                className="w-full flex items-center justify-center gap-3 py-4 bg-white hover:bg-slate-50 text-slate-950 rounded-2xl transition-all font-black text-sm shadow-xl active:scale-95 group"
              >
                <svg className="w-5 h-5 transition-transform group-hover:scale-110" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center gap-4 py-4">
                <div className="h-[1px] bg-slate-800 flex-1"></div>
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">or initialize credentials</span>
                <div className="h-[1px] bg-slate-800 flex-1"></div>
              </div>

              <button 
                onClick={() => setAuthMode("EMAIL_LOGIN")}
                className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl transition-all font-black text-sm border border-slate-700 active:scale-95"
              >
                Access with Credentials
              </button>
              
              <button 
                onClick={() => setAuthMode("EMAIL_SIGNUP")}
                className="w-full py-2 text-primary hover:text-primary/80 font-black text-[10px] uppercase tracking-widest transition-colors"
              >
                Request Authorization Hub Access
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-6">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-[10px] font-black uppercase tracking-widest text-center"
                >
                  {error}
                </motion.div>
              )}
              
              {authMode === "EMAIL_SIGNUP" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">FULL_LEGAL_NAME</label>
                  <input 
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700"
                    placeholder="Enter legal name"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">IDENTITY_EMAIL</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700"
                  placeholder="name@church.com"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                  {authMode === "EMAIL_SIGNUP" ? "SECURE_CREDENTIAL (8-15 chars)" : "AUTH_SECURITY_CODE"}
                </label>
                <input 
                  type="password"
                  required
                  maxLength={15}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white text-sm font-bold focus:border-primary/50 outline-none transition-all placeholder:text-slate-700 font-mono"
                  placeholder={authMode === "EMAIL_SIGNUP" ? "8 to 15 characters" : "••••••••"}
                />
              </div>

              <button 
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white rounded-2xl transition-all font-black text-sm shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? "Processing..." : authMode === "EMAIL_LOGIN" ? "Authorize Session" : "Request Activation"}
              </button>

              <button 
                type="button"
                onClick={() => setAuthMode("SELECT")}
                className="w-full py-2 text-slate-500 hover:text-slate-400 font-black text-[10px] uppercase tracking-widest transition-colors"
               >
                ← Back to Control Transaction
              </button>
            </form>
          )}

          <div className="pt-6 border-t border-slate-800 flex justify-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Core_Active</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={10} className="text-slate-600" />
              <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">SSL_Encrypted</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Waiting Room or Suspension Logic
  if (!currentUser.isApproved || currentUser.isSuspended) {
    return <WaitingRoom user={currentUser} onLogout={logout} />;
  }


  // Report compilation state

  // Compiler notifications listing
  const notificationItems: Array<{
    id: string;
    type: string;
    title: string;
    message: string;
    actionLabel: string;
    action: () => void | Promise<void>;
    requisition?: any;
  }> = [];

  // 1. Members awaiting approval (only for ADMIN)
  if (currentUser?.role === UserRole.ADMIN) {
    users.filter(u => !u.isApproved).forEach(u => {
      notificationItems.push({
        id: `user-await-${u.id}`,
        type: "MEMBER_APPROVAL",
        title: "Member Pending Approval",
        message: `${u.name} (${u.email}) is awaiting account activation.`,
        actionLabel: "Authorize User",
        action: async () => {
          await approveUser(u.id);
        }
      });
    });

    // 2. New requisitions received (status === SUBMITTED)
    requisitions.filter(r => r.status === "SUBMITTED").forEach(r => {
      notificationItems.push({
        id: `req-sub-${r.id}`,
        type: "REQ_RECEIVED",
        title: "New Requisition Received",
        message: `"${r.title}" (${r.groupName}) for KES ${r.amount.toLocaleString()} is pending decision.`,
        actionLabel: "Review Requisitions",
        requisition: r,
        action: () => {
          setCurrentView("approvals");
          setIsNotificationsOpen(false);
        }
      });
    });
  }

  // 3. New approvals done
  requisitions.filter(r => r.status === "APPROVED_L1" || r.status === "APPROVED_L2").forEach(r => {
    notificationItems.push({
      id: `req-app-${r.id}`,
      type: "REQ_APPROVED",
      title: "Requisition Approved",
      message: `"${r.title}" has been authorized to ${r.status.replace("_", " ")} for KES ${r.amount.toLocaleString()}.`,
      actionLabel: "View Ledger",
      requisition: r,
      action: () => {
        setCurrentView("requisitions");
        setIsNotificationsOpen(false);
      }
    });
  });

  // 3.5. Disbursements needed (specifically for FINANCE and ADMIN roles)
  if (currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.ADMIN) {
    requisitions.filter(r => r.status === "APPROVED_L2").forEach(r => {
      notificationItems.push({
        id: `finance-disb-req-${r.id}`,
        type: "FINANCE_DISBURSEMENT_REQUIRED",
        title: "Disbursement Action Required",
        message: `Requisition "${r.title}" (${r.groupName}) is L2 APPROVED and ready for immediate payout of KES ${r.amount.toLocaleString()}.`,
        actionLabel: "Disburse Ledger",
        requisition: r,
        action: () => {
          setCurrentView("finance");
          setIsNotificationsOpen(false);
        }
      });
    });
  }

  // 4. Report generation reminder
  if (showReportReminder) {
    notificationItems.push({
      id: "report-reminder",
      type: "REPORT_REMINDER",
      title: "Consolidated Reports Pending",
      message: "Reconcile actual payouts vs project allocations and compile audited ledger report.",
      actionLabel: reportState === "SUCCESS" ? "Report Downloaded ✓" : reportState === "GENERATING" ? "Compiling..." : "Compile PDF Report",
      action: () => {
         setReportState("GENERATING");
         setTimeout(() => {
           setReportState("SUCCESS");
           setTimeout(() => {
             setShowReportReminder(false);
             setReportState("IDLE");
           }, 2000);
         }, 1500);
      }
    });
  }

  const renderView = () => {
    switch (currentView) {
      case "dashboard": return <Dashboard />;
      case "notifications": return <NotificationHub onSelectRequisition={(req) => setSelectedReqForNoticeDetail(req)} />;
      case "requisitions": return <RequisitionsPanel />;
      case "approvals": return <ApprovalsPanel />;
      case "settings": return <SettingsPanel />;
      case "users": return <UsersPanel />;
      case "reports": return <ReportsPanel />;
      case "finance": return <FinanceLedgerPanel />;
      default: return <Dashboard />;
    }
  };

  const unreadNotificationsCount = notificationItems.filter(item => !readNoticeIds.includes(item.id)).length;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      <Sidebar currentView={currentView} onViewChange={setCurrentView} notificationsCount={unreadNotificationsCount} />
      
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8 shrink-0 select-none">
          <div>
            <h1 className="text-xs md:text-lg font-bold text-slate-900 leading-tight truncate max-w-[150px] md:max-w-none">
              {currentView.charAt(0).toUpperCase() + currentView.slice(1)}: {currentUser.group}
            </h1>
            <p className="text-[10px] text-slate-500 hidden sm:block">System synchronized • {new Date().toLocaleTimeString()}</p>
          </div>

          <div className="flex-1 max-w-md mx-8 hidden md:block" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              <input 
                type="text" 
                placeholder="Search requisitions by title or group..." 
                className="w-full pl-10 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                value={globalSearchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setGlobalSearchTerm(val);
                  if (val.trim() !== "") {
                    setCurrentView("requisitions");
                  }
                }}
                onFocus={() => setIsSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    saveRecentSearch(globalSearchTerm);
                    setIsSearchFocused(false);
                    setCurrentView("requisitions");
                    (e.target as HTMLInputElement).blur();
                  }
                }}
              />
              {globalSearchTerm && (
                <button 
                  onClick={() => setGlobalSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X size={14} />
                </button>
              )}

              <AnimatePresence>
                {isSearchFocused && recentSearches.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="absolute left-0 right-0 top-full mt-2 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50 p-2"
                  >
                    <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-100 mb-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Recent Searches</span>
                      <button 
                        onClick={clearAllRecentSearches}
                        className="text-[9px] font-bold text-rose-500 hover:text-rose-700 uppercase tracking-wider flex items-center gap-1 cursor-pointer bg-transparent border-none"
                      >
                        <Trash2 size={10} />
                        Clear All
                      </button>
                    </div>
                    <div className="space-y-0.5">
                      {recentSearches.map((term, idx) => (
                        <div
                          key={`${term}-${idx}`}
                          onClick={() => {
                            setGlobalSearchTerm(term);
                            saveRecentSearch(term);
                            setIsSearchFocused(false);
                            setCurrentView("requisitions");
                          }}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-slate-50 rounded-lg text-xs text-slate-700 cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-2">
                            <Clock size={12} className="text-slate-400 group-hover:text-indigo-500" />
                            <span className="font-medium">{term}</span>
                          </div>
                          <button
                            onClick={(e) => removeRecentSearch(term, e)}
                            className="text-slate-400 hover:text-rose-500 hover:bg-slate-100 rounded p-1 transition-all cursor-pointer bg-transparent border-none"
                            title="Remove search from history"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-1.5 border-r border-slate-100 pr-4 mr-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Operational</span>
            </div>
            
            <div className="relative" ref={notificationsRef}>
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                <Bell size={16} />
                {notificationItems.length > 0 && (
                  <div className="absolute top-1 right-1 bg-rose-500 text-white font-black text-[7px] w-3.5 h-3.5 rounded-full flex items-center justify-center border-2 border-white transform translate-x-1 -translate-y-1">
                    {notificationItems.length}
                  </div>
                )}
              </button>

              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-50 text-left"
                  >
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-widest">Active Alerts ({notificationItems.length})</span>
                      {notificationItems.length > 0 && (
                        <button 
                          onClick={() => {
                            setShowReportReminder(false);
                            setIsNotificationsOpen(false);
                          }}
                          className="text-[9px] font-bold text-indigo-600 uppercase tracking-tight hover:underline cursor-pointer"
                        >
                          Clear All
                        </button>
                      )}
                    </div>

                    <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 scrollbar-hide">
                      {notificationItems.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 space-y-2 px-4">
                          <Bell size={24} className="mx-auto opacity-20" />
                          <p className="text-[10px] font-bold uppercase tracking-widest">ledger cleared</p>
                          <p className="text-[10px] text-slate-400 leading-relaxed">All member feeds and approvals are synchronized.</p>
                        </div>
                      ) : (() => {
                        const unread = notificationItems.filter(item => !readNoticeIds.includes(item.id));
                        const read = notificationItems.filter(item => readNoticeIds.includes(item.id));

                        return (
                          <>
                            {unread.map(item => (
                              <div 
                                key={item.id} 
                                onClick={() => {
                                  if (item.requisition) {
                                    setSelectedReqForNoticeDetail(item.requisition);
                                    setIsNotificationsOpen(false);
                                  }
                                  toggleNoticeRead(item.id, true);
                                }}
                                className={cn(
                                  "p-3 md:p-3.5 hover:bg-slate-50 transition-all space-y-1.5 md:space-y-2 text-[10px] md:text-xs select-none",
                                  "border-l-2 border-indigo-500 bg-white"
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <span className={cn(
                                    "font-bold text-[8px] md:text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded",
                                    item.type === "MEMBER_APPROVAL" ? "bg-amber-100 text-amber-700" :
                                    item.type === "REQ_RECEIVED" ? "bg-indigo-100 text-indigo-700" :
                                    item.type === "REQ_APPROVED" ? "bg-emerald-100 text-emerald-700" :
                                    "bg-rose-100 text-rose-700"
                                  )}>
                                    {item.title}
                                  </span>
                                  <span className="text-[8px] font-black text-indigo-600 bg-indigo-50 px-1 py-0.5 rounded">
                                    NEW
                                  </span>
                                </div>
                                <p className="text-slate-600 leading-snug font-medium text-[10px] md:text-[11px]">{item.message}</p>
                                <button 
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await item.action();
                                    toggleNoticeRead(item.id, true);
                                  }}
                                  className="w-full mt-1 py-1.5 text-center bg-slate-100 hover:bg-indigo-600 hover:text-white rounded text-[8px] md:text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                                >
                                  {item.actionLabel}
                                </button>
                              </div>
                            ))}

                            {unread.length > 0 && read.length > 0 && (
                              <div className="px-4 py-2 bg-slate-50 text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span>History</span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                              </div>
                            )}

                            {read.map(item => (
                              <div 
                                key={item.id} 
                                onClick={() => {
                                  if (item.requisition) {
                                    setSelectedReqForNoticeDetail(item.requisition);
                                    setIsNotificationsOpen(false);
                                  }
                                }}
                                className={cn(
                                  "p-3 md:p-3.5 hover:bg-slate-50 transition-all space-y-1.5 md:space-y-2 text-[10px] md:text-xs select-none opacity-60 grayscale-[40%]",
                                  item.requisition ? "cursor-pointer" : ""
                                )}
                              >
                                <div className="flex items-start justify-between">
                                  <span className="font-bold text-[8px] md:text-[9px] uppercase tracking-wider text-slate-400">
                                    {item.title}
                                  </span>
                                </div>
                                <p className="text-slate-500 leading-snug font-medium text-[10px] md:text-[11px]">{item.message}</p>
                                <div className="flex gap-2">
                                  <button 
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      await item.action();
                                    }}
                                    className="flex-1 mt-1 py-1 text-center bg-slate-50 text-slate-400 rounded text-[8px] font-bold uppercase tracking-widest transition-all"
                                  >
                                    RE-ACTION
                                  </button>
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleNoticeRead(item.id, false);
                                    }}
                                    className="px-2 mt-1 py-1 text-center bg-slate-50 text-slate-300 hover:text-slate-500 rounded text-[8px] font-bold uppercase tracking-widest transition-all"
                                  >
                                    RESTORE
                                  </button>
                                </div>
                              </div>
                            ))}
                          </>
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="relative h-10 flex items-center" ref={profileRef}>
              <button 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className="flex items-center gap-2 pr-1 py-1 hover:bg-slate-50 rounded-full transition-all cursor-pointer group border border-transparent hover:border-slate-100"
              >
                <div className="flex flex-col items-end hidden sm:flex">
                  <span className="text-[10px] font-black text-slate-900 uppercase tracking-tight">{currentUser.name.split(' ')[0]}</span>
                  <span className="text-[8px] text-primary font-bold uppercase tracking-widest leading-none">{currentUser.role.split('_')[0]}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-[10px] shadow-sm group-hover:scale-105 transition-transform">
                  {currentUser.name.charAt(0)}
                </div>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-[60]"
                  >
                    <div className="p-3 border-b border-slate-50">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated Transaction</p>
                      <p className="text-xs font-bold text-slate-900 truncate">{currentUser.email}</p>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={() => {
                          setCurrentView("settings");
                          setIsProfileOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors text-left"
                      >
                        <Settings size={14} className="text-slate-400" />
                        SYSTEM
                      </button>
                      <div className="h-[1px] bg-slate-50 my-1" />
                      <button
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition-colors text-left"
                      >
                        <LogOut size={14} />
                        EXIT SESSION
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-3 md:p-6 pb-24 md:pb-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
               {renderView()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Context Bar */}
        <footer className="h-10 bg-white border-t border-slate-100 px-6 hidden md:flex items-center justify-between text-[10px] font-medium text-slate-500 shrink-0">
          <div className="flex gap-4">
            <span className="flex items-center gap-1 uppercase tracking-tighter"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> STABILITY: 100%</span>
            <span className="flex items-center gap-1 uppercase tracking-tighter font-mono italic"><span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> ID: #{currentUser.id.toUpperCase()}</span>
          </div>
          <div className="flex gap-4">
            <span className="opacity-40">v3.0.2-ENTERPRISE</span>
            <span className="text-indigo-600 cursor-pointer hover:underline font-bold uppercase tracking-tighter">System Health Log →</span>
          </div>
        </footer>
      </main>

      {/* Real-time Toast Notifications */}
      <div className="fixed bottom-12 right-6 z-[100] flex flex-col gap-3 w-80 pointer-events-none">
        <AnimatePresence>
          {activeToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="pointer-events-auto"
            >
              <div className="bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
                <div className={cn(
                  "h-1.5 w-full",
                  toast.severity === "HIGH" ? "bg-rose-500" : "bg-amber-500"
                )} />
                <div className="p-4 flex gap-3">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    toast.severity === "HIGH" ? "bg-rose-50 text-rose-600" : "bg-amber-50 text-amber-600"
                  )}>
                    <AlertCircle size={18} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Budget Integrity Alert</span>
                      <button 
                        onClick={() => removeToast(toast.id)}
                        className="text-slate-400 hover:text-slate-900 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-800 leading-snug mt-1">{toast.message}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-[9px] font-mono text-slate-400 italic">SEC_CHAMBER_NOTIFY</span>
                      <button 
                        onClick={() => {
                          setCurrentView("dashboard");
                          removeToast(toast.id);
                        }}
                        className="text-[9px] font-black text-indigo-600 uppercase tracking-widest hover:underline"
                      >
                        Investigate →
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {selectedReqForNoticeDetail && (
        <RequisitionDetailModal 
          req={selectedReqForNoticeDetail}
          onClose={() => setSelectedReqForNoticeDetail(null)}
          onDelete={async () => {
            if (selectedReqForNoticeDetail) {
              await deleteRequisition(selectedReqForNoticeDetail.id);
              setSelectedReqForNoticeDetail(null);
            }
          }}
          onGenerateReceipt={() => setIsGeneratingReceiptFromHub(selectedReqForNoticeDetail)}
        />
      )}

      {isGeneratingReceiptFromHub && (
        <ReceiptTemplateGenerator 
          req={isGeneratingReceiptFromHub}
          onClose={() => setIsGeneratingReceiptFromHub(null)}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <RequisitionProvider>
      <AppContent />
    </RequisitionProvider>
  );
}
