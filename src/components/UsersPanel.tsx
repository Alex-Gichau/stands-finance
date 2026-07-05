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
  X,
  ShieldCheck,
  Clock,
  Download,
  Trash2,
  LogOut,
  Zap
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
    adminResetUserPassword,
    deleteUser,
    adminForceLogoutUser,
    churchGroups,
    lastGroupsSync,
    addChurchGroup,
    deleteChurchGroup,
    addSystemLog,
    loading
  } = useRequisitions();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "groups">("users");

  // Calculate users per security level
  const securityLevelCounts = React.useMemo(() => {
    const counts: Record<string, number> = {
      [UserRole.CHURCH_GROUP]: 0,
      [UserRole.APPROVER_L1]: 0,
      [UserRole.APPROVER_L2]: 0,
      [UserRole.FINANCE]: 0,
      [UserRole.ADMIN]: 0,
      [UserRole.SUPER_ADMIN]: 0,
    };
    users.forEach((u) => {
      if (u.role && counts[u.role] !== undefined) {
        counts[u.role]++;
      }
    });
    return counts;
  }, [users]);

  // Calculate users per affiliated group
  const groupCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    
    // Initialize defined groups
    churchGroups.forEach((g) => {
      if (g && g.name) {
        counts[g.name] = 0;
      }
    });
    
    users.forEach((u) => {
      const uGroups = u.groups && u.groups.length > 0 ? u.groups : (u.group ? [u.group] : ["INDEPENDENT"]);
      uGroups.forEach((gName) => {
        if (gName) {
          counts[gName] = (counts[gName] || 0) + 1;
        }
      });
    });
    return counts;
  }, [users, churchGroups]);

  // Group search & filtering states under identity & affiliations
  const [groupSearchTerm, setGroupSearchTerm] = useState("");

  const filteredChurchGroups = React.useMemo(() => {
    return churchGroups.filter((group) => {
      // Apply text search
      if (groupSearchTerm.trim()) {
        const query = groupSearchTerm.toLowerCase();
        const matchesName = group.name.toLowerCase().includes(query);
        const matchesDesc = (group.description || "").toLowerCase().includes(query);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [churchGroups, groupSearchTerm]);

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
  const [groups, setGroups] = useState<string[]>([]);
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
  const [editGroups, setEditGroups] = useState<string[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsGroupDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const [editApproverCode, setEditApproverCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Custom states for group selection & admin password reset overrides
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<any | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  const handleResetPassword = async (email: string) => {
    setEditError(null);
    setEditSuccess(null);
    setIsResettingPassword(true);
    try {
      await adminResetUserPassword(email);
      setEditSuccess(`Password reset email successfully sent to: ${email}`);
    } catch (err: any) {
      setEditError(err?.message || "Failed to trigger password reset email.");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    try {
      await deleteUser(id);
      setConfirmingDeleteId(null);
    } catch (err: any) {
      alert(err.message || "Failed to delete user.");
    }
  };

  const handleExportCSV = (groupNameFilter?: string) => {
    // Select all user profiles with role === UserRole.CHURCH_GROUP
    let membersToExport = users.filter(u => u.role === UserRole.CHURCH_GROUP);
    
    // Narrow down by specific church group if specified
    if (groupNameFilter) {
      membersToExport = membersToExport.filter(u => u.group === groupNameFilter);
    }

    if (membersToExport.length === 0) {
      alert(groupNameFilter 
        ? `No church group members found for group: "${groupNameFilter}".` 
        : "No church group members found to export."
      );
      return;
    }

    // Prepare CSV Header and Data Rows
    const headers = ["ID", "Name", "Email", "Role", "Church Group", "Status", "Suspended"];
    const rows = membersToExport.map(u => [
      u.id,
      `"${u.name.replace(/"/g, '""')}"`,
      u.email,
      u.role,
      `"${(u.group || "").replace(/"/g, '""')}"`,
      !u.isApproved ? "PENDING" : u.isSuspended ? "SUSPENDED" : "ACTIVE",
      u.isSuspended ? "YES" : "NO"
    ]);

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const filename = groupNameFilter 
      ? `church_members_${groupNameFilter.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.csv`
      : "all_church_group_members.csv";
      
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Record system log for audit trail purposes
    if (addSystemLog) {
      addSystemLog(
        "EXPORT_CHURCH_MEMBERS_CSV", 
        `Admin exported church group members CSV${groupNameFilter ? ` for church group: ${groupNameFilter}` : ""}`, 
        { groupNameFilter, count: membersToExport.length }
      );
    }
  };

  const startEditing = (user: UserProfile) => {
    setEditingUser(user);
    setEditName(user.name);
    setEditRole(user.role);
    setEditGroup(user.group || "");
    setEditGroups(user.groups || (user.group ? [user.group] : []));
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
      const finalGroups = groups.filter(Boolean);
      const primaryGroup = finalGroups[0] || group.trim() || "";
      await adminRegisterUser(
        email.trim(),
        password,
        name.trim(),
        role,
        primaryGroup || undefined,
        (role === UserRole.APPROVER_L1 || role === UserRole.APPROVER_L2) ? approverCode.trim() : undefined,
        finalGroups
      );

      setSuccess(`Account registered successfully for ${name}!`);
      setName(""); setEmail(""); setPassword(""); setRole(UserRole.CHURCH_GROUP); setGroup(""); setGroups([]); setApproverCode("");
      
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

    const finalGroups = editGroups.filter(Boolean);
    if (finalGroups.length === 0) {
      setEditError("Ministry Group Affiliations: You must select at least one ministry group for permission scoping.");
      return;
    }

    setIsSaving(true);
    try {
      const primaryGroup = finalGroups[0] || editGroup.trim() || "";
      await updateUserProfile(editingUser.id, {
        name: editName.trim(),
        role: editRole,
        group: primaryGroup || undefined,
        groups: finalGroups,
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

  if (currentUser?.role !== UserRole.ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN) {
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
    const hideSuperAdmin = u.role === UserRole.SUPER_ADMIN && currentUser?.role !== UserRole.SUPER_ADMIN;
    return matchesSearch && matchesRole && !hideSuperAdmin;
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
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => handleExportCSV()}
            className="w-full md:w-auto bg-slate-50 hover:bg-slate-100 text-slate-700 hover:text-slate-950 border border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2 px-6 py-3 md:py-2.5 rounded-xl transition-all"
            title="Export all Church Group Members as CSV"
          >
            <Download size={18} className="text-slate-600" />
            <span className="text-[10px] md:text-xs uppercase tracking-widest font-black">EXPORT MEMBERS CSV</span>
          </button>
          
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
      <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab("users")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "users" ? "bg-white dark:bg-slate-900 text-primary dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          <div className="flex items-center gap-2">
            <span>User Directory</span>
            <div className="flex items-center gap-1">
              <span className="bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full text-[9px]">
                {users.length}
              </span>
              <span className="bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 px-2 py-0.5 rounded-full text-[9px] flex items-center gap-1" title="Online Users">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                {users.filter(u => u.isOnline).length}
              </span>
            </div>
          </div>
        </button>
        <button 
          onClick={() => setActiveTab("groups")}
          className={cn(
            "px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
            activeTab === "groups" ? "bg-white dark:bg-slate-900 text-primary dark:text-blue-400 shadow-sm" : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          )}
        >
          Church Groups ({churchGroups.length})
        </button>
      </div>

      {activeTab === "users" ? (
        <>
          {/* Directory Metrics & Quick Stats: Single Horizontal Scrolling Row */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm mb-4">
            <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              
              {/* Security Levels */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <Shield size={12} className="text-primary" />
                  <span>Roles:</span>
                </div>
                <div className="flex items-center gap-2">
                  {Object.values(UserRole).map((role) => {
                    const count = securityLevelCounts[role] || 0;
                    let colorClasses = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700/60";
                    if (role === UserRole.SUPER_ADMIN) {
                      colorClasses = "bg-purple-50 text-purple-700 border-purple-100 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30";
                    } else if (role === UserRole.ADMIN) {
                      colorClasses = "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30";
                    } else if (role === UserRole.APPROVER_L1 || role === UserRole.APPROVER_L2) {
                      colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30";
                    } else if (role === UserRole.FINANCE) {
                      colorClasses = "bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30";
                    } else if (role === UserRole.CHURCH_GROUP) {
                      colorClasses = "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30";
                    }

                    return (
                      <div 
                        key={role}
                        className={cn(
                          "px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] shrink-0",
                          colorClasses
                        )}
                      >
                        <span className="uppercase tracking-wide text-[9px] whitespace-nowrap">{role.replace('_', ' ')}</span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-white/60 dark:bg-black/20 font-mono">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0 self-center" />

              {/* Affiliated Groups */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-1 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  <Building2 size={12} className="text-teal-500 animate-pulse" />
                  <span>Groups:</span>
                </div>
                <div className="flex items-center gap-2">
                  {Object.entries(groupCounts).map(([gName, count]) => {
                    const isIndependent = gName === "INDEPENDENT";
                    return (
                      <div 
                        key={gName}
                        className={cn(
                          "px-2.5 py-1 rounded-xl border text-[11px] font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] shrink-0",
                          isIndependent 
                            ? "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800/40 dark:text-slate-400 dark:border-slate-700/40"
                            : "bg-teal-50 text-teal-700 border-teal-100 dark:bg-teal-950/20 dark:text-teal-400 dark:border-teal-900/30"
                        )}
                      >
                        <span className="uppercase tracking-wide text-[9px] whitespace-nowrap max-w-[120px] truncate" title={gName}>
                          {gName}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-white/60 dark:bg-black/20 font-mono">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Filter bar */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input 
            type="text" 
            placeholder="Search by name, email, or protocol ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl text-sm focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-1.5">
            <Filter size={14} className="text-slate-400" />
            <select 
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer [&>option]:bg-white [&>option]:dark:bg-slate-900"
            >
              <option value="ALL">ALL SECURITY ROLES</option>
              {Object.values(UserRole)
                .filter(role => currentUser?.role === UserRole.SUPER_ADMIN || role !== UserRole.SUPER_ADMIN)
                .map(role => (
                <option key={role} value={role}>{role.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-850/50 border-b border-slate-200 dark:border-slate-800 text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
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
                    onClick={() => startEditing(user)}
                    className={cn(
                      "group hover:bg-slate-50/50 transition-colors cursor-pointer",
                      user.isSuspended && "bg-rose-50/10"
                    )}
                  >
                    <td className="px-3 md:px-8 py-2 md:py-5">
                      <div className="flex items-center gap-2.5 md:gap-4">
                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full p-[2px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-sm shrink-0 overflow-hidden group-hover:scale-105 transition-transform">
                          <div className="w-full h-full rounded-full overflow-hidden bg-slate-200 dark:bg-slate-900 flex items-center justify-center text-primary font-black text-[10px] md:text-sm">
                            {user.photoURL ? (
                              <img 
                                src={user.photoURL} 
                                alt={user.name} 
                                className="w-full h-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              user.name.charAt(0)
                            )}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] md:text-sm font-bold text-slate-800 dark:text-slate-205 leading-tight truncate">{user.name}</p>
                          <div className="flex items-center gap-1 mt-0.5 md:mt-1 truncate">
                            <Mail size={8} className="text-slate-300 md:w-2.5 md:h-2.5" />
                            <p className="text-[7.5px] md:text-[10px] text-slate-400 dark:text-slate-410 font-medium truncate tracking-tight">{user.email}</p>
                          </div>
                          {(() => {
                            const now = new Date();
                            const isOnline = user.isOnline && user.lastSeen && (now.getTime() - new Date(user.lastSeen).getTime() < 3 * 60000);
                            return (
                              <div className="flex items-center gap-1.5 mt-1" title={user.lastSeen ? new Date(user.lastSeen).toLocaleString() : ""}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-300")} />
                                <span className="text-[7px] md:text-[8px] text-slate-400 font-medium tracking-tight">
                                  {(() => {
                                    const fallbackTime = isOnline ? now.toISOString() : new Date(now.getTime() - 3600000 * 4).toISOString();
                                    const d = new Date(user.lastSeen || fallbackTime);
                                    if (isNaN(d.getTime())) {
                                      return "Last Seen --/--/---- --:--:--";
                                    }
                                    const day = String(d.getDate()).padStart(2, '0');
                                    const month = String(d.getMonth() + 1).padStart(2, '0');
                                    const year = d.getFullYear();
                                    const hours = String(d.getHours()).padStart(2, '0');
                                    const minutes = String(d.getMinutes()).padStart(2, '0');
                                    const seconds = String(d.getSeconds()).padStart(2, '0');
                                    const formattedStr = `Last Seen ${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
                                    return formattedStr;
                                  })()}
                                </span>
                              </div>
                            );
                          })()}
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
                      <div className="flex flex-col gap-1.5 justify-center">
                        <div className="flex flex-col gap-1 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Building2 size={12} className="text-slate-300" />
                            <span className="text-[10px] font-bold uppercase tracking-tight italic">
                              {(user.groups && user.groups.length > 0) ? user.groups[0] : (user.group || "INDEPENDENT")}
                            </span>
                          </div>
                          {user.groups && user.groups.length > 1 && (
                            <div className="flex flex-wrap gap-1 mt-1 pl-4">
                              {user.groups.slice(1).map((g, idx) => (
                                <span key={`group-tag-${g}-${idx}`} className="text-[8px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {g}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {(user.role === UserRole.APPROVER_L1 || user.role === UserRole.APPROVER_L2) && (
                          <div className="flex items-center gap-1.5 text-primary">
                            <Fingerprint size={12} className="text-primary/40" />
                            <span className="text-[10px] font-mono font-bold tracking-widest bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10">
                              {user.approverCode || "TRANSACTION_PENDING"}
                            </span>
                          </div>
                        )}
                      </div>
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

                    <td className="px-4 md:px-8 py-3 md:py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-1 md:gap-2">
                        {user.id !== currentUser?.id && currentUser?.role === UserRole.SUPER_ADMIN && (
                          <button 
                            onClick={async () => {
                              if (window.confirm(`Force logout user ${user.email}?`)) {
                                await adminForceLogoutUser(user.id);
                              }
                            }}
                            className="p-2 md:p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 hover:border-rose-200 dark:hover:border-rose-900/40 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg md:rounded-xl transition-all"
                            title="Force Logout"
                          >
                            <LogOut size={14} className="md:w-4 md:h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => startEditing(user)}
                          className="p-2 md:p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:text-primary dark:hover:text-primary/80 hover:border-primary/20 dark:hover:border-primary/45 rounded-lg md:rounded-xl transition-all"
                          title="Detailed Configuration"
                        >
                          <Edit size={14} className="md:w-4 md:h-4" />
                        </button>

                        {confirmingDeleteId === user.id ? (
                          <div className="flex items-center gap-1 animate-in slide-in-from-right-2">
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="px-2 py-1.5 bg-rose-600 text-white text-[9px] font-black uppercase rounded-lg shadow-lg shadow-rose-200"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => setConfirmingDeleteId(null)}
                              className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-colors"
                            >
                              <XCircle size={14} />
                            </button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmingDeleteId(user.id)}
                            disabled={user.id === currentUser?.id}
                            className={cn(
                              "p-2 md:p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-450 hover:border-rose-100 dark:hover:border-rose-900/60 rounded-lg md:rounded-xl transition-all",
                              user.id === currentUser?.id && "opacity-20 cursor-not-allowed"
                            )}
                            title={user.id === currentUser?.id ? "Cannot delete self" : "Delete Member"}
                          >
                            <Trash2 size={14} className="md:w-4 md:h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && loading && (
            <div className="py-8 w-full flex flex-col gap-3 px-6">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="w-full h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl animate-pulse" />
              ))}
            </div>
          )}

          {filteredUsers.length === 0 && !loading && (
            <div className="py-16 flex flex-col items-center justify-center text-slate-400">
              <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">No Members Found</h4>
              <p className="text-[10px]">Adjust your search query or role filter.</p>
            </div>
          )}
        </div>
      </div>
      </>
      ) : (
        <>
          {/* Church Groups Search and Affiliations filter layer */}
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-4 mb-6">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search groups under identity, affiliations, description, or name..."
                value={groupSearchTerm}
                onChange={(e) => setGroupSearchTerm(e.target.value)}
                className="w-full pl-12 pr-10 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200 rounded-xl text-sm focus:border-primary/40 focus:ring-4 focus:ring-primary/5 outline-none transition-all"
              />
              {groupSearchTerm && (
                <button 
                  onClick={() => setGroupSearchTerm("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {churchGroups.length === 0 && loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="bg-slate-100 dark:bg-slate-800 p-4.5 rounded-2xl h-32 animate-pulse" />
              ))}
            </div>
          )}

          {churchGroups.length === 0 && !loading && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
               <div className="py-16 w-full flex flex-col items-center justify-center text-slate-400 col-span-full">
                  <h4 className="text-[10px] font-black uppercase tracking-widest mb-1">No Church Groups Found</h4>
               </div>
               <button 
                  onClick={() => setIsGroupModalOpen(true)}
                  className="border-2 border-dashed border-slate-200 p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary/40 hover:text-primary transition-all group min-h-[142px]"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Building2 size={20} />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.15em]">REGISTER NEW GROUP</span>
                </button>
            </div>
          )}

          {/* Search filtering with 0 matches */}
          {churchGroups.length > 0 && filteredChurchGroups.length === 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-12 rounded-2xl flex flex-col items-center justify-center text-center mb-6">
              <Search size={32} className="text-slate-300 mb-3" />
              <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-1">
                No matching church groups found
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm mb-4">
                No groups matched your search keyword: <strong className="text-slate-700 dark:text-slate-300">"{groupSearchTerm}"</strong>
              </p>
              <button 
                onClick={() => {
                  setGroupSearchTerm("");
                }}
                className="btn-primary px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl shadow-md cursor-pointer"
              >
                Clear Search
              </button>
            </div>
          )}

          {filteredChurchGroups.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredChurchGroups.map((group) => {
                  return (
                    <motion.div
                      key={group.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setSelectedGroupForMembers(group)}
                      className="bg-white dark:bg-slate-900 p-4.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary/50 hover:shadow-md transition-all cursor-pointer hover:scale-[1.01]"
                    >
                      <div className="flex justify-between items-start mb-2.5">
                        <div className="w-10 h-10 bg-slate-50 dark:bg-slate-950 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-primary/10 group-hover:text-primary transition-all">
                          <Building2 size={20} />
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChurchGroup(group.id);
                          }}
                          className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition-all"
                          title="Delete Group"
                        >
                          <XCircle size={16} />
                        </button>
                      </div>

                      <h3 className="text-xs font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-1 truncate" title={group.name}>
                        {group.name}
                      </h3>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[2.5rem] line-clamp-2" title={group.description || "No description provided."}>
                        {group.description || "No description provided."}
                      </p>
                      
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Users size={12} className="text-slate-400" />
                          <span className="text-[9px] font-black text-primary dark:text-blue-400 uppercase tracking-widest bg-primary/5 dark:bg-blue-500/5 px-1.5 py-0.5 rounded-md">
                            {users.filter(u => u.group === group.name).length} MEMBERS
                          </span>
                        </div>
                        <span className="text-[8px] font-mono text-slate-300 dark:text-slate-600" title={group.id}>#{group.id.toUpperCase().substring(0, 5)}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <button 
                onClick={() => setIsGroupModalOpen(true)}
                className="border-2 border-dashed border-slate-200 dark:border-slate-800 p-4.5 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-primary/40 hover:text-primary transition-all group min-h-[142px]"
              >
                <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-slate-950 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Building2 size={20} />
                </div>
                <span className="text-[9px] font-black uppercase tracking-[0.15em]">REGISTER NEW GROUP</span>
              </button>
            </div>
          )}
        </>
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-none md:rounded-3xl w-full max-w-xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
            >
              <div className="px-4 md:px-8 py-4 md:py-6 border-b border-slate-100 bg-white flex items-center justify-between sticky top-0 z-10">
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
                  <X size={20} className="text-slate-500 md:w-5 md:h-5" />
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
                        {Object.values(UserRole)
                          .filter(r => currentUser?.role === UserRole.SUPER_ADMIN || r !== UserRole.SUPER_ADMIN)
                          .map((r) => (
                          <option key={r} value={r}>{r.replace("_", " ")}</option>
                        ))}
                      </select>
                    </div>

                     <div className="space-y-2 animate-in slide-in-from-top-2 duration-300 relative" ref={dropdownRef}>
                       <div className="flex justify-between items-center ml-1">
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                           Ministry Group Affiliations (Select One or More)
                         </label>
                         {lastGroupsSync && (
                           <span 
                             className="text-[9px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md flex items-center gap-1 cursor-help"
                             title={`Fresh from Supabase. Last synchronized: ${lastGroupsSync.toLocaleString()}`}
                           >
                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                             Synced {lastGroupsSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                           </span>
                         )}
                       </div>
                       <div 
                         className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 min-h-[46px] flex flex-wrap gap-2 items-center cursor-text transition-colors focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-600/10"
                         onClick={() => setIsGroupDropdownOpen(true)}
                       >
                         {(isModalOpen ? groups : editGroups).map((g, idx) => (
                           <span key={`user-group-${g}-${idx}`} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold uppercase tracking-wider rounded-md">
                             {g}
                             <button
                               type="button"
                               onClick={(e) => {
                                 e.stopPropagation();
                                 if (isModalOpen) {
                                   const next = groups.filter(item => item !== g);
                                   setGroups(next);
                                   setGroup(next[0] || "");
                                 } else {
                                   const next = editGroups.filter(item => item !== g);
                                   setEditGroups(next);
                                   setEditGroup(next[0] || "");
                                 }
                               }}
                               className="hover:text-indigo-900 transition-colors"
                             >
                               <X size={12} />
                             </button>
                           </span>
                         ))}
                         <input
                           type="text"
                           className="flex-1 min-w-[120px] bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
                           placeholder={(isModalOpen ? groups : editGroups).length === 0 ? "Search and select groups..." : "Add more..."}
                           value={groupSearchQuery}
                           onChange={(e) => {
                             setGroupSearchQuery(e.target.value);
                             setIsGroupDropdownOpen(true);
                           }}
                           onFocus={() => setIsGroupDropdownOpen(true)}
                         />
                       </div>
                       
                       <AnimatePresence>
                         {isGroupDropdownOpen && (
                           <motion.div
                             initial={{ opacity: 0, y: -5 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: -5 }}
                             className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden z-[100] flex flex-col"
                           >
                             <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                               <Search size={14} className="text-slate-400 shrink-0" />
                               <input
                                 type="text"
                                 className="w-full bg-transparent text-xs font-semibold outline-none text-slate-700 placeholder:text-slate-400"
                                 placeholder="Search ministry groups..."
                                 value={groupSearchQuery}
                                 onChange={(e) => setGroupSearchQuery(e.target.value)}
                                 autoFocus
                               />
                               {groupSearchQuery && (
                                 <button
                                   type="button"
                                   onClick={() => setGroupSearchQuery("")}
                                   className="text-[10px] text-slate-400 hover:text-slate-600 font-bold uppercase px-1"
                                 >
                                   Clear
                                 </button>
                               )}
                             </div>
                             <div className="max-h-[180px] overflow-y-auto p-1.5 space-y-0.5">
                               {churchGroups
                                 .filter(cg => cg.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                 .filter(cg => !(isModalOpen ? groups : editGroups).includes(cg.name))
                                 .map(cg => (
                                   <button
                                     key={cg.id}
                                     type="button"
                                     onClick={() => {
                                       if (isModalOpen) {
                                         const next = Array.from(new Set([...groups, cg.name]));
                                         setGroups(next);
                                         setGroup(next[0] || "");
                                       } else {
                                         const next = Array.from(new Set([...editGroups, cg.name]));
                                         setEditGroups(next);
                                         setEditGroup(next[0] || "");
                                       }
                                       setGroupSearchQuery("");
                                       // keep dropdown open for fast multiple selections
                                     }}
                                     className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors flex flex-col gap-0.5"
                                   >
                                     <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{cg.name}</span>
                                     {cg.description && (
                                       <span className="text-[10px] text-slate-500 truncate max-w-full block">{cg.description}</span>
                                     )}
                                   </button>
                                 ))
                               }
                               {churchGroups
                                 .filter(cg => cg.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                 .filter(cg => !(isModalOpen ? groups : editGroups).includes(cg.name)).length === 0 && (
                                 <div className="px-3 py-4 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                   No groups found
                                 </div>
                               )}
                             </div>
                           </motion.div>
                         )}
                       </AnimatePresence>
                     </div>

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
                  <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100 text-left">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Administrative Actions</h4>
                    
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleResetPassword(editingUser.email)}
                        disabled={isResettingPassword}
                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 hover:bg-blue-100 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isResettingPassword ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
                        {isResettingPassword ? "TRANSMITTING_RESET..." : "Send Password Reset Email"}
                      </button>

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
                      {isModalOpen ? "CONFIRM AUTHORIZATION" : "CONFIRM UPDATE"}
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
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-none md:rounded-3xl w-full max-w-md h-full md:h-auto shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between sticky top-0 z-10 bg-white">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">New Church Group</h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1">SYS_STRUCT_MOD</p>
                </div>
                <button onClick={() => setIsGroupModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X size={20} className="text-slate-400" />
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

      {/* Group Members Viewer Modal */}
      <AnimatePresence>
        {selectedGroupForMembers && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-none md:rounded-[2rem] w-full max-w-2xl h-full md:h-auto md:max-h-[90vh] shadow-2xl overflow-hidden border-t md:border border-slate-200 flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
                <div>
                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-[0.2em] flex items-center gap-2">
                    <Building2 size={16} className="text-primary" />
                    <span>{selectedGroupForMembers.name}</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono tracking-widest mt-1">
                    {users.filter(u => u.group === selectedGroupForMembers.name).length} REGISTERED MEMBERS
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {users.filter(u => u.group === selectedGroupForMembers.name).length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleExportCSV(selectedGroupForMembers.name)}
                      className="px-3.5 py-2 bg-primary/10 hover:bg-primary/25 text-primary border border-primary/20 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                      title="Export members of this church group as CSV"
                    >
                      <Download size={12} />
                      <span>EXPORT</span>
                    </button>
                  )}
                  <button 
                    onClick={() => setSelectedGroupForMembers(null)} 
                    className="p-2 hover:bg-slate-200 rounded-full transition-colors"
                  >
                    <X size={20} className="text-slate-500" />
                  </button>
                </div>
              </div>

              <div className="p-8 max-h-[30rem] overflow-y-auto space-y-4">
                {selectedGroupForMembers.description && (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-2">
                    <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Group Purview</h4>
                    <p className="text-xs text-slate-600 leading-relaxed">{selectedGroupForMembers.description}</p>
                  </div>
                )}

                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Members List</h4>
                
                {users.filter(u => u.group === selectedGroupForMembers.name).length === 0 ? (
                  <div className="py-12 text-center rounded-2xl border-2 border-dashed border-slate-101 p-6">
                    <Users size={32} className="mx-auto text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-500">No members registered under this group.</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                      Go to the Users Directory tab to associate users with this church group.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
                    {users.filter(u => u.group === selectedGroupForMembers.name).map((user) => (
                      <div key={user.id} className="p-4 flex items-center justify-between gap-4 bg-white hover:bg-slate-50 transition-colors">
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img
                              src={user.photoURL}
                              alt={user.name}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-black text-sm border border-slate-200">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <div className="text-xs font-black text-slate-900 uppercase tracking-tight">{user.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{user.email}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-[9px] font-black px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">
                            {user.role}
                          </span>
                          
                          {user.isSuspended ? (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-rose-50 text-rose-600 rounded-md border border-rose-100">
                              SUSPENDED
                            </span>
                          ) : !user.isApproved ? (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md border border-amber-100">
                              PENDING
                            </span>
                          ) : (
                            <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100">
                              ACTIVE
                            </span>
                          )}

                          <button
                            onClick={() => {
                              setSelectedGroupForMembers(null);
                              startEditing(user);
                              setActiveTab("users"); // Switch tab to users where editing takes place
                            }}
                            className="px-3 py-1.5 text-[9px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 rounded-lg border border-primary/20 transition-all flex items-center gap-1"
                          >
                            <Edit size={10} />
                            <span>MANAGE</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="px-8 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedGroupForMembers(null)}
                  className="px-6 py-2.5 bg-white border border-slate-200 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 hover:border-slate-300 transition-all"
                >
                  CLOSE VIEWPORT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

