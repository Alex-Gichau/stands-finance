/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { ComposedChart, Area, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, cn, getDaysSinceSubmission } from "../lib/utils";
import { AlertTriangle, TrendingUp, Layout, Activity, ClipboardList, CheckCircle, Wallet, Users, X, Eye, Repeat, Clock, ArrowUpRight, Search, Trash2, Printer, FileText, ShieldCheck, CalendarRange, Flag } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RequisitionDetailModal } from "./RequisitionsPanel";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { printSystemLogs } from "../utils/exportUtils";

// Custom high-detail chart tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const approvalRate = data.requested > 0 ? Math.round((data.approved / data.requested) * 100) : 0;
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-4 rounded-2xl shadow-xl space-y-2 text-xs text-slate-750 min-w-[245px]">
        <div className="font-black text-slate-900 border-b border-slate-100 pb-1.5 flex justify-between items-center">
          <span className="text-[11px] uppercase tracking-wider text-slate-500 font-extrabold">{label} Statistics</span>
          <span className="text-[8px] font-mono bg-slate-100 px-1.5 py-0.5 rounded-md uppercase text-slate-400">Ledger Metrics</span>
        </div>
        <div className="space-y-1.5 pt-1.5 text-[11px]">
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
              Requested Volume:
            </span>
            <span className="font-bold text-slate-900 font-mono">Ksh {Number(data.requested).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              Approved / Settled:
            </span>
            <span className="font-bold text-slate-900 font-mono">Ksh {Number(data.approved).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-dashed border-slate-100 pt-1.5 mt-0.5">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
              Avg Request Size:
            </span>
            <span className="font-bold text-indigo-950 font-mono">Ksh {Number(data.average).toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
              Submission Count:
            </span>
            <span className="font-bold text-slate-900 font-mono">{data.count} Requisitions</span>
          </div>
          <div className="flex items-center justify-between gap-4 text-[10px] bg-slate-50 px-2 py-1.5 rounded-xl border border-slate-100 mt-2">
            <span className="text-slate-500 font-black uppercase tracking-wider text-[8px]">Approval Conversion:</span>
            <span className={`font-black font-mono text-[10px] ${approvalRate >= 80 ? "text-emerald-600" : approvalRate >= 50 ? "text-amber-600" : "text-slate-600"}`}>
              {approvalRate}%
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

const PIE_COLORS = [
  "#4f46e5", // Indigo-600
  "#06b6d4", // Cyan-500
  "#10b981", // Emerald-500
  "#f59e0b", // Amber-500
  "#ec4899", // Pink-500
  "#8b5cf6", // Violet-500
  "#f43f5e", // Rose-500
  "#64748b", // Slate-500
];

const PieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    return (
      <div className="bg-white/95 backdrop-blur-md border border-slate-200 p-3.5 rounded-2xl shadow-xl space-y-1.5 text-xs text-slate-700 min-w-[220px]">
        <div className="font-extrabold text-slate-900 border-b border-slate-100 pb-1 flex justify-between items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-slate-500 truncate max-w-[150px]">
            {data.groupName}
          </span>
          <span className="text-[8px] font-mono bg-indigo-50 px-1.5 py-0.5 rounded-md uppercase text-indigo-500 font-bold font-sans">
            Ledger Share
          </span>
        </div>
        <div className="pt-1 text-[11px] space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Submitted count:</span>
            <span className="font-mono font-bold text-slate-900">{data.count} reqs</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Value (KES):</span>
            <span className="font-mono font-black text-slate-900">Ksh {data.totalAmount?.toLocaleString()}</span>
          </div>
          {data.disbursedAmount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Disbursed (KES):</span>
              <span className="font-mono font-bold">Ksh {data.disbursedAmount?.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const Dashboard: React.FC = () => {
  const { requisitions, projects, alerts, currentUser, seedAllEcosystemData, deleteRequisition, systemLogs, canAccess, systemSettings, loading, supplementaryRequests, applySupplementaryBudget } = useRequisitions();

  const hasAuditTrail = useMemo(() => {
    return canAccess("auditTrail");
  }, [canAccess]);

  const [seeding, setSeeding] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);

  const [velocityTimeframe, setVelocityTimeframe] = useState<"DAILY" | "MONTHLY" | "ANNUAL">("DAILY");

  const [showRequested, setShowRequested] = useState(true);
  const [showApproved, setShowApproved] = useState(true);
  const [showAverage, setShowAverage] = useState(false);
  const [showCount, setShowCount] = useState(false);

  // Supplementary Budget states
  const [isSupplementaryModalOpen, setIsSupplementaryModalOpen] = useState(false);
  const [supProjectId, setSupProjectId] = useState("");
  const [supAmount, setSupAmount] = useState("");
  const [supJustification, setSupJustification] = useState("");
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [supError, setSupError] = useState<string | null>(null);
  const [supSuccess, setSupSuccess] = useState<string | null>(null);

  const dailyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sumByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const approvedByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    const countByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    
    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const dayName = days[d.getDay()];
        if (dayName) {
          sumByDay[dayName] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByDay[dayName] += req.amount;
          }
          countByDay[dayName] += 1;
        }
      }
    });

    const baselineRequested: Record<string, number> = { Mon: 30000, Tue: 45000, Wed: 60000, Thu: 35000, Fri: 80000, Sat: 25000, Sun: 15000 };
    const baselineApproved: Record<string, number> = { Mon: 24000, Tue: 39000, Wed: 50000, Thu: 28000, Fri: 72000, Sat: 19000, Sun: 10000 };
    const baselineCount: Record<string, number> = { Sun: 1, Mon: 3, Tue: 4, Wed: 5, Thu: 3, Fri: 7, Sat: 2 };
    
    return days.map(day => {
      const useMockData = systemSettings.prototypeDataEnabled && requisitions.length === 0;
      const requested = useMockData ? baselineRequested[day] : sumByDay[day];
      const approved = useMockData ? baselineApproved[day] : approvedByDay[day];
      const count = useMockData ? baselineCount[day] : countByDay[day];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: day,
        value: requested, // For legacy fallback
        requested,
        approved,
        count,
        average
      };
    });
  }, [requisitions, systemSettings.prototypeDataEnabled]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sumByMonth: Record<string, number> = {};
    const approvedByMonth: Record<string, number> = {};
    const countByMonth: Record<string, number> = {};
    
    months.forEach(m => { 
      sumByMonth[m] = 0; 
      approvedByMonth[m] = 0;
      countByMonth[m] = 0;
    });

    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const monthName = months[d.getMonth()];
        if (monthName) {
          sumByMonth[monthName] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByMonth[monthName] += req.amount;
          }
          countByMonth[monthName] += 1;
        }
      }
    });

    const baselineRequested: Record<string, number> = {
      Jan: 120000, Feb: 150000, Mar: 180000, Apr: 210000, May: 280000, Jun: 240000,
      Jul: 290000, Aug: 310500, Sep: 340000, Oct: 380000, Nov: 420000, Dec: 550000
    };
    const baselineApproved: Record<string, number> = {
      Jan: 102000, Feb: 135000, Mar: 150000, Apr: 178000, May: 240000, Jun: 195000,
      Jul: 250000, Aug: 275000, Sep: 305000, Oct: 340000, Nov: 375000, Dec: 490000
    };
    const baselineCount: Record<string, number> = {
      Jan: 10, Feb: 12, Mar: 15, Apr: 16, May: 22, Jun: 18,
      Jul: 24, Aug: 25, Sep: 28, Oct: 30, Nov: 32, Dec: 42
    };

    return months.map(m => {
      const useMockData = systemSettings.prototypeDataEnabled && requisitions.length === 0;
      const requested = useMockData ? baselineRequested[m] : sumByMonth[m];
      const approved = useMockData ? baselineApproved[m] : approvedByMonth[m];
      const count = useMockData ? baselineCount[m] : countByMonth[m];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: m,
        value: requested,
        requested,
        approved,
        count,
        average
      };
    });
  }, [requisitions, systemSettings.prototypeDataEnabled]);

  const annualData = useMemo(() => {
    const years = ["2024", "2025", "2026", "2027"];
    const sumByYear: Record<string, number> = {};
    const approvedByYear: Record<string, number> = {};
    const countByYear: Record<string, number> = {};
    
    years.forEach(y => { 
      sumByYear[y] = 0; 
      approvedByYear[y] = 0;
      countByYear[y] = 0;
    });

    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const yStr = d.getFullYear().toString();
        if (years.includes(yStr)) {
          sumByYear[yStr] += req.amount;
          if (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) {
            approvedByYear[yStr] += req.amount;
          }
          countByYear[yStr] += 1;
        }
      }
    });

    const baselineRequested: Record<string, number> = {
      "2024": 1200000, "2025": 2400000, "2026": 4800000, "2027": 620000
    };
    const baselineApproved: Record<string, number> = {
      "2024": 1050000, "2025": 2150000, "2026": 4200000, "2027": 520000
    };
    const baselineCount: Record<string, number> = {
      "2024": 98, "2025": 190, "2026": 380, "2027": 52
    };

    return years.map(y => {
      const useMockData = systemSettings.prototypeDataEnabled && requisitions.length === 0;
      const requested = useMockData ? baselineRequested[y] : sumByYear[y];
      const approved = useMockData ? baselineApproved[y] : approvedByYear[y];
      const count = useMockData ? baselineCount[y] : countByYear[y];
      const average = count > 0 ? Math.round(requested / count) : 0;

      return {
        name: y,
        value: requested,
        requested,
        approved,
        count,
        average
      };
    });
  }, [requisitions, systemSettings.prototypeDataEnabled]);

  const currentVelocityData = useMemo(() => {
    if (velocityTimeframe === "DAILY") return dailyData;
    if (velocityTimeframe === "MONTHLY") return monthlyData;
    return annualData;
  }, [velocityTimeframe, dailyData, monthlyData, annualData]);

  const formatYAxis = (val: number) => {
    if (val >= 1000000) {
      return `Ksh ${(val / 1000000).toFixed(1)}M`;
    }
    if (val >= 1000) {
      return `Ksh ${Math.round(val / 1000)}k`;
    }
    return `Ksh ${val}`;
  };

  const recentRequisitions = requisitions.slice(0, 5);
  const activeAlerts = alerts.filter(a => {
    if (a.isRead) return false;
    if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) return false;
    return true;
  });

  // Unified timeline derived from unread alerts and system logs
  const combinedTimeline = useMemo(() => {
    const items: Array<{
      id: string;
      message: string;
      timestamp: string;
      type: "ALERT" | "LOG";
      severity?: "LOW" | "MEDIUM" | "HIGH";
      action?: string;
    }> = [];

    // Filter active alerts
    activeAlerts.forEach(a => {
      items.push({
        id: a.id,
        message: a.message,
        timestamp: a.timestamp,
        type: "ALERT",
        severity: a.severity
      });
    });

    // Share system logs
    systemLogs.forEach(l => {
      items.push({
        id: l.id,
        message: `${l.details}`,
        timestamp: l.timestamp,
        type: "LOG",
        action: l.action
      });
    });

    // Sort descending by timestamp, take top 15
    return items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  }, [alerts, systemLogs]);

  const findRequisitionForLog = (text: string) => {
    if (!text) return null;
    const cleanText = text.toLowerCase();

    // 1. Try matching by ID directly
    const idMatch = requisitions.find(r => r.id && cleanText.includes(r.id.toLowerCase()));
    if (idMatch) return idMatch;

    // 2. Try quoted matches to avoid false positives
    const quoted = text.match(/['"`]([^'"`]+)['"`]/);
    if (quoted && quoted[1]) {
      const cleanQuote = quoted[1].trim().toLowerCase();
      const match = requisitions.find(r => r.title && r.title.toLowerCase() === cleanQuote);
      if (match) return match;
    }

    // 3. Substring match
    const sortedReqs = [...requisitions].sort((a, b) => b.title.length - a.title.length);
    return sortedReqs.find(r => r.title && r.title.length > 3 && cleanText.includes(r.title.toLowerCase())) || null;
  };

  const handleTimelineItemClick = (text: string) => {
    const matched = findRequisitionForLog(text);
    if (matched) {
      setSelectedRequisition(matched);
    }
  };

  const stats = useMemo(() => {
    const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
    const pending = requisitions.filter(r => r.status === RequisitionStatus.SUBMITTED || r.status === RequisitionStatus.APPROVED_L1).length;
    const approved = requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2 || r.status === RequisitionStatus.DISBURSED).length;
    const disbursed = requisitions.filter(r => r.status === RequisitionStatus.DISBURSED).reduce((acc, r) => acc + r.amount, 0);

    return [
      { label: "Gross Ledger Value", value: formatCurrency(totalValue), icon: Wallet, color: "text-primary", bg: "bg-primary/5" },
      { label: "Pending Approvals", value: `${pending} Transactions`, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Status Approved", value: `${approved} Transactions`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Total Fund Disbursed", value: formatCurrency(disbursed), icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    ];
  }, [requisitions]);

  const userGroupProject = projects.find(p => p.groupId === currentUser?.group);

  const requestedPerGroup = useMemo(() => {
    const groupTotals: Record<string, { groupId: string, groupName: string, count: number, totalAmount: number, pendingCount: number, disbursedAmount: number, requisitions: Requisition[] }> = {};
    
    requisitions.forEach(req => {
      const gid = req.groupId || "OTHER";
      const gname = req.groupName || "Other / Non-affine";
      
      if (!groupTotals[gid]) {
        groupTotals[gid] = {
          groupId: gid,
          groupName: gname,
          count: 0,
          totalAmount: 0,
          pendingCount: 0,
          disbursedAmount: 0,
          requisitions: []
        };
      }
      
      groupTotals[gid].count += 1;
      groupTotals[gid].totalAmount += req.amount;
      groupTotals[gid].requisitions.push(req);
      
      if (req.status === RequisitionStatus.SUBMITTED || req.status === RequisitionStatus.APPROVED_L1) {
        groupTotals[gid].pendingCount += 1;
      }
      if (req.status === RequisitionStatus.DISBURSED) {
        groupTotals[gid].disbursedAmount += req.amount;
      }
    });

    return Object.values(groupTotals).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [requisitions]);

  if (loading) {
    return (
      <div className="space-y-6 lg:space-y-8 animate-pulse p-4 md:p-8">
        {/* Header Skeleton */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <div className="space-y-3">
            <div className="h-8 w-64 bg-slate-200 rounded-lg"></div>
            <div className="h-4 w-48 bg-slate-100 rounded-md"></div>
          </div>
          <div className="flex items-center gap-3">
            <div className="h-12 w-32 bg-slate-200 rounded-xl"></div>
            <div className="h-12 w-12 bg-slate-200 rounded-xl"></div>
          </div>
        </div>

        {/* Highlight Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex items-center justify-between">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
          <div className="h-32 bg-white rounded-3xl border border-slate-200 shadow-sm p-6 items-center justify-between hidden lg:flex">
             <div className="space-y-3">
                <div className="h-4 w-24 bg-slate-100 rounded"></div>
                <div className="h-8 w-32 bg-slate-200 rounded"></div>
             </div>
             <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          </div>
        </div>

        {/* Main Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-1 lg:col-span-2 h-[450px] bg-white rounded-[2rem] border border-slate-200 shadow-sm"></div>
          <div className="h-[450px] bg-white rounded-[2rem] border border-slate-200 shadow-sm"></div>
        </div>
      </div>
    );
  }

  if (systemSettings.prototypeDataEnabled && requisitions.length === 0 && (currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN)) {
    return (
      <div className="h-[80vh] flex flex-col items-center justify-center space-y-8 animate-in fade-in duration-1000">
        <div className="relative">
          <div className="w-32 h-32 bg-primary/5 rounded-[3rem] rotate-45 animate-pulse absolute -inset-4 blur-2xl" />
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white border border-slate-200 rounded-[2rem] flex items-center justify-center text-primary shadow-xl relative z-10"
          >
            <Activity size={40} />
          </motion.div>
        </div>
        
        <div className="text-center space-y-3 max-w-md">
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Initialize Ledger Ecosystem</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">
            Welcome to St Andrews Requisition System. Your database is currently empty. Populate the environment with pre-configured dummy data to explore the audit trail, budget tracking, and approval pipelines.
          </p>
        </div>

        <button 
          onClick={async () => {
            setSeeding(true);
            try {
              await seedAllEcosystemData();
            } finally {
              setSeeding(false);
            }
          }}
          disabled={seeding}
          className="btn-primary px-10 py-4 flex items-center gap-3 shadow-2xl shadow-primary/40 relative overflow-hidden group"
        >
          {seeding ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>SYNCING DATA...</span>
            </>
          ) : (
            <>
              <TrendingUp size={20} />
              <span>ACTIVATE PROTOTYPE DATA</span>
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Role-aware Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div>
          <h1 className="text-lg md:text-2xl font-bold text-slate-900 tracking-tight">System Terminal</h1>
          <p className="text-slate-500 text-[9px] md:text-sm">Welcome, {currentUser?.name} • <span className="font-mono text-[8px] md:text-[10px] uppercase tracking-widest">{currentUser?.role} Mode</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          {(!systemSettings.hideSupplementaryBudgetBtn && currentUser && [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.ADMIN].includes(currentUser.role)) && (
            <button
              onClick={() => {
                setSupProjectId("");
                setSupAmount("");
                setSupJustification("");
                setSupError(null);
                setSupSuccess(null);
                setIsSupplementaryModalOpen(true);
              }}
              className="px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest shadow-sm hover:shadow active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <TrendingUp size={13} className="text-amber-600 animate-pulse" />
              <span>Supplementary Budget</span>
            </button>
          )}
          <div className="flex items-center gap-2 px-2.5 py-1 md:px-3 md:py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm w-fit">
            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Ledger Active</span>
          </div>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-3 md:p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className={cn("absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-125 transition-transform duration-500", stat.color)}>
              <stat.icon size={50} className="md:w-[80px] md:h-[80px]" />
            </div>
            <div className="text-[7px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 md:mb-2">{stat.label}</div>
            <div className="text-base md:text-2xl font-bold text-slate-900 mb-0.5 md:mb-1">{stat.value}</div>
            <div className={cn("text-[7px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block", stat.bg, stat.color)}>
              Live Sync
            </div>
          </motion.div>
        ))}
      </div>

      {/* Scoped Budget Banner for CHURCH_GROUP */}
      {currentUser?.role === UserRole.CHURCH_GROUP && userGroupProject && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary text-white rounded-2xl p-4 md:p-8 shadow-xl shadow-primary/20 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Your Ministry Group Ledger</h2>
                {requisitions.filter(r => r.projectId === userGroupProject.id).length > 0 && (
                  <span className="bg-white/20 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-white/10 backdrop-blur-sm">
                    {requisitions.filter(r => r.projectId === userGroupProject.id).length} Requisitions Done
                  </span>
                )}
              </div>
              <h3 className="text-xl md:text-3xl font-bold">{userGroupProject.name}</h3>
              <p className="opacity-80 text-xs md:text-sm max-w-md">Live fiscal monitoring for your specific project allocation and spend patterns.</p>
            </div>
            <div className="flex-1 w-full md:max-w-lg space-y-4">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[10px] md:text-sm font-bold opacity-80 uppercase tracking-wider">Utilization</span>
                <span className="text-lg md:text-2xl font-bold">
                  {((userGroupProject.spentAmount / userGroupProject.allocatedBudget) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-3 md:h-4 bg-white/20 rounded-full overflow-hidden border border-white/10">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(userGroupProject.spentAmount / userGroupProject.allocatedBudget) * 100}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    (userGroupProject.spentAmount / userGroupProject.allocatedBudget) > 0.9 ? "bg-rose-400" : "bg-amber-400"
                  )}
                />
              </div>
              <div className="flex justify-between text-[8px] md:text-xs font-mono opacity-80">
                <span>{formatCurrency(userGroupProject.spentAmount)} SPENT</span>
                <span>{formatCurrency(userGroupProject.allocatedBudget)} TOTAL</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Volume Chart */}
        <div className={cn(
          hasAuditTrail ? "lg:col-span-2" : "lg:col-span-3",
          "bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm"
        )}>
          <div className="px-4 md:px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest text-center">Transaction Velocity</h2>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200/50">
              <button
                type="button"
                onClick={() => setVelocityTimeframe("DAILY")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "DAILY" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Daily
              </button>
              <button
                type="button"
                onClick={() => setVelocityTimeframe("MONTHLY")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "MONTHLY" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setVelocityTimeframe("ANNUAL")}
                className={cn(
                  "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer",
                  velocityTimeframe === "ANNUAL" 
                    ? "bg-white text-primary shadow-sm" 
                    : "text-slate-500 hover:text-slate-850"
                )}
              >
                Annual
              </button>
            </div>
          </div>
          
          {/* Detailed Metric Toggle Layer */}
          <div className="px-4 md:px-6 py-2.5 border-b border-slate-100 bg-slate-50/30 flex flex-wrap gap-2 items-center justify-between">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.15em]">Overlay Parameters:</span>
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <button
                type="button"
                onClick={() => setShowRequested(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showRequested 
                    ? "bg-blue-500/10 text-blue-700 border-blue-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showRequested ? "bg-blue-600 animate-pulse" : "bg-slate-300")} />
                Requested
              </button>
              
              <button
                type="button"
                onClick={() => setShowApproved(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showApproved 
                    ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showApproved ? "bg-emerald-600 animate-pulse" : "bg-slate-300")} />
                Approved
              </button>
              
              <button
                type="button"
                onClick={() => setShowAverage(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showAverage 
                    ? "bg-purple-500/10 text-purple-700 border-purple-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showAverage ? "bg-purple-600" : "bg-slate-300")} />
                Avg Size
              </button>
              
              <button
                type="button"
                onClick={() => setShowCount(prev => !prev)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border cursor-pointer",
                  showCount 
                    ? "bg-orange-500/10 text-orange-700 border-orange-500/20 shadow-sm"
                    : "bg-transparent text-slate-400 border-slate-200/60"
                )}
              >
                <span className={cn("w-1.5 h-1.5 rounded-full", showCount ? "bg-orange-600" : "bg-slate-300")} />
                Count ({velocityTimeframe === "DAILY" ? "Day" : velocityTimeframe === "MONTHLY" ? "Month" : "Year"})
              </button>
            </div>
          </div>

          <div className="p-2 md:p-6 h-[270px] md:h-[320px]">
             <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
               <ComposedChart data={currentVelocityData} margin={{ top: 10, right: showCount ? 5 : 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRequested" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0.01}/>
                  </linearGradient>
                  <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                />
                
                <YAxis 
                  yAxisId="left"
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={formatYAxis}
                />

                {showCount && (
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#f97316', fontSize: 9, fontWeight: 700 }}
                    tickFormatter={(val) => `${val} req`}
                  />
                )}

                <Tooltip content={<CustomTooltip />} />
                
                {showRequested && (
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="requested" 
                    stroke="#2563eb" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorRequested)" 
                    name="Requested"
                  />
                )}

                {showApproved && (
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="approved" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorApproved)" 
                    name="Approved"
                  />
                )}

                {showAverage && (
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="average" 
                    stroke="#8b5cf6" 
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#8b5cf6", strokeWidth: 1 }}
                    activeDot={{ r: 6 }}
                    name="Average Size"
                  />
                )}

                {showCount && (
                  <Bar 
                    yAxisId="right"
                    dataKey="count" 
                    fill="#f97316" 
                    radius={[4, 4, 0, 0]}
                    maxBarSize={30}
                    opacity={0.45}
                    name="Submissions"
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        {hasAuditTrail && (
          <div className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm">
            <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" />
                <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Trail</h2>
              </div>
              <div className="flex items-center gap-3">
                <span className="hidden md:inline text-[8px] md:text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">LIVE</span>
                <button 
                  onClick={() => printSystemLogs(systemLogs, "System Audit Ledger", currentUser)}
                  className="flex items-center gap-1.5 text-[8px] md:text-[10px] text-slate-500 font-black uppercase tracking-widest hover:text-primary transition-all group"
                >
                  <Printer size={12} className="group-hover:scale-110 transition-transform" />
                  Print Logs
                </button>
                <button className="text-[8px] md:text-[10px] text-primary font-black uppercase tracking-widest hover:underline transition-all">
                  View All
                </button>
              </div>
            </div>
            <div className="p-2 md:p-4 space-y-2 md:space-y-4 flex-1 overflow-y-auto max-h-[280px] scrollbar-hide">
              {combinedTimeline.length > 0 ? (
                combinedTimeline.map((item, idx) => {
                  const associatedRequisition = findRequisitionForLog(item.message);
                  
                  return (
                    <div 
                      key={item.id || idx} 
                      onClick={() => {
                        if (associatedRequisition) {
                          setSelectedRequisition(associatedRequisition);
                        }
                      }}
                      className={cn(
                        "relative pl-6 pb-3 md:pb-4 border-l-2 border-slate-100 last:pb-0 group transition-colors",
                        associatedRequisition ? "hover:bg-slate-50 cursor-pointer p-1.5 -ml-1.5 rounded-r-xl" : ""
                      )}
                    >
                      <div className={cn(
                        "absolute left-[-5px] top-1.5 md:top-2 w-2 h-2 rounded-full border border-white ring-4 ring-white",
                        item.type === "ALERT" 
                          ? (item.severity === "HIGH" ? "bg-rose-500" : "bg-amber-500")
                          : (item.action?.includes("CREATE") ? "bg-blue-500" : item.action?.includes("APPROVE") ? "bg-emerald-500" : "bg-slate-400")
                      )} />
                      
                      <p className="text-[10px] md:text-[11px] font-bold text-slate-800 leading-snug group-hover:text-indigo-950 transition-colors">
                        {item.message}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-0.5 md:mt-1">
                        <span className="text-[8px] md:text-[9px] text-slate-400 font-mono uppercase">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className={cn(
                          "px-1 py-0.5 rounded text-[7px] md:text-[8px] font-black tracking-widest uppercase border",
                          item.type === "ALERT" ? "bg-rose-50/50 text-rose-600 border-rose-100" : "bg-slate-50 text-slate-500 border-slate-200"
                        )}>
                          {item.type === "ALERT" ? `Alert (${item.severity})` : item.action?.replace(/_/g, " ") || "AUDIT"}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                  <Activity size={24} />
                  <p className="text-[8px] font-bold uppercase tracking-widest mt-2">No activity logs</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Group Requests Breakdown Ledger & Dashboard Pie Chart Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table representation (Ministry Group Requests) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between font-sans">
            <div>
              <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
                <Users size={16} className="text-indigo-600" />
                Ministry Group Requests
              </h2>
              <p className="text-[8px] md:text-[10px] text-slate-400 mt-0.5 uppercase font-mono">Consolidated Financial Exposure</p>
            </div>
            <span className="text-[8px] md:text-[10px] font-mono text-slate-400">TOTAL: {requestedPerGroup.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-sans">
              <thead>
                <tr className="bg-slate-50/30">
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministry Group</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Transactions</th>
                  <th className="hidden sm:table-cell px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Pend</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-[7px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Sum (Ksh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requestedPerGroup.map((val, i) => (
                  <tr 
                    key={i} 
                    onClick={() => setSelectedGroupDetails(val)}
                    className="hover:bg-indigo-50/20 transition-all cursor-pointer group"
                  >
                    <td className="px-3 md:px-6 py-2.5 md:py-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-800 text-[11px] md:text-sm uppercase group-hover:text-indigo-600 transition-colors truncate max-w-[100px] md:max-w-none">{val.groupName}</span>
                      </div>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-center">
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[9px] md:text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                        {val.count}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-center">
                      <span className={cn(
                        "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] md:text-[11px] font-mono font-bold",
                        val.pendingCount > 0 ? "bg-amber-50 text-amber-600" : "bg-slate-50 text-slate-400"
                      )}>
                        {val.pendingCount}
                      </span>
                    </td>
                    <td className="px-3 md:px-6 py-2.5 md:py-4 text-right font-mono font-black text-slate-900 text-[11px] md:text-sm">
                      {formatCurrency(val.totalAmount)}
                    </td>
                  </tr>
                ))}
                {requestedPerGroup.length > 0 && (
                  <tr className="bg-slate-50 border-t border-slate-200 font-bold">
                    <td className="px-4 md:px-6 py-3 md:py-4 text-[10px] md:text-xs font-black uppercase text-slate-800">
                      Grand Total
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-center font-mono text-[10px] md:text-xs text-slate-500">
                      {requestedPerGroup.reduce((acc, x) => acc + x.count, 0)}
                    </td>
                    <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4 text-center font-mono text-[10px] md:text-xs text-slate-500">
                      {requestedPerGroup.reduce((acc, x) => acc + x.pendingCount, 0)}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right font-mono text-xs md:text-sm text-primary">
                      {formatCurrency(requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0))}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Visual value distribution chart */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col font-sans">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
              <TrendingUp size={16} className="text-primary" />
              Allocation Breakdown
            </h2>
            <span className="text-[8px] md:text-[10px] font-black bg-primary/10 text-primary px-2.5 py-0.5 rounded-full uppercase tracking-widest">Share %</span>
          </div>

          <div className="p-4 flex flex-col items-center justify-center flex-1 space-y-4">
            {requestedPerGroup.length > 0 ? (
              <>
                <div className="w-full h-[185px] relative flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <PieChart>
                      <Pie
                        data={requestedPerGroup}
                        nameKey="groupName"
                        dataKey="totalAmount"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={3}
                      >
                        {requestedPerGroup.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<PieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Center metrics summary overlay */}
                  <div className="absolute text-center flex flex-col items-center pointer-events-none">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Gross value</span>
                    <span className="text-sm font-black text-slate-900 font-mono mt-0.5">
                      Ksh {(requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0) / 1000).toFixed(0)}k
                    </span>
                  </div>
                </div>

                {/* Highly readable color-coded descriptive legends */}
                <div className="w-full space-y-1 overflow-y-auto max-h-[155px] pr-1">
                  {(() => {
                    const totalVal = requestedPerGroup.reduce((acc, x) => acc + x.totalAmount, 0);
                    return requestedPerGroup.map((g, idx) => {
                      const color = PIE_COLORS[idx % PIE_COLORS.length];
                      const pct = totalVal > 0 ? ((g.totalAmount / totalVal) * 100).toFixed(1) : "0";
                      return (
                        <div 
                          key={g.groupId} 
                          onClick={() => setSelectedGroupDetails(g)}
                          className="flex items-center justify-between text-[11px] p-2 hover:bg-slate-50 rounded-xl transition-all cursor-pointer group/item"
                        >
                          <div className="flex items-center gap-2 truncate max-w-[65%]">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                            <span className="font-bold text-slate-700 uppercase tracking-tight truncate group-hover/item:text-primary transition-colors text-[10px]">
                              {g.groupName}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-[10px] font-bold text-slate-800 shrink-0">
                            <span>{pct}%</span>
                            <span className="text-slate-400">|</span>
                            <span>Ksh {g.totalAmount.toLocaleString()}</span>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            ) : (
              <div className="h-[200px] flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                <TrendingUp size={30} />
                <p className="text-[8px] font-bold uppercase tracking-widest mt-2">No allocation available</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Transaction Summary Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Recent Ledger Events</h2>
          <span className="text-[10px] font-mono text-slate-400">LAST_UPDATE: {new Date().toLocaleTimeString()}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/30">
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Entity</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Affiliation</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Allocated Value</th>
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentRequisitions.map((req, i) => (
                <motion.tr 
                  key={req.id} 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedRequisition(req)}
                  className="hover:bg-indigo-50/20 active:bg-indigo-50/40 transition-all cursor-pointer group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5 flex-wrap">
                          <span>{req.title}</span>
                          {req.status !== RequisitionStatus.DISBURSED && (
                            <span className="text-[8px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              {getDaysSinceSubmission(req.submittedAt)}d
                            </span>
                          )}
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={11} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                          {req.inProcurement && (
                            <span className="text-[8px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              PROCUREMENT
                            </span>
                          )}
                          {req.requiresMoreInfo && (
                            <span className="text-[8px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded uppercase tracking-tight">
                              INFO REQ
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">#{req.id.slice(-8).toUpperCase()}</div>
                      </div>
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 opacity-0 group-hover:opacity-100 px-2 py-0.5 rounded font-black tracking-widest uppercase transition-all">
                        INSPECT
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-bold px-2 py-1 bg-slate-100 text-slate-600 rounded uppercase tracking-wider">
                      {req.groupName}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-slate-900">{formatCurrency(req.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-[9px] font-black tracking-widest uppercase",
                      req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600" :
                      req.status === RequisitionStatus.SUBMITTED ? "bg-amber-50 text-amber-600" :
                      req.status === RequisitionStatus.REJECTED ? "bg-rose-50 text-rose-600" :
                      "bg-slate-100 text-slate-500"
                    )}>
                      {req.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Requisition Detail View Modal */}
      <AnimatePresence>
        {selectedRequisition && (
          <RequisitionDetailModal 
            req={selectedRequisition} 
            onClose={() => setSelectedRequisition(null)} 
            onDelete={() => {
              deleteRequisition(selectedRequisition.id);
              setSelectedRequisition(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(selectedRequisition);
            }}
          />
        )}
      </AnimatePresence>

      {/* Receipt Generator Modal */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>

      {/* Ministry Group requests detailed list Modal */}
      <AnimatePresence>
        {selectedGroupDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[85vh]"
            >
              <div className="px-8 py-6 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-600 shadow-sm">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-wider">{selectedGroupDetails.groupName}</h3>
                    <p className="text-xs font-mono text-slate-400 uppercase tracking-widest mt-0.5">Consolidated Group Account Transactions Ledger</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedGroupDetails(null)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
                >
                  <X size={20} className="text-slate-500" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto space-y-6 flex-1">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total requests</span>
                    <p className="text-lg md:text-2xl font-bold text-slate-950 font-mono mt-1">{selectedGroupDetails.count}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Pending</span>
                    <p className="text-lg md:text-2xl font-bold text-amber-600 font-mono mt-1">{selectedGroupDetails.pendingCount}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disbursed</span>
                    <p className="text-lg md:text-2xl font-bold text-emerald-600 font-mono mt-1">{formatCurrency(selectedGroupDetails.disbursedAmount)}</p>
                  </div>
                  <div className="bg-slate-50 p-3 md:p-4 rounded-2xl border border-slate-100">
                    <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Exposure</span>
                    <p className="text-lg md:text-2xl font-bold text-indigo-600 font-mono mt-1">{formatCurrency(selectedGroupDetails.totalAmount)}</p>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Individual Requisition List</span>
                    <span className="text-[10px] font-mono text-slate-400">COUNT: {selectedGroupDetails.requisitions.length} ENTRIES</span>
                  </div>
                  <div className="overflow-x-auto max-h-[40vh]">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50/55 border-b border-slate-100">
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Title / Narratives</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Submitted Date</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Digital Status</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Fund Value (KES)</th>
                          <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Inspect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedGroupDetails.requisitions.map((req: Requisition, idx: number) => (
                          <tr 
                            key={req.id} 
                            onClick={(e) => {
                              setSelectedRequisition(req);
                            }}
                            className="hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                          >
                            <td className="px-6 py-4 font-mono text-xs text-slate-500 font-bold uppercase">
                              #{req.id.substr(0, 8).toUpperCase()}
                            </td>
                            <td className="px-6 py-4 border-slate-100">
                              <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                                <span>{req.title}</span>
                                {req.flaggedForAudit && (
                                  <span title="Flagged for Audit" className="inline-flex shrink-0">
                                    <Flag size={11} className="text-rose-500 fill-rose-500" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 truncate max-w-sm mt-0.5">{req.description}</div>
                            </td>
                            <td className="px-6 py-4 text-xs text-slate-500 font-medium font-mono">
                              {new Date(req.submittedAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={cn(
                                "inline-flex px-2 py-0.5 rounded-full text-[9px] font-black tracking-widest uppercase",
                                req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                                req.status === RequisitionStatus.SUBMITTED ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                req.status === RequisitionStatus.REJECTED ? "bg-rose-50 text-rose-600 border border-rose-100" :
                                "bg-slate-100 text-slate-500 border border-slate-200"
                              )}>
                                {req.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-slate-900 text-xs">
                              {formatCurrency(req.amount)}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className="inline-flex px-2.5 py-1.5 bg-slate-50 text-slate-500 border border-slate-200 group-hover:border-indigo-500 group-hover:text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all items-center gap-1 mx-auto font-sans">
                                <Eye size={11} strokeWidth={2.5} />
                                VIEW
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="px-8 py-5 border-t border-slate-100 bg-white flex justify-end">
                <button 
                  onClick={() => setSelectedGroupDetails(null)}
                  className="px-8 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer font-sans"
                >
                  DISMISS VIEW
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isSupplementaryModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className="px-6 py-4.5 border-b border-rose-100 bg-amber-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-amber-900 uppercase tracking-[0.2em] flex items-center gap-1.5">
                    <TrendingUp size={16} className="text-amber-600" />
                    Apply for Supplementary Budget
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono tracking-wide mt-1">SYS_LEDGER_INCREASE_V1</p>
                </div>
                <button 
                  onClick={() => setIsSupplementaryModalOpen(false)}
                  className="p-2 hover:bg-slate-200/50 rounded-full transition-colors cursor-pointer"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh] space-y-6">
                {supError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 items-center text-xs text-rose-600 font-bold">
                    <AlertTriangle size={14} className="shrink-0" />
                    <span>{supError}</span>
                  </div>
                )}
                {supSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-center text-xs text-emerald-600 font-bold">
                    <CheckCircle size={14} className="shrink-0" />
                    <span>{supSuccess}</span>
                  </div>
                )}

                <form 
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!supProjectId) {
                      setSupError("Please select a target allocation project");
                      return;
                    }
                    const amt = Number(supAmount);
                    if (isNaN(amt) || amt <= 0) {
                      setSupError("Please specify a positive supplementary budget amount");
                      return;
                    }
                    if (!supJustification.trim()) {
                      setSupError("Please provide a business justification for this supplement");
                      return;
                    }

                    setSupSubmitting(true);
                    setSupError(null);
                    setSupSuccess(null);
                    try {
                      await applySupplementaryBudget(supProjectId, amt, supJustification.trim());
                      setSupSuccess("Supplementary budget request logged and transmitted to the oversight board successfully.");
                      setSupAmount("");
                      setSupJustification("");
                      setSupProjectId("");
                    } catch (err: any) {
                      setSupError(err?.message || "Failed to submit request.");
                    } finally {
                      setSupSubmitting(false);
                    }
                  }} 
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Target Project Allocation</label>
                    <select
                      required
                      value={supProjectId}
                      onChange={(e) => setSupProjectId(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all cursor-pointer"
                    >
                      <option value="">SELECT TARGET LEDGER PROJECT</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name.toUpperCase()} (Allocated: KES {p.allocatedBudget.toLocaleString()} / Spent: KES {p.spentAmount.toLocaleString()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Required Supplementary Amount (KES)</label>
                    <input 
                      type="number"
                      required
                      min={1}
                      placeholder="e.g. 150000"
                      value={supAmount}
                      onChange={(e) => setSupAmount(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm font-semibold outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detailed Justification & Purpose</label>
                    <textarea 
                      required
                      rows={3}
                      placeholder="Provide high-integrity justification details. Highlight emergency expenditures, scope expansions, or unforeseen logistics."
                      value={supJustification}
                      onChange={(e) => setSupJustification(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs md:text-sm outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/40 transition-all font-medium resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    disabled={supSubmitting}
                    className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {supSubmitting ? "TRANSMITTING LEDGER REQUEST..." : "SUBMIT SUPPLEMENTARY APPLICATION"}
                  </button>
                </form>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Recent Applications Status Feed</h4>
                  
                  {supplementaryRequests.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-400 font-medium font-sans">No previous supplementary requests registered in ledger.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                      {supplementaryRequests.map((req) => (
                        <div key={req.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">{req.projectName}</span>
                              <span className="text-[8px] font-mono text-slate-300">#{req.id}</span>
                            </div>
                            <p className="text-[10.5px] text-slate-400 font-medium italic truncate max-w-sm">"{req.justification}"</p>
                            <p className="text-[8px] text-slate-400 font-mono">{new Date(req.submittedAt).toLocaleString()} • {req.requesterName}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                            <span className="text-[10.5px] font-bold text-slate-800 font-mono">KES {req.amount.toLocaleString()}</span>
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider",
                              req.status === "APPROVED" ? "bg-emerald-50 text-emerald-600 border border-emerald-100" :
                              req.status === "REJECTED" ? "bg-rose-50 text-rose-600 border border-rose-100" :
                              "bg-amber-50 text-amber-600 border border-amber-100"
                            )}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
