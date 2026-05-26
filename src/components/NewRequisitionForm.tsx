/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { numberToWords } from "../utils/numberUtils";
import { formatCurrency, cn } from "../lib/utils";
import { Upload, X, Paperclip, Loader2, DollarSign, FileText, Info, Repeat, Users, PlusCircle, Save } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RecurrenceType, UserRole } from "../types";

interface NewRequisitionFormProps {
  onClose: () => void;
}

export const NewRequisitionForm: React.FC<NewRequisitionFormProps> = ({ onClose }) => {
  const { addRequisition, currentUser, projects, churchGroups, addChurchGroup } = useRequisitions();
  const [amount, setAmount] = useState<string>("");
  const [amountWords, setAmountWords] = useState<string>("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const isAdminOrFinance = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.FINANCE;
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);

  const handleAddNewGroup = async () => {
    if (!newGroupName.trim()) return;
    setAddingGroup(true);
    try {
      await addChurchGroup(newGroupName.trim(), newGroupDescription.trim() || undefined);
      setSelectedGroup(newGroupName.trim());
      setNewGroupName("");
      setNewGroupDescription("");
      setShowNewGroupInput(false);
    } catch (err) {
      console.error("Failed to add group:", err);
    } finally {
      setAddingGroup(false);
    }
  };

  useEffect(() => {
    if (isAdminOrFinance) {
      if (churchGroups && churchGroups.length > 0) {
        setSelectedGroup(churchGroups[0].name);
      } else {
        setSelectedGroup("Youth Camp 2026");
      }
    } else {
      setSelectedGroup(currentUser?.group || "Youth Camp 2026");
    }
  }, [currentUser, churchGroups, isAdminOrFinance]);

  useEffect(() => {
    const val = parseFloat(amount);
    if (!isNaN(val)) {
      setAmountWords(numberToWords(val));
    } else {
      setAmountWords("");
    }
  }, [amount]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setAttachments(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const groupVal = selectedGroup || currentUser?.group || "General Group";
    const matchingProject = projects.find(p => p.groupId === groupVal || p.name === groupVal);

    try {
      await addRequisition({
        projectId: matchingProject ? matchingProject.id : "",
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        amount: Number(amount),
        amountWords,
        recurrence,
        groupId: groupVal,
        groupName: groupVal,
        requesterId: currentUser?.id || "u-anon",
        requesterName: currentUser?.name || "Anonymous",
        attachments: attachments.map(f => f.name + " (Simulated)"),
      });
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
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">New Requisition Hub</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Section 1: Requisition Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>
                <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest">General Information</h4>
              </div>
              {isAdminOrFinance && (
                <button
                  type="button"
                  onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                  className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10"
                >
                  <PlusCircle size={12} />
                  <span>Quick Add Group</span>
                </button>
              )}
            </div>

            {showNewGroupInput && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Church Group Name</label>
                    <input 
                      type="text" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. St Andrews Choir"
                      className="input-field bg-white h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Optional Scope / Description</label>
                    <input 
                      type="text" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="e.g. Traditional Choir Ministry"
                      className="input-field bg-white h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(false)}
                    className="px-3 py-1.5 bg-white border border-slate-200 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={addingGroup || !newGroupName.trim()}
                    onClick={handleAddNewGroup}
                    className="px-3.5 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 hover:bg-primary/95 shadow-sm"
                  >
                    {addingGroup ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                    <span>Save Group entry</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* Department/Group Autofill or Dropdown Field */}
            <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-150">
              <div className="flex items-center gap-1.5 mb-1 bg-white inline-flex px-2.5 py-1 rounded-full border border-slate-100 shadow-sm">
                <Users size={12} className="text-primary" />
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-[0.15em] leading-none">
                  Department / Church Group
                </span>
              </div>
              
              {isAdminOrFinance ? (
                <div className="space-y-1.5">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="input-field cursor-pointer h-10 px-3 bg-white border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-[11px]"
                  >
                    {churchGroups && churchGroups.length > 0 ? (
                      churchGroups.map((g) => (
                        <option key={g.id} value={g.name} className="font-sans text-xs">
                          {g.name}
                        </option>
                      ))
                    ) : (
                      <option value="Youth Camp 2026">YOUTH CAMP 2026</option>
                    )}
                  </select>
                  <p className="text-[9px] text-primary font-black uppercase tracking-wider pl-1 font-mono">
                    ★ Privileged Terminal Mode: Change designated church group manually
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    disabled
                    value={selectedGroup}
                    className="input-field h-10 px-3 bg-slate-200/50 text-slate-500 border-slate-200 text-xs font-bold uppercase tracking-wider cursor-not-allowed"
                  />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-1 font-mono flex items-center gap-1">
                    <span>⚡ Group Auto-filled: Requisition matches user church group securely</span>
                  </p>
                </div>
              )}
            </div>
            
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Requisition Title</label>
              <input 
                name="title" 
                required 
                className="input-field text-xs md:text-sm"
                placeholder="Briefly describe the request (e.g. Youth Camp Catering)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
              <textarea 
                name="description" 
                required 
                rows={4}
                className="input-field resize-none py-3"
                placeholder="Provide a comprehensive breakdown of the requirements..."
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Recurrence Protocol</label>
              <div className="relative">
                <Repeat className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <select 
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as RecurrenceType)}
                  className="input-field pl-12 cursor-pointer font-bold uppercase tracking-widest text-[11px]"
                >
                  <option value={RecurrenceType.NONE}>NO RECURRENCE</option>
                  <option value={RecurrenceType.MONTHLY}>MONTHLY CYCLE</option>
                  <option value={RecurrenceType.QUARTERLY}>QUARTERLY CYCLE</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Financial Information */}
          <div className="space-y-4 p-4 md:p-6 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <DollarSign size={16} className="text-secondary" />
              </div>
              <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest">Financial breakdown</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount (KES)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-[10px] md:text-xs uppercase">Ksh</span>
                  <input 
                    name="amount" 
                    type="number" 
                    required 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="input-field pl-12 font-mono font-bold text-primary text-xs md:text-sm"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Amount in Words</label>
                <div className="min-h-10 bg-white border border-slate-200 rounded-xl px-4 py-2 flex items-center text-[10px] md:text-[11px] text-slate-500 font-medium italic overflow-hidden leading-snug">
                  {amountWords || "Auto-calculated on input..."}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Attachments */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Paperclip size={16} className="text-emerald-600" />
              </div>
              <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">Quotations & Documents</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <label className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center gap-2 hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer group">
                <input type="file" multiple onChange={handleFileChange} className="hidden" />
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Upload size={18} className="text-slate-400 group-hover:text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-slate-700">Click to upload documents</p>
                  <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest">PDF, Image or XLSX max 10MB</p>
                </div>
              </label>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-hide">
                <AnimatePresence>
                  {attachments.map((file, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-white flex items-center justify-center border border-slate-100 text-slate-400 font-black text-[10px] uppercase">
                          {file.name.split('.').pop()?.slice(0, 3)}
                        </div>
                        <div className="overflow-hidden max-w-[150px]">
                          <p className="text-xs font-bold text-slate-700 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-500 rounded-lg transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </motion.div>
                  ))}
                  {attachments.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-slate-300 py-8">
                      <p className="text-[10px] font-black uppercase tracking-widest">No Documents Attached</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Advisory Box */}
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5">
              <Info size={12} />
            </div>
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Important: You are submitting a legal financial request to the Diocese ledger. Ensure all supporting documents are accurate. Approval processing typically takes 24-72 hours.
            </p>
          </div>
        </form>

        <div className="px-4 md:px-8 py-4 md:py-6 border-t border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-end gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="w-full md:w-auto px-6 py-3 md:py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 transition-all cursor-pointer"
          >
            DISCARD DRAFT
          </button>
          <button 
            disabled={loading || !amount || !attachments.length}
            type="submit"
            form="new-req-form" 
            className="w-full md:w-auto btn-primary disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl"
            onClick={() => {
              const form = document.getElementById('new-req-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            <span className="uppercase tracking-widest text-[10px] md:text-xs">
              {loading ? "INITIALIZING LEDGER..." : "SUBMIT FOR L1 APPROVAL"}
            </span>
          </button>
        </div>
        
        {/* Actual form element needs ID for the button outside it */}
        <form id="new-req-form" onSubmit={handleSubmit} className="hidden" />
      </motion.div>
    </div>
  );
};
