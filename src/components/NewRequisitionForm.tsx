/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { useRequisitions, getActiveFiscalYear } from "../contexts/RequisitionContext";
import { numberToWords } from "../utils/numberUtils";
import { formatCurrency, cn, uploadAttachmentsToLocalServer } from "../lib/utils";
import { Upload, X, Paperclip, Loader2, DollarSign, FileText, Info, Repeat, Users, PlusCircle, Save, Camera } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { RecurrenceType, UserRole } from "../types";
import { CameraCapture } from "./CameraCapture";
import { ConfirmationModal } from "./ConfirmationModal";
import { RequisitionStatus } from "../types";

interface NewRequisitionFormProps {
  onClose: () => void;
}

export const NewRequisitionForm: React.FC<NewRequisitionFormProps> = ({ onClose }) => {
  const { addRequisition, currentUser, projects, churchGroups, addChurchGroup, vendors, addVendor, triggerToast } = useRequisitions();
  const activeYear = getActiveFiscalYear();
  const [amount, setAmount] = useState<string>("");
  const [amountWords, setAmountWords] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceType>(RecurrenceType.NONE);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [payableTo, setPayableTo] = useState<string>("");
  const [showAddVendorForm, setShowAddVendorForm] = useState(false);
  const [vendorContact, setVendorContact] = useState("");
  const [vendorLocation, setVendorLocation] = useState("");
  const [vendorOfferings, setVendorOfferings] = useState("");
  const [isSavingVendor, setIsSavingVendor] = useState(false);

  const [activeTab, setActiveTab] = useState<"SEARCH" | "CREATE">("SEARCH");

  const isAdminOrFinance = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.FINANCE;
  const [selectedGroup, setSelectedGroup] = useState<string>("");

  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [showDraftConfirm, setShowDraftConfirm] = useState(false);

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

  const isExistingVendor = vendors?.some(
    v => v.name.toLowerCase().trim() === payableTo.toLowerCase().trim()
  );

  const handleSaveVendor = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!payableTo.trim()) return;
    setIsSavingVendor(true);
    try {
      await addVendor({
        name: payableTo.trim(),
        contact: vendorContact.trim(),
        location: vendorLocation.trim(),
        offerings: vendorOfferings.trim()
      });
      setShowAddVendorForm(false);
      setVendorContact("");
      setVendorLocation("");
      setVendorOfferings("");
    } catch (err) {
      console.error("Failed to add vendor:", err);
    } finally {
      setIsSavingVendor(false);
    }
  };

  const [isDraftRestored, setIsDraftRestored] = useState(false);

  // Load draft from localStorage on initial render
  useEffect(() => {
    if (!currentUser?.id) return;
    const draftKey = `stands_requisition_draft_${currentUser.id}`;
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft = JSON.parse(savedDraft);
        if (draft.title) setTitle(draft.title);
        if (draft.description) setDescription(draft.description);
        if (draft.amount) setAmount(draft.amount);
        if (draft.recurrence) setRecurrence(draft.recurrence as RecurrenceType);
        if (draft.payableTo) setPayableTo(draft.payableTo);
        if (draft.selectedGroup) setSelectedGroup(draft.selectedGroup);
        if (draft.vendorContact) setVendorContact(draft.vendorContact);
        if (draft.vendorLocation) setVendorLocation(draft.vendorLocation);
        if (draft.vendorOfferings) setVendorOfferings(draft.vendorOfferings);
        if (draft.showAddVendorForm !== undefined) setShowAddVendorForm(draft.showAddVendorForm);
        setIsDraftRestored(true);
      } catch (err) {
        console.error("Failed to restore draft:", err);
      }
    }
  }, [currentUser]);

  // Handle default group setting ONLY if there is no auto-saved group in localStorage
  useEffect(() => {
    if (!currentUser?.id) return;
    const draftKey = `stands_requisition_draft_${currentUser.id}`;
    const hasDraft = localStorage.getItem(draftKey);
    if (hasDraft) return;

    if (isAdminOrFinance) {
      if (churchGroups && churchGroups.length > 0) {
        setSelectedGroup(churchGroups[0].name);
      } else {
        setSelectedGroup(`Youth Camp ${activeYear}`);
      }
    } else {
      if (currentUser?.groups && currentUser.groups.length > 0) {
        setSelectedGroup(currentUser.group || currentUser.groups[0]);
      } else {
        setSelectedGroup(currentUser?.group || `Youth Camp ${activeYear}`);
      }
    }
  }, [currentUser, churchGroups, isAdminOrFinance]);

  // Auto-save form inputs to localStorage on state updates
  useEffect(() => {
    if (!currentUser?.id) return;
    const draftKey = `stands_requisition_draft_${currentUser.id}`;

    // If completely empty, remove any existing draft from storage
    if (!title.trim() && !description.trim() && !amount.trim() && !payableTo.trim()) {
      localStorage.removeItem(draftKey);
      return;
    }

    const draftData = {
      title,
      description,
      amount,
      recurrence,
      payableTo,
      selectedGroup,
      vendorContact,
      vendorLocation,
      vendorOfferings,
      showAddVendorForm
    };
    localStorage.setItem(draftKey, JSON.stringify(draftData));
  }, [
    currentUser,
    title,
    description,
    amount,
    recurrence,
    payableTo,
    selectedGroup,
    vendorContact,
    vendorLocation,
    vendorOfferings,
    showAddVendorForm
  ]);

  useEffect(() => {
    const val = parseFloat(amount);
    if (!isNaN(val)) {
      setAmountWords(numberToWords(val));
    } else {
      setAmountWords("");
    }
  }, [amount]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const selectedFiles = Array.from(e.dataTransfer.files);
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
      setAttachments(prev => [...prev, ...allowedFiles]);
    }
  };

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
      setAttachments(prev => [...prev, ...allowedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleCloseAttempt = () => {
    if (title.trim() || description.trim() || amount.trim() || attachments.length > 0) {
      setShowDraftConfirm(true);
    } else {
      onClose();
    }
  };

  const handleSaveDraft = async () => {
    try {
      setLoading(true);
      const groupVal = selectedGroup || currentUser?.group || "General Group";
      const matchingProject = projects.find(p => p.groupId === groupVal || p.name === groupVal);
      const parsedAmount = Number(amount) || 0;

      await addRequisition({
        status: RequisitionStatus.DRAFT,
        projectId: matchingProject ? matchingProject.id : "",
        title: title.trim() || "Draft Requisition",
        description: description.trim() || "",
        payableTo: payableTo.trim() || undefined,
        amount: parsedAmount,
        amountWords: amountWords || "",
        recurrence,
        groupId: groupVal,
        groupName: groupVal,
        requesterId: currentUser?.id || "u-anon",
        requesterName: currentUser?.name || "Anonymous",
        requesterEmail: currentUser?.email || "",
        attachments: [], // Usually draft doesn't need to parse attachments, keep simple
      });
      if (currentUser?.id) {
        localStorage.removeItem(`stands_requisition_draft_${currentUser.id}`);
      }
      onClose();
    } catch (err) {
      console.error("Failed to save draft:", err);
      alert("Failed to save draft.");
    } finally {
      setLoading(false);
      setShowDraftConfirm(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!navigator.onLine) {
      alert("Submission Blocked: You are currently offline. Please connect to the internet to submit new requisitions.");
      return;
    }
    setLoading(true);

    const groupVal = selectedGroup || currentUser?.group || "General Group";
    const matchingProject = projects.find(p => p.groupId === groupVal || p.name === groupVal);

    try {
      const parsedAmount = Number(amount);
      if (parsedAmount <= 0) {
        setLoading(false);
        alert("Amount must be greater than 0.");
        return;
      }

      // Convert all local attachments to persistent base64 strings
      const readPromises = attachments.map((file) => {
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

      const encodedAttachments = await Promise.all(readPromises);
      const localUploadedAttachments = await uploadAttachmentsToLocalServer(encodedAttachments);

      await addRequisition({
        projectId: matchingProject ? matchingProject.id : "",
        title: title.trim() || "Untitled Requisition",
        description: description.trim() || "No description provided",
        payableTo: payableTo.trim() || undefined,
        amount: parsedAmount,
        amountWords: amountWords || "",
        recurrence,
        groupId: groupVal,
        groupName: groupVal,
        requesterId: currentUser?.id || "u-anon",
        requesterName: currentUser?.name || "Anonymous",
        requesterEmail: currentUser?.email || "",
        attachments: localUploadedAttachments,
      });

      // Clear the local draft from storage upon successful submission
      if (currentUser?.id) {
        localStorage.removeItem(`stands_requisition_draft_${currentUser.id}`);
      }

      onClose();
    } catch (error) {
      console.error("Submission failed:", error);
      alert(error instanceof Error ? error.message : "An error occurred during submission.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-none md:rounded-2xl w-full max-w-3xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 dark:border-slate-800 flex flex-col"
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between sticky top-0 z-10">
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-[0.2em]">New Requisition Hub</h3>
          <button onClick={handleCloseAttempt} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} className="text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <form id="new-req-form" onSubmit={handleSubmit} className="overflow-y-auto p-4 md:p-8 space-y-6 md:space-y-8 flex-1">
          {/* Draft Restored Banner */}
          {isDraftRestored && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-indigo-50 border border-indigo-200 dark:bg-indigo-950/30 dark:border-indigo-800/50 p-4 rounded-xl flex items-start justify-between gap-4"
            >
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                  <Save size={14} className="text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-widest mb-1">Unsaved Draft Restored</h5>
                  <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400/80">We recovered your previous unsaved inputs from this device.</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setTitle("");
                  setDescription("");
                  setAmount("");
                  setPayableTo("");
                  setVendorContact("");
                  setVendorLocation("");
                  setVendorOfferings("");
                  if (currentUser?.id) {
                    localStorage.removeItem(`stands_requisition_draft_${currentUser.id}`);
                  }
                  setIsDraftRestored(false);
                }}
                className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 px-3 py-1.5 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800/50 transition-colors whitespace-nowrap"
              >
                Start Fresh
              </button>
            </motion.div>
          )}

          {/* Section 1: Requisition Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2 w-full justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText size={16} className="text-primary" />
                </div>
                <h4 className="text-[10px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">General Information</h4>
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
                className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">New Church Group Name</label>
                    <input 
                      type="text" 
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      placeholder="e.g. St Andrews Choir"
                      className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest ml-1">Optional Scope / Description</label>
                    <input 
                      type="text" 
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      placeholder="e.g. Traditional Choir Ministry"
                      className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 h-9 text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput(false)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider rounded-lg"
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
            <div className="space-y-1.5 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-1.5 mb-1 bg-white dark:bg-slate-800 inline-flex px-2.5 py-1 rounded-full border border-slate-100 dark:border-slate-700 shadow-sm">
                <Users size={12} className="text-primary" />
                <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-[0.15em] leading-none">
                  Department / Church Group
                </span>
              </div>
              
              {isAdminOrFinance ? (
                <div className="space-y-1.5">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="input-field cursor-pointer h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold uppercase tracking-widest text-[11px] text-slate-900 dark:text-slate-200"
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
              ) : currentUser?.groups && currentUser.groups.length > 1 ? (
                <div className="space-y-1.5">
                  <select
                    value={selectedGroup}
                    onChange={(e) => setSelectedGroup(e.target.value)}
                    className="input-field cursor-pointer h-10 px-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-bold uppercase tracking-widest text-[11px] text-slate-900 dark:text-slate-200"
                  >
                    {currentUser.groups.map((groupName, idx) => (
                      <option key={idx} value={groupName} className="font-sans text-xs">
                        {groupName}
                      </option>
                    ))}
                  </select>
                  <p className="text-[9px] text-indigo-500 font-bold uppercase tracking-widest pl-1 font-mono flex items-center gap-1">
                    <span>⚡ Group Selection: You are affiliated with multiple ministry groups. Choose the correct group for permission scoping.</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    disabled
                    value={selectedGroup}
                    className="input-field h-10 px-3 bg-slate-200/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider cursor-not-allowed"
                  />
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-1 font-mono flex items-center gap-1">
                    <span>⚡ Group Auto-filled: Requisition matches user church group securely</span>
                  </p>
                </div>
              )}
            </div>

            {/* Vendor Management / Payable To Field */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-150 dark:border-slate-800 relative">
              <label className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest block mb-1">
                🤝 Payable To (Vendor Name)
              </label>
              
              <div className="relative">
                <input 
                  type="text"
                  required 
                  value={payableTo}
                  onChange={(e) => {
                    setPayableTo(e.target.value);
                    setShowAddVendorForm(false);
                  }}
                  placeholder="e.g. Acme Stationery Supply Ltd"
                  className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 text-xs md:text-sm h-10 px-3 pr-10"
                />
                
                {/* Search suggestion drop-down if user types a matching string */}
                {payableTo.trim() && !isExistingVendor && vendors && vendors.length > 0 && (
                  <div className="absolute left-0 right-0 top-11 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest p-2 bg-slate-50 dark:bg-slate-800/60">
                      Suggestions from registered STANDS Vendors
                    </p>
                    {vendors
                      .filter(v => v.name.toLowerCase().includes(payableTo.toLowerCase()))
                      .map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setPayableTo(v.name);
                          }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800 font-medium text-slate-700 dark:text-slate-300 flex justify-between items-center"
                        >
                          <span>{v.name}</span>
                          <span className={cn(
                            "text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase",
                            v.status === "PENDING" ? "bg-amber-100 text-amber-700" :
                            v.status === "REJECTED" ? "bg-rose-100 text-rose-700" :
                            "bg-emerald-100 text-emerald-700"
                          )}>
                            {v.status === "PENDING" ? "PENDING" :
                             v.status === "REJECTED" ? "REJECTED" :
                             "APPROVED"}
                          </span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* Add Vendor prompt if typed and not an existing registered vendor */}
              {payableTo.trim() && !isExistingVendor && !showAddVendorForm && (
                <motion.div 
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-350">
                      "{payableTo}" is not registered on STANDS Vendors
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                      Would you like to {isAdminOrFinance ? "register them to" : "propose adding them to"} the permanent Diocesan ledger now?
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddVendorForm(true)}
                    className="text-[10px] font-black text-primary hover:text-primary/80 uppercase tracking-widest shrink-0 self-start sm:self-center bg-white dark:bg-slate-850 px-3 py-1.5 rounded-lg border border-primary/25 shadow-sm"
                  >
                    {isAdminOrFinance ? "Register Vendor" : "Propose Vendor"}
                  </button>
                </motion.div>
              )}

              {/* Existing Vendor Badge / Details display */}
              {payableTo.trim() && isExistingVendor && vendors?.filter(v => v.name.toLowerCase().trim() === payableTo.toLowerCase().trim()).map(v => (
                <div key={v.id} className={cn("border rounded-xl p-3 flex items-start gap-3 mt-2", 
                  v.status === "PENDING" ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/30" :
                  v.status === "REJECTED" ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/30" :
                  "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/30"
                )}>
                  <div className={cn("w-5 h-5 flex items-center justify-center text-white shrink-0 font-bold text-xs rounded-full",
                     v.status === "PENDING" ? "bg-amber-500" :
                     v.status === "REJECTED" ? "bg-rose-500" :
                     "bg-emerald-500"
                  )}>
                    {v.status === "PENDING" ? "!" : v.status === "REJECTED" ? "✕" : "✓"}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                       <p className={cn("text-xs font-bold", 
                          v.status === "PENDING" ? "text-amber-800 dark:text-amber-300" :
                          v.status === "REJECTED" ? "text-rose-800 dark:text-rose-300" :
                          "text-emerald-800 dark:text-emerald-300"
                       )}>
                         {v.status === "PENDING" ? "Vendor Pending Approval" : 
                          v.status === "REJECTED" ? "Vendor Rejected" : 
                          "STANDS Verified Vendor Linked"}
                       </p>
                    </div>
                    
                    <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-1 space-y-0.5">
                      <p>📍 <span className="font-semibold">Location:</span> {v.location || "Not specified"}</p>
                      <p>📞 <span className="font-semibold">Contact:</span> {v.contact || "Not specified"}</p>
                      <p>🛍️ <span className="font-semibold">Offers:</span> {v.offerings || "Not specified"}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Register Vendor expanded sub-form */}
              {showAddVendorForm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mt-2 space-y-3"
                >
                  <p className="text-[10px] font-black text-slate-600 dark:text-slate-350 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-1.5">
                    {isAdminOrFinance ? "Register" : "Propose"} "{payableTo}" Details
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Contact Reference (Phone/Email)</label>
                      <input 
                        type="text"
                        value={vendorContact}
                        onChange={(e) => setVendorContact(e.target.value)}
                        placeholder="e.g. +254 712 345678 / sales@firm.com"
                        className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 h-9 text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">Physical Location</label>
                      <input 
                        type="text"
                        value={vendorLocation}
                        onChange={(e) => setVendorLocation(e.target.value)}
                        placeholder="e.g. Bishop Road, Nairobi"
                        className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 h-9 text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest ml-1">What they offer / Products / services</label>
                    <input 
                      type="text"
                      value={vendorOfferings}
                      onChange={(e) => setVendorOfferings(e.target.value)}
                      placeholder="e.g. Stationery, Tents, Catering services..."
                      className="input-field bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 border-slate-200 dark:border-slate-800 h-9 text-xs"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddVendorForm(false)}
                      className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-bold uppercase tracking-wider rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingVendor || !payableTo.trim()}
                      onClick={handleSaveVendor}
                      className="px-3.5 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-wider rounded-lg flex items-center gap-1 hover:bg-primary/95 shadow-sm"
                    >
                      {isSavingVendor ? <Loader2 size={10} className="animate-spin" /> : null}
                      <span>{isAdminOrFinance ? "Save Vendor to STANDS" : "Submit Proposal"}</span>
                    </button>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Requisition Title</label>
              <input 
                name="title" 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required 
                className="input-field text-xs md:text-sm"
                placeholder="Briefly describe the request (e.g. Youth Camp Catering)"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Description</label>
              <textarea 
                name="description" 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
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
          <div className="space-y-4 p-4 md:p-6 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <DollarSign size={16} className="text-secondary" />
              </div>
              <h4 className="text-[10px] md:text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Financial breakdown</h4>
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
                <div className="min-h-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 flex items-center text-[10px] md:text-[11px] text-slate-500 dark:text-slate-400 font-medium italic overflow-hidden leading-snug">
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
              <h4 className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Quotations & Documents</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-3">
                <label 
                  onDragOver={handleDragOver}
                  onDragEnter={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer group flex-1",
                    isDragging 
                      ? "border-emerald-500 bg-emerald-500/10 dark:border-emerald-400 dark:bg-emerald-400/10 scale-[1.02]" 
                      : "border-slate-200 dark:border-slate-800 hover:border-primary/40 dark:hover:border-primary/60 hover:bg-primary/5 dark:hover:bg-primary/5"
                  )}
                >
                  <input type="file" multiple onChange={handleFileChange} className="hidden" />
                  <div className="w-9 h-9 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Upload size={16} className={cn("text-slate-400 dark:text-slate-300 group-hover:text-primary", isDragging && "text-emerald-500 dark:text-emerald-400")} />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isDragging ? "Drop your files here!" : "Click or drag & drop documents"}
                    </p>
                    <p className="text-[9px] text-slate-400 dark:text-slate-550 mt-0.5 uppercase tracking-widest">PDF, Image, XLSX max 2MB</p>
                  </div>
                </label>

                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex items-center justify-center gap-2.5 p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-200 hover:bg-emerald-50/20 text-slate-700 dark:text-slate-300 hover:text-emerald-700 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer group"
                >
                  <Camera size={14} className="text-slate-400 dark:text-slate-300 group-hover:text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Use Camera to Scan</span>
                </button>
              </div>

              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-2 scrollbar-hide">
                <AnimatePresence>
                  {attachments.map((file, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800/50 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white dark:bg-slate-950 flex items-center justify-center border border-slate-100 dark:border-slate-800 text-slate-400 font-black text-[10px] uppercase font-mono overflow-hidden shrink-0 shadow-sm">
                          {file.type.startsWith("image/") ? (
                            <img 
                              src={URL.createObjectURL(file)} 
                              alt="preview" 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <span>{file.name.split('.').pop()?.slice(0, 3)}</span>
                          )}
                        </div>
                        <div className="overflow-hidden max-w-[150px]">
                          <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
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
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30 flex gap-3 items-start">
            <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 mt-0.5">
              <Info size={12} />
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
              Important: You are submitting a legal financial request to the Diocese ledger. Ensure all supporting documents are accurate. Approval processing typically takes 24-72 hours.
            </p>
          </div>
        </form>

        <div className="px-4 md:px-8 py-4 md:py-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/80 flex flex-col md:flex-row justify-end gap-3">
          <button 
            type="button"
            onClick={handleCloseAttempt}
            className="w-full md:w-auto px-6 py-3 md:py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-slate-600 dark:text-slate-350 rounded-xl text-[10px] md:text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer"
          >
            DISCARD DRAFT
          </button>
          <button 
            disabled={loading || !amount || !attachments.length || !navigator.onLine}
            type="submit"
            form="new-req-form" 
            className="w-full md:w-auto btn-primary disabled:opacity-50 disabled:scale-100 flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl text-center"
            onClick={() => {
              if (!navigator.onLine) {
                alert("Cannot perform this action offline.");
                return;
              }
              const form = document.getElementById('new-req-form') as HTMLFormElement;
              if (form) form.requestSubmit();
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            <span className="uppercase tracking-widest text-[10px] md:text-xs">
              {!navigator.onLine ? "OFFLINE: READ-ONLY MODE" : (loading ? "INITIALIZING LEDGER..." : "SUBMIT FOR L1 APPROVAL")}
            </span>
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {isCameraOpen && (
          <CameraCapture 
            onCapture={(file) => setAttachments(prev => [...prev, file])} 
            onClose={() => setIsCameraOpen(false)} 
          />
        )}
      </AnimatePresence>

      <ConfirmationModal 
        isOpen={showDraftConfirm}
        title="Save Requisition as Draft?"
        message="You have unsaved changes in this requisition. Would you like to save it as a draft so you can resume later, or discard your draft changes permanently?"
        confirmText="YES, SAVE AS DRAFT"
        cancelText="DISCARD DRAFT"
        onConfirm={handleSaveDraft}
        onCancel={() => {
          if (currentUser?.id) {
            localStorage.removeItem(`stands_requisition_draft_${currentUser.id}`);
          }
          setShowDraftConfirm(false);
          onClose();
        }}
      />
    </div>
  );
};
