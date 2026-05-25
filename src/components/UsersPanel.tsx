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
  ShieldCheck
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const UsersPanel: React.FC = () => {
  const { users, approveUser, suspendUser, updateUserRole, updateUserProfile, currentUser, adminRegisterUser } = useRequisitions();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");

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
    if (password.length < 8) return setError("Password must be 8+ chars");

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
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Users size={24} className="text-primary" />
            User Access Management
          </h2>
          <p className="text-sm text-slate-500">Maintain directory nodes and security protocols for the organization.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={18} />
            REGISTER NEW MEMBER
          </button>
        </div>
      </div>

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
              <tr className="bg-slate-50/50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-4">Identification Node</th>
                <th className="px-8 py-4">Security Level</th>
                <th className="px-8 py-4">Affiliation / Key</th>
                <th className="px-8 py-4">Access Status</th>
                <th className="px-8 py-4 text-right">Actions</th>
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
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm border border-primary/5 group-hover:scale-110 transition-transform">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 leading-tight">{user.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <Mail size={10} className="text-slate-300" />
                            <p className="text-[10px] text-slate-400 font-medium">{user.email}</p>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.15em]",
                        getRoleBadge(user.role)
                      )}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-8 py-5">
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
                            {user.approverCode || "NODE_PENDING"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">SYSTEM_CORE</span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-2">
                        {!user.isApproved ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-600 rounded-lg border border-amber-100 animate-pulse">
                            <AlertCircle size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">PENDING_REVIEW</span>
                          </div>
                        ) : user.isSuspended ? (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-600 rounded-lg border border-rose-100">
                            <UserX size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">SUSPENDED</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                            <CheckCircle2 size={12} />
                            <span className="text-[9px] font-black uppercase tracking-widest">ACTIVE_NODE</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => startEditing(user)}
                          className="p-2.5 bg-white border border-slate-200 text-slate-400 hover:text-primary hover:border-primary/20 rounded-xl transition-all"
                          title="Detailed Configuration"
                        >
                          <Edit size={16} />
                        </button>

                        {!user.isApproved ? (
                          <button 
                            onClick={() => approveUser(user.id)}
                            className="px-4 py-2 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 shadow-sm transition-all"
                          >
                            AUTHORIZE
                          </button>
                        ) : (
                          <button 
                            onClick={() => suspendUser(user.id, !user.isSuspended)}
                            className={cn(
                              "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                              user.isSuspended 
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-100" 
                                : "bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100"
                            )}
                          >
                            {user.isSuspended ? "RESTORE" : "SUSPEND"}
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

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
              Administrative changes to security levels take effect immediately across all active nodes. Downgrading an account from <strong>ADMIN</strong> level will revoke access to this management layer. Suspended nodes are immediately disconnected from the financial ledger.
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
              <div className="px-8 py-6 border-b border-slate-100 bg-white flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">
                    {isModalOpen ? "New Member Credentials" : "Update Member Node"}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1">SYS_ACCESS_CONTROL_V4</p>
                </div>
                <button 
                  onClick={() => { setIsModalOpen(false); setEditingUser(null); setError(null); setSuccess(null); }}
                  className="p-2 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <XCircle size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={isModalOpen ? handleRegister : handleEditSave} className="p-8 space-y-6">
                 {(error || editError) && (
                  <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex gap-3 items-center text-xs text-rose-600 font-bold">
                    <AlertCircle size={16} />
                    <span>{error || editError}</span>
                  </div>
                )}
                {(success || editSuccess) && (
                  <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex gap-3 items-center text-xs text-emerald-600 font-bold">
                    <CheckCircle2 size={16} />
                    <span>{success || editSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                    <input 
                      type="text"
                      required
                      value={isModalOpen ? name : editName}
                      onChange={(e) => isModalOpen ? setName(e.target.value) : setEditName(e.target.value)}
                      className="input-field"
                      placeholder="Enter legal name"
                    />
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-400">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Identity Node (Email)</label>
                    <input 
                      type="email"
                      required
                      disabled={!isModalOpen}
                      value={isModalOpen ? email : editingUser?.email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={cn("input-field", !isModalOpen && "bg-slate-50 cursor-not-allowed")}
                      placeholder="email@church.com"
                    />
                  </div>
                </div>

                {isModalOpen && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Password Credentials</label>
                    <div className="relative">
                      <input 
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="input-field pr-12 font-mono"
                        placeholder="••••••••••••"
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
                          <input 
                            type="text"
                            required
                            value={isModalOpen ? group : editGroup}
                            onChange={(e) => isModalOpen ? setGroup(e.target.value) : setEditGroup(e.target.value)}
                            className="input-field pl-11 bg-white font-bold text-slate-600 uppercase tracking-widest placeholder:not-italic"
                            placeholder="Worship, Youth, Missions..."
                          />
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

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditingUser(null); }}
                    className="px-8 py-3 bg-slate-50 text-slate-500 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || isSaving}
                    className="btn-primary px-10 flex items-center gap-2"
                  >
                    {(isSubmitting || isSaving) ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
                    {isModalOpen ? "AUTHORIZE NODE" : "CONSOLIDATE UPDATE"}
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

