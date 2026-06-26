/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  Filter, 
  Download, 
  ExternalLink,
  Activity,
  History,
  AlertCircle,
  CheckCircle2,
  Clock,
  Briefcase
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Transaction, TransactionType, TransactionStatus } from "../types";
import { cn } from "../lib/utils";

const TransactionsPanel: React.FC = () => {
  const { transactions, syncingTargets } = useRequisitions();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<TransactionType | "ALL">("ALL");
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | "ALL">("ALL");

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch = 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.externalRef.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.sourceSystem.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = typeFilter === "ALL" || t.type === typeFilter;
      const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
      
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, searchTerm, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().split("T")[0];
    const todays = transactions.filter(t => t.timestamp.startsWith(today));
    
    return {
      totalVolume: transactions.reduce((acc, t) => acc + t.amount, 0),
      todaysCount: todays.length,
      pendingCount: transactions.filter(t => t.status === TransactionStatus.PENDING).length,
      failedCount: transactions.filter(t => t.status === TransactionStatus.FAILED).length,
    };
  }, [transactions]);

  return (
    <div className="flex-1 p-4 md:p-8 bg-slate-50 space-y-8">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: "Total Volume", value: stats.totalVolume, icon: Briefcase, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Incoming Today", value: stats.todaysCount, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Pending Sync", value: stats.pendingCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Anomalies", value: stats.failedCount, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border-2 border-slate-100 p-3 md:p-5 rounded-2xl md:rounded-[2rem] shadow-sm flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-4 text-center md:text-left"
          >
            <div className={cn("p-2 md:p-3 rounded-xl md:rounded-2xl shrink-0", stat.bg)}>
              <stat.icon className={cn("w-4 h-4 md:w-5 md:h-5", stat.color)} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest truncate">{stat.label}</p>
              <p className="text-xs md:text-lg font-bold text-slate-900 truncate">
                {typeof stat.value === "number" && stat.label === "Total Volume" ? `KES ${stat.value.toLocaleString()}` : stat.value}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Main Ledger Section */}
      <div className="bg-white border-2 border-slate-100 rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col min-h-[600px]">
        {/* Controls Toolbar */}
        <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative flex-1 max-w-md group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-600 transition-colors" />
              <input
                type="text"
                placeholder="Find Reference or System..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border-2 border-slate-100 rounded-2xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-50 focus:border-indigo-600 transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-600 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">ALL TYPES</option>
                {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-white border-2 border-slate-100 rounded-2xl px-4 py-2.5 text-[11px] font-bold text-slate-600 focus:outline-none focus:border-indigo-600"
              >
                <option value="ALL">ALL STATUS</option>
                {Object.values(TransactionStatus).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-2xl text-xs font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            <Download size={14} />
            Export Ledger
          </button>
        </div>

        {/* Ledger Table */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/20">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction / Reference</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Source System</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date / Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredTransactions.map((tx) => (
                  <motion.tr
                    key={tx.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="group hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-6 py-5">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900">{tx.description}</span>
                        <span className="text-[10px] font-mono text-slate-400 mt-1 uppercase">REF: {tx.externalRef}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter",
                        tx.type === TransactionType.CREDIT ? "bg-emerald-50 text-emerald-600" :
                        tx.type === TransactionType.DEBIT ? "bg-rose-50 text-rose-600" :
                        "bg-indigo-50 text-indigo-600"
                      )}>
                        {tx.type === TransactionType.CREDIT ? <ArrowDownLeft size={10} /> : <ArrowUpRight size={10} />}
                        {tx.type}
                      </div>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className={cn(
                        "text-sm font-black",
                        tx.type === TransactionType.CREDIT ? "text-emerald-600" : "text-slate-900"
                      )}>
                        {tx.type === TransactionType.CREDIT ? "+" : "-"}KES {tx.amount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center">
                          <ExternalLink size={10} className="text-slate-400" />
                        </div>
                        <span className="text-xs font-bold text-slate-600">{tx.sourceSystem}</span>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex justify-center">
                        {tx.status === TransactionStatus.COMPLETED ? (
                          <div className="flex items-center gap-1.5 text-emerald-600">
                            <CheckCircle2 size={14} />
                            <span className="text-[10px] font-black uppercase">Success</span>
                          </div>
                        ) : tx.status === TransactionStatus.PENDING ? (
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <Clock size={14} />
                            <span className="text-[10px] font-black uppercase">In Progress</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-rose-500">
                            <AlertCircle size={14} />
                            <span className="text-[10px] font-black uppercase">Flagged</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-bold text-slate-900">
                          {new Date(tx.timestamp).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-[10px] font-bold text-slate-400">
                          {new Date(tx.timestamp).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredTransactions.length === 0 && syncingTargets.has("transactions") && (
            <div className="py-8 w-full flex flex-col gap-3 px-6">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="w-full h-[76px] bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {filteredTransactions.length === 0 && !syncingTargets.has("transactions") && (
            <div className="p-20 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-24 h-24 bg-slate-50 rounded-[2.5rem] flex items-center justify-center">
                <History className="w-10 h-10 text-slate-200" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">No matching logs found</h3>
                <p className="text-sm text-slate-500 max-w-xs mx-auto">Try adjusting your filters or search terms to find specific legacy or external ledger entries.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TransactionsPanel;
