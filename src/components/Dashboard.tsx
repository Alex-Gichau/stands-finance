/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { AlertTriangle, TrendingUp, Layout, Activity, ClipboardList, CheckCircle, Wallet, Users, X, Eye, Repeat, Clock, ArrowUpRight, Search, Trash2, Printer, FileText, ShieldCheck, CalendarRange } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RequisitionDetailModal } from "./RequisitionsPanel";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";

const Dashboard: React.FC = () => {
  const { requisitions, projects, alerts, currentUser, seedAllEcosystemData, deleteRequisition, systemLogs } = useRequisitions();

  const [seeding, setSeeding] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [selectedGroupDetails, setSelectedGroupDetails] = useState<any | null>(null);

  const [velocityTimeframe, setVelocityTimeframe] = useState<"DAILY" | "MONTHLY" | "ANNUAL">("DAILY");

  const dailyData = useMemo(() => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const sumByDay: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
    
    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const dayName = days[d.getDay()];
        if (dayName) {
          sumByDay[dayName] += req.amount;
        }
      }
    });

    const baseline: Record<string, number> = { Mon: 30000, Tue: 45000, Wed: 60000, Thu: 35000, Fri: 80000, Sat: 25000, Sun: 15000 };
    
    return days.map(day => ({
      name: day,
      value: sumByDay[day] > 0 ? sumByDay[day] : baseline[day]
    }));
  }, [requisitions]);

  const monthlyData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const sumByMonth: Record<string, number> = {};
    months.forEach(m => { sumByMonth[m] = 0; });

    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const monthName = months[d.getMonth()];
        if (monthName) {
          sumByMonth[monthName] += req.amount;
        }
      }
    });

    const baseline: Record<string, number> = {
      Jan: 120000, Feb: 150000, Mar: 180000, Apr: 210000, May: 280000, Jun: 240000,
      Jul: 290000, Aug: 310500, Sep: 340000, Oct: 380000, Nov: 420000, Dec: 550000
    };

    return months.map(m => ({
      name: m,
      value: sumByMonth[m] > 0 ? sumByMonth[m] : baseline[m]
    }));
  }, [requisitions]);

  const annualData = useMemo(() => {
    const years = ["2024", "2025", "2026", "2027"];
    const sumByYear: Record<string, number> = {};
    years.forEach(y => { sumByYear[y] = 0; });

    requisitions.forEach(req => {
      const dateStr = req.submittedAt || req.updatedAt;
      if (dateStr) {
        const d = new Date(dateStr);
        const yStr = d.getFullYear().toString();
        if (years.includes(yStr)) {
          sumByYear[yStr] += req.amount;
        }
      }
    });

    const baseline: Record<string, number> = {
      "2024": 1200000,
      "2025": 2400000,
      "2026": 4800000,
      "2027": 620000
    };

    return years.map(y => ({
      name: y,
      value: sumByYear[y] > 0 ? sumByYear[y] : baseline[y]
    }));
  }, [requisitions]);

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
    if (a.targetRole && currentUser?.role !== a.targetRole && currentUser?.role !== UserRole.ADMIN) return false;
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

  if (requisitions.length === 0 && currentUser?.role === UserRole.ADMIN) {
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
        <div className="flex items-center gap-2 px-2.5 py-1 md:px-3 md:py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm w-fit">
          <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-600">Ledger Active</span>
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
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Your Ministry Group Ledger</h2>
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
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
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
          <div className="p-2 md:p-6 h-[250px] md:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentVelocityData}>
                <defs>
                   <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e3a8a" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#1e3a8a" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
                  tickFormatter={formatYAxis}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }} 
                  formatter={(value: any) => [`Ksh ${Number(value).toLocaleString()}`, "Amount"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#1e3a8a" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col shadow-sm">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-indigo-600" />
              <h2 className="text-[10px] md:text-xs font-bold text-slate-800 uppercase tracking-widest">Audit Trail</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[8px] md:text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">LIVE</span>
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
      </div>

      {/* Group Request Totals Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
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
          <table className="w-full text-left">
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
                  <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                    <span className="font-mono font-black text-slate-900 text-[11px] md:text-sm">
                      {formatCurrency(val.totalAmount)}
                    </span>
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
                        <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{req.title}</div>
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
                            <td className="px-6 py-4">
                              <div className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">{req.title}</div>
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
      </AnimatePresence>
    </div>
  );
};

export default Dashboard;
