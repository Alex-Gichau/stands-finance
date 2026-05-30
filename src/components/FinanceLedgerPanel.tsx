/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Banknote, 
  Wallet,
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  FileText, 
  Send, 
  Plus, 
  Sparkles, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  Receipt, 
  ShieldAlert,
  Printer,
  ChevronDown,
  ChevronUp,
  Database,
  Flag
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { RequisitionStatus, UserRole, Requisition, Project } from "../types";
import { formatCurrency, formatDate, cn } from "../lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../lib/firebase";
import { doc, updateDoc } from "firebase/firestore";

export const FinanceLedgerPanel: React.FC = () => {
  const { 
    requisitions, 
    projects, 
    currentUser, 
    updateRequisitionStatus,
    addSystemLog,
    triggerToast,
    users
  } = useRequisitions();

  // Component state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING_DISBURSAL" | "DISBURSED">("ALL");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("ALL");
  const [activeTab, setActiveTab] = useState<"ledgers" | "budgets">("ledgers");
  const [expandedReqId, setExpandedReqId] = useState<string | null>(null);

  // Budget adjustment form state
  const [adjustingProject, setAdjustingProject] = useState<Project | null>(null);
  const [topUpAmount, setTopUpAmount] = useState<string>("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Disbursement form state
  const [disbursingReq, setDisbursingReq] = useState<Requisition | null>(null);
  const [disburseMethod, setDisburseMethod] = useState<"EFT" | "MPESA" | "CHEQUE" | "CASH">("MPESA");
  const [referenceNum, setReferenceNum] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [isCommitingPayout, setIsCommitingPayout] = useState(false);

  // Constants
  const STARTING_RESERVE = 25000000; // Diocesan Base Liquidity

  // Mapping ministry groups to chart/category codes for double-entry tracking
  const getAccountingCode = (groupId: string): { code: string; name: string } => {
    const formatted = (groupId || "").toLowerCase();
    if (formatted.includes("youth")) {
      return { code: "4020", name: "Outreach & Youth Camps" };
    } else if (formatted.includes("women") || formatted.includes("guild")) {
      return { code: "4030", name: "Women's Guild Ministry" };
    } else if (formatted.includes("choir")) {
      return { code: "4010", name: "Choir Admin & Equipment" };
    } else if (formatted.includes("sanctuary") || formatted.includes("building")) {
      return { code: "4040", name: "Sanctuary Maintenance" };
    } else if (formatted.includes("sunday") || formatted.includes("school")) {
      return { code: "4050", name: "Sunday School Media" };
    } else if (formatted.includes("pioneer")) {
      return { code: "4060", name: "Pioneer Ministry Dev" };
    }
    return { code: "4090", name: "Ministry General Expenses" };
  };

  // 1. Calculate Financial Metrics
  const metrics = useMemo(() => {
    // Total approved or disbursed, which represents total committed funds
    const totalDisbursed = requisitions
      .filter(r => r.status === RequisitionStatus.DISBURSED)
      .reduce((acc, r) => acc + r.amount, 0);

    const pendingDisbursalCount = requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).length;
    const totalCommittedPending = requisitions
      .filter(r => r.status === RequisitionStatus.APPROVED_L2)
      .reduce((acc, r) => acc + r.amount, 0);

    const totalActiveBudget = projects.reduce((acc, p) => acc + p.allocatedBudget, 0);
    const totalRemainingBudget = projects.reduce((acc, p) => acc + (p.allocatedBudget - p.spentAmount), 0);

    const availableReserve = STARTING_RESERVE - totalDisbursed;

    // Disbursement efficiency: simulated speed
    const approvedRequisitions = requisitions.filter(
      r => r.status === RequisitionStatus.DISBURSED || r.status === RequisitionStatus.APPROVED_L2
    );
    const averageTimeMinutes = approvedRequisitions.length > 0 ? 320 : 0; // Simulated stable speed in system

    return {
      availableReserve,
      totalDisbursed,
      pendingDisbursalCount,
      totalCommittedPending,
      totalActiveBudget,
      totalRemainingBudget,
      averageTimeMinutes
    };
  }, [requisitions, projects]);

  // Handle Budget top up directly in Firebase
  const handleBudgetTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProject || !topUpAmount) return;
    
    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("Please enter a valid amount larger than 0");
      return;
    }

    setTopUpLoading(true);
    try {
      const pRef = doc(db, "projects", adjustingProject.id);
      const updatedBudget = adjustingProject.allocatedBudget + amount;
      
      await updateDoc(pRef, {
        allocatedBudget: updatedBudget
      });

      await addSystemLog(
        "BUDGET_ADJUSTMENT", 
        `Top-up: Added KES ${amount.toLocaleString()} to ${adjustingProject.name}. Adjusted total: KES ${updatedBudget.toLocaleString()}`,
        { projectId: adjustingProject.id, amountAdded: amount, newBudget: updatedBudget }
      );

      setTopUpAmount("");
      setAdjustingProject(null);
    } catch (err) {
      console.error("Failed to adjust budget:", err);
      alert("Error writing to database. Ensure you are authorized.");
    } finally {
      setTopUpLoading(false);
    }
  };

  // Handle Manual Fund Disbursement Action
  const handleRecordPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbursingReq) return;

    if (!referenceNum.trim()) {
      alert("Please enter a bank transfer reference number, check or voucher id");
      return;
    }

    setIsCommitingPayout(true);

    const requester = users?.find(u => u.id === disbursingReq.requesterId);
    const resolvedEmail = requester?.email || `${disbursingReq.requesterName.toLowerCase().replace(/\s+/g, "")}@church.org`;

    // 1. Trigger Loading Email Toast
    triggerToast({
      type: "FINANCE_DISBURSEMENT",
      severity: "MEDIUM",
      message: `📧 Dispatching Cash Disbursement Email Notification to ${disbursingReq.requesterName} (${resolvedEmail})...`,
      timestamp: new Date().toISOString()
    });

    try {
      const payoutNotesText = `Disbursement ref: ${disburseMethod} #${referenceNum}. ${payoutNotes ? `Notes: ${payoutNotes}` : ""}`;
      
      // Update state to DISBURSED, which logs the decision
      await updateRequisitionStatus(
        disbursingReq.id,
        RequisitionStatus.DISBURSED,
        "APPROVE",
        payoutNotesText,
        "SIGNATURE"
      );

      await addSystemLog(
        "FUNDS_DISBURSED",
        `Disbursed KES ${disbursingReq.amount.toLocaleString()} for '${disbursingReq.title}' via ${disburseMethod} (Ref: ${referenceNum})`,
        { requisitionId: disbursingReq.id, amount: disbursingReq.amount, method: disburseMethod, referenceNum }
      );

      // 2. Perform API call to /api/send-email (logs activity)
      try {
        await fetch("/api/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: resolvedEmail,
            requesterName: disbursingReq.requesterName,
            amount: disbursingReq.amount,
            title: disbursingReq.title
          })
        });

        // 3. Trigger Success Toast
        triggerToast({
          type: "LARGE_REQUEST",
          severity: "LOW",
          message: `✅ Disbursement email successfully delivered to ${resolvedEmail}!`,
          timestamp: new Date().toISOString()
        });
      } catch (mailErr) {
        console.warn("Mail dispatch report failed:", mailErr);
      }

      setReferenceNum("");
      setPayoutNotes("");
      setDisbursingReq(null);
    } catch (err) {
      console.error("Failed to records payout:", err);
      alert("Authorization issue or Firestore write error");
    } finally {
      setIsCommitingPayout(false);
    }
  };

  // Filtered list of requisitions specifically acting as General Ledger Line Items
  const ledgerEntries = useMemo(() => {
    return requisitions.filter(req => {
      // Must be relevant to finance: approved for payment or fully paid out
      const isFinanceTier = req.status === RequisitionStatus.APPROVED_L2 || req.status === RequisitionStatus.DISBURSED;
      if (!isFinanceTier) return false;

      // Project filter
      if (selectedProjectId !== "ALL" && req.projectId !== selectedProjectId) return false;

      // Search term filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        req.title.toLowerCase().includes(searchLower) ||
        req.id.toLowerCase().includes(searchLower) ||
        req.groupName.toLowerCase().includes(searchLower);

      if (!matchesSearch) return false;

      // Status filters
      if (statusFilter === "PENDING_DISBURSAL" && req.status !== RequisitionStatus.APPROVED_L2) return false;
      if (statusFilter === "DISBURSED" && req.status !== RequisitionStatus.DISBURSED) return false;

      return true;
    }).sort((a, b) => {
      // Newest ledger lines first
      const dateA = new Date(a.updatedAt || a.submittedAt).getTime();
      const dateB = new Date(b.updatedAt || b.submittedAt).getTime();
      return dateB - dateA;
    });
  }, [requisitions, searchTerm, statusFilter, selectedProjectId]);

  // Double entry voucher layout generator window trigger
  const printLedgerVoucher = (req: Requisition) => {
    const codeInfo = getAccountingCode(req.groupId);
    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup blocked! Enable popups to print double-entry cash ledger voucher.");
      return;
    }

    win.document.write(`
      <html>
        <head>
          <title>DIOCESAN FINANCIAL VOUCHER - ${req.id}</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 40px; color: #1e293b; background: #fff; }
            .border-box { border: 4px double #0f172a; padding: 25px; max-width: 800px; margin: 0 auto; }
            .header-tbl { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
            .header-title { font-size: 20px; font-weight: bold; text-align: center; letter-spacing: 2px; text-transform: uppercase; border-bottom: 2px solid #000; padding-bottom: 10px; }
            .meta-lbl { font-weight: bold; font-size: 13px; padding: 6px 0; }
            .entry-table { width: 100%; border-collapse: collapse; margin: 25px 0; }
            .entry-table th { background: #f1f5f9; border: 1px solid #1e293b; padding: 10px; font-size: 11px; text-transform: uppercase; text-align: left;}
            .entry-table td { border: 1px solid #1e293b; padding: 10px; font-size: 13px; }
            .words-row { margin: 15px 0; padding: 10px; background: #fafafa; border-left: 3px solid #0f172a; font-style: italic; font-size: 12px; }
            .footer-sig { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; text-align: center; margin-top: 45px; font-size: 11px; }
            .sig-line { border-top: 1px dashed #000; margin-top: 25px; padding-top: 6px; font-weight: bold; }
            @media print { body { padding: 10px; } .border-box { max-width: 100%; border: 3px solid #000; } }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="header-title">ST. ANDREWS DIOCESAN CATHEDRAL <br/> <span style="font-size:14px; color:#555">Double-Entry Cash Disbursement Voucher</span></div>
            
            <table class="header-tbl">
              <tr>
                <td class="meta-lbl" style="width:15%">VOUCHER ID:</td>
                <td style="font-family:monospace; font-weight:bold; font-size:14px">${req.id.toUpperCase()}</td>
                <td class="meta-lbl" style="width:20%; text-align:right">LEDGER DATE:</td>
                <td style="text-align:right">${new Date(req.updatedAt || req.submittedAt).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td class="meta-lbl">MINISTRY:</td>
                <td style="text-transform:uppercase">${req.groupName || req.groupId}</td>
                <td class="meta-lbl" style="text-align:right">PAYMENT REF:</td>
                <td style="text-align:right; font-weight:bold">${req.status === RequisitionStatus.DISBURSED ? "PAID OUT" : "PENDING"}</td>
              </tr>
              <tr>
                <td class="meta-lbl">PROJECT:</td>
                <td colspan="3" style="text-transform:uppercase">${projects.find(p => p.id === req.projectId)?.name || "Central Budget Allocation"}</td>
              </tr>
            </table>

            <div style="font-size:13px; margin: 10px 0;">
              <strong>Requisition Subject:</strong> ${req.title}<br/>
              <strong>Economic Narrative:</strong> ${req.description}
            </div>

            <table class="entry-table">
              <thead>
                <tr>
                  <th style="width:12%">Acc Code</th>
                  <th style="width:48%">Account Allocation Ledger Transaction</th>
                  <th style="width:20%; text-align:right">Debit (Econ outflow)</th>
                  <th style="width:20%; text-align:right">Credit (Asset ledger)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-family:monospace">${codeInfo.code}</td>
                  <td>${codeInfo.name} [Direct Expenditure]</td>
                  <td style="text-align:right; font-family:monospace">KES ${req.amount.toLocaleString()}.00</td>
                  <td style="text-align:right; font-family:monospace">-</td>
                </tr>
                <tr>
                  <td style="font-family:monospace">1010</td>
                  <td>Central Diocesan Banking Pool [Liquid Assets]</td>
                  <td style="text-align:right; font-family:monospace">-</td>
                  <td style="text-align:right; font-family:monospace">KES ${req.amount.toLocaleString()}.00</td>
                </tr>
                <tr style="font-weight:bold;">
                  <td colspan="2" style="text-align:right">T-Account Balanced Checksum:</td>
                  <td style="text-align:right; font-family:monospace">KES ${req.amount.toLocaleString()}.00</td>
                  <td style="text-align:right; font-family:monospace">KES ${req.amount.toLocaleString()}.00</td>
                </tr>
              </tbody>
            </table>

            <div class="words-row">
              <strong>Voucher Value in Words:</strong> ${req.amountWords || "Amount checked and certified as requested by the ministry head."}
            </div>

            <div style="font-size:11px; color:#475569; border-top:1px solid #e2e8f0; padding-top:10px; margin-top:20px">
              <strong>Audit Trail:</strong> L1 Certified @ ${req.approvedAtL1 ? new Date(req.approvedAtL1).toLocaleString() : "N/A"} • L2 Approved @ ${req.approvedAtL2 ? new Date(req.approvedAtL2).toLocaleString() : "N/A"} • System Hash Transaction: ${req.digitalSignature || "Unsigned_Prototype_Ecosystem"}
            </div>

            <div class="footer-sig">
              <div>
                <p>APPROVED BY</p>
                <div class="sig-line">Diocesan Finance Chair</div>
              </div>
              <div>
                <p>PAID VIA MPESA/BANK WIRE</p>
                <div class="sig-line">Clergy Administrator</div>
              </div>
              <div>
                <p>ACKNOWLEDGED RECIPIENT</p>
                <div class="sig-line">Ministry Representative</div>
              </div>
            </div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
  };

  return (
    <div className="space-y-6 animate-in fade-in transition-all duration-700">
      
      {/* 1. Brand Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Finance Ledger</h1>
          <p className="text-slate-500 text-sm">Double-entry ledger ledger checking, budget allocations, and disbursement controls.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[#4f46e5]/95 bg-[#4f46e5]/10 px-3 py-1 rounded-full border border-indigo-500/10">
            Accounting Console
          </span>
        </div>
      </div>

      {/* 2. Fiscal Analytics Deck */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-slate-900 p-5 rounded-2xl text-white border border-slate-800 shadow-md relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-10 group-hover:scale-125 transition-all text-indigo-400">
            <Wallet size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Central Vault Liquidity</p>
          <h2 className="text-xl font-bold leading-none mb-2">{formatCurrency(metrics.availableReserve)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-semibold text-emerald-400">
            <ArrowUpRight size={10} />
            <span>Vault Base: {formatCurrency(STARTING_RESERVE)}</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-amber-500">
            <Clock size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Committed Liabilities</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalCommittedPending)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full inline-flex">
            <span>{metrics.pendingDisbursalCount} Approved, Awaiting Payout</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-[#10b981]">
            <CheckCircle2 size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Fund Disbursed</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalDisbursed)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full inline-flex">
            <ArrowDownLeft size={10} />
            <span>Actual Outflows Recorded</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute right-[-10px] top-[-10px] opacity-5 group-hover:scale-125 transition-all text-[#4f46e5]">
            <TrendingUp size={80} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Budget Safety Margin</p>
          <h2 className="text-xl font-bold text-slate-900 leading-none mb-2">{formatCurrency(metrics.totalRemainingBudget)}</h2>
          <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full inline-flex">
            <span>Unspent Budget Pool</span>
          </div>
        </div>

      </div>

      {/* 3. Navigation between ledger journal vs. project budgets */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("ledgers")}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer",
            activeTab === "ledgers" ? "border-indigo-600 text-indigo-600 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          General Ledger Logs
        </button>
        <button
          onClick={() => setActiveTab("budgets")}
          className={cn(
            "pb-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all cursor-pointer",
            activeTab === "budgets" ? "border-indigo-600 text-indigo-600 font-extrabold" : "border-transparent text-slate-400 hover:text-slate-600"
          )}
        >
          Ministry Budget Controls
        </button>
      </div>

      {activeTab === "ledgers" && (
        <div className="space-y-6">
          
          {/* Project Budget Quick-View Cards */}
          <div className="flex gap-3 overflow-x-auto pb-4 pt-1 -mx-2 px-2 scrollbar-hide">
            {projects.map((project) => {
              const projectRequisitions = requisitions.filter(r => r.projectId === project.id);
              const requisitionsCount = projectRequisitions.length;
              const spendingRatio = (project.spentAmount / project.allocatedBudget) * 100;
              const remainingAmount = project.allocatedBudget - project.spentAmount;
              return (
                <div 
                  key={project.id} 
                  className="min-w-[180px] md:min-w-[220px] bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-2 group cursor-pointer"
                  onClick={() => {
                    setSelectedProjectId(project.id);
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-[10px] font-extrabold text-slate-700 uppercase tracking-tight group-hover:text-indigo-600 transition-colors truncate max-w-[140px]">
                        {project.name}
                      </h4>
                      <p className="text-[8px] font-mono text-slate-400">Remaining: {formatCurrency(remainingAmount)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn(
                        "text-[8px] font-black px-1.5 py-0.5 rounded-full border",
                        spendingRatio >= 90 
                          ? "bg-rose-50 text-rose-600 border-rose-100" 
                          : spendingRatio >= 75 
                            ? "bg-amber-50 text-amber-600 border-amber-100" 
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                      )}>
                        {spendingRatio.toFixed(0)}% Used
                      </span>
                      {requisitionsCount > 0 && (
                        <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200 shadow-sm">
                          {requisitionsCount} REQs
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(spendingRatio, 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full",
                          spendingRatio >= 90 ? "bg-rose-500" : spendingRatio >= 75 ? "bg-amber-500" : "bg-indigo-600"
                        )}
                      />
                    </div>
                    <div className="flex justify-between text-[7px] font-bold text-slate-400 tracking-tighter">
                      <span>{formatCurrency(project.spentAmount)}</span>
                      <span>{formatCurrency(project.allocatedBudget)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 4. Filter Panel */}
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap gap-2 items-center w-full lg:w-auto">
              <button 
                onClick={() => setStatusFilter("ALL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer",
                  statusFilter === "ALL" 
                    ? "bg-slate-900 text-white" 
                    : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                )}
              >
                All Entries
              </button>
              <button 
                onClick={() => setStatusFilter("PENDING_DISBURSAL")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "PENDING_DISBURSAL" 
                    ? "bg-amber-500 text-white" 
                    : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                )}
              >
                <Clock size={12} />
                Pending Disbursal ({metrics.pendingDisbursalCount})
              </button>
              <button 
                onClick={() => setStatusFilter("DISBURSED")}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  statusFilter === "DISBURSED" 
                    ? "bg-emerald-600 text-white" 
                    : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                )}
              >
                <CheckCircle2 size={12} />
                Disbursed Logs
              </button>
            </div>

            <div className="flex gap-2 items-center w-full lg:w-auto">
              {/* Search */}
              <div className="relative flex-1 lg:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Filter key words or voucher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none"
                />
              </div>

              {/* Project selector */}
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="bg-slate-50 border border-slate-200 text-xs rounded-lg px-3 py-1.5 outline-none font-medium text-slate-700 focus:ring-2 focus:ring-indigo-500/10"
              >
                <option value="ALL">All Accounts</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 5. Awaiting Disbursement Box */}
          {requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).length > 0 && (
            <div className="bg-amber-50/50 rounded-2xl border border-amber-200 p-5 space-y-4 shadow-inner">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="text-amber-600" size={18} />
                  <div>
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest">Payout Queue ({metrics.pendingDisbursalCount})</h3>
                    <p className="text-[10px] text-slate-500">Authorized requests ready for immediate payment processing.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requisitions.filter(r => r.status === RequisitionStatus.APPROVED_L2).map((req) => (
                  <div key={req.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-mono uppercase text-slate-400 font-bold">#{req.id.substr(0, 8)}</span>
                          {req.flaggedForAudit && (
                            <span title="Flagged for Audit" className="inline-flex shrink-0">
                              <Flag size={10} className="text-rose-500 fill-rose-500" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-extrabold text-[#4f46e5]">{formatCurrency(req.amount)}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-800 leading-snug line-clamp-1">{req.title}</h4>
                      <p className="text-[10px] text-slate-500 font-medium">Group: {req.groupName} • Requester: {req.requesterName}</p>
                    </div>

                    <button
                      onClick={() => setDisbursingReq(req)}
                      className="w-full text-center py-2 bg-slate-900 hover:bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Process Disbursement Voucher
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Active double entry bookkeeping journal */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-800">Double-Entry Ledger Books</h3>
                <p className="text-[10px] text-slate-500">Every payout and reserve commitment balance ledger transaction.</p>
              </div>
              <div className="text-[10px] text-slate-400 font-bold">
                Showing {ledgerEntries.length} entries
              </div>
            </div>

            {ledgerEntries.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <Database className="mx-auto text-slate-300" size={32} />
                <p className="text-xs font-medium">No financial ledger entries found matching the filter.</p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-full">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                      <th className="py-3 px-6">Voucher/Code</th>
                      <th className="py-3 px-4">Account Allocation Context</th>
                      <th className="py-3 px-4 text-right">Debit (Econ)</th>
                      <th className="py-3 px-4 text-right">Credit (Asset)</th>
                      <th className="py-3 px-4">Status & Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {ledgerEntries.map((req) => {
                      const isExpanded = expandedReqId === req.id;
                      const codeInfo = getAccountingCode(req.groupId);
                      return (
                        <React.Fragment key={req.id}>
                          <tr className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-6 font-mono">
                              <div className="text-[11px] font-bold text-slate-800">#{req.id.substr(0, 8).toUpperCase()}</div>
                              <div className="text-[9px] text-slate-400 uppercase tracking-wider">Acc: {codeInfo.code}</div>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                <span className="line-clamp-1">{req.title}</span>
                                {req.flaggedForAudit && (
                                  <span title="Flagged for Audit" className="inline-flex shrink-0">
                                    <Flag size={11} className="text-rose-500 fill-rose-500" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                                <span className="font-bold text-indigo-600">{req.groupName}</span>
                                <span>•</span>
                                <span>Project: {projects.find(p => p.id === req.projectId)?.name || "Central Reserve"}</span>
                              </div>
                            </td>
                            <td className="py-4 px-4 text-right font-mono font-bold text-rose-600">
                              KES {req.amount.toLocaleString()}.00
                            </td>
                            <td className="py-4 px-4 text-right font-mono font-medium text-slate-400">
                              - Credit Central Bank
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full inline-block",
                                  req.status === RequisitionStatus.DISBURSED 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                    : "bg-amber-50 text-amber-700 border border-amber-100"
                                )}>
                                  {req.status === RequisitionStatus.DISBURSED ? "PAID OUT" : "UNPAID REQ"}
                                </span>
                                
                                <button
                                  onClick={() => printLedgerVoucher(req)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title="Print Cash Disbursement Voucher"
                                >
                                  <Printer size={13} />
                                </button>

                                <button
                                  onClick={() => setExpandedReqId(isExpanded ? null : req.id)}
                                  className="p-1 hover:bg-slate-100 rounded text-slate-500 transition-colors cursor-pointer"
                                >
                                  {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Extra transaction journal notes */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={5} className="bg-slate-50/50 p-4 border-t border-b border-dashed border-slate-200">
                                <div className="space-y-2 text-[11px] text-slate-600">
                                  <p><strong>Accounting Narrative:</strong> {req.description}</p>
                                  {req.amountWords && <p><strong>Amount in Words:</strong> {req.amountWords}</p>}
                                  
                                  <div className="flex flex-wrap gap-4 pt-2 text-[10px] text-slate-500 border-t border-slate-200">
                                    <p><strong>Approved Date L1:</strong> {req.approvedAtL1 ? new Date(req.approvedAtL1).toLocaleString() : "N/A"}</p>
                                    <p><strong>Approved Date L2:</strong> {req.approvedAtL2 ? new Date(req.approvedAtL2).toLocaleString() : "N/A"}</p>
                                    {req.status === RequisitionStatus.DISBURSED && (
                                      <p className="text-emerald-700 font-semibold">
                                        <strong>Fully Settled Date:</strong> {req.disbursedAt ? new Date(req.disbursedAt).toLocaleString() : new Date(req.updatedAt).toLocaleString()}
                                      </p>
                                    )}
                                  </div>

                                  {req.approvalHistory && req.approvalHistory.length > 0 && (
                                    <div className="space-y-1 pt-2">
                                      <p className="font-bold text-slate-700">Audit Chamber Protocol Logs:</p>
                                      <div className="space-y-1">
                                        {req.approvalHistory.map((h, i) => (
                                          <p key={i} className="font-mono text-[9px] text-slate-500 bg-white p-1 rounded-md border border-slate-100">
                                            [{new Date(h.timestamp).toLocaleTimeString()}] [{h.role}] {h.approverName}: "{h.note || "No custom ledger notes provided"}"
                                          </p>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {activeTab === "budgets" && (
        <div className="space-y-6">
          
          {/* 7. Active progress dashboard */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-800">Ministry Group Budget Reserves</h3>
              <p className="text-xs text-slate-500">Live fiscal matrix mapping allocations, spend trails, and unallocated buffer transactions.</p>
            </div>

            <div className="space-y-5">
              {projects.map((project) => {
                const projectRequisitions = requisitions.filter(r => r.projectId === project.id);
                const requisitionsCount = projectRequisitions.length;
                const spendingRatio = (project.spentAmount / project.allocatedBudget) * 100;
                const remainingAmount = project.allocatedBudget - project.spentAmount;
                const codeInfo = getAccountingCode(project.groupId);

                return (
                  <div key={project.id} className="p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-all bg-slate-50/30">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[9px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded">
                            ACC: {codeInfo.code}
                          </span>
                          <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{project.name}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">Linked Group ID: {project.groupId} • Status: {project.status}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Spent vs. Allocated</div>
                          <div className="text-xs font-bold text-slate-800">
                            {formatCurrency(project.spentAmount)} <span className="text-slate-400 font-medium">/ {formatCurrency(project.allocatedBudget)}</span>
                          </div>
                        </div>

                        {(currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN) && (
                          <button
                            onClick={() => setAdjustingProject(project)}
                            className="px-2.5 py-1.5 bg-white border border-slate-200 hover:border-indigo-600 text-slate-700 hover:text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer"
                          >
                            <Plus size={10} />
                            Modify
                          </button>
                        )}
                      </div>
                    </div>

              {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-1000",
                            spendingRatio >= 90 ? "bg-rose-500" : spendingRatio >= 75 ? "bg-amber-500" : "bg-indigo-600"
                          )}
                          style={{ width: `${Math.min(spendingRatio, 100)}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold">
                        <div className="flex items-center gap-2">
                          <span>{spendingRatio.toFixed(1)}% Bound</span>
                          {requisitionsCount > 0 && (
                            <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-100 text-[8px] uppercase">
                              {requisitionsCount} Requisitions Done
                            </span>
                          )}
                        </div>
                        <span>{formatCurrency(remainingAmount)} Remaining Reserve</span>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 8. MODAL: Manual Disbursement Settlement Form */}
      <AnimatePresence>
        {disbursingReq && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden"
            >
              <div className="bg-slate-900 text-white p-6">
                <div className="flex items-center gap-2">
                  <Receipt className="text-indigo-400 animate-pulse" size={20} />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-300">Settle Approved Request</h3>
                    <p className="text-[10px] text-indigo-200">Recording payouts on physical checks or mobile banking.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleRecordPayout} className="p-6 space-y-4">
                
                <div className="border border-slate-100 bg-slate-50 p-3 rounded-xl space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>REQUISITION #{disbursingReq.id.substr(0, 8)}</span>
                    <span className="text-slate-700">{disbursingReq.groupName}</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">{disbursingReq.title}</h4>
                  <div className="text-sm font-black text-indigo-600">{formatCurrency(disbursingReq.amount)}</div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Disbursement Channel</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: "MPESA", label: "M-PESA" },
                      { id: "EFT", label: "Bank EFT" },
                      { id: "CHEQUE", label: "Cheque" },
                      { id: "CASH", label: "Cash" }
                    ].map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => setDisburseMethod(ch.id as any)}
                        className={cn(
                          "py-2 text-center rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer border",
                          disburseMethod === ch.id 
                            ? "bg-slate-900 text-white border-slate-900" 
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {ch.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction / Ref Reference</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., MPESA-TXN-2831, CHQ #001223"
                    value={referenceNum}
                    onChange={(e) => setReferenceNum(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verification Comment (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Provide clerical details, bank transfer receipts references..."
                    value={payoutNotes}
                    onChange={(e) => setPayoutNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisbursingReq(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCommitingPayout}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-lg shadow-emerald-600/10"
                  >
                    {isCommitingPayout ? "Committing..." : "Confirm Release"}
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. MODAL: Budget Top Up Allocation Form */}
      <AnimatePresence>
        {adjustingProject && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full overflow-hidden"
            >
              <div className="bg-indigo-650 p-5 bg-[#4f46e5] text-white">
                <div className="flex items-center gap-2">
                  <TrendingUp size={18} />
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#e0e7ff]">Modify Budget Reserve</h3>
                    <p className="text-[10px] text-indigo-100">Top-up allocation on active project ledger lines.</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleBudgetTopUp} className="p-5 space-y-4">
                
                <div className="space-y-1 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">PROJECT</div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">{adjustingProject.name}</h4>
                  <p className="text-[10px] text-slate-500">Current Allocation: <span className="font-bold">{formatCurrency(adjustingProject.allocatedBudget)}</span></p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Top-up Value (KES)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="e.g., 500000"
                    value={topUpAmount}
                    onChange={(e) => setTopUpAmount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 font-bold"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAdjustingProject(null)}
                    className="flex-1 py-2 border border-slate-200 rounded-lg text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={topUpLoading}
                    className="flex-1 py-2 bg-slate-900 hover:bg-slate-850 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    {topUpLoading ? "Updating..." : "Authorize Topup"}
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
