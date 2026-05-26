/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Pencil,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Paperclip,
  Printer,
  Download,
  ArrowUpDown,
  History,
  ShieldCheck,
  CalendarDays,
  MoreVertical,
  Loader2,
  Repeat,
  FileText,
  ChevronDown
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { printRequisitions, downloadRequisitionsHtml, downloadRequisitionsCsv, downloadRequisitionsPdf } from "../utils/exportUtils";
import { NewRequisitionForm } from "./NewRequisitionForm";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { ReceiptGallery } from "./ReceiptGallery";
import { EditRequisitionModal } from "./EditRequisitionModal";

export const RequisitionsPanel: React.FC = () => {
  const { 
    requisitions, 
    deleteRequisition, 
    currentUser, 
    globalSearchTerm, 
    setGlobalSearchTerm,
    searchFilter
  } = useRequisitions();
  const [isAdding, setIsAdding] = useState(false);
  const [viewingReq, setViewingReq] = useState<Requisition | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  
  const [editingReq, setEditingReq] = useState<Requisition | null>(null);
  const [requisitionToDelete, setRequisitionToDelete] = useState<Requisition | null>(null);
  const [now, setNow] = useState(Date.now());

  React.useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const filtered = requisitions.filter(req => {
    const term = globalSearchTerm.toLowerCase();
    
    let matchesSearch = false;
    if (!term) {
      matchesSearch = true;
    } else {
      const inTitle = req.title.toLowerCase().includes(term);
      const inGroup = req.groupName.toLowerCase().includes(term);
      const inRequester = req.requesterName?.toLowerCase().includes(term);
      const inId = req.id.toLowerCase().includes(term);

      if (searchFilter === "ALL") {
        matchesSearch = inTitle || inGroup || inRequester || inId;
      } else if (searchFilter === "TITLE") {
        matchesSearch = inTitle;
      } else if (searchFilter === "GROUP") {
        matchesSearch = inGroup;
      } else if (searchFilter === "REQUESTER") {
        matchesSearch = inRequester;
      }
    }

    const matchesStatus = filterStatus === "ALL" || req.status === filterStatus;
    
    const canSee = currentUser?.role === UserRole.ADMIN || req.groupId === currentUser?.group;
    
    return matchesSearch && matchesStatus && canSee;
  }).sort((a, b) => {
    const timeA = new Date(a.submittedAt || a.updatedAt || 0).getTime();
    const timeB = new Date(b.submittedAt || b.updatedAt || 0).getTime();
    return timeB - timeA;
  });

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case RequisitionStatus.APPROVED_L2: return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case RequisitionStatus.DISBURSED: return "bg-blue-50 text-blue-600 border-blue-100";
      case RequisitionStatus.SUBMITTED: return "bg-amber-50 text-amber-600 border-amber-100";
      case RequisitionStatus.REJECTED: return "bg-rose-50 text-rose-600 border-rose-100";
      default: return "bg-slate-50 text-slate-600 border-slate-100";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Financial Requisitions</h2>
          <p className="text-sm text-slate-500">Master ledger for all ministry group funding requests.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative flex bg-white border border-slate-200 rounded-xl shadow-sm">
             <button 
              onClick={() => printRequisitions(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 border-r border-slate-100 text-slate-600 transition-colors cursor-pointer"
              title="Print Ledger"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors flex items-center gap-1 cursor-pointer"
              title="Download Data"
            >
              <Download size={16} />
              <ChevronDown size={12} className="text-slate-400" />
            </button>

            {showExportDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowExportDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden divide-y divide-slate-100 text-left">
                  <div className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-slate-50">
                    Export Filtered Table ({filtered.length} transactions)
                  </div>
                  <button
                    onClick={() => {
                      downloadRequisitionsPdf(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Download PDF Document
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsCsv(filtered, "Requisitions List Ledger");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-700 hover:bg-slate-50 font-bold transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Download CSV Sheet
                  </button>
                  <button
                    onClick={() => {
                      downloadRequisitionsHtml(filtered, "Requisitions List Ledger", currentUser);
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Download Classic HTML
                  </button>
                </div>
              </>
            )}
          </div>
          
          <button 
            onClick={() => setIsAdding(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={18} />
            NEW REQUISITION
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            className="w-full pl-11 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter size={12} className="text-slate-400" />
            <select 
              className="w-full bg-transparent text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">ALL STATUSES</option>
              {Object.values(RequisitionStatus).map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-4 md:px-6 py-3 md:py-4">ID & Title</th>
                <th className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">Ministry Group</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Amount</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-center">Status</th>
                <th className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">Expiry</th>
                <th className="px-4 md:px-6 py-3 md:py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filtered.map((req, i) => {
                  const isExpired = req.expiresAt && new Date(req.expiresAt) < new Date();
                  const hoursRemaining = req.expiresAt ? (new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60) : null;
                  const isNearingExpiry = !isExpired && hoursRemaining !== null && hoursRemaining <= 24 && hoursRemaining > 0;
                  
                  const updateAge = now - new Date(req.updatedAt).getTime();
                  const isRecentlyApprovedOrDisbursed = (req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED) && updateAge < 8000;

                  return (
                    <motion.tr 
                      key={req.id} 
                      initial={{ opacity: 0 }}
                      animate={{ 
                        opacity: 1,
                        backgroundColor: isRecentlyApprovedOrDisbursed ? "rgba(16, 185, 129, 0.08)" : undefined
                      }}
                      exit={{ opacity: 0 }}
                      onClick={() => setViewingReq(req)}
                      className={cn(
                        "transition-colors group cursor-pointer border-l-2",
                        isRecentlyApprovedOrDisbursed
                          ? "border-l-emerald-500 shadow-[inset_4px_0_0_0_#10b981]" 
                          : isNearingExpiry 
                            ? "bg-amber-50/60 hover:bg-amber-100/60 border-l-amber-500" 
                            : "hover:bg-slate-50/80 border-l-transparent"
                      )}
                    >
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex flex-col min-w-0 max-w-[120px] md:max-w-none">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-[11px] md:text-sm truncate">{req.title}</span>
                            {req.recurrence && req.recurrence !== "NONE" && (
                              <Repeat size={10} className="text-primary animate-pulse shrink-0" />
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                            <span className="text-[7.5px] md:text-[10px] font-mono text-slate-400 uppercase tracking-wider truncate shrink-0">{req.id}</span>
                            <span className="inline-flex items-center px-1.5 py-0.5 bg-slate-100/80 border border-slate-200/50 text-slate-700 rounded-md text-[7.5px] md:text-[9px] font-extrabold uppercase tracking-wider leading-none w-fit">
                              {req.groupName}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="hidden lg:table-cell px-4 md:px-6 py-3 md:py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 text-primary rounded-lg text-[10px] font-bold uppercase tracking-wide">
                          {req.groupName}
                        </span>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-[10px] md:text-sm">{formatCurrency(req.amount)}</span>
                      </td>
                      <td className="px-3 md:px-6 py-2.5 md:py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em] shrink-0",
                            getStatusColor(req.status)
                          )}>
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell px-4 md:px-6 py-3 md:py-4">
                        {req.expiresAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock size={10} className={isExpired ? "text-rose-500" : isNearingExpiry ? "text-amber-600 animate-pulse" : "text-slate-400"} />
                            <span className={cn(
                              "text-[9px] md:text-[10px] font-mono font-bold uppercase tracking-tighter truncate",
                              isExpired ? "text-rose-500" : isNearingExpiry ? "text-amber-650 font-extrabold" : "text-slate-500"
                            )}>
                              {isExpired ? "EXPIRED" : `${Math.ceil(hoursRemaining)}H REM`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingReq(req);
                            }}
                            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all"
                          >
                            <Eye size={16} />
                          </button>
                          {currentUser?.role === UserRole.ADMIN && (
                            <>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingReq(req);
                                }}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-amber-500 transition-all"
                                title="Edit Requisition"
                              >
                                <Pencil size={15} />
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRequisitionToDelete(req);
                                }}
                                className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                                title="Delete Permanently"
                              >
                                <Trash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/50 border-t border-slate-200 font-bold text-slate-800">
                  <td className="px-6 py-4 text-xs font-black uppercase tracking-wider" colSpan={2}>
                    Sum Total of Filtered Requisitions
                  </td>
                  <td className="px-6 py-4 text-right font-mono text-xs text-rose-600 font-extrabold whitespace-nowrap">
                    {formatCurrency(filtered.reduce((sum, r) => sum + r.amount, 0))}
                  </td>
                  <td colSpan={3} className="px-6 py-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    ({filtered.length} requests in view)
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {filtered.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No matching requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Adjust your filters or initiate a new request transaction.</p>
            </div>
          )}
        </div>
      </div>

      {/* Modal for Adding */}
      <AnimatePresence>
        {isAdding && <NewRequisitionForm onClose={() => setIsAdding(false)} />}
      </AnimatePresence>

      {/* Modal for Details */}
      <AnimatePresence>
        {viewingReq && (
          <RequisitionDetailModal 
            req={viewingReq} 
            onClose={() => setViewingReq(null)} 
            onDelete={() => {
              setRequisitionToDelete(viewingReq);
              setViewingReq(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(viewingReq);
            }}
            onEdit={() => {
              setEditingReq(viewingReq);
              setViewingReq(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Modal for Editing */}
      <AnimatePresence>
        {editingReq && (
          <EditRequisitionModal 
            req={editingReq} 
            onClose={() => setEditingReq(null)} 
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {requisitionToDelete && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 text-center space-y-6"
            >
              <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
                <AlertTriangle size={24} />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Confirm Deletion</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Are you absolutely sure you want to permanently delete requisition <strong className="text-slate-800 font-bold">{requisitionToDelete.title}</strong>? This action is irreversible and will erase the financial ledger entry.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  type="button"
                  onClick={() => setRequisitionToDelete(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  type="button"
                  onClick={async () => {
                    await deleteRequisition(requisitionToDelete.id);
                    setRequisitionToDelete(null);
                  }}
                  className="flex-1 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all cursor-pointer"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal for Receipt Generator */}
      <AnimatePresence>
        {isGeneratingReceipt && (
          <ReceiptTemplateGenerator 
            req={isGeneratingReceipt} 
            onClose={() => setIsGeneratingReceipt(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export interface DetailModalProps {
  req: Requisition;
  onClose: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
  onEdit?: () => void;
}

export const RequisitionDetailModal: React.FC<DetailModalProps> = ({ req, onClose, onDelete, onGenerateReceipt, onEdit }) => {
  const { currentUser, updateRequisitionStatus } = useRequisitions();
  const [decisionNote, setDecisionNote] = useState("");
  const [approvalCode, setApprovalCode] = useState("");
  const [showDecisionForm, setShowDecisionForm] = useState<"APPROVE" | "REJECT" | "ESCALATE" | null>(null);
  const [loading, setLoading] = useState(false);

  const canAct = () => {
    if (!currentUser) return false;
    if (currentUser.role === UserRole.ADMIN) return true;
    if (currentUser.role === UserRole.APPROVER_L1 && req.status === RequisitionStatus.SUBMITTED) return true;
    if (currentUser.role === UserRole.APPROVER_L2 && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    return false;
  };

  const handleDecision = async (decision: "APPROVE" | "REJECT" | "ESCALATE") => {
    setLoading(true);
    try {
      let nextStatus = req.status;
      if (decision === "APPROVE") {
        nextStatus = req.status === RequisitionStatus.SUBMITTED ? RequisitionStatus.APPROVED_L1 : RequisitionStatus.APPROVED_L2;
      } else if (decision === "REJECT") {
        nextStatus = RequisitionStatus.REJECTED;
      } else if (decision === "ESCALATE") {
        nextStatus = RequisitionStatus.ESCALATED;
      }

      await updateRequisitionStatus(
        req.id, 
        nextStatus, 
        decision, 
        decisionNote, 
        "CODE", 
        decision === "REJECT" ? decisionNote : undefined,
        approvalCode
      );
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="px-4 md:px-8 py-4 md:py-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <span className={cn(
              "p-1.5 md:p-2 rounded-xl border",
              req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10"
            )}>
              <ShieldCheck size={18} className="md:w-5 md:h-5" />
            </span>
            <div className="min-w-0">
              <h3 className="text-[12px] md:text-sm font-black text-slate-900 uppercase tracking-[0.1em] truncate">{req.title}</h3>
              <p className="text-[8px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest">{req.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 md:p-2 hover:bg-slate-100 rounded-full transition-colors">
              <XCircle size={18} className="text-slate-500 md:w-5 md:h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Left Content */}
            <div className="lg:col-span-2 p-4 md:p-8 space-y-5 md:space-y-8 border-b lg:border-b-0 lg:border-r border-slate-100">
              <section className="space-y-3 md:space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em]">Contextual Data</h4>
                </div>
                <div className="bg-slate-50 rounded-xl md:rounded-2xl p-3 md:p-6 border border-slate-100 space-y-4 text-[10px] md:text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {req.description}
                </div>
              </section>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8">
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Breakdown</h4>
                  <div className="space-y-1">
                    <p className="text-xl md:text-2xl font-bold text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                    <p className="text-[9px] md:text-[11px] text-slate-500 italic font-medium">{req.amountWords}</p>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction Ownership</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs md:text-base shrink-0">
                      {req.requesterName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-bold text-slate-900 truncate">{req.requesterName}</p>
                      <p className="text-[8px] md:text-[10px] text-slate-500 uppercase tracking-wider truncate">{req.groupName}</p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="space-y-3 md:space-y-4">
                <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Evidence</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 mb-4">
                   {req.attachments?.map((attachment, i) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-primary/40 transition-all cursor-pointer group">
                      <div className="p-1.5 bg-slate-50 rounded-lg text-slate-400 group-hover:text-primary transition-colors">
                        <Paperclip size={12} />
                      </div>
                      <span className="text-[10px] md:text-xs font-medium text-slate-700 truncate">{attachment}</span>
                    </div>
                  ))}
                  {(!req.attachments || req.attachments.length === 0) && (
                    <div className="col-span-1 md:col-span-2 py-4 flex flex-col items-center justify-center text-slate-300 border border-dashed border-slate-200 rounded-2xl">
                      <p className="text-[9px] font-black uppercase tracking-widest">No Documents Linked</p>
                    </div>
                  )}
                </div>

                {/* Receipt Gallery Integration */}
                {req.receipts && req.receipts.length > 0 && (
                  <div className="pt-4 border-t border-slate-100">
                    <ReceiptGallery receipts={req.receipts} />
                  </div>
                )}
              </section>

              {/* Decision Form integration */}
              {showDecisionForm && (
                <motion.div 
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className={cn(
                    "p-4 md:p-6 rounded-2xl border bg-slate-50",
                    showDecisionForm === "APPROVE" ? "border-emerald-100" : showDecisionForm === "REJECT" ? "border-rose-100" : "border-amber-100"
                  )}
                >
                  <h4 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                    {showDecisionForm === "APPROVE" ? "Authorize Ledger Transaction" : showDecisionForm === "REJECT" ? "Reject Transaction" : "Escalate Transaction"}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Decision Note / Reason</label>
                      <textarea 
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="input-field bg-white text-xs"
                        placeholder="Provide reasoning..."
                        rows={3}
                      />
                    </div>
                    {showDecisionForm === "APPROVE" && (
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Security Code</label>
                        <input 
                          type="password"
                          value={approvalCode}
                          onChange={(e) => setApprovalCode(e.target.value)}
                          className="input-field bg-white font-mono text-xs"
                          placeholder="••••••"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                       <button 
                        onClick={() => setShowDecisionForm(null)}
                        className="px-4 md:px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button 
                        disabled={loading || (showDecisionForm === "APPROVE" && !approvalCode) || (showDecisionForm === "REJECT" && !decisionNote.trim())}
                        onClick={() => handleDecision(showDecisionForm)}
                        className={cn(
                          "btn-primary px-5 md:px-8 flex items-center gap-2",
                          showDecisionForm === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : 
                          showDecisionForm === "ESCALATE" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : ""
                        )}
                      >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : null}
                        <span className="text-[10px] md:text-xs">CONFIRM</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar - History & Status */}
            <div className="bg-slate-50/50 p-6 md:p-8 space-y-6 md:space-y-8 h-full">
              <section className="space-y-4">
                <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Audit Trail</h4>
                <div className="space-y-5 md:space-y-6 relative ml-1">
                  <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200" />
                  
                  {/* Creation Transaction */}
                  <div className="relative pl-7 md:pl-8">
                    <div className="absolute left-0 top-1.5 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full bg-slate-200 border-2 border-white ring-4 ring-slate-50/50" />
                    <p className="text-[9px] md:text-[10px] font-serif text-slate-400 mb-0.5 md:mb-1">{formatDate(req.submittedAt)}</p>
                    <p className="text-[10px] md:text-[11px] font-bold text-slate-900 leading-tight">Ledger Transaction Initialized</p>
                    <p className="text-[8px] md:text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Requester: {req.requesterName}</p>
                  </div>

                  {/* History Transactions */}
                  {req.approvalHistory.map((note, i) => (
                    <div key={i} className="relative pl-7 md:pl-8">
                       <div className={cn(
                        "absolute left-0 top-1.5 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white ring-4 ring-slate-50/50",
                        note.decision === "APPROVE" ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <p className="text-[9px] md:text-[10px] font-serif text-slate-400 mb-0.5 md:mb-1">{formatDate(note.timestamp)}</p>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-[10px] md:text-[11px] font-bold text-slate-900 leading-tight">
                          {note.decision === "APPROVE" ? "Authorized" : "Rejected"}
                        </p>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-sm text-[7px] md:text-[8px] font-black uppercase tracking-widest",
                          note.decision === "APPROVE" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {note.role.split('_').pop()}
                        </span>
                      </div>
                      <p className="text-[10px] md:text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200 leading-relaxed shadow-sm">
                        "{note.note || note.rejectionReason}"
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-6 md:pt-8 border-t border-slate-200/60 space-y-4">
                 <h4 className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</h4>
                 <div className="space-y-3 md:space-y-4">
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><CalendarDays size={13} /> Submitted</span>
                      <span className="font-bold text-slate-700">{formatDate(req.submittedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] md:text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><Clock size={13} /> Expiry</span>
                      <span className="font-bold text-rose-500">{req.expiresAt ? formatDate(req.expiresAt) : "N/A"}</span>
                    </div>
                    {req.recurrence && req.recurrence !== "NONE" && (
                      <div className="flex items-center justify-between text-[10px] md:text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5"><Repeat size={13} /> Recurrence</span>
                        <span className="font-black text-primary uppercase tracking-widest">{req.recurrence}</span>
                      </div>
                    )}
                 </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-8 py-3 md:py-6 border-t border-slate-100 bg-white flex flex-col md:flex-row gap-3 md:gap-4 justify-between items-center">
          <div className="flex items-center gap-2 w-full md:w-auto justify-center md:justify-start">
            <button 
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all border border-slate-100 md:border-0"
              title="Delete Document"
            >
              <Trash2 size={16} />
            </button>
            {currentUser?.role === UserRole.ADMIN && onEdit && (
              <button 
                onClick={onEdit}
                className="p-2.5 hover:bg-amber-50 text-slate-400 hover:text-amber-500 rounded-xl transition-all border border-slate-100 md:border-0"
                title="Edit Requisition details"
              >
                <Pencil size={16} />
              </button>
            )}
            <button 
              onClick={onGenerateReceipt}
              className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-primary rounded-xl transition-all border border-slate-100 md:border-0" 
              title="Generate Receipt Template"
            >
              <FileText size={16} />
            </button>
            <button className="p-2.5 hover:bg-slate-100 text-slate-400 rounded-xl transition-all border border-slate-100 md:border-0" title="Print Details">
              <Printer size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
             <button 
              onClick={onClose}
              className="flex-1 md:flex-none px-4 md:px-8 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-[9px] md:text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer uppercase tracking-widest"
            >
              EXIT
            </button>
            
            {!showDecisionForm && canAct() && (
              <div className="flex flex-1 md:flex-none items-center gap-1.5 md:gap-2">
                <button 
                  onClick={() => setShowDecisionForm("REJECT")}
                  className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-[9px] md:text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer uppercase tracking-widest"
                >
                  REJECT
                </button>
                {req.status === RequisitionStatus.SUBMITTED && (
                  <>
                    <button 
                      onClick={() => setShowDecisionForm("ESCALATE")}
                      className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-[9px] md:text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer uppercase tracking-widest"
                    >
                      ESCALATE
                    </button>
                    <button 
                      onClick={() => setShowDecisionForm("APPROVE")}
                      className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100"
                    >
                      APPROVE
                    </button>
                  </>
                )}
                {(req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED) && (
                   <button 
                     onClick={() => setShowDecisionForm("APPROVE")}
                     className="flex-1 md:flex-none px-3 md:px-6 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100"
                   >
                     APPROVE L2
                   </button>
                )}
              </div>
            )}

            {req.status === RequisitionStatus.APPROVED_L2 && (
               <button className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-[9px] md:text-xs font-bold hover:bg-emerald-700 transition-all cursor-pointer uppercase tracking-widest shadow-lg shadow-emerald-100">
                DISBURSE FUNDS
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
