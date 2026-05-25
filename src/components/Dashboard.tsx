/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole } from "../types";
import { formatCurrency, cn } from "../lib/utils";
import { AlertTriangle, TrendingUp, Layout, Activity, ClipboardList, CheckCircle, Wallet, Users } from "lucide-react";
import { motion } from "motion/react";

const Dashboard: React.FC = () => {
  const { requisitions, projects, alerts, currentUser, seedAllEcosystemData } = useRequisitions();

  const [seeding, setSeeding] = React.useState(false);

  const recentRequisitions = requisitions.slice(0, 5);
  const activeAlerts = alerts.filter(a => !a.isRead);

  const stats = useMemo(() => {
    const totalValue = requisitions.reduce((acc, r) => acc + r.amount, 0);
    const pending = requisitions.filter(r => r.status === RequisitionStatus.SUBMITTED || r.status === RequisitionStatus.APPROVED_L1).length;
    const approved = requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2 || r.status === RequisitionStatus.DISBURSED).length;
    const disbursed = requisitions.filter(r => r.status === RequisitionStatus.DISBURSED).reduce((acc, r) => acc + r.amount, 0);

    return [
      { label: "Gross Ledger Value", value: formatCurrency(totalValue), icon: Wallet, color: "text-primary", bg: "bg-primary/5" },
      { label: "Pending Approvals", value: `${pending} Nodes`, icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Status Approved", value: `${approved} Nodes`, icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Total Fund Disbursed", value: formatCurrency(disbursed), icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    ];
  }, [requisitions]);

  const userGroupProject = projects.find(p => p.groupId === currentUser?.group);

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Terminal</h1>
          <p className="text-slate-500 text-sm">Welcome, {currentUser?.name} • <span className="font-mono text-[10px] uppercase tracking-widest">{currentUser?.role} Mode</span></p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Ledger Active</span>
        </div>
      </div>

      {/* Top Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group"
          >
            <div className={cn("absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-125 transition-transform duration-500", stat.color)}>
              <stat.icon size={80} />
            </div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">{stat.label}</div>
            <div className="text-2xl font-bold text-slate-900 mb-1">{stat.value}</div>
            <div className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full inline-block", stat.bg, stat.color)}>
              Real-time Sync
            </div>
          </motion.div>
        ))}
      </div>

      {/* Scoped Budget Banner for CHURCH_GROUP */}
      {currentUser?.role === UserRole.CHURCH_GROUP && userGroupProject && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary text-white rounded-2xl p-8 shadow-xl shadow-primary/20 relative overflow-hidden"
        >
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-2">
              <h2 className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Your Ministry Group Ledger</h2>
              <h3 className="text-3xl font-bold">{userGroupProject.name}</h3>
              <p className="opacity-80 text-sm max-w-md">Live fiscal monitoring for your specific project allocation and spend patterns.</p>
            </div>
            <div className="flex-1 max-w-lg space-y-4">
              <div className="flex justify-between items-end mb-1">
                <span className="text-sm font-bold opacity-80 uppercase tracking-wider">Budget Utilization</span>
                <span className="text-2xl font-bold">
                  {((userGroupProject.spentAmount / userGroupProject.allocatedBudget) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-4 bg-white/20 rounded-full overflow-hidden border border-white/10">
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
              <div className="flex justify-between text-xs font-mono opacity-80">
                <span>{formatCurrency(userGroupProject.spentAmount)} SPENT</span>
                <span>{formatCurrency(userGroupProject.allocatedBudget)} ALLOCATED</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Volume Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-primary" />
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Financial Node Velocity</h2>
            </div>
          </div>
          <div className="p-6 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[
                { name: 'Mon', value: 40000 },
                { name: 'Tue', value: 30000 },
                { name: 'Wed', value: 65000 },
                { name: 'Thu', value: 45000 },
                { name: 'Fri', value: 80000 },
                { name: 'Sat', value: 25000 },
                { name: 'Sun', value: 15000 },
              ]}>
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
                  tickFormatter={(val) => `Ksh ${val/1000}k`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid #e2e8f0', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }} 
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
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center gap-2">
            <Activity size={16} className="text-primary" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Digital Audit Log</h2>
          </div>
          <div className="p-4 space-y-4 flex-1 overflow-y-auto max-h-[300px] scrollbar-hide">
            {activeAlerts.length > 0 ? (
              activeAlerts.map((alert) => (
                <div key={alert.id} className="relative pl-6 pb-4 border-l-2 border-slate-100 last:pb-0">
                  <div className={cn(
                    "absolute left-[-9px] top-0 w-4 h-4 rounded-full border-2 border-white",
                    alert.severity === "HIGH" ? "bg-rose-500" : "bg-primary"
                  )} />
                  <p className="text-[11px] font-bold text-slate-800 leading-snug">{alert.message}</p>
                  <p className="text-[9px] text-slate-400 mt-1 uppercase font-mono">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 py-10 opacity-50">
                <Activity size={32} />
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Audit Chamber Silent</p>
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
                <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Node Entity</th>
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
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-800 text-sm">{req.title}</div>
                    <div className="text-[10px] text-slate-400 font-mono">#{req.id.slice(-8).toUpperCase()}</div>
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
    </div>
  );
};

export default Dashboard;
