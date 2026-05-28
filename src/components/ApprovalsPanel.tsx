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
  FileText,
  Flag
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

export const ApprovalsPanel: React.FC = () => {
  const { requisitions, updateRequisitionStatus, currentUser, globalSearchTerm, canPerform } = useRequisitions();
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

    const canDoL1 = canPerform('canApproveL1');
    const canDoL2 = canPerform('canApproveL2');

    if (canDoL1 && req.status === RequisitionStatus.SUBMITTED) return true;
    if (canDoL2 && (req.status === RequisitionStatus.APPROVED_L1 || req.status === RequisitionStatus.ESCALATED)) return true;
    
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
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">Authorization Hub</h2>
          <p className="text-[10px] md:text-sm text-slate-500">Authenticated verification stream for pending ledger transactions.</p>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="px-3 py-1.5 md:px-4 md:py-2 bg-primary/5 border border-primary/10 rounded-xl flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary md:w-4 md:h-4" />
            <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-primary">
              {currentUser?.role === UserRole.APPROVER_L2 ? "L2 KEYMASTER" : currentUser?.role === UserRole.ADMIN ? "GLOBAL ADMIN" : "L1 VERIFIER"}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:gap-6">
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
              className="bg-white rounded-xl md:rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-primary/30 transition-all cursor-pointer group flex flex-col md:flex-row overflow-hidden relative"
            >
              <div className={cn(
                "w-1 md:w-1.5 self-stretch shrink-0",
                req.status === RequisitionStatus.SUBMITTED ? "bg-amber-500" : "bg-primary"
              )} />
              
              <div className="flex-1 p-3 md:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                <div className="space-y-1 md:space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 md:w-9 md:h-9 rounded-lg md:rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      <FileText size={14} className="md:w-4 md:h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-[13px] md:text-base tracking-tight group-hover:text-primary transition-colors truncate">{req.title}</h3>
                        {req.flaggedForAudit && (
                          <span title="Flagged for Audit" className="inline-flex shrink-0">
                            <Flag size={11} className="text-rose-500 fill-rose-500" />
                          </span>
                        )}
                        <span className="text-[7.5px] md:text-[9px] font-mono font-bold text-slate-400 uppercase tracking-tighter">#{req.id.slice(-6).toUpperCase()}</span>
                      </div>
                      <p className="text-[9px] md:text-[11px] text-slate-500 line-clamp-1 italic font-medium">"{req.description}"</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 pl-[38px] md:pl-[46px]">
                    <div className="flex items-center gap-1">
                      <Clock size={9} className="text-slate-400 md:w-2.5 md:h-2.5" />
                      <span className="text-[8.5px] md:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider">{Math.ceil((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24))} Days</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                       <div className="w-3.5 h-3.5 md:w-4 md:h-4 rounded-full bg-slate-100 flex items-center justify-center text-[7.5px] md:text-[8.5px] font-bold text-slate-500 border border-white">
                        {req.requesterName.charAt(0)}
                      </div>
                      <span className="text-[8.5px] md:text-[9.5px] font-bold text-slate-500 uppercase tracking-wider truncate max-w-[70px] md:max-w-none">{req.requesterName}</span>
                    </div>
                  </div>
                </div>

                <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-1">
                  <div className="md:hidden">
                    <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-[0.15em] mb-0.5">Value</p>
                    <p className="text-base font-black text-slate-900 font-mono">{formatCurrency(req.amount)}</p>
                  </div>
                  <div className="hidden md:block text-right">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-0.5">Impact Value</p>
                    <p className="text-xl font-black text-slate-900 leading-none font-mono tracking-tighter">{formatCurrency(req.amount)}</p>
                  </div>
                  {req.status === RequisitionStatus.APPROVED_L1 && (
                    <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[7.5px] md:text-[8px] font-black uppercase tracking-widest">
                      <CheckCircle2 size={8} /> L1 VERIFIED
                    </div>
                  )}
                </div>
              </div>
              
              <div className="md:w-12 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-100 flex md:flex-col items-center justify-center gap-2 py-1.5 md:py-3">
                <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:scale-110 group-hover:border-primary/20 transition-all">
                  <ArrowRight size={14} className="md:w-4 md:h-4" />
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
              className="bg-white rounded-2xl md:rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col mx-2"
            >
              {approvalStep === "DETAILS" && (
                <div className="flex flex-col">
                  <div className="px-5 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                    <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Detailed Review</h3>
                    <button onClick={() => setSelectedReq(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                      <XCircle size={18} className="text-slate-400 md:w-5 md:h-5" />
                    </button>
                  </div>
                  
                  <div className="p-5 md:p-8 space-y-5 md:space-y-6">
                    <div className="bg-slate-50 rounded-xl md:rounded-2xl p-4 md:p-6 border border-slate-100">
                      <div className="flex justify-between items-start mb-4">
                        <div className="min-w-0 flex-1 pr-2">
                          <h4 className="text-base md:text-lg font-bold text-slate-900 tracking-tight truncate">{selectedReq.title}</h4>
                          <p className="text-[9px] md:text-[10px] font-mono text-slate-400 uppercase tracking-widest mt-0.5 md:mt-1 truncate">SYS_ID: {selectedReq.id.slice(-8)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Amount</p>
                          <p className="text-lg md:text-xl font-black text-primary font-mono">{formatCurrency(selectedReq.amount)}</p>
                        </div>
                      </div>
                      <div className="p-3 md:p-4 bg-white rounded-lg md:rounded-xl border border-slate-200 text-[11px] md:text-xs text-slate-600 italic leading-relaxed max-h-32 overflow-y-auto scrollbar-hide">
                        "{selectedReq.description}"
                      </div>
                    </div>

                    <div className="space-y-3 md:space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Decision Commentary</label>
                        <textarea 
                          value={decisionNote}
                          onChange={(e) => setDecisionNote(e.target.value)}
                          placeholder="Provide audit reasoning..."
                          className="input-field py-2.5 md:py-3 min-h-[80px] md:min-h-[100px] resize-none text-[11px] md:text-xs"
                        />
                      </div>
                      
                      <div className="p-3 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl border border-amber-100 flex gap-2.5 md:gap-3 items-start">
                        <Info size={14} className="text-amber-500 shrink-0 mt-0.5 md:w-4 md:h-4" />
                        <p className="text-[10px] md:text-[11px] text-amber-800 leading-relaxed font-medium">
                          Commitment will trigger subsequent protocol stages.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-5 md:px-8 py-4 md:py-6 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-2 md:gap-3">
                    <button 
                      onClick={handleReject}
                      disabled={loading || !decisionNote.trim()}
                      className="px-4 md:px-6 py-2 md:py-3 bg-white border border-rose-200 text-rose-600 rounded-xl text-[10px] md:text-xs font-black uppercase hover:bg-rose-50 transition-all cursor-pointer shadow-sm shadow-rose-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button 
                      onClick={() => setApprovalStep("CODE")}
                      className="btn-primary px-5 md:px-8 py-2 md:py-3 text-[10px] md:text-xs"
                    >
                      Verify Key
                    </button>
                  </div>
                </div>
              )}

              {approvalStep === "CODE" && (
                <div className="p-8 md:p-12 text-center space-y-6 md:space-y-8">
                  <div className="mx-auto w-16 h-16 md:w-20 md:h-20 bg-primary/10 rounded-2xl md:rounded-3xl flex items-center justify-center text-primary relative">
                    <Fingerprint size={30} className="md:w-10 md:h-10 animate-pulse" />
                    <motion.div 
                      className="absolute inset-0 rounded-2xl md:rounded-3xl border-2 border-primary"
                      animate={{ scale: [1, 1.1, 1], opacity: [0, 0.5, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">Security Protocol</h3>
                    <p className="text-[9px] md:text-xs text-slate-400 mt-2 uppercase font-black tracking-widest">Input unique {currentUser?.role === UserRole.APPROVER_L2 ? "7" : "6"}-digit signature key</p>
                  </div>
                  
                  <div className="relative max-w-[240px] md:max-w-[280px] mx-auto">
                    <input 
                      type="password"
                      maxLength={7}
                      value={authCode}
                      onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, ''))}
                      autoFocus
                      placeholder="•••••••"
                      className="w-full text-center text-2xl md:text-4xl tracking-[0.4em] md:tracking-[0.6em] font-black border-none bg-slate-50 py-4 md:py-6 rounded-xl md:rounded-2xl focus:ring-4 focus:ring-primary/10 outline-none transition-all placeholder:text-slate-200"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2.5 md:gap-3">
                    <button 
                      disabled={loading || authCode.length < (currentUser?.role === UserRole.APPROVER_L2 ? 7 : 6)}
                      onClick={handleApprove}
                      className="w-full py-3 md:py-4 bg-primary text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                      Verify Signature
                    </button>
                    <button 
                      onClick={() => setApprovalStep("DETAILS")}
                      className="w-full py-2.5 bg-white text-slate-400 rounded-xl text-[9px] md:text-[10px] font-black uppercase hover:text-slate-600 transition-all"
                    >
                      Return to details
                    </button>
                  </div>
                </div>
              )}

              {approvalStep === "SUCCESS" && (
                <div className="p-10 md:p-16 text-center space-y-8 md:space-y-10">
                  <div className="mx-auto w-20 h-20 md:w-24 md:h-24 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-2xl shadow-emerald-200">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", damping: 12 }}
                    >
                      <CheckCircle2 size={40} className="md:w-12 md:h-12" />
                    </motion.div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight">Ledger Written</h3>
                    <p className="text-[10px] md:text-xs text-slate-400 uppercase font-black tracking-widest px-4 md:px-8">Requisition has been successfully authorized.</p>
                  </div>
                  <button 
                    onClick={() => setSelectedReq(null)}
                    className="w-full py-3.5 md:py-4 bg-slate-900 text-white rounded-xl md:rounded-2xl text-[10px] md:text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
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
