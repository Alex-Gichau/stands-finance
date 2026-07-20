/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { numberToWords } from "../utils/numberUtils";
import { formatCurrency, cn, uploadAttachmentsToLocalServer } from "../lib/utils";
import { X, Loader2, DollarSign, FileText, Repeat, Users, PlusCircle, Save, Activity } from "lucide-react";
import { motion } from "motion/react";
import { RecurrenceType, Requisition, RequisitionStatus, UserRole } from "../types";
import { ApprovalSparkline } from "./ApprovalSparkline";

interface EditRequisitionModalProps {
  req: Requisition;
  onClose: () => void;
}

export const EditRequisitionModal: React.FC<EditRequisitionModalProps> = ({ req, onClose }) => {
  const { updateRequisition, projects, churchGroups, addChurchGroup, currentUser, triggerToast } = useRequisitions();
  
  const [title, setTitle] = useState(req.title);
  const [description, setDescription] = useState(req.description);
  const [amount, setAmount] = useState(req.amount.toString());
  const [amountWords, setAmountWords] = useState(req.amountWords || "");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(req.recurrence || RecurrenceType.NONE);
  const [selectedGroup, setSelectedGroup] = useState(req.groupName);
  const [projectId, setProjectId] = useState(req.projectId || "");
  const [inProcurement, setInProcurement] = useState(req.inProcurement || false);
  const [requiresMoreInfo, setRequiresMoreInfo] = useState(req.requiresMoreInfo || false);
  
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitAction, setSubmitAction] = useState<"save" | "submit">("save");

  const [uploadCompletedCount, setUploadCompletedCount] = useState(0);
  const [uploadTotalCount, setUploadTotalCount] = useState(0);
  const [uploadCurrentFile, setUploadCurrentFile] = useState("");

  const [existingAttachments, setExistingAttachments] = useState<string[]>(
    Array.isArray(req.attachments) 
      ? req.attachments 
      : (typeof req.attachments === "string" && req.attachments ? [req.attachments] : [])
  );
  const [newAttachments, setNewAttachments] = useState<File[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const limit = 2 * 1024 * 1024; // 2MB

      const allowedFormatFiles: File[] = [];
      const unsupportedFiles: File[] = [];

      for (const file of selectedFiles) {
        const name = file.name.toLowerCase();
        const type = file.type.toLowerCase();

        const isPdf = type === "application/pdf" || name.endsWith(".pdf");
        const isImage = type.startsWith("image/") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".gif") || name.endsWith(".webp");
        const isDocx = type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
                       type === "application/msword" || 
                       name.endsWith(".docx") || 
                       name.endsWith(".doc");

        if (isPdf || isImage || isDocx) {
          allowedFormatFiles.push(file);
        } else {
          unsupportedFiles.push(file);
        }
      }

      if (unsupportedFiles.length > 0) {
        alert(`Unsupported format error: Only PDF, Image, and DOCX files are allowed. The following file(s) were rejected:\n${unsupportedFiles.map(f => f.name).join("\n")}`);
        if (triggerToast) {
          triggerToast({
            type: "SYSTEM_INFO",
            message: "Unsupported format error: Only PDF, Image, and DOCX files are allowed.",
            severity: "HIGH",
            timestamp: new Date().toISOString()
          });
        }
      }

      const oversizedFiles = allowedFormatFiles.filter(file => file.size > limit);
      if (oversizedFiles.length > 0) {
        alert(`The following file(s) exceed the 2MB size limit and were rejected:\n${oversizedFiles.map(f => `${f.name} (${(f.size / (1024 * 1024)).toFixed(2)} MB)`).join("\n")}`);
      }
      const allowedFiles = allowedFormatFiles.filter(file => file.size <= limit);
      setNewAttachments(prev => [...prev, ...allowedFiles]);
    }
  };

  const removeExistingAttachment = (idx: number) => {
    setExistingAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const removeNewAttachment = (idx: number) => {
    setNewAttachments(prev => prev.filter((_, i) => i !== idx));
  };

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

    try {
      // Process and encode any new attachments
      const readPromises = newAttachments.map((file) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            // Compress images using browser canvas
            if (file.type.startsWith("image/")) {
              const img = new Image();
              img.onload = () => {
                const canvas = document.createElement("canvas");
                const MAX_DIM = 800; // Optimal preview dimension
                let width = img.width;
                let height = img.height;
                if (width > MAX_DIM || height > MAX_DIM) {
                  if (width > height) {
                    height = Math.round((height * MAX_DIM) / width);
                    width = MAX_DIM;
                  } else {
                    width = Math.round((width * MAX_DIM) / height);
                    height = MAX_DIM;
                  }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx?.drawImage(img, 0, 0, width, height);
                // Save space using a medium-high quality JPEG
                const compressed = canvas.toDataURL("image/jpeg", 0.7);
                resolve(`${file.name}::${compressed}`);
              };
              img.onerror = () => {
                resolve(`${file.name}::${result}`);
              };
              img.src = result;
            } else {
              // Non-image files like PDFs. Preserve full base64 content so they are uploaded to Google Drive and saved.
              resolve(`${file.name}::${result}`);
            }
          };
          reader.onerror = () => {
            resolve(`${file.name}::data:text/plain;base64,RXJyb3IgcmVhZGluZyBmaWxl`);
          };
          reader.readAsDataURL(file);
        });
      });

      const encodedNew = await Promise.all(readPromises);
      const combinedAttachments = [...existingAttachments, ...encodedNew];
      
      setUploadCompletedCount(0);
      setUploadTotalCount(combinedAttachments.length);
      setUploadCurrentFile("");

      const finalAttachments = await uploadAttachmentsToLocalServer(combinedAttachments, (completed, total, lastFile) => {
        setUploadCompletedCount(completed);
        setUploadTotalCount(total);
        setUploadCurrentFile(lastFile);
      });

      const matchingProject = projects.find(p => p.groupId === selectedGroup || p.name === selectedGroup);
      const finalProjectId = projectId || (matchingProject ? matchingProject.id : "");

      const isReqDraft = req.status === RequisitionStatus.DRAFT;
      const finalStatus = (isReqDraft && submitAction === "submit") 
        ? RequisitionStatus.SUBMITTED 
        : req.status;

      await updateRequisition(req.id, {
        title: title.trim(),
        description: description.trim(),
        amount: Number(amount),
        amountWords,
        recurrence,
        groupId: selectedGroup,
        groupName: selectedGroup,
        projectId: finalProjectId,
        inProcurement,
        requiresMoreInfo,
        attachments: finalAttachments,
        status: finalStatus
      });
      onClose();
    } catch (error) {
      console.error("Failed to update requisition:", error);
    } finally {
      setSaving(false);
    }
  };

  if (req.status === RequisitionStatus.REJECTED) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-slate-200 text-center space-y-4"
        >
          <div className="w-12 h-12 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600">
            <X size={24} />
          </div>
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Access Restricted</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Rejected requisitions cannot be edited. Please submit a new requisition instead.
          </p>
          <button 
            type="button" 
            onClick={onClose}
            className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
          >
            Go Back
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        className="bg-white rounded-none md:rounded-2xl w-full max-w-3xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Administrative Editor</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {Array.isArray(req.approvalHistory) && req.approvalHistory.length > 0 && (
            <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <Activity size={14} className="text-slate-400" />
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Approval Flow History</h4>
              </div>
              <ApprovalSparkline req={req} />
            </div>
          )}
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

            {/* Recurrence protocol */}
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
            
            {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.FINANCE || currentUser?.role === UserRole.SUPER_ADMIN) && (
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 space-y-4">
                 <h4 className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-2">Workflow Status</h4>
                 <div className="flex items-center justify-between gap-4">
                   {(currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPER_ADMIN) && (
                     <label className="flex items-center gap-2 cursor-pointer">
                       <input 
                         type="checkbox"
                         checked={inProcurement}
                         onChange={(e) => setInProcurement(e.target.checked)}
                         className="rounded text-primary focus:ring-primary h-4 w-4"
                       />
                       <span className="text-xs font-bold text-slate-700">In Procurement</span>
                     </label>
                   )}
                   <label className="flex items-center gap-2 cursor-pointer">
                     <input 
                       type="checkbox"
                       checked={requiresMoreInfo}
                       onChange={(e) => setRequiresMoreInfo(e.target.checked)}
                       className="rounded text-primary focus:ring-primary h-4 w-4"
                     />
                     <span className="text-xs font-bold text-slate-700">Requires More Info</span>
                   </label>
                 </div>
              </div>
            )}

            {/* Attachment Management Section */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-150 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-[10px] md:text-xs font-black text-slate-700 uppercase tracking-widest font-sans">Requisition Documents & Attachments</h4>
                    <p className="text-[9px] text-slate-400">Manage receipts, invoices, and other supporting evidence files</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-widest flex items-center gap-1 bg-primary/5 px-2.5 py-1.5 rounded-lg border border-primary/10 cursor-pointer"
                >
                  <PlusCircle size={12} />
                  <span>Upload More Files</span>
                </button>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  multiple
                  className="hidden"
                />
              </div>

              {/* Existing file list */}
              {existingAttachments.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block font-sans">Current Registered Attachments</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {existingAttachments.map((att, idx) => {
                      const [name] = att.split("::");
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-xl animate-in fade-in">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText size={14} className="text-primary shrink-0" />
                            <span className="text-[11px] font-bold text-slate-700 truncate" title={name}>{name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeExistingAttachment(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Remove attachment"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* New file staging area */}
              {newAttachments.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-dashed border-slate-200">
                  <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest block font-sans">New Files Staged for Upload</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {newAttachments.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-emerald-500/5 border border-emerald-500/10 rounded-xl animate-in fade-in">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText size={14} className="text-emerald-600 shrink-0" />
                          <span className="text-[11px] font-bold text-emerald-800 truncate" title={file.name}>{file.name}</span>
                          <span className="text-[9px] text-slate-400">({(file.size / 1024).toFixed(0)} KB)</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeNewAttachment(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                          title="Remove staged attachment"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {existingAttachments.length === 0 && newAttachments.length === 0 && (
                <div className="p-6 bg-slate-100/50 border border-dashed border-slate-200 rounded-xl text-center text-slate-300">
                  <p className="text-[10px] font-black uppercase tracking-widest">No Documents Attached</p>
                </div>
              )}
            </div>
          </div>

          {/* Visual upload progress bar */}
          {saving && uploadTotalCount > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2.5 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-sky-50 rounded-lg text-sky-600 animate-pulse">
                    <Loader2 size={14} className="animate-spin" />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-700">
                      Uploading Attachments
                    </h4>
                    <p className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">
                      Transferring to local server storage
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-sky-600 font-mono bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                  {uploadCompletedCount} / {uploadTotalCount} ({Math.round((uploadCompletedCount / uploadTotalCount) * 100)}%)
                </span>
              </div>
              
              {/* Progress Track */}
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-sky-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.round((uploadCompletedCount / uploadTotalCount) * 100)}%` }}
                />
              </div>

              {/* Current File Info */}
              {uploadCurrentFile && (
                <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-medium">
                  <span className="font-bold text-slate-400 uppercase text-[9px] tracking-wider">Active:</span>
                  <span className="truncate max-w-[400px] font-mono text-slate-600">{uploadCurrentFile}</span>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={() => {
                const subject = `Requisition: ${title}`;
                const body = `Requisition Details:\n\nTitle: ${title}\nDescription: ${description}\nAmount: KES ${amount}`;
                window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
              }}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
            >
              Share Email
            </button>
            <button
              type="button"
              onClick={() => {
                const text = `Requisition: ${title}\nDescription: ${description}\nAmount: KES ${amount}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
              }}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
            >
              Share WhatsApp
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all cursor-pointer"
            >
              Cancel Edit
            </button>
            {req.status === RequisitionStatus.DRAFT ? (
              <>
                <button
                  type="submit"
                  onClick={() => setSubmitAction("save")}
                  disabled={saving || !title.trim() || !amount.trim()}
                  className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
                >
                  {saving && submitAction === "save" ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Apply Changes</span>
                </button>
                <button
                  type="submit"
                  onClick={() => setSubmitAction("submit")}
                  disabled={saving || !title.trim() || !amount.trim()}
                  className="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-100 dark:shadow-none transition-all cursor-pointer flex items-center gap-2"
                >
                  {saving && submitAction === "submit" ? <Loader2 size={12} className="animate-spin" /> : null}
                  <span>Submit Requisition</span>
                </button>
              </>
            ) : (
              <button
                type="submit"
                onClick={() => setSubmitAction("save")}
                disabled={saving || !title.trim() || !amount.trim()}
                className="px-8 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-slate-200 transition-all cursor-pointer flex items-center gap-2"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                <span>Apply Changes</span>
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
};
