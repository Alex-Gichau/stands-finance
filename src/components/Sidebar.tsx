/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  LayoutDashboard, 
  FileText, 
  CheckCircle, 
  Banknote, 
  BarChart3, 
  Settings, 
  UserCircle,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Bell
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole } from "../types";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  notificationsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onViewChange, notificationsCount = 0 }) => {
  const { currentUser, logout } = useRequisitions();
  
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar_collapsed");
      if (saved === "true") {
        setIsCollapsed(true);
      }
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      if (typeof window !== "undefined") {
        localStorage.setItem("sidebar_collapsed", String(!prev));
      }
      return !prev;
    });
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN] },
    { id: "notifications", label: "Notification", icon: Bell, roles: [UserRole.CHURCH_GROUP, UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.FINANCE, UserRole.ADMIN] },
    { id: "requisitions", label: "Requisitions", icon: FileText, roles: [UserRole.CHURCH_GROUP, UserRole.ADMIN] },
    { id: "approvals", label: "Authorization Hub", icon: CheckCircle, roles: [UserRole.APPROVER_L1, UserRole.APPROVER_L2, UserRole.ADMIN] },
    { id: "finance", label: "Finance Ledger", icon: Banknote, roles: [UserRole.FINANCE, UserRole.ADMIN] },
    { id: "reports", label: "Impact Reports", icon: BarChart3, roles: [UserRole.FINANCE, UserRole.ADMIN] },
    { id: "users", label: "Users", icon: UserCircle, roles: [UserRole.ADMIN] },
    { id: "settings", label: "Audit Trails", icon: Settings, roles: [UserRole.ADMIN, UserRole.FINANCE], desktopOnly: true },
  ];

  const filteredItems = menuItems.filter(item => 
    currentUser && item.roles.includes(currentUser.role)
  );

  return (
    <>
      <div className={cn(
        "hidden md:flex flex-col h-full bg-slate-900 border-r border-slate-800 transition-all duration-500 relative z-30 shadow-2xl shrink-0",
        isCollapsed ? "w-20" : "w-64"
      )}>
      {/* Brand Header */}
      <div className="h-20 flex items-center px-6 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Zap size={60} className="text-primary" />
        </div>
        
        <div className="flex items-center gap-3 relative z-10 w-full">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 5 }}
            className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-primary/20"
          >
            <ShieldCheck size={24} />
          </motion.div>
          
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="overflow-hidden"
              >
                <h1 className="font-black text-white text-md tracking-tighter uppercase whitespace-nowrap">
                  St Andrews
                </h1>
                <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] leading-tight">
                  REQUISITION SYS
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={toggleCollapse}
        className="absolute -right-3 top-24 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all shadow-xl hover:scale-110 z-50 cursor-pointer"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto no-scrollbar">
        {!isCollapsed && (
          <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-4 ml-2">
            Operations Cluster
          </div>
        )}
        
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={cn(
                "w-full flex items-center rounded-2xl transition-all duration-300 group text-[11px] font-black uppercase tracking-widest focus:outline-none relative",
                isCollapsed ? "justify-center p-3" : "gap-4 px-4 py-3.5",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "hover:bg-white/5 text-slate-400 hover:text-slate-100",
                item.desktopOnly ? "hidden lg:flex" : ""
              )}
            >
              <Icon size={18} className={cn("shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-300")} />
              {!isCollapsed && <span>{item.label}</span>}
              {!isCollapsed && item.id === "notifications" && notificationsCount > 0 && (
                <span className="ml-auto bg-rose-500 text-white font-black text-[9px] px-2 py-0.5 rounded-full ring-2 ring-slate-900 leading-none">
                  {notificationsCount}
                </span>
              )}
              {isCollapsed && item.id === "notifications" && notificationsCount > 0 && (
                <span className="absolute top-1 right-1 bg-rose-500 text-white font-black text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center ring-2 ring-slate-900">
                  {notificationsCount}
                </span>
              )}
              
              {isActive && !isCollapsed && (
                <motion.div 
                  layoutId="active-nav"
                  className="absolute left-0 w-1 h-6 bg-white rounded-r-full"
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer Profile */}
      <div className="p-4 border-t border-white/5">
        <div className={cn(
          "bg-white/5 rounded-2xl p-3 transition-all",
          isCollapsed ? "flex flex-col items-center gap-4" : "flex items-center gap-4 px-4"
        )}>
           <div className="relative">
            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-primary font-bold shadow-inner">
              {currentUser?.name.charAt(0)}
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full animate-pulse" />
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-black text-white truncate uppercase tracking-tight">{currentUser?.name}</p>
              <p className="text-[9px] text-primary font-bold truncate uppercase tracking-widest mt-0.5">
                {currentUser?.role.replace("_", " ")}
              </p>
            </div>
          )}

          {!isCollapsed && (
            <button 
              onClick={logout}
              className="p-2 text-slate-500 hover:text-rose-400 transition-colors hover:bg-rose-400/10 rounded-lg cursor-pointer"
              title="Terminate Session"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
        
        {isCollapsed && (
           <button 
            onClick={logout}
            className="w-full mt-4 flex justify-center py-2 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        )}
      </div>
    </div>

    {/* Mobile Bottom Navigation Bar */}
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-md border-t border-border flex md:hidden items-center justify-around px-2 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] selection:bg-transparent transition-colors duration-300">
      <div className="flex items-center justify-around w-full max-w-md mx-auto">
        {(() => {
          const mobileItems = filteredItems.filter(item => item.id !== "notifications");
          const dashboardIdx = mobileItems.findIndex(i => i.id === "dashboard");
          if (dashboardIdx !== -1) {
            const [dashboard] = mobileItems.splice(dashboardIdx, 1);
            const mid = Math.floor(mobileItems.length / 2);
            mobileItems.splice(mid, 0, dashboard);
          }
          return mobileItems;
        })().map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onViewChange(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1 group relative transition-all duration-300",
                "w-full h-full",
                isActive ? "text-primary" : "text-slate-400 hover:text-slate-600"
              )}
            >
              <div className={cn(
                "relative flex items-center justify-center w-10 h-10 rounded-2xl transition-all duration-300",
                isActive ? "bg-primary/5 -translate-y-1" : "bg-transparent"
              )}>
                <Icon size={isActive ? 20 : 18} strokeWidth={isActive ? 2.5 : 2} className="transition-all" />
                {isActive && (
                  <motion.div 
                    layoutId="active-pill"
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"
                  />
                )}
              </div>
              <span className={cn(
                "text-[8px] font-black uppercase tracking-[0.1em] mt-0.5 transition-all duration-300",
                isActive ? "opacity-100 scale-100" : "opacity-0 scale-90 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0"
              )}>
                {item.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  </>
  );
};

