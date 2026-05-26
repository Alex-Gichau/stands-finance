/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole, UserProfile } from "../types";
import { cn } from "../lib/utils";
import { 
  Users, 
  Shield, 
  UserX, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  UserPlus, 
  Loader2, 
  Eye, 
  EyeOff, 
  Edit,
  MoreVertical,
  Mail,
  Fingerprint,
  Building2,
  XCircle,
  ShieldCheck,
  Clock
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const UsersPanel: React.FC = () => {
  const { 
    users, 
    approveUser, 
    suspendUser, 
    updateUserRole, 
    updateUserProfile, 
    currentUser, 
    adminRegisterUser,
    churchGroups,
    addChurchGroup,
    deleteChurchGroup
  } = useRequisitions();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");

  // Group modal states
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [isGroupSubmitting, setIsGroupSubmitting] = useState(false);

  // Registration modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>(UserRole.CHURCH_GROUP);
  const [group, setGroup] = useState("");
  const [approverCode, setApproverCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [regType, setRegType] = useState<"PASSWORD" | "GMAIL">("PASSWORD");
  const [generatedInvite, setGeneratedInvite] = useState<{ url: string; email: string; name: string } | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Editing states
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<UserRole>(UserRole.CHURCH_GROUP);
  const [editGroup, setEditGroup] = useState("");
  const [editApproverCode, setEditApproverCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  const startEditing = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditGroup(user.group || "");
    setEditApproverCode(user.approverCode || "");
    setEditError(null);
    setEditSuccess(null);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!name.trim()) return setError("Name is required");
    if (!email.trim() || !email.includes("@")) return setError("Valid email required");

    if (regType === "GMAIL") {
      setIsSubmitting(true);
      try {
        const inviteUrl = window.location.origin + "?invite=true&email=" + encodeURIComponent(email.trim()) + "&role=" + role + "&group=" + encodeURIComponent(group || "") + "&code=" + approverCode;
        setGeneratedInvite({
          url: inviteUrl,
          email: email.trim(),
          name: name.trim()
        });
        setSuccess(`Secure Gmail invitation link generated successfully for ${name}!`);
      } catch (err: any) {
        setError(err?.message || "Generation failed.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (password.length < 8 || password.length > 15) return setError("Password must be between 8 and 15 characters");

    setIsSubmitting(true);
    try {
      await adminRegisterUser(
        email.trim(),
        password,
        name.trim(),
        role,
        role === UserRole.CHURCH_GROUP ? group.trim() : undefined,
        (role === UserRole.APPROVER_L1 || role === UserRole.APPROVER_L2) ? approverCode.trim() : undefined
      );

      setSuccess(`Account registered successfully for ${name}!`);
      setName(""); setEmail(""); setPassword(""); setRole(UserRole.CHURCH_GROUP); setGroup(""); setApproverCode("");
      
      setTimeout(() => {
        setIsModalOpen(false);
        setSuccess(null);
      }, 2000);
    } catch (err: any) {
      setError(err?.message || "Registration failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setEditSuccess(null);

    setIsSaving(true);
    try {
      await updateUserProfile(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        group: editRole === UserRole.CHURCH_GROUP ? editGroup.trim() : undefined,
        approverCode: (editRole === UserRole.APPROVER_L1 || editRole === UserRole.APPROVER_L2) ? editApproverCode.trim() : undefined
      });
      setEditSuccess("Profile updated successfully!");
      setTimeout(() => { setEditingUser(null); setEditSuccess(null); }, 1500);
    } catch (err: any) {
      setEditError(err?.message || "Update failed.");
    } finally {
      setIsSaving(false);
    }
  };

  if (currentUser?.role !== UserRole.ADMIN) {
    return (
      <div className="h-full flex items-center justify-center p-12">
        <div className="text-center space-y-6 max-w-md animate-in fade-in transition-all">
          <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto border border-slate-100 ring-8 ring-slate-50/50">
             <ShieldCheck size={40} className="text-slate-300" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Access Restricted</h2>
            <p className="text-sm text-slate-500 font-medium">Only System Administrators can access the user directory and rights management console.</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === "ALL" || u.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case UserRole.ADMIN: return "bg-primary/10 text-primary border-primary/20";
      case UserRole.APPROVER_L1:
      case UserRole.APPROVER_L2: return "bg-emerald-50 text-emerald-600 border-emerald-100";
      default: return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={24} className="text-primary" />
            Identity & Affiliation
          </h2>
          <p className="text-xs md:text-sm text-slate-500">Manage user directory and organizational structure.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeTab === "groups" && (
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="w-full md:w-auto btn-primary flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800"
            >
              <Building2 size={18} />
              <span className="text-[10px] md:text-xs uppercase tracking-widest font-black">NEW CHURCH GROUP</span>
            </button>
          )}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full md:w-auto btn-primary flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl shadow-lg shadow-primary/20"
          >
            <UserPlus size={18} />
            <span className="text-[10px] md:text-xs uppercase tracking-widest font-black">REGISTER NEW MEMBER</span>
          </button>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab("users")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "users" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          User Directory
        </button>
        <button 
          onClick={() => setActiveTab("groups")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "groups" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          Church Groups ({churchGroups.length})
        </button>
      </div>

      {activeTab === "users" ? (
        <>
          {/* Filter bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by name, email, or protocol ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select 
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
            >
              <option value="ALL">ALL SECURITY ROLES</option>
              {Object.values(UserRole).map(role => (
                <option key={role} value={role}>{role.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-4 md:px-8 py-4">Identification Transaction</th>
                <th className="px-4 md:px-8 py-4 hidden sm:table-cell">Security Level</th>
                <th className="px-4 md:px-8 py-4 hidden md:table-cell">Affiliation / Key</th>
                <th className="px-4 md:px-8 py-4">Status</th>
                <th className="px-4 md:px-8 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => (
                  <motion.tr 
                    key={user.id} 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "group hover:bg-slate-50/50 transition-colors",
                      user.isSuspended && "bg-rose-50/10"
                    )}
                  >
                    <td className="px-3 md:px-8 py-2 md:py-5">
                      <div className="flex items-center gap-2.5 md:gap-4">
                        <div className="w-7 h-7 md:w-10 md:h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] md:text-sm border border-primary/5 shrink-0">
                          {user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] md:text-sm font-bold text-slate-800 leading-tight truncate">{user.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 md:mt-1 truncate">
                            <Mail size={8} className="text-slate-300 md:w-2.5 md:h-2.5" />
                            <p className="text-[7.5px] md:text-[10px] text-slate-400 font-medium truncate tracking-tight">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 md:px-8 py-2.5 md:py-5 hidden sm:table-cell">
                      <span className={cn(
                        "px-1.5 py-0.5 md:px-2.5 md:py-1 rounded-full border text-[7.5px] md:text-[9px] font-black uppercase tracking-[0.1em] md:tracking-[0.15em]",
                        getRoleBadge(user.role)
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 hidden md:table-cell">
                      {user.role === UserRole.CHURCH_GROUP ? (
                        <div className="flex items-center gap-1.5 text-slate-600">
                          <Building2 size={12} className="text-slate-300" />
                          <span className="text-[10px] font-bold uppercase tracking-tight italic">
                            {user.group || "INDEPENDENT"}
                          </span>
                        </div>
                      ) : (user.role === UserRole.APPROVER_L1 || user.role === UserRole.APPROVER_L2) ? (
                        <div className="flex items-center gap-1.5 text-primary">
                          <Fingerprint size={12} className="text-primary/40" />
                          <span className="text-[10px] font-mono font-bold tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                            {user.approverCode || "TRANSACTION_PENDING"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SYSTEM_CORE</span>
                      )}
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5">
                      <div className="flex items-center gap-2">
                        {!user.isApproved ? (
                          <div className="flex items-center gap-1 px-2 md:px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 animate-pulse">
                            <Clock size={10} className="md:w-3 md:h-3" />
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">WAITING ROOM</span>
                          </div>
                        ) : user.isSuspended ? (
                          <div className="flex items-center gap-1 px-2 md:px-3 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                            <UserX size={10} className="md:w-3 md:h-3" />
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">SUSPENDED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 px-2 md:px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                            <CheckCircle2 size={10} className="md:w-3 md:h-3" />
                            <span className="text-[8px] md:text-[9px] font-black uppercase tracking-widest">ACTIVE</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-3 md:py-5 text-right">
                      <div className="flex justify-end items-center gap-1 md:gap-2">
                        <button 
                          onClick={() => startEditing(user)}
                          className="p-2 md:p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/20 rounded-lg md:rounded-xl transition-all"
                          title="Detailed Configuration"
                        >
                          <Edit size={14} className="md:w-4 md:h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>
      </>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {churchGroups.map((group) => (
              <motion.div
                key={group.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm group hover:border-primary/20 transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                    <Building2 size={24} />
                  </div>
                  <button 
                    onClick={() => deleteChurchGroup(group.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <XCircle size={18} />
                  </button>
                </div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-1">{group.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed min-h-[3rem]">{group.description || "No description provided."}</p>
                <div className="mt-6 pt-6 border-t border-slate-50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-300" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {users.filter(u => u.group === group.name).length} MEMBERS
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-300">{group.id}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <button 
            onClick={() => setIsGroupModalOpen(true)}
            className="border-2 border-dashed border-slate-200 p-6 rounded-[2rem] flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-primary/40 hover:text-primary transition-all group"
          >
            <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Building2 size={24} />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">REGISTER NEW GROUP</span>
          </button>
        </div>
      )}

      <div className="p-6 bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ShieldCheck size={120} className="text-white" />
        </div>
        <div className="relative z-10 flex gap-6 items-start">
          <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20">
            <AlertCircle size={24} />
          </div>
          <div className="space-y-2">
            <h4 className="text-sm font-black text-white uppercase tracking-[0.2em]">Security Protocol Directive</h4>
            <p className="text-xs text-slate-400 leading-relaxed max-w-2xl font-medium">
              Administrative changes to security levels take effect immediately across all active transactions. Downgrading an account from <strong>ADMIN</strong> level will revoke access to this management layer. Suspended transactions are immediately disconnected from the financial ledger.
            </p>
          </div>
        </div>
      </div>

      {/* Registration/Edit Modals via AnimatePresence */}
      <AnimatePresence>
        {(isModalOpen || editingUser) && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden border border-slate-200 flex flex-col"
            >
              <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] md:text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                    {isModalOpen ? "New Member Credentials" : "Update Member Transaction"}
                  </h3>
                  <p className="text-[8px] md:text-[10px] text-slate-400 font-mono tracking-widest mt-1">SYS_ACCESS_CONTROL_V4</p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setEditingUser(null); setError(null); setSuccess(null); setGeneratedInvite(null); }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle size={18} className="text-slate-400 md:w-5 md:h-5" />
                </button>
              </div>

              <form onSubmit={isModalOpen ? handleRegister : handleEditSave} className="p-4 md:p-8 space-y-4 md:space-y-6">
                 {isModalOpen && (
                   <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full mb-2">
                     <button
                       type="button"
                       onClick={() => { setRegType("PASSWORD"); setGeneratedInvite(null); setError(null); setSuccess(null); }}
                       className={cn(
                         "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                         regType === "PASSWORD" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                       )}
                     >
                       Direct Password Account
                     </button>
                     <button
                       type="button"
                       onClick={() => { setRegType("GMAIL"); setGeneratedInvite(null); setError(null); setSuccess(null); }}
                       className={cn(
                         "flex-1 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                         regType === "GMAIL" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
                       )}
                     >
                       Gmail Invite Sign-up Link
                     </button>
                   </div>
                 )}

                 {(error || editError) && (
                  <div className="p-3 md:p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 items-center text-[10px] md:text-xs text-rose-600 font-bold">
                    <AlertCircle size={14} className="md:w-4 md:h-4" />
                    <span>{error || editError}</span>
                  </div>
                )}
                {(success || editSuccess) && (
                  <div className="p-3 md:p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-center text-[10px] md:text-xs text-emerald-600 font-bold">
                    <CheckCircle2 size={14} className="md:w-4 md:h-4" />
                    <span>{success || editSuccess}</span>
                  </div>
                )}

                {isModalOpen && regType === "GMAIL" && generatedInvite && (
                  <div className="p-4 bg-sky-50 border border-sky-100 rounded-2xl space-y-3 animate-in fade-in duration-300 text-left">
                    <div className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-wider">
                      <Mail size={14} />
                      <span>Invite Ready to Transmit</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                      An entry has been prepared for <strong className="text-slate-850 font-black">{generatedInvite.name}</strong>. Provide this link to activate and log in via Google/Gmail with their assigned role:
                    </p>
                    <input 
                      type="text" 
                      readOnly 
                      value={generatedInvite.url} 
                      className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-[10px] font-mono text-slate-600 select-all outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedInvite.url);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="flex-1 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        {copiedInvite ? "COPIED!" : "COPY SECURE LINK"}
                      </button>
                      <a
                        href={`mailto:${encodeURIComponent(generatedInvite.email)}?subject=${encodeURIComponent("St. Andrews Finance Hub Access Invitation")}&body=${encodeURIComponent(`Hello ${generatedInvite.name},\n\nYou have been authorized as a ${role.replace("_", " ")}${group ? ` representing the ${group} group` : ""} on the St. Andrews Requisition Hub.\n\nPlease activate your access by clicking this link and signing in with your Google/Gmail Account:\n\n${generatedInvite.url}\n\nWarm regards,\nSystem Administrator`)}`}
                        className="flex-1 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all text-center flex items-center justify-center gap-1.5"
                      >
                        <Mail size={12} />
                        SEND EMAIL INVITE
                      </a>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text"
                      required
                      value={isModalOpen ? name : editName}
                      onChange={(e) => {
                        if (isModalOpen) {
                          setName(e.target.value);
                          setGeneratedInvite(null);
                        } else {
                          setEditName(e.target.value);
                        }
                      }}
                      className="input-field text-xs md:text-sm"
                      placeholder="Enter legal name"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <label className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Transaction (Email)</label>
                    <input 
                      type="email"
                      required
                      disabled={!isModalOpen}
                      value={isModalOpen ? email : editingUser?.email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setGeneratedInvite(null);
                      }}
                      className={cn("input-field text-xs md:text-sm", !isModalOpen && "bg-slate-50 cursor-not-allowed")}
                      placeholder="email@church.com"
                    />
                  </div>
                </div>

                {isModalOpen && regType === "PASSWORD" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Credentials (8-15 characters)</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        maxLength={15}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pr-12 font-mono"
                        placeholder="Min 8, max 15 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-primary transition-colors"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-slate-50 rounded-2xl p-6 space-y-6 border border-slate-100">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Protocol Level (Role)</label>
                      <select
                        value={isModalOpen ? role : editRole}
                        onChange={(e) => isModalOpen ? setRole(e.target.value as UserRole) : setEditRole(e.target.value as UserRole)}
                        className="input-field bg-white font-bold uppercase tracking-widest cursor-pointer"
                      >
                        {Object.values(UserRole).map((r) => (
                          <option key={r} value={r}>{r.replace("_", " ")}</option>
                        ))}
                      </select>
                    </div>

                    {(isModalOpen ? role : editRole) === UserRole.CHURCH_GROUP && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ministry Group Affiliation</label>
                        <div className="relative">
                          <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <select
                            required
                            value={isModalOpen ? group : editGroup}
                            onChange={(e) => isModalOpen ? setGroup(e.target.value) : setEditGroup(e.target.value)}
                            className="input-field pl-11 bg-white font-bold text-slate-600 uppercase tracking-widest"
                          >
                            <option value="">SELECT GROUP</option>
                            {churchGroups.map(cg => (
                              <option key={cg.id} value={cg.name}>{cg.name}</option>
                            ))}
                            <option value="INDEPENDENT">INDEPENDENT / OTHER</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {((isModalOpen ? role : editRole) === UserRole.APPROVER_L1 || (isModalOpen ? role : editRole) === UserRole.APPROVER_L2) && (
                      <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Security PIN Signature ({ (isModalOpen ? role : editRole) === UserRole.APPROVER_L1 ? "6" : "7" } DIGITS)
                        </label>
                        <div className="relative">
                          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="text"
                            maxLength={(isModalOpen ? role : editRole) === UserRole.APPROVER_L1 ? 6 : 7}
                            required
                            value={isModalOpen ? approverCode : editApproverCode}
                            onChange={(e) => isModalOpen ? setApproverCode(e.target.value.replace(/\D/g, "")) : setEditApproverCode(e.target.value.replace(/\D/g, ""))}
                            className="input-field pl-11 bg-white font-mono font-bold tracking-[0.4em]"
                            placeholder="XXXXXX"
                          />
                        </div>
                      </div>
                    )}
                </div>

                {!isModalOpen && editingUser && (
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Actions</h4>
                    <div className="flex flex-wrap gap-2">
                      {!editingUser.isApproved ? (
                        <button
                          type="button"
                          onClick={async () => {
                            await approveUser(editingUser.id);
                            setEditingUser({ ...editingUser, isApproved: true });
                          }}
                          className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold border border-emerald-100 hover:bg-emerald-100 transition-colors uppercase tracking-widest"
                        >
                          Approve Account
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={async () => {
                            await suspendUser(editingUser.id, !editingUser.isSuspended);
                            setEditingUser({ ...editingUser, isSuspended: !editingUser.isSuspended });
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold border transition-colors uppercase tracking-widest flex items-center justify-center gap-2",
                            editingUser.isSuspended 
                              ? "bg-slate-800 text-white hover:bg-slate-900 border-slate-700" 
                              : "bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-100"
                          )}
                        >
                          {editingUser.isSuspended ? (
                            <><ShieldCheck size={14} /> Restore Connectivity</>
                          ) : (
                            <><UserX size={14} /> Suspend Transaction</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-2 md:pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditingUser(null); }}
                    className="w-full md:w-auto px-8 py-3 bg-slate-50 text-slate-500 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all text-center"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isSaving}
                    className="w-full md:w-auto btn-primary px-10 py-3 md:py-2.5 flex items-center justify-center gap-2 rounded-xl"
                  >
                    {(isSubmitting || isSaving) ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    <span className="text-[10px] md:text-xs uppercase tracking-widest font-black">
                      {isModalOpen ? "AUTHORIZE TRANSACTION" : "CONSOLIDATE UPDATE"}
                    </span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Church Group Registration Modal */}
      <AnimatePresence>
        {isGroupModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">New Church Group</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1">SYS_STRUCT_MOD</p>
                </div>
                <button onClick={() => setIsGroupModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <XCircle size={18} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                setIsGroupSubmitting(true);
                try {
                  await addChurchGroup(groupName, groupDesc);
                  setGroupName(""); setGroupDesc("");
                  setIsGroupModalOpen(false);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsGroupSubmitting(false);
                }
              }} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Group Name</label>
                  <input 
                    type="text"
                    required
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Youth Ministry"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                  <textarea 
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                    className="input-field min-h-[100px] py-3"
                    placeholder="What is the purpose of this group?"
                  />
                </div>
                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsGroupModalOpen(false)}
                    className="px-6 py-2.5 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isGroupSubmitting}
                    className="btn-primary px-8 py-2.5 flex items-center gap-2 rounded-xl"
                  >
                    {isGroupSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Building2 size={16} />}
                    <span className="text-[10px] uppercase tracking-widest font-black">REGISTER GROUP</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

