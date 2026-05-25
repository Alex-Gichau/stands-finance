/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Clock, ShieldAlert, LogOut, ShieldCheck, Cpu } from "lucide-react";
import { UserProfile } from "../types";
import { motion } from "motion/react";

interface WaitingRoomProps {
  user: UserProfile;
  onLogout: () => void;
}

export const WaitingRoom: React.FC<WaitingRoomProps> = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
        {/* Ambient background effects */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_10%,#1e293b_0%,transparent_50%)] opacity-30" />
        <div className="absolute top-0 right-0 p-20 opacity-5 pointer-events-none">
          <ShieldAlert size={300} className="text-white" />
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl p-12 text-center space-y-10 relative z-10"
        >
          <div className="relative inline-block">
            <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center mx-auto border-2 border-primary/20 shadow-xl">
              <Clock size={40} className="text-primary animate-pulse" />
            </div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              className="absolute -inset-4 border border-dashed border-primary/20 rounded-full"
            />
          </div>

          <div className="space-y-4">
            <div className="inline-block px-4 py-1.5 bg-primary/10 border border-primary/20 rounded-full">
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Synchronization Pending</p>
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight leading-tight">
              Awaiting Administrative<br />Account Activation
            </h1>
            <p className="text-sm text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
              Welcome, <span className="text-white font-bold">{user.name}</span>. Your identity node has been registered, but requires high-level authorization before ledger access is granted.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-6 border-y border-slate-800">
             <div className="flex items-center gap-4 text-left p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-primary/30 transition-all">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
                  <ShieldCheck size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Protocol</p>
                   <p className="text-[11px] font-black text-white uppercase mt-0.5">Identity Verification</p>
                </div>
             </div>
             <div className="flex items-center gap-4 text-left p-4 bg-slate-950 rounded-2xl border border-slate-800 group hover:border-primary/30 transition-all">
                <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 group-hover:text-primary transition-colors">
                  <Cpu size={20} />
                </div>
                <div>
                   <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Level</p>
                   <p className="text-[11px] font-black text-white uppercase mt-0.5">Auth Tier 0</p>
                </div>
             </div>
          </div>

          <div className="space-y-6">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest italic">
              Administrators have been notified of your request.
            </p>
            <button 
              onClick={onLogout}
              className="w-full flex items-center justify-center gap-3 py-4 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 border border-slate-700"
            >
              <LogOut size={16} /> Disconnect Session
            </button>
          </div>
        </motion.div>
      </div>
  );
};
