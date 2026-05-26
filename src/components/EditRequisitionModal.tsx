/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { numberToWords } from "../utils/numberUtils";
import { formatCurrency, cn } from "../lib/utils";
import { X, Loader2, DollarSign, FileText, Repeat, Users, PlusCircle, Save } from "lucide-react";
import { motion } from "motion/react";
import { RecurrenceType, Requisition } from "../types";

interface EditRequisitionModalProps {
  req: Requisition;
  onClose: () => void;
}

export const EditRequisitionModal: React.FC<EditRequisitionModalProps> = ({ req, onClose }) => {
  const { updateRequisition, projects, churchGroups, addChurchGroup } = useRequisitions();
  
  const [title, setTitle] = useState(req.title);
  const [description, setDescription] = useState(req.description);
  const [amount, setAmount] = useState(req.amount.toString());
  const [amountWords, setAmountWords] = useState(req.amountWords || "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(req.recurrence || RecurrenceType.NONE);
  const [selectedGroup, setSelectedGroup] = useState(req.groupName);
  const [projectId, setProjectId] = useState(req.projectId || "");
  
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const val = parseFloat(amount);
    if (!isNaN(val)) {
      setAmountWords(numberToWords(val));
    } else {
      setAmountWords("");
    }
  }, [amount]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !amount.trim()) return;
    setSaving(true);

    const matchingProject = projects.find(p => p.groupId === selectedGroup || p.name === selectedGroup);
    const finalProjectId = projectId || (matchingProject ? matchingProject.id : "");

    try {
      await updateRequisition(req.id, {
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        amountWords,
        recurrence,
        groupId: selectedGroup,
        groupName: selectedGroup,
        projectId: finalProjectId
      });
      onClose();
    } catch (error) {
      console.error("Failed to update requisition:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Administrative Editor</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Section 1: Desginated Group & Quick Add */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users size={16} className="text-primary" />
                </div>
                <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest">Ownership & Affiliations</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowNewGroupInput(!showNewGroupInput)}
                className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10"
              >
                <PlusCircle size={12} />
                <span>Quick Add Group</span>
              </button>
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

            <div className="space-y-1.5 p-4 bg-slate-50 rounded-2xl border border-slate-150">
              <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 block mb-1">
                Designated Team / Department / Group
              </label>
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
                  <option value={selectedGroup}>{selectedGroup}</option>
                )}
              </select>
            </div>

            {/* Requisition Title */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Requisition Title</label>
              <input 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required 
                className="input-field text-xs md:text-sm font-semibold"
                placeholder="Briefly describe the request"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Detailed Log / Purpose</label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required 
                rows={4}
                className="input-field resize-none py-3 text-xs md:text-sm leading-relaxed"
                placeholder="Provide a comprehensive breakdown of requirements..."
              />
            </div>

            {/* Recurrence & Budget Line info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    <option value={RecurrenceType.MONTHLY}>MONTHLY PROTOCOL</option>
                    <option value={RecurrenceType.QUARTERLY}>QUARTERLY PROTOCOL</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Project Context</label>
                <select 
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="input-field cursor-pointer font-bold uppercase tracking-widest text-[11px]"
                >
                  <option value="">NO SPECIFIED PROJECT</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id} className="font-sans text-xs uppercase tracking-wider">{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Funding breakdown */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest ml-1">Total Authorized Amount (KES)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                    type="number" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required 
                    min="1"
                    className="input-field pl-12 font-mono font-bold text-xs md:text-sm"
                    placeholder="Enter budget requirement amount..."
                  />
                </div>
              </div>

              {amountWords && (
                <div className="p-4 bg-white/80 border border-slate-200/60 rounded-xl space-y-1 animate-in fade-in duration-300">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-mono">AUTHORIZED WORDS OF CERTIFICATION</span>
                  <p className="text-[11px] font-bold text-slate-700 italic">{amountWords} shillings only.</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel Edit
            </button>
            <button
              type="submit"
              disabled={saving || !title.trim() || !amount.trim()}
              className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 transition-all cursor-pointer flex items-center gap-2"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              <span>Apply Changes</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
