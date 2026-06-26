/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Bell, 
  Shield, 
  User, 
  Database, 
  Mail, 
  Smartphone,
  Fingerprint,
  Save,
  History,
  Activity,
  Cpu,
  Lock,
  Wifi,
  Settings2,
  ShieldCheck,
  Server,
  Zap,
  ArrowRight,
  UserCheck,
  Moon,
  Sun,
  Palette,
  Gauge,
  Clock,
  ChevronDown,
  Coins,
  BookOpen,
  Plus,
  Wand2,
  RefreshCw,
  Trash2,
  Power,
  LogOut
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { cn, sendSlackNotification } from "../lib/utils";
import { UserRole } from "../types";
import { motion } from "motion/react";
import { SystemHealth } from "./SystemHealth";
import { databaseService } from "../lib/databaseService";
import { isSupabaseEnabled, getSupabaseClient } from "../lib/supabase";

export const SettingsPanel: React.FC = () => {
  const { 
    thresholds, 
    updateThreshold, 
    currentUser, 
    updateUserProfile, 
    updateCurrentUserPassword,
    biometricEnrolled, 
    enrollBiometric, 
    systemLogs, 
    seedAllEcosystemData, 
    systemSettings, 
    updateSystemSettings,
    allocateBudgetForGroup,
    projects,
    churchGroups,
    triggerToast,
    requisitions,
    users,
    logout,
  } = useRequisitions();

  const [isBackingUp, setIsBackingUp] = React.useState(false);
  const [backupResult, setBackupResult] = React.useState<any | null>(null);

  const [useSupabase, setUseSupabase] = React.useState(isSupabaseEnabled());

  const [testingConnection, setTestingConnection] = React.useState(false);
  const [connectionTestResult, setConnectionTestResult] = React.useState<{
    status: "success" | "partial_success" | "failed" | "not_configured" | null;
    message: string;
    details?: string;
    urlUsed?: string;
    latency?: number;
  }>({ status: null, message: "" });
  const [supabaseUrlInfo, setSupabaseUrlInfo] = React.useState<string>("");
  const [localActiveDevices, setLocalActiveDevices] = React.useState<any[]>([]);

  // Special Characters URL Encoder States and Handlers
  const [encodePassword, setEncodePassword] = React.useState("");
  const [rawConnectionUrl, setRawConnectionUrl] = React.useState("");
  const [encodedConnectionUrl, setEncodedConnectionUrl] = React.useState("");
  const [encodedPasswordOnly, setEncodedPasswordOnly] = React.useState("");

  const handleEncodePasswordOnly = (pass: string) => {
    setEncodePassword(pass);
    if (!pass) {
      setEncodedPasswordOnly("");
      return;
    }
    setEncodedPasswordOnly(encodeURIComponent(pass));
  };

  const handleEncodeConnectionString = (url: string) => {
    setRawConnectionUrl(url);
    if (!url) {
      setEncodedConnectionUrl("");
      return;
    }
    
    try {
      const schemeIndex = url.indexOf("://");
      if (schemeIndex === -1) {
        setEncodedConnectionUrl("Invalid URL pattern (missing scheme divider '://')");
        return;
      }
      
      const scheme = url.substring(0, schemeIndex + 3);
      const remaining = url.substring(schemeIndex + 3);
      
      const lastAtIdx = remaining.lastIndexOf("@");
      if (lastAtIdx === -1) {
        setEncodedConnectionUrl("Invalid URL pattern (missing '@' separator)");
        return;
      }
      
      const creds = remaining.substring(0, lastAtIdx);
      const hostPart = remaining.substring(lastAtIdx + 1);
      
      const firstColIdx = creds.indexOf(":");
      if (firstColIdx === -1) {
        setEncodedConnectionUrl("Invalid URL pattern (missing username-password divider ':')");
        return;
      }
      
      const username = creds.substring(0, firstColIdx);
      const password = creds.substring(firstColIdx + 1);
      
      const encodedPass = encodeURIComponent(password);
      setEncodedConnectionUrl(`${scheme}${username}:${encodedPass}@${hostPart}`);
    } catch (e: any) {
      setEncodedConnectionUrl(`Error parsing: ${e.message || String(e)}`);
    }
  };

  const sendSupabaseToggleSlackAlert = async (isEnabled: boolean) => {
    const client = getSupabaseClient(true);
    let counts = { users: 0, projects: 0, requisitions: 0, system_logs: 0 };
    let fetchStatus = "Offline";
    
    if (client) {
      try {
        const [resU, resP, resR, resL] = await Promise.all([
          client.from("users").select("*", { count: 'exact', head: true }),
          client.from("projects").select("*", { count: 'exact', head: true }),
          client.from("requisitions").select("*", { count: 'exact', head: true }),
          client.from("system_logs").select("*", { count: 'exact', head: true }),
        ]);
        counts.users = resU?.count || 0;
        counts.projects = resP?.count || 0;
        counts.requisitions = resR?.count || 0;
        counts.system_logs = resL?.count || 0;
        fetchStatus = "Success";
      } catch (err: any) {
        fetchStatus = "Query Warning: " + (err?.message || JSON.stringify(err));
      }
    }

    const details = [
      `*Supabase Sync State Toggled:* ${isEnabled ? "🟢 ENABLED (Dual-Write Active)" : "🔴 DISABLED (Firestore Only)"}`,
      `*Audit Status Backup Summary (Current Supabase Table Counts):*`,
      `• *Registered Users:* ${counts.users} records`,
      `• *Active Projects:* ${counts.projects} records`,
      `• *Requisition Invoices:* ${counts.requisitions} records`,
      `• *System Audit Logs:* ${counts.system_logs} records`,
      `\n*Diagnostics Retrieval:* ${fetchStatus}`,
      `*Triggered By:* [${currentUser?.name || "Unknown"} - ${currentUser?.email || "No Email"}]`
    ].join("\n");

    try {
      await sendSlackNotification({
        action: "Supabase persistence toggle audit report",
        details,
        performedBy: currentUser?.email || "system@reconstitution.org",
        level: "normal",
        metadata: {
          useSupabase: isEnabled,
          counts,
          fetchStatus
        }
      });
    } catch (e) {
      console.error("[SettingsPanel] Failed to dispatch Slack report", e);
    }
  };

  React.useEffect(() => {
    if (currentUser?.activeDevices) {
      setLocalActiveDevices(currentUser.activeDevices);
    } else {
      setLocalActiveDevices([]);
    }
  }, [currentUser?.activeDevices]);

  React.useEffect(() => {
    const loadUrl = async () => {
      try {
        const res = await fetch("/api/config/supabase");
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            setSupabaseUrlInfo(data.url);
          }
        }
      } catch (err) {
        console.info("Could not fetch Supabase URL configuration:", err);
      }
    };
    loadUrl();
  }, []);

  const runFullBackup = async () => {
    setIsBackingUp(true);
    setBackupResult(null);
    try {
      const response = await fetch("/api/backup-all-to-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requisitions, users })
      });
      const data = await response.json();
      setBackupResult(data);
      if (response.ok && data.success) {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "MEDIUM",
          message: `Successfully completed backup of ${requisitions.length} requisitions and ${users.length} users to Google Sheets.`,
          timestamp: new Date().toISOString()
        });
      } else {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "HIGH",
          message: data.error || "Failed to complete data backup to Sheets.",
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      setBackupResult({
        success: false,
        message: err.message || "Failed to contact Google Workspace sync endpoint."
      });
    } finally {
      setIsBackingUp(false);
    }
  };

  // Slack Notification States and Live Dispatchers (Prompt 6)
  const [slackActionLoading, setSlackActionLoading] = React.useState<{ [key: string]: boolean }>({});
  const [slackActionResult, setSlackActionResult] = React.useState<any | null>(null);

  const executeSlackTrigger = async (type: string, payload: any) => {
    setSlackActionLoading(prev => ({ ...prev, [type]: true }));
    setSlackActionResult(null);
    try {
      let endpoint = "/api/slack/morning-briefing";
      if (type === "eod") endpoint = "/api/slack/eod-snapshot";
      else if (type === "leaderboard") endpoint = "/api/slack/weekly-leaderboard";
      else if (type === "stale") endpoint = "/api/slack/alert-stale-requisitions";
      else if (type === "anomalies") endpoint = "/api/slack/alert-behavioral-anomalies";
      else if (type === "latency") endpoint = "/api/slack/alert-latency";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      setSlackActionResult({ type, success: response.ok, ...data });

      if (response.ok && data.success) {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "MEDIUM",
          message: `Successfully dispatched Slack action: ${type.toUpperCase()}`,
          timestamp: new Date().toISOString()
        });
      } else {
        triggerToast({
          type: "SYSTEM_INFO",
          severity: "HIGH",
          message: data.error || `Failed to dispatch Slack ${type}.`,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err: any) {
      console.error(err);
      setSlackActionResult({
        type,
        success: false,
        message: err.message || "Failed to contact Slack integration endpoint."
      });
    } finally {
      setSlackActionLoading(prev => ({ ...prev, [type]: false }));
    }
  };

  const dispatchMorningBriefing = () => {
    const pendingRequisitions = requisitions.filter(r => r.status === "SUBMITTED" || r.status === "APPROVED_L1");
    executeSlackTrigger("morning", { pendingRequisitions });
  };

  const dispatchEodSnapshot = () => {
    const todayStr = new Date().toDateString();
    const logs = systemLogs || [];
    
    const uniqueUsersToday = new Set(
      logs
        .filter((l: any) => new Date(l.timestamp).toDateString() === todayStr)
        .map((l: any) => l.performedBy)
    );
    const dau = uniqueUsersToday.size || 1;
    
    const totalProcessed = requisitions.filter(r => new Date(r.updatedAt || r.submittedAt).toDateString() === todayStr).length;
    
    const totalDisbursed = requisitions
      .filter(r => r.status === "DISBURSED")
      .reduce((sum, r) => sum + (r.amount || 0), 0);

    executeSlackTrigger("eod", { dau, totalProcessed, totalDisbursed });
  };

  const dispatchWeeklyLeaderboard = () => {
    const logs = systemLogs || [];
    const userStats: { [name: string]: { logins: number; interactions: number; name: string; role: string } } = {};
    
    logs.forEach((log: any) => {
      const userName = log.performedBy || "System User";
      if (!userStats[userName]) {
        const roleMatch = userName.match(/\(([^)]+)\)/);
        const extractedRole = roleMatch ? roleMatch[1] : "Member";
        const cleanName = userName.split(" (")[0];
        userStats[userName] = { logins: 0, interactions: 0, name: cleanName, role: extractedRole };
      }
      
      const actionLower = (log.action || "").toLowerCase();
      if (actionLower.includes("login") || actionLower.includes("session")) {
        userStats[userName].logins++;
      } else {
        userStats[userName].interactions++;
      }
    });

    const leaderboard = Object.values(userStats)
      .sort((a, b) => b.interactions - a.interactions || b.logins - a.logins)
      .slice(0, 5);

    executeSlackTrigger("leaderboard", { leaderboard });
  };

  const dispatchStaleScan = () => {
    const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
    const staleRequisitions = requisitions.filter(r => {
      const isPending = r.status === "SUBMITTED" || r.status === "APPROVED_L1";
      const submittedTime = new Date(r.submittedAt).getTime();
      return isPending && submittedTime < fortyEightHoursAgo;
    });

    executeSlackTrigger("stale", { staleRequisitions });
  };

  const dispatchBehavioralAnomalies = () => {
    const userHighValueSubmissionTimes: { [user: string]: number[] } = {};
    const anomaliesList: any[] = [];

    requisitions.forEach(r => {
      const user = r.requesterEmail || "Member";
      const amount = r.amount || 0;
      if (amount >= 100000) {
        if (!userHighValueSubmissionTimes[user]) userHighValueSubmissionTimes[user] = [];
        const t = new Date(r.submittedAt).getTime();
        userHighValueSubmissionTimes[user].push(t);
      }
    });

    Object.entries(userHighValueSubmissionTimes).forEach(([user, times]) => {
      times.sort((a, b) => a - b);
      for (let i = 1; i < times.length; i++) {
        const diffMs = times[i] - times[i - 1];
        if (diffMs < (24 * 60 * 60 * 1000)) {
          anomaliesList.push({
            user,
            description: `Submitted multiple high-value transactions (>= 100,000 KES) within a 24-hour window. Risk score HIGH.`,
            timestamp: new Date(times[i]).toISOString()
          });
        }
      }
    });

    executeSlackTrigger("anomalies", { anomaliesList });
  };

  const dispatchLatencyAlert = () => {
    executeSlackTrigger("latency", { endpoint: "/api/check-balance", durationMs: 1420 });
  };

  const [sliderIndex, setSliderIndex] = React.useState(1); // 0 = Aggressive, 1 = Balanced, 2 = Power Saver
  
  // Update password state
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [passwordError, setPasswordError] = React.useState("");
  const [passwordSuccess, setPasswordSuccess] = React.useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = React.useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!newPassword) {
      setPasswordError("Password cannot be empty.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updateCurrentUserPassword(newPassword);
      setPasswordSuccess("Your account password has been changed successfully.");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };
  
  // Budget allocation & closing books state
  const INTERVAL_MODES = [
    { value: 500, label: "Aggressive", duration: "500ms" },
    { value: 2500, label: "Balanced", duration: "2500ms" },
    { value: 10000, label: "Power Saver", duration: "10s" }
  ];
  const updateInterval = INTERVAL_MODES[sliderIndex].value;

  const handleTestEmail = async () => {
    alert("Email test functionality is currently disabled as the Firebase backend has been removed. Please configure an alternative notification service.");
  };

  const lastTenLogs = systemLogs.slice(0, 10);

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Settings2 size={28} className="text-primary" />
            System Configuration
          </h2>
          <p className="text-sm text-muted font-medium max-w-xl">
            Configure authorization pipelines, security thresholds, and organizational audit parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Hardware Biometric Enrollment */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            <div className="bg-slate-900 px-8 py-4 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Fingerprint size={16} className="text-primary" />
                Auth Pipeline Terminal
              </h3>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Hardware_Link_Active</span>
              </div>
            </div>
            
            <div className="p-10 flex flex-col md:flex-row items-center gap-10">
              <motion.div 
                animate={biometricEnrolled ? {} : { scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className={cn(
                  "w-32 h-32 rounded-[2.5rem] flex items-center justify-center border shadow-inner transition-all duration-700 shrink-0",
                  biometricEnrolled 
                    ? "bg-primary/5 border-primary/20 text-primary shadow-primary/5" 
                    : "bg-slate-50 border-slate-200 text-slate-300"
                )}
              >
                <Fingerprint size={64} />
              </motion.div>
              
              <div className="flex-1 text-center md:text-left space-y-4">
                <div>
                  <h4 className="text-lg font-black text-foreground uppercase tracking-tight">
                    {biometricEnrolled ? "Biometric Transaction Synchronized" : "Initialize Biometric Signature"}
                  </h4>
                  <p className="text-xs text-muted leading-relaxed font-medium mt-1">
                    Authorize expenditure requests via kernel-level fingerprint verification. This protocol bypasses manual code entry for rapid organizational turn-around.
                  </p>
                </div>
                
                {!biometricEnrolled ? (
                  <button 
                    onClick={() => enrollBiometric(true)}
                    className="btn-primary px-8 py-3 flex items-center gap-2"
                  >
                    <Cpu size={18} />
                    INITIALIZE ENROLLMENT
                  </button>
                ) : (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl flex flex-col sm:flex-row items-center gap-3 justify-between">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                      <div className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">Security Link Verified</div>
                    </div>
                    <button 
                      onClick={() => enrollBiometric(false)}
                      className="text-[9px] font-black text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 uppercase tracking-widest transition-colors"
                    >
                      DISCONNECT_TRANSACTION
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Email Notification Configuration */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-4">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Mail size={16} className="text-primary" />
                Notification Configuration
              </h3>
              <p className="text-[10px] text-muted font-medium italic">Configure the target email for automated requisition alerts.</p>
              
              <div className="flex gap-3">
                <input
                  type="email"
                  placeholder="admin@church.org"
                  className="flex-1 px-4 py-3 bg-slate-50 border border-border rounded-xl text-xs font-bold focus:border-primary/50 outline-none transition-colors"
                  value={systemSettings.notificationEmail || ""}
                  onChange={(e) => updateSystemSettings({ ...systemSettings, notificationEmail: e.target.value })}
                />
                <button
                  onClick={handleTestEmail}
                  className="px-6 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Test Config
                </button>
                <button
                  onClick={() => alert("Email notification settings saved.")}
                  className="px-6 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-colors"
                >
                  Save Email
                </button>
              </div>
            </section>
          )}

          {/* System Health Diagnostics Monitor */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm p-8 space-y-8">
              {/* Telemetry Loop Speed Tuner Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-border/60">
                <div className="space-y-1">
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                    <Gauge size={16} className="text-primary" />
                    Telemetry Speed Tuning
                  </h3>
                  <p className="text-[10px] text-muted font-medium italic">Adjust the background resource telemetry loop latency on the fly</p>
                </div>
                
                <div className="w-full md:w-96 p-4 rounded-2xl bg-slate-500/5 border border-border/50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-muted">Refresh Profile:</span>
                    <span className="text-[10px] font-black font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-md uppercase">
                      {INTERVAL_MODES[sliderIndex].label} ({INTERVAL_MODES[sliderIndex].duration})
                    </span>
                  </div>
                  
                  <div className="relative pt-1">
                    <input 
                      type="range" 
                      min="0" 
                      max="2" 
                      step="1" 
                      value={sliderIndex}
                      onChange={(e) => setSliderIndex(Number(e.target.value))}
                      className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-primary bg-slate-200 dark:bg-slate-800"
                    />
                    <div className="flex justify-between text-[9px] font-extrabold text-muted mt-2">
                      <button 
                        onClick={() => setSliderIndex(0)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 0 ? "text-primary font-black" : "")}
                      >
                        Aggressive (500ms)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(1)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 1 ? "text-primary font-black" : "")}
                      >
                        Balanced (2.5s)
                      </button>
                      <button 
                        onClick={() => setSliderIndex(2)} 
                        className={cn("uppercase tracking-tighter transition-colors hover:text-foreground", sliderIndex === 2 ? "text-primary font-black" : "")}
                      >
                        Power Saver (10s)
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <SystemHealth updateInterval={updateInterval} />
            </section>
          )}

          {/* Security & Access Thresholds */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
              <div className="px-8 py-6 border-b border-border flex items-center justify-between">
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Lock size={16} className="text-primary" />
                  Operational Security Thresholds
                </h3>
                <p className="text-[10px] text-muted font-mono">PROTO_DYNAMIC_V4</p>
              </div>
              
              <div className="divide-y divide-border/50">
                {thresholds.map((t, i) => (
                  <motion.div 
                    key={t.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between p-8 hover:bg-background transition-colors group"
                  >
                    <div className="flex items-center gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:scale-110",
                        t.isEnabled ? "bg-primary/10 text-primary" : "bg-background text-muted"
                      )}>
                        <Zap size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-foreground uppercase tracking-tight group-hover:text-primary transition-colors">{t.type.replace("_", " ")}</p>
                        <p className="text-[10px] text-muted font-mono mt-0.5">TRIGGER_VALUE: {t.threshold}{t.type.toLowerCase().includes('budget') ? '%' : ' KES'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="relative">
                         <input 
                          type="number" 
                          value={t.threshold}
                          onChange={(e) => updateThreshold(t.id, { threshold: Number(e.target.value) })}
                          className="w-24 px-4 py-2 bg-background border border-border rounded-xl text-xs font-black font-mono focus:border-primary/50 outline-none transition-colors text-right"
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-slate-300 uppercase">VAL</span>
                      </div>
                     
                      <button 
                        onClick={() => updateThreshold(t.id, { isEnabled: !t.isEnabled })}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-300",
                          t.isEnabled ? "bg-primary" : "bg-slate-200"
                        )}
                      >
                        <motion.div 
                          animate={{ x: t.isEnabled ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-lg"
                        />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* User Profile Identity */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
             <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                <UserCheck size={120} className="text-primary" />
             </div>
            <div className="px-8 py-6 border-b border-border">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <UserCheck size={18} className="text-primary" />
                Session Identity Transaction
              </h3>
            </div>
            
            <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">LEGAL_NAME_DISPLAY</label>
                <div className="p-4 bg-background rounded-2xl text-xs text-foreground border border-border font-bold">{currentUser?.name}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1">IDENTITY_EMAIL</label>
                <div className="p-4 bg-background rounded-2xl text-xs text-foreground border border-border font-bold">{currentUser?.email}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">PROTOCOL_ACCESS_ROLE</label>
                <div className="p-4 bg-primary text-white rounded-2xl text-xs font-black uppercase tracking-widest border border-primary/20 shadow-lg shadow-primary/20">{currentUser?.role.replace("_", " ")}</div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">AFFILIATED_TRANSACTION_GROUP</label>
                <div className="p-4 bg-slate-50 rounded-2xl text-xs text-slate-900 border border-slate-100 font-bold uppercase">{currentUser?.group || "GLOBAL_CLUSTER"}</div>
              </div>
            </div>
          </section>

          {/* User Password Update Security */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Lock size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                Change Password Pipeline
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <span className="text-[9px] font-black uppercase tracking-widest">Secure Client Cipher</span>
              </div>
            </div>
            
            <form onSubmit={handleUpdatePassword} className="p-10 space-y-6 relative z-10">
              <p className="text-xs text-muted leading-relaxed font-semibold">
                Configure a new secure password for your authentication record. Minimum 6 characters required.
              </p>

              {passwordError && (
                <div className="p-4 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl text-xs text-rose-700 dark:text-rose-300 font-bold uppercase tracking-wide">
                  Error: {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl text-xs text-emerald-700 dark:text-emerald-300 font-bold uppercase tracking-wide">
                  {passwordSuccess}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">New Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-border rounded-xl text-xs font-bold focus:border-primary focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="btn-primary w-full sm:w-auto px-8 py-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest disabled:opacity-50"
                >
                  {isUpdatingPassword ? "Processing Transaction..." : "Update Password Signature"}
                </button>
              </div>
            </form>
          </section>

          {/* Connected Devices */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <Smartphone size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Smartphone size={18} className="text-primary" />
                Connected Devices
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <span className="text-[9px] font-black uppercase tracking-widest">{localActiveDevices.length} {localActiveDevices.length === 1 ? 'Device' : 'Devices'} Connected</span>
              </div>
            </div>
            <div className="p-8 relative z-10 space-y-4">
              {localActiveDevices.map((device, i) => {
                const localSessionId = typeof window !== "undefined" ? localStorage.getItem("device_session_id") : null;
                const isCurrent = device.id === localSessionId;
                return (
                  <div key={device.id} className="flex flex-col md:flex-row md:items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl gap-4 group">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-border text-slate-400 group-hover:text-primary transition-colors">
                        <Cpu size={20} />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-bold text-foreground">
                            {device.userAgent.slice(0, 50)}...
                          </p>
                          {isCurrent && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 rounded-md text-[8px] font-black uppercase tracking-widest shrink-0 shadow-sm">
                              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                              This Device
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted font-medium uppercase tracking-widest">
                          <span>Logged in: {new Date(device.loginTime).toLocaleDateString()}</span>
                          <span className="w-1 h-1 bg-border rounded-full" />
                          <span>Last Active: {new Date(device.lastActive).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                          if (confirm(`Revoke session for this device?`)) {
                             const updated = localActiveDevices.filter(d => d.id !== device.id);
                             setLocalActiveDevices(updated);
                             if (currentUser) {
                               updateUserProfile(currentUser.id, { activeDevices: updated });
                             }
                             triggerToast({ type: "SECURITY_UPDATE", message: "Device logged out successfully", severity: "MEDIUM", timestamp: new Date().toISOString() });
                             
                             // If revoking this device, trigger logout
                             if (isCurrent) {
                               setTimeout(() => {
                                 logout();
                               }, 1000);
                             }
                          }
                      }}
                      className="px-4 py-2 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-900/50 text-rose-600 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0 cursor-pointer"
                    >
                      Revoke Device
                    </button>
                  </div>
                );
              })}

              {localActiveDevices.length > 0 && (
                <div className="pt-4 border-t border-border mt-4">
                  <button 
                    onClick={async () => {
                      if (confirm("Are you sure you want to log out of all devices? This will invalidate all session heartbeats and sign you out completely.")) {
                        setLocalActiveDevices([]);
                        if (currentUser) {
                          await updateUserProfile(currentUser.id, { activeDevices: [] });
                        }
                        triggerToast({ 
                          type: "SECURITY_UPDATE", 
                          message: "A request has been sent to destroy all active sessions. Redirecting...", 
                          severity: "HIGH", 
                          timestamp: new Date().toISOString() 
                        });
                        setTimeout(() => {
                          logout();
                        }, 1200);
                      }
                    }}
                    className="w-full h-11 flex items-center justify-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] transition-all border border-rose-500/20 cursor-pointer"
                  >
                    <Power size={13} className="text-rose-600" />
                    Logout all devices
                  </button>
                </div>
              )}

              {(!localActiveDevices || localActiveDevices.length === 0) && (
                 <div className="text-center py-6 border border-dashed border-border rounded-xl">
                   <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No Active Devices Detected</p>
                 </div>
              )}
            </div>
          </section>

          {/* Logout Audit Timeline */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
              <History size={120} className="text-primary" />
            </div>
            <div className="px-8 py-6 border-b border-border flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <History size={18} className="text-primary" />
                Logout Audit
              </h3>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-200/50 dark:border-amber-500/20 rounded-lg">
                <ShieldCheck size={12} />
                <span className="text-[9px] font-black uppercase tracking-widest">Slack Alert Active</span>
              </div>
            </div>
            <div className="p-8 relative z-10">
              <div className="space-y-6">
                {systemLogs
                  .filter(log => log.action === "USER_LOGOUT" && log.metadata?.email === currentUser?.email)
                  .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                  .slice(0, 5)
                  .map((log, index) => (
                    <div key={log.id} className="flex gap-4 group">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-border flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all shadow-sm">
                          <Lock size={12} />
                        </div>
                        {index < 4 && <div className="w-px h-full bg-border mt-2" />}
                      </div>
                      <div className="pb-2 flex-1">
                        <div className="flex flex-col">
                          <p className="text-xs font-bold text-foreground">Session Terminated</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Clock size={10} className="text-muted" />
                            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">
                              {new Date(log.timestamp).toLocaleString(undefined, {
                                year: 'numeric', month: 'short', day: 'numeric',
                                hour: '2-digit', minute: '2-digit', second: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {systemLogs.filter(log => log.action === "USER_LOGOUT" && log.metadata?.email === currentUser?.email).length === 0 && (
                    <div className="text-center py-6 border border-dashed border-border rounded-xl">
                      <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No logout events recorded yet</p>
                    </div>
                  )}
              </div>
              <div className="mt-8 pt-4 border-t border-border flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-xl">
                 <Shield className="text-primary mt-0.5 shrink-0" size={16} />
                 <p className="text-[10px] sm:text-xs text-muted leading-relaxed font-medium">
                   <strong>Security Notice:</strong> If you recognize an unexpected logout event or session drop from an unknown device, please contact the administrator immediately or change your password.
                 </p>
              </div>
            </div>
          </section>
        </div>

        <div className="space-y-8">
          {/* Record Metadata Card */}
          {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
            <>
              <section className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 opacity-10 transition-transform group-hover:scale-125 duration-700">
                  <Server size={80} className="text-white" />
               </div>
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Ledger Metadata</h3>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">FIRESTORE_LIVE_SYNC</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {[
                  { label: "Cluster Type", value: "CLOUD_GEN_3", status: "emerald" },
                  { label: "Integrity Link", value: "ENCRYPTED_SSL", status: "emerald" },
                  { label: "Record Index", value: "3,102 ENTITIES", status: "primary" }
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center group/item cursor-default">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-hover/item:text-slate-300 transition-colors">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full animate-pulse",
                        item.status === 'emerald' ? 'bg-emerald-500' : 'bg-primary'
                      )} />
                      <span className="text-[10px] font-black text-white uppercase tracking-tighter">{item.value}</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="pt-8 flex flex-col gap-3">
              </div>
            </section>

            {/* Supabase Relational Database Migration & Fallback Section */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                  ⚡
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 dark:text-white">Supabase Backup Database & Sync</h3>
                  <p className="text-xs text-slate-500">Enable advanced SQL dual-write backup capabilities or backup to Supabase in real time.</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 pt-4">
                {/* Connection Status indicator */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full animate-pulse bg-emerald-500" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-white">Active Persistence Layer</p>
                      <p className="text-[10px] text-slate-500">
                        Primary Database: Supabase PostgreSQL (Production Cluster)
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono py-1 px-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 rounded-full font-black uppercase tracking-wider">
                    SUPABASE: ACTIVE
                  </span>
                </div>

                {/* Supabase Dynamic Connection Test Utility */}
                <div className="p-5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Wifi className="w-4 h-4 text-indigo-500" />
                        Supabase Connection Diagnostics
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Perform an active ping and probe of the Supabase gateway endpoints using both live dynamic or static environments.
                      </p>
                    </div>
                  </div>

                  {/* Masked endpoint info */}
                  <div className="bg-slate-100 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    <div>
                      <span className="text-slate-400">Endpoint URL:</span>{" "}
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {supabaseUrlInfo 
                          ? (supabaseUrlInfo.length > 23 
                              ? `${supabaseUrlInfo.substring(0, 15)}...${supabaseUrlInfo.substring(supabaseUrlInfo.length - 8)}` 
                              : supabaseUrlInfo)
                          : "Not Configured / Unknown"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Connection Mode:</span>{" "}
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {supabaseUrlInfo ? "DYNAMIC_GATEWAY" : "STAN_LOCAL_PROBING"}
                      </span>
                    </div>
                  </div>

                  {connectionTestResult.status && (
                    <div className={cn(
                      "p-3.5 rounded-xl border flex flex-col gap-1 text-[11px]",
                      connectionTestResult.status === "success" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-400",
                      connectionTestResult.status === "partial_success" && "bg-amber-500/10 border-amber-500/20 text-amber-800 dark:text-amber-400",
                      connectionTestResult.status === "failed" && "bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-400",
                      connectionTestResult.status === "not_configured" && "bg-slate-500/10 border-slate-500/20 text-slate-800 dark:text-slate-400"
                    )}>
                      <div className="flex items-center gap-1.5 font-bold">
                        {connectionTestResult.status === "success" && "✓ Gateway Verification Succeeded"}
                        {connectionTestResult.status === "partial_success" && "⚠ Gateway Reachable (Initialization Needed)"}
                        {connectionTestResult.status === "failed" && "✗ Connection Probe Failed"}
                        {connectionTestResult.status === "not_configured" && "ℹ Credentials Missing"}
                        {connectionTestResult.latency !== undefined && (
                          <span className="ml-auto text-[9px] font-mono py-0.5 px-2 bg-black/5 dark:bg-white/5 rounded">
                            Latency: {connectionTestResult.latency}ms
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] leading-relaxed opacity-90">{connectionTestResult.message}</p>
                      {connectionTestResult.details && (
                        <div className="text-[9px] font-mono mt-1 pt-1 border-t border-current/10 overflow-x-auto whitespace-pre-wrap leading-tight text-slate-500 dark:text-slate-400">
                          {connectionTestResult.details}
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    disabled={testingConnection}
                    onClick={async () => {
                      setTestingConnection(true);
                      setConnectionTestResult({ status: null, message: "" });
                      const startTime = Date.now();

                      try {
                        const client = getSupabaseClient(true);
                        
                        // Let's refetch endpoint URL to show live configuration
                        try {
                          const confRes = await fetch("/api/config/supabase");
                          if (confRes.ok) {
                            const confData = await confRes.json();
                            if (confData.url) {
                              setSupabaseUrlInfo(confData.url);
                            }
                          }
                        } catch (err) {
                          console.log("Error refreshing URL info during test:", err);
                        }

                        // Call the server-side comprehensive manual troubleshooter
                        let troubleshootReport: any = null;
                        try {
                          const tsRes = await fetch("/api/config/troubleshoot", { method: "POST" });
                          if (tsRes.ok) {
                            troubleshootReport = await tsRes.json();
                          }
                        } catch (tsErr) {
                          console.log("[Diagnostics] Failed to call server-side manual troubleshooter:", tsErr);
                        }

                        if (!client) {
                          const msg = "Could not initialize client. Supabase VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY variables are blank or invalid in your environmental config.";
                          setConnectionTestResult({
                            status: "not_configured",
                            message: msg,
                            details: troubleshootReport ? `Server-Side Variable Status:\n${JSON.stringify(troubleshootReport.env, null, 2)}\n\nRecommendations:\n- ${troubleshootReport.recommendations?.join("\n- ")}` : "No deeper server info was retrieved."
                          });
                          triggerToast({
                            type: "SECURITY_UPDATE",
                            severity: "HIGH",
                            message: "Supabase connection failed: Credentials missing.",
                            timestamp: new Date().toISOString()
                          });
                          return;
                        }

                        // Query probe client-side
                        const { data, error } = await client.from("users").select("id").limit(1);
                        const latency = Date.now() - startTime;

                        let tablesSummary = "";
                        if (troubleshootReport?.postgres?.tables) {
                          tablesSummary = `\n\nLive Tables Discovered (${troubleshootReport.postgres.tables.length}):\n` + 
                            troubleshootReport.postgres.tables.map((t: any) => `  - ${t.name}: ${t.count >= 0 ? `${t.count} records` : "unreadable"}`).join("\n");
                        }

                        if (error) {
                          // Check if the error is "relation not found" which is Postgres error code "PGRST116" or similar
                          const isTableMissing = error.message?.includes("relation") || error.code === "PGRST116" || error.code === "42P01";
                          
                          if (isTableMissing) {
                            const msg = "Successfully connected to the Supabase instance! However, the 'users' target schema table relation was not found. Please execute database migrations to set up SQL tables.";
                            setConnectionTestResult({
                              status: "partial_success",
                              message: msg,
                              details: `Database Ping: Reachable\nLatency: ${latency}ms\nPostgres Error Code: ${error.code || "unknown"}\nAPI Response: ${error.message}${tablesSummary}\n\nServer Recommendations:\n- ${troubleshootReport?.recommendations?.join("\n- ") || "Initialize schema tables"}`,
                              latency
                            });
                            triggerToast({
                              type: "SYSTEM_INFO",
                              severity: "MEDIUM",
                              message: "Supabase Reachable! Schema migration is required.",
                              timestamp: new Date().toISOString()
                            });
                          } else {
                            const msg = `Supabase Gateway refused the request. Please double check that your API endpoints, anonymous key tokens, and CORS routing permission levels are configured.`;
                            setConnectionTestResult({
                              status: "failed",
                              message: msg,
                              details: `Latency: ${latency}ms\nError Code: ${error.code || "unknown"}\nMessage Details: ${error.message}${tablesSummary}\n\nTroubleshoot Recommendations:\n- ${troubleshootReport?.recommendations?.join("\n- ") || "Check authentication tokens"}`,
                              latency
                            });
                            triggerToast({
                              type: "SECURITY_UPDATE",
                              severity: "HIGH",
                              message: `Supabase Connection Refused: ${error.message}`,
                              timestamp: new Date().toISOString()
                            });
                          }
                        } else {
                          const msg = "Supabase API Connection & Schema verification were fully successful! Direct connection and REST gateway verified successfully.";
                          setConnectionTestResult({
                            status: "success",
                            message: msg,
                            details: `Status: Connected\nLatency: ${latency}ms\nAuthorized Role: anon\nActive Queries: Verified\nPostgres Engine: ${troubleshootReport?.postgres?.version || "Standard"}${tablesSummary}\n\nRecommendations:\n- ${troubleshootReport?.recommendations?.join("\n- ") || "Connections are completely healthy"}`,
                            latency
                          });
                          triggerToast({
                            type: "SYSTEM_INFO",
                            severity: "LOW",
                            message: "Supabase connection verified successfully!",
                            timestamp: new Date().toISOString()
                          });
                        }
                      } catch (err: any) {
                        const latency = Date.now() - startTime;
                        const msg = `CORS routing error or endpoint name-resolution failure occurred while reaching Supabase API cluster hosts.`;
                        setConnectionTestResult({
                          status: "failed",
                          message: msg,
                          details: `Latency: ${latency}ms\nException: ${err.message || err}`,
                          latency
                        });
                        triggerToast({
                          type: "SECURITY_UPDATE",
                          severity: "HIGH",
                          message: `Supabase Network Exception: ${err.message || 'Check logs'}`,
                          timestamp: new Date().toISOString()
                        });
                      } finally {
                        setTestingConnection(false);
                      }
                    }}
                    className="w-full py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300/50 dark:border-slate-700/50 text-[10px] font-bold rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={cn("w-3.5 h-3.5", testingConnection && "animate-spin")} />
                    {testingConnection ? "testing..." : "Execute Connection Diagnosis"}
                  </button>
                </div>

                {/* Supabase Password URL-Encoder Helper Tool */}
                <div className="p-5 bg-slate-100/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
                      <Lock className="w-4 h-4" />
                      <p className="text-xs font-bold uppercase tracking-wider">DATABASE_URL Password Encoder Utility</p>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      If your database password has special characters like <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-850 rounded font-mono">@</code>, <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-850 rounded font-mono">#</code>, <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-850 rounded font-mono">:</code>, or <code className="px-1 py-0.5 bg-slate-200 dark:bg-slate-850 rounded font-mono">?</code>, direct connection strings will reject authentication unless they are URL-encoded. Use this tool to generate the correct string.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Option A: URL-Encode raw password only</label>
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={encodePassword}
                          onChange={(e) => handleEncodePasswordOnly(e.target.value)}
                          placeholder="My#Secret@Pass123"
                          className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        />
                        {encodedPasswordOnly && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(encodedPasswordOnly);
                              triggerToast({
                                type: "SYSTEM_INFO",
                                severity: "LOW",
                                message: "Encoded password copied to clipboard!",
                                timestamp: new Date().toISOString()
                              });
                            }}
                            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-bold cursor-pointer"
                          >
                            Copy
                          </button>
                        )}
                      </div>
                      {encodedPasswordOnly && (
                        <p className="mt-1.5 text-[9px] font-mono text-indigo-600 dark:text-indigo-400 break-all bg-indigo-500/5 p-2 rounded-lg border border-indigo-500/10">
                          Encoded: <span className="font-bold">{encodedPasswordOnly}</span>
                        </p>
                      )}
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800 my-2 pt-2">
                      <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 block mb-1 uppercase tracking-wider">Option B: Translate Raw Supabase Connection String</label>
                      <div className="space-y-2">
                        <textarea
                          rows={2}
                          value={rawConnectionUrl}
                          onChange={(e) => handleEncodeConnectionString(e.target.value)}
                          placeholder="postgresql://postgres.ref_id:password_with_special_chars@aws-0-eu-west-2.pooler.supabase.com:6543/postgres"
                          className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-900 dark:text-white"
                        />
                        {encodedConnectionUrl && (
                          <div className="space-y-1 bg-emerald-500/5 dark:bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Encoded Connection URL</span>
                              <button
                                onClick={() => {
                                  if (!encodedConnectionUrl.startsWith("Error") && !encodedConnectionUrl.startsWith("Invalid")) {
                                    navigator.clipboard.writeText(encodedConnectionUrl);
                                    triggerToast({
                                      type: "SYSTEM_INFO",
                                      severity: "LOW",
                                      message: "Encoded connection string copied to clipboard!",
                                      timestamp: new Date().toISOString()
                                    });
                                  }
                                }}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold cursor-pointer"
                                disabled={encodedConnectionUrl.startsWith("Error") || encodedConnectionUrl.startsWith("Invalid")}
                              >
                                Copy String
                              </button>
                            </div>
                            <p className="text-[9px] font-mono text-slate-800 dark:text-slate-200 break-all leading-normal select-all">
                              {encodedConnectionUrl}
                            </p>
                          </div>
                        )}
                        <p className="text-[9px] text-slate-500 leading-normal">
                          💡 Paste your raw connection string above. This utility will automatically parse the URI, locate your password, URL-encode it, and output the correct formatted URI for you to copy and paste into your Secrets panel.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>


              </div>
            </section>

            {/* Dashboard Announcement Banner Configuration */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 font-bold text-lg">
                  📢
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Global Announcement Banner</h3>
                  <p className="text-[9px] text-muted uppercase tracking-widest mt-1 font-mono">System-Wide Broadcast</p>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Configure a dismissible announcement banner to be displayed to and visible to all system users.
              </p>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-foreground">Announcement Message</label>
                  <textarea
                    value={systemSettings.announcementMessage || ""}
                    onChange={(e) => updateSystemSettings({ announcementMessage: e.target.value })}
                    placeholder="Enter broadcast message here..."
                    className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[11px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground">Banner Type</label>
                    <div className="relative">
                      <select
                        value={systemSettings.announcementType || "info"}
                        onChange={(e) => updateSystemSettings({ announcementType: e.target.value as any })}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 pb-3 text-[11px] font-bold text-foreground appearance-none focus:outline-none focus:ring-2 focus:ring-primary uppercase tracking-wider h-[42px]"
                      >
                        <option value="info">Info (Blue)</option>
                        <option value="warning">Warning (Yellow)</option>
                        <option value="alert">Alert (Red)</option>
                        <option value="success">Success (Green)</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-[14px] text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-foreground">Status</label>
                    <button
                      type="button"
                      onClick={() => updateSystemSettings({ announcementIsActive: !systemSettings.announcementIsActive })}
                      className={`w-full py-3 h-[42px] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        systemSettings.announcementIsActive
                          ? "bg-rose-500 hover:bg-rose-600 text-white shadow-sm"
                          : "bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                      }`}
                    >
                      {systemSettings.announcementIsActive ? "Deactivate Banner" : "Activate Banner"}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* Google Sheets Data Backup Section */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-bold text-lg">
                  📊
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Sheets Backup Drive</h3>
                  <p className="text-[9px] text-muted uppercase tracking-widest mt-1 font-mono">Workspace API Backup Sink</p>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Performs a secure bulk audit upload of all matching record indices to designated Google Sheets isolation sheets, dynamically mapped and archived according to their respective Fiscal Years.
              </p>

              {backupResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border text-[10px] font-mono leading-relaxed space-y-2 ${
                    backupResult.mode === "online"
                      ? "bg-emerald-500/5 border-emerald-200/50 text-emerald-800 dark:text-emerald-300 dark:border-emerald-900/30"
                      : "bg-rose-500/5 border-rose-200/50 text-rose-800 dark:text-rose-300 dark:border-rose-900/30"
                  }`}
                >
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5 text-[11px] text-slate-800 dark:text-slate-100">
                    {backupResult.mode === "online" ? "🟢 Synchronization Authorized" : "🟡 Synced to Simulated Local Pool"}
                  </div>
                  <div className="space-y-1.5">
                    <div>{backupResult.message}</div>
                    {backupResult.backupSummary && backupResult.backupSummary.map((summary: any, sIdx: number) => (
                      <div key={sIdx} className="pt-2 border-t border-slate-200/30 dark:border-slate-800/50">
                        <div className="font-bold text-foreground">Fiscal Year: {summary.fiscalYear}</div>
                        <div>Sheet Title: {summary.sheetTitle}</div>
                        <div>Indexed: Row Appends ({summary.appendedCount}) | Overwrites ({summary.updatedCount})</div>
                        {summary.spreadsheetUrl && summary.mode !== "simulated_fallback" && (
                          <a
                            href={summary.spreadsheetUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300 underline font-semibold inline-flex items-center gap-1 mt-1 font-sans cursor-pointer text-xs"
                          >
                            Explore Spreadsheet Ledger
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <button
                type="button"
                onClick={runFullBackup}
                disabled={isBackingUp || requisitions.length === 0}
                className={`w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm ${
                  isBackingUp
                    ? "bg-slate-100 text-slate-400 dark:bg-slate-800"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-lg hover:shadow-emerald-200/50"
                }`}
              >
                {isBackingUp ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Backing Up ({requisitions.length} Records)...
                  </>
                ) : (
                  <>
                    <Database size={14} />
                    Initiate Data Backup
                  </>
                )}
              </button>
            </section>

            {/* API Notification Control Center (Slack Integration - Prompt 6) */}
            <section className="bg-card rounded-[2rem] border border-border p-8 shadow-sm transition-all space-y-6">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                  💬
                </span>
                <div>
                  <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em]">Slack Integration Commands</h3>
                  <p className="text-[9px] text-indigo-500 font-mono font-bold uppercase tracking-widest mt-1">
                    System Monitors & Action Hub (Prompt 6)
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-muted leading-relaxed font-semibold">
                Directly configure, audit, and force-dispatch Slack notifications across workflows. Perfect for validating alerting coverage paths, interactive action attachments, and performance monitor targets.
              </p>

              {slackActionResult && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-2xl border text-[10px] font-mono leading-relaxed space-y-1.5 ${
                    slackActionResult.success
                      ? "bg-emerald-500/5 border-emerald-200/50 text-emerald-800 dark:text-emerald-300 dark:border-emerald-900/30"
                      : "bg-rose-500/5 border-rose-200/50 text-rose-800 dark:text-rose-300 dark:border-rose-900/30"
                  }`}
                >
                  <div className="font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5 text-slate-800 dark:text-slate-100">
                    {slackActionResult.success ? "🟢 Alert Synced" : "🔴 Dispatch Failure"}
                    {slackActionResult.mode === "simulated" && (
                      <span className="px-1.5 py-0.5 rounded-lg border border-yellow-200 bg-yellow-50 text-[8px] text-yellow-800 font-bold dark:bg-yellow-950/20 dark:border-yellow-900/30">
                        SIMULATED FALLBACK
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="font-bold">Command:</span> {slackActionResult.type?.toUpperCase()}
                  </div>
                  {slackActionResult.message && (
                    <div>
                      <span className="font-bold">Log:</span> {slackActionResult.message}
                    </div>
                  )}
                  {slackActionResult.staleCount !== undefined && (
                    <div>
                      <span className="font-bold">Flagged Stale Requisitions:</span> {slackActionResult.staleCount}
                    </div>
                  )}
                  {slackActionResult.anomaliesCount !== undefined && (
                    <div>
                      <span className="font-bold">Suspicious Velocity Profiles:</span> {slackActionResult.anomaliesCount}
                    </div>
                  )}
                </motion.div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Morning Briefing */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>☀️</span> Morning Operational Briefing
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Compiles and schedules unapproved tickets into block structures for L1/L2 verifiers.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchMorningBriefing}
                    disabled={slackActionLoading["morning"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["morning"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Bell size={10} />
                    )}
                    Send Morning Brief
                  </button>
                </div>

                {/* 2. EOD activity snapshot */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🌙</span> EOD Activity Snapshot
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Sends active user sessions, processed items count, and disbursement sums to channels.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchEodSnapshot}
                    disabled={slackActionLoading["eod"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["eod"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Activity size={10} />
                    )}
                    Send EOD snapshot
                  </button>
                </div>

                {/* 3. User Analytics Leaderboard */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🏆</span> Engagement Leaderboard
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Ranks users dynamically from audit logs by active logins and ledger interventions.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchWeeklyLeaderboard}
                    disabled={slackActionLoading["leaderboard"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["leaderboard"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Gauge size={10} />
                    )}
                    Send Leaderboard
                  </button>
                </div>

                {/* 4. Stale Requisitions sweep */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>⏳</span> Scan Stale Pending Tickets
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Identifies and alerts of submissions stagnant for &gt;48 hours to accelerate the pipeline.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchStaleScan}
                    disabled={slackActionLoading["stale"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["stale"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Clock size={10} />
                    )}
                    Dispatch Stale Warnings
                  </button>
                </div>

                {/* 5. Behavioral Anomalies scan */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>🛡️</span> Scan Irregular Velocity Spikes
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Audits user velocity for multiple high-value acquisitions created in narrow windows.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchBehavioralAnomalies}
                    disabled={slackActionLoading["anomalies"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["anomalies"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <ShieldCheck size={10} />
                    )}
                    Deploy Security Audit
                  </button>
                </div>

                {/* 6. Latency alerts monitor */}
                <div className="p-4 rounded-2xl border border-border bg-background/50 space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="text-[10px] font-extrabold uppercase text-foreground tracking-wider flex items-center gap-1.5">
                      <span>⚡</span> Simulate Lag Warning
                    </h4>
                    <p className="text-[9px] text-muted font-bold mt-1 leading-relaxed">
                      Dispatches performance warning logs for DB queries exceeding SLA latency thresholds.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={dispatchLatencyAlert}
                    disabled={slackActionLoading["latency"]}
                    className="w-full py-2.5 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {slackActionLoading["latency"] ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Zap size={10} />
                    )}
                    Simulate Lag Alert
                  </button>
                </div>
              </div>
            </section>
          </>
          )}

          {/* Real-time Audit Trail */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm flex flex-col h-[500px]">
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-background">
              <div>
                <h3 className="text-xs font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  Audit Trail
                </h3>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">LIVE_FEED</span>
                  <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2 space-y-2 scrollbar-thin">
              {lastTenLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                  <div className="w-16 h-16 bg-background rounded-3xl flex items-center justify-center border border-border text-muted/30">
                    <Activity size={24} />
                  </div>
                  <p className="text-[10px] font-black text-muted uppercase tracking-widest">Awaiting Log Transactions...</p>
                </div>
              ) : (
                lastTenLogs.map((log, idx) => (
                  <motion.div 
                    key={log.id} 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-5 border border-border rounded-2xl hover:bg-background transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border border-border bg-card text-muted group-hover:text-primary group-hover:border-primary/20 transition-colors">
                        {log.action}
                      </span>
                      <span className="font-mono text-[9px] text-muted font-bold">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    
                    <p className="text-[11px] text-foreground font-medium leading-relaxed mb-3">
                      {log.details}
                    </p>
                    
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-md bg-background flex items-center justify-center text-[8px] font-black text-muted">
                        {log.performedBy?.charAt(0)}
                      </div>
                      <span className="text-[9px] font-black text-muted uppercase tracking-tighter truncate max-w-[150px]">
                        {log.performedBy}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>



          {/* Interface Aesthetics & Theme */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm transition-all">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Palette size={16} className="text-primary" />
                Interface Visual Core
              </h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">High-Contrast Dark Mode</p>
                  <p className="text-[10px] text-muted font-medium italic">Reduced eye-strain for audit cycles</p>
                </div>
                
                <div className="flex items-center gap-3 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-border/50">
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'light' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme !== 'dark' 
                        ? "bg-white dark:bg-slate-700 text-amber-500 shadow-sm shadow-amber-500/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Sun size={18} />
                  </button>
                  <button 
                    onClick={() => currentUser && updateUserProfile(currentUser.id, { theme: 'dark' })}
                    className={cn(
                      "w-10 h-10 flex items-center justify-center rounded-xl transition-all",
                      currentUser?.theme === 'dark' 
                        ? "bg-white dark:bg-slate-700 text-primary shadow-sm shadow-primary/10" 
                        : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    <Moon size={18} />
                  </button>
                </div>
              </div>

              {currentUser?.theme === 'dark' && (
                <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center gap-3">
                  <Cpu size={16} className="text-primary animate-pulse" />
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">Display_Driver: OLED_OPTIMIZED_V2</span>
                </div>
              )}
            </div>
          </section>

          {/* Session Timeout Policy */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm transition-all">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Clock size={16} className="text-primary" />
                Session Timeout Policy
              </h3>
            </div>
            
            <div className="p-8 space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-black text-foreground uppercase tracking-tight">Idle Timeout Limit</p>
                  <p className="text-[10px] text-muted font-medium italic">Inactivity period before alert warning emerges</p>
                </div>
                
                <div className="relative">
                  <select
                    value={currentUser?.idleTimeoutDuration || 15}
                    onChange={async (e) => {
                      if (currentUser) {
                        const val = Number(e.target.value);
                        await updateUserProfile(currentUser.id, { idleTimeoutDuration: val });
                      }
                    }}
                    className="appearance-none bg-background border border-border rounded-xl px-4 py-2.5 pr-10 text-xs font-black text-foreground tracking-wider uppercase focus:border-primary focus:outline-none transition-colors cursor-pointer w-full sm:w-40"
                  >
                    <option value={5}>5 Minutes</option>
                    <option value={15}>15 Minutes</option>
                    <option value={30}>30 Minutes</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                    <ChevronDown size={14} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-indigo-50 dark:bg-slate-950/20 border border-indigo-100 dark:border-slate-800 rounded-2xl flex items-start gap-3">
                <Shield size={16} className="text-primary shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest block">Zero-Trust Guard Status</span>
                  <p className="text-[10px] text-muted dark:text-slate-400 leading-relaxed font-semibold">
                    The portal will prompt security authorization alerts if no click, keystroke, touch, or scroll events are received within {currentUser?.idleTimeoutDuration || 15} minutes.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Alert Channels */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-background">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                Alert Pipelines
              </h3>
            </div>
            
            <div className="p-4 space-y-2">
              {[
                { label: "Internal Message Hub", active: true, icon: Mail },
                { label: "SMS Critical Broadcast", active: false, icon: Smartphone }
              ].map((channel) => (
                <div key={channel.label} className="flex items-center justify-between p-4 rounded-2xl hover:bg-background group transition-colors">
                  <div className="flex items-center gap-3">
                    <channel.icon size={16} className={cn("transition-colors", channel.active ? "text-primary" : "text-muted")} />
                    <span className="text-[10px] font-black text-foreground/70 uppercase tracking-widest">{channel.label}</span>
                  </div>
                  <button className={cn(
                    "w-10 h-5 rounded-full relative transition-all duration-300",
                    channel.active ? "bg-primary" : "bg-border"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-3 h-3 rounded-full bg-white shadow-sm transition-all",
                      channel.active ? "right-1" : "left-1"
                    )} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

