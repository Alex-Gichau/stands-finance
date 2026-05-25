/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  ShieldCheck, 
  Fingerprint, 
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  Info,
  Loader2,
  Search,
  XCircle,
  FileText
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export const ApprovalsPanel: React.FC = () => {
  const { requisitions, updateRequisitionStatus, currentUser, globalSearchTerm } = useRequisitions();
  const [selectedReq, setSelectedReq] = useState<Requisition | null>(null);
  const [approvalStep, setApprovalStep] = useState<"DETAILS" | "CODE" | "SUCCESS">("DETAILS");
  const [authCode, setAuthCode] = useState("");
  const [decisionNote, setDecisionNote] = useState("");
  const [loading, setLoading] = useState(false);

  const pendingApprovals = requisitions.filter(req => {
    const matchesSearch = req.title.toLowerCase().includes(globalSearchTerm.toLowerCase()) || 
                          req.groupName.toLowerCase().includes(globalSearchTerm.toLowerCase()) ||
                          req.id.toLowerCase().includes(globalSearchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (currentUser?.role === UserRole.APPROVER_L1) {
      return req.status === RequisitionStatus.SUBMITTED;
    }
    if (currentUser?.role === UserRole.APPROVER_L2) {
      return req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED;
    }
    if (currentUser?.role === UserRole.ADMIN) {
      return [RequisitionStatus.SUBMITTED, RequisitionStatus.APPROVED_L1, RequisitionStatus.ESCALATED].includes(req.status);
    }
    return false;
  });

  const handleApprove = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      const nextStatus = selectedReq.status === RequisitionStatus.SUBMITTED 
        ? RequisitionStatus.APPROVED_L1 
        : RequisitionStatus.APPROVED_L2;
      
      await updateRequisitionStatus(
        selectedReq.id, 
        nextStatus, 
        "APPROVE", 
        decisionNote, 
        "CODE", 
        undefined, 
        authCode
      );
      setApprovalStep("SUCCESS");
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedReq) return;
    setLoading(true);
    try {
      await updateRequisitionStatus(
        selectedReq.id, 
        RequisitionStatus.REJECTED, 
        "REJECT", 
        decisionNote, 
        "CODE", 
        decisionNote
      );
      setSelectedReq(null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Authorization Hub</h2>
          <p className="text-sm text-slate-500">Authenticated verification stream for pending ledger nodes.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="px-4 py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
            <ShieldCheck size={16} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">
              {currentUser?.role === UserRole.APPROVER_L2 ? "L2 KEYMASTER" : currentUser?.role === UserRole.ADMIN ? "GLOBAL ADMIN" : "L1 VERIFIER"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <AnimatePresence mode="popLayout">
          {pendingApprovals.map((req) => (
            <motion.div 
              key={req.id}
              layout
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={() => {
                setSelectedReq(req);
                setApprovalStep("DETAILS");
                setAuthCode("");
                setDecisionNote("");
              }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group flex flex-col md:flex-row overflow-hidden relative"
            >
              <div className={cn(
                "w-1.5 self-stretch shrink-0",
                req.status === RequisitionStatus.SUBMITTED ? "bg-amber-500" : "bg-primary"
              )} />
              
              <div className="flex-1 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-lg tracking-tight group-hover:text-primary transition-colors">{req.title}</h3>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-tighter">#{req.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-xs text-slate-500 line-clamp-1 italic font-medium">"{req.description}"</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 pl-[52px]">
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{Math.ceil((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24))} Days Pending</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-white">
                        {req.requesterName.charAt(0)}
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{req.requesterName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Impact Value</p>
                  <p className="text-2xl font-black text-slate-900 leading-none font-mono tracking-tighter">{formatCurrency(req.amount)}</p>
                  {req.status === RequisitionStatus.APPROVED_L1 && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 text-[9px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={10} /> L1 VERIFIED
                    </div>
                  )}
                </div>
              </div>
              
              <div className="md:w-16 bg-slate-50 border-l border-slate-100 flex md:flex-col items-center justify-center gap-2 py-4">
                <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:scale-110 group-hover:border-primary/20 transition-all">
                  <ArrowRight size={20} />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {pendingApprovals.length === 0 && (
          <div className="py-32 flex flex-col items-center justify-center bg-white rounded-3xl border border-slate-200 border-dashed animate-in fade-in transition-all">
             <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mb-6 relative">
                <CheckCircle2 size={40} className="text-emerald-500/30" />
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 flex items-center justify-center"
                >
                  <CheckCircle2 size={40} className="text-emerald-500" />
                </motion.div>
             </div>
             <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Authorization Queue Clear</h3>
             <p className="text-xs text-slate-400 mt-2">All financial entities have been authenticated or rejected.</p>
          </div>
        )}
      </div>

      {/* Authorization Modal */}
      <AnimatePresence>
        {selectedReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              {approvalStep === "DETAILS" && (
                <div className="flex flex-col">
                  <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Detailed Review</h3>
                    <button onClick={() => setSelectedReq(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <XCircle size={20} className="text-slate-400" />
                    </button>
                  </div>
                  
                  <div className="p-8 space-y-6">
                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="text-lg font-bold text-slate-900 tracking-tight">{selectedReq.title}</h4>
                          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-1">SYS_NODE_ID: {selectedReq.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Amount</p>
                          <p className="text-xl font-black text-primary font-mono">{formatCurrency(selectedReq.amount)}</p>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 italic leading-relaxed">
                        "{selectedReq.description}"
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Decision Commentary</label>
                        <textarea 
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                          placeholder="Provide audit reasoning for your authorization decision..."
                          className="input-field py-3 min-h-[100px] resize-none"
                        />
                      </div>
                      
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
                        <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                          Proceeding to Key Verification will commit this decision to the digital audit trail. Ensure all quotations attached match the requested amount.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-8 py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                    <button 
                      onClick={handleReject}
                      disabled={loading || !decisionNote}
                      className="px-6 py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-xs font-black uppercase hover:bg-rose-50 transition-all cursor-pointer shadow-sm shadow-rose-100 disabled:opacity-50"
                    >
                      Reject Entity
                    </button>
                    <button 
                      onClick={() => setApprovalStep("CODE")}
                      className="btn-primary px-8"
                    >
                      Verify Key
                    </button>
                  </div>
                </div>
              )}

              {approvalStep === "CODE" && (
                <div className="p-12 text-center space-y-8">
                  <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center text-primary relative">
                    <Fingerprint size={40} className="animate-pulse" />
                    <motion.div 
                      className="absolute inset-0 rounded-3xl border-2 border-primary"
                      animate={{ scale: [1, 1.1, 1], opacity: [0, 0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Security Protocol</h3>
                    <p className="text-xs text-slate-400 mt-2 uppercase font-black tracking-widest">Input your unique {currentUser?.role === UserRole.APPROVER_L2 ? "7" : "6"}-digit signature key</p>
                  </div>
                  
                  <div className="relative max-w-[280px] mx-auto">
                    <input 
                      type="password"
                      maxLength={7}
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                      placeholder="•••••••"
                      className="w-full text-center text-4xl tracking-[0.6em] font-black border-none bg-slate-50 py-6 rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <button 
                      disabled={loading || authCode.length < (currentUser?.role === UserRole.APPROVER_L2 ? 7 : 6)}
                      onClick={handleApprove}
                      className="w-full py-4 bg-primary text-white rounded-2xl text-xs font-black uppercase hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
                      Verify & Commit Signature
                    </button>
                    <button 
                      onClick={() => setApprovalStep("DETAILS")}
                      className="w-full py-3 bg-white text-slate-400 rounded-2xl text-[10px] font-black uppercase hover:text-slate-600 transition-all"
                    >
                      Return to details
                    </button>
                  </div>
                </div>
              )}

              {approvalStep === "SUCCESS" && (
                <div className="p-16 text-center space-y-10">
                  <div className="mx-auto w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-200">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <CheckCircle2 size={48} />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Ledger Node Written</h3>
                    <p className="text-xs text-slate-400 uppercase font-black tracking-widest px-8">Requisition has been successfully authorized and moved to the next protocol stage.</p>
                  </div>
                  <button 
                    onClick={() => setSelectedReq(null)}
                    className="w-full py-4 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    CONTINUE HUB OPS
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
