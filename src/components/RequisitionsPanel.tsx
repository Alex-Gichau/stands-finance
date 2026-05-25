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
  FileText
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { printRequisitions, downloadRequisitionsHtml } from "../utils/exportUtils";
import { NewRequisitionForm } from "./NewRequisitionForm";
import { ReceiptTemplateGenerator } from "./ReceiptTemplateGenerator";
import { ReceiptGallery } from "./ReceiptGallery";

export const RequisitionsPanel: React.FC = () => {
  const { requisitions, deleteRequisition, currentUser, globalSearchTerm, setGlobalSearchTerm } = useRequisitions();
  const [isAdding, setIsAdding] = useState(false);
  const [viewingReq, setViewingReq] = useState<Requisition | null>(null);
  const [isGeneratingReceipt, setIsGeneratingReceipt] = useState<Requisition | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filtered = requisitions.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(globalSearchTerm.toLowerCase()) || 
                          req.groupName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                          req.id.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                          (req.recurrence && req.recurrence.toLowerCase().includes(globalSearchTerm.toLowerCase()));
    const matchesStatus = filterStatus === "ALL" || req.status === filterStatus;
    
    const canSee = currentUser?.role === UserRole.ADMIN || req.groupId === currentUser?.group;
    
    return matchesSearch && matchesStatus && canSee;
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
          <div className="flex bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
             <button 
              onClick={() => printRequisitions(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 border-r border-slate-100 text-slate-600 transition-colors"
              title="Print Ledger"
            >
              <Printer size={16} />
            </button>
            <button 
              onClick={() => downloadRequisitionsHtml(filtered, "Requisition Ledger", currentUser)}
              className="p-2.5 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Export CSV"
            >
              <Download size={16} />
            </button>
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
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by ID, title, or ministry group..." 
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
            value={globalSearchTerm}
            onChange={(e) => setGlobalSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select 
              className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
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
              <tr className="bg-slate-50/50 border-b border-slate-200">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">ID & Title</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ministry Group</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Amount (Ksh)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Expiry</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filtered.map((req, i) => {
                  const isExpired = req.expiresAt && new Date(req.expiresAt) < new Date();
                  return (
                    <motion.tr 
                      key={req.id} 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => setViewingReq(req)}
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm">{req.title}</span>
                            {req.recurrence && req.recurrence !== "NONE" && (
                              <Repeat size={10} className="text-primary animate-pulse" />
                            )}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">{req.id}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-primary/5 text-primary rounded-lg text-[10px] font-bold uppercase tracking-wide">
                          {req.groupName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-mono font-bold text-slate-900 text-sm">{formatCurrency(req.amount)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.15em]",
                            getStatusColor(req.status)
                          )}>
                            {req.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {req.expiresAt ? (
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className={isExpired ? "text-rose-500" : "text-slate-400"} />
                            <span className={cn(
                              "text-[10px] font-mono font-bold uppercase tracking-tighter",
                              isExpired ? "text-rose-500" : "text-slate-500"
                            )}>
                              {isExpired ? "EXPIRED" : `${Math.ceil((new Date(req.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60))}H REM`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-primary transition-all">
                            <Eye size={16} />
                          </button>
                          {currentUser?.role === UserRole.ADMIN && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteRequisition(req.id);
                              }}
                              className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 text-slate-400 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="py-24 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <Search size={24} className="text-slate-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-widest">No matching requisitions</h3>
              <p className="text-xs text-slate-400 mt-2">Adjust your filters or initiate a new request node.</p>
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
              deleteRequisition(viewingReq.id);
              setViewingReq(null);
            }}
            onGenerateReceipt={() => {
              setIsGeneratingReceipt(viewingReq);
            }}
          />
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

interface DetailModalProps {
  req: Requisition;
  onClose: () => void;
  onDelete: () => void;
  onGenerateReceipt: () => void;
}

const RequisitionDetailModal: React.FC<DetailModalProps> = ({ req, onClose, onDelete, onGenerateReceipt }) => {
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
        <div className="px-8 py-5 border-b border-slate-200 bg-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className={cn(
              "p-2 rounded-xl border",
              req.status === RequisitionStatus.APPROVED_L2 ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-primary/5 text-primary border-primary/10"
            )}>
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.1em]">{req.title}</h3>
              <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{req.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
              <XCircle size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* Left Content */}
            <div className="lg:col-span-2 p-8 space-y-8 border-r border-slate-100">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Contextual Data</h4>
                </div>
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4 text-slate-600 text-sm font-medium leading-relaxed whitespace-pre-wrap">
                  {req.description}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-8">
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Financial Breakdown</h4>
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                    <p className="text-[11px] text-slate-500 italic font-medium">{req.amountWords}</p>
                  </div>
                </section>
                <section className="space-y-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Node Ownership</h4>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                      {req.requesterName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900">{req.requesterName}</p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">{req.groupName}</p>
                    </div>
                  </div>
                </section>
              </div>

              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Verification Evidence</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                   {req.attachments?.map((attachment, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl hover:border-primary/40 transition-all cursor-pointer group">
                      <div className="p-2 bg-slate-50 rounded-lg text-slate-400 group-hover:text-primary transition-colors">
                        <Paperclip size={14} />
                      </div>
                      <span className="text-xs font-medium text-slate-700 truncate">{attachment}</span>
                    </div>
                  ))}
                  {(!req.attachments || req.attachments.length === 0) && (
                    <div className="col-span-2 py-4 flex flex-col items-center justify-center text-slate-300 border border-dashed border-slate-200 rounded-2xl">
                      <p className="text-[10px] font-black uppercase tracking-widest">No Documents Linked</p>
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
                    "p-6 rounded-2xl border bg-slate-50",
                    showDecisionForm === "APPROVE" ? "border-emerald-100" : showDecisionForm === "REJECT" ? "border-rose-100" : "border-amber-100"
                  )}
                >
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest mb-4">
                    {showDecisionForm === "APPROVE" ? "Authorize Ledger Node" : showDecisionForm === "REJECT" ? "Reject Node" : "Escalate Node"}
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Decision Note / Reason</label>
                      <textarea 
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        className="input-field bg-white"
                        placeholder="Provide reasoning for your decision..."
                        rows={3}
                      />
                    </div>
                    {showDecisionForm === "APPROVE" && (
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Approver Security Code</label>
                        <input 
                          type="password"
                          value={approvalCode}
                          onChange={(e) => setApprovalCode(e.target.value)}
                          className="input-field bg-white font-mono"
                          placeholder="••••••"
                        />
                      </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                       <button 
                        onClick={() => setShowDecisionForm(null)}
                        className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        CANCEL
                      </button>
                      <button 
                        disabled={loading || (showDecisionForm === "APPROVE" && !approvalCode) || (showDecisionForm === "REJECT" && !decisionNote)}
                        onClick={() => handleDecision(showDecisionForm)}
                        className={cn(
                          "btn-primary px-8 flex items-center gap-2",
                          showDecisionForm === "REJECT" ? "bg-rose-600 hover:bg-rose-700" : 
                          showDecisionForm === "ESCALATE" ? "bg-amber-500 hover:bg-amber-600 shadow-amber-200" : ""
                        )}
                      >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                        CONFIRM {showDecisionForm}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Right Sidebar - History & Status */}
            <div className="bg-slate-50/50 p-8 space-y-8 h-full">
              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Digital Audit Trail</h4>
                <div className="space-y-6 relative ml-1">
                  <div className="absolute left-1.5 top-2 bottom-2 w-0.5 bg-slate-200" />
                  
                  {/* Creation Node */}
                  <div className="relative pl-8">
                    <div className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full bg-slate-200 border-2 border-white ring-4 ring-slate-50/50" />
                    <p className="text-[10px] font-serif text-slate-400 mb-1">{formatDate(req.submittedAt)}</p>
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">Ledger Node Initialized</p>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-tighter">Requester: {req.requesterName}</p>
                  </div>

                  {/* History Nodes */}
                  {req.approvalHistory.map((note, i) => (
                    <div key={i} className="relative pl-8">
                       <div className={cn(
                        "absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 border-white ring-4 ring-slate-50/50",
                        note.decision === "APPROVE" ? "bg-emerald-500" : "bg-rose-500"
                      )} />
                      <p className="text-[10px] font-serif text-slate-400 mb-1">{formatDate(note.timestamp)}</p>
                      <div className="flex items-center gap-1.5 mb-1">
                        <p className="text-[11px] font-bold text-slate-900 leading-tight">
                          {note.decision === "APPROVE" ? "Authorized Signature" : "Rejected from Ledger"}
                        </p>
                        <span className={cn(
                          "px-1.5 py-0.5 rounded-sm text-[8px] font-black uppercase tracking-widest",
                          note.decision === "APPROVE" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                        )}>
                          {note.role.split('_').pop()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded-lg border border-slate-200 leading-relaxed shadow-sm">
                        "{note.note || note.rejectionReason}"
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="pt-8 border-t border-slate-200/60 space-y-4">
                 <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Metadata</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><CalendarDays size={14} /> Submitted</span>
                      <span className="font-bold text-slate-700">{formatDate(req.submittedAt)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-500 flex items-center gap-1.5"><Clock size={14} /> Expiry Target</span>
                      <span className="font-bold text-rose-500">{req.expiresAt ? formatDate(req.expiresAt) : "N/A"}</span>
                    </div>
                    {req.recurrence && req.recurrence !== "NONE" && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500 flex items-center gap-1.5"><Repeat size={14} /> Recurrence</span>
                        <span className="font-black text-primary uppercase tracking-widest">{req.recurrence} CYCLE</span>
                      </div>
                    )}
                 </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-slate-100 bg-white flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="p-2.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-xl transition-all"
              title="Delete Document"
            >
              <Trash2 size={18} />
            </button>
            <button 
              onClick={onGenerateReceipt}
              className="p-2.5 hover:bg-slate-100 text-slate-400 hover:text-primary rounded-xl transition-all" 
              title="Generate Receipt Template"
            >
              <FileText size={18} />
            </button>
            <button className="p-2.5 hover:bg-slate-100 text-slate-400 rounded-xl transition-all" title="Print Details">
              <Printer size={18} />
            </button>
          </div>
          <div className="flex items-center gap-3">
             <button 
              onClick={onClose}
              className="px-8 py-2.5 bg-slate-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-bold hover:bg-slate-100 transition-all cursor-pointer"
            >
              EXIT VIEW
            </button>
            
            {!showDecisionForm && canAct() && (
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowDecisionForm("REJECT")}
                  className="px-6 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                >
                  REJECT
                </button>
                {req.status === RequisitionStatus.SUBMITTED && (
                   <button 
                    onClick={() => setShowDecisionForm("ESCALATE")}
                    className="px-6 py-2.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all cursor-pointer"
                  >
                    ESCALATE
                  </button>
                )}
                <button 
                  onClick={() => setShowDecisionForm("APPROVE")}
                  className="btn-primary"
                >
                  AUTHORIZE APPROVAL
                </button>
              </div>
            )}

            {req.status === RequisitionStatus.APPROVED_L2 && (
               <button className="btn-primary bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200">
                PROCEED TO DISBURSEMENT
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
