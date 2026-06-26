import React, { useState, useMemo } from "react";
import { 
  BookOpen, 
  Search, 
  HelpCircle, 
  Info, 
  CheckCircle, 
  Key, 
  ShieldCheck, 
  User, 
  ArrowRight, 
  Sparkles, 
  FileText, 
  TrendingUp, 
  Sliders, 
  X,
  PlusCircle,
  Clock,
  Shield,
  Activity,
  UserCircle2,
  FileCheck2,
  Lock,
  RotateCcw,
  Eye,
  AlertCircle,
  Hash,
  Coins,
  Receipt,
  Check,
  ChevronRight
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { UserRole } from "../types";

interface HelpDocArticle {
  id: string;
  category: string;
  title: string;
  keywords: string[];
  summary: string;
  content: React.ReactNode;
}

interface HelpPanelProps {
  onPlayTour?: () => void;
}

export const HelpPanel: React.FC<HelpPanelProps> = ({ onPlayTour }) => {
  const { currentUser } = useRequisitions();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentUser?.role || UserRole.CHURCH_GROUP);
  const [activeStep, setActiveStep] = useState(0);

  // Sandbox simulation states for checking out system step by step
  const [simStep, setSimStep] = useState(1);
  const [simTitle, setSimTitle] = useState("VBS Craft Materials Purchase");
  const [simAmount, setSimAmount] = useState(350);
  const [simL1Reason, setSimL1Reason] = useState("");
  const [simL2Status, setSimL2Status] = useState("pending"); // pending, approved, rejected
  const [simRefNumber, setSimRefNumber] = useState("");
  const [simShowTooltip, setSimShowTooltip] = useState<string | null>(null);

  const resetSandbox = () => {
    setSimStep(1);
    setSimTitle("VBS Craft Materials Purchase");
    setSimAmount(350);
    setSimL1Reason("");
    setSimL2Status("pending");
    setSimRefNumber("");
    setSimShowTooltip(null);
  };

  // Guided Tour Steps Data
  const tourSteps = [
    {
      title: "Step 1: Submission (Ministry Rep)",
      role: "Ministry Representative",
      icon: PlusCircle,
      desc: "Representative creates a new requisition connected to an active project code and uploads a supplier invoice/receipt photo.",
      elementName: "Requisition Entry Form Panel",
      tooltip: "The document starts with a 'SUBMITTED' state tag. Automated budget compliance checking fires to ensure enough money resides in the target allocation line.",
      color: "from-indigo-500 to-blue-500"
    },
    {
      title: "Step 2: L1 Vetting (Approver L1)",
      role: "Level 1 Verifier",
      icon: FileText,
      desc: "L1 verifiers check supplier quotes, invoice fields, matching ledger numbers, and physically verify details before digital routing.",
      elementName: "Approvals Table Vetting Action",
      tooltip: "Signoff tags status as 'APPROVED_L1'. This locks primary transaction values to prevent tampering or adjustment of totals.",
      color: "from-blue-500 to-emerald-500"
    },
    {
      title: "Step 3: L2 Treasury Check (Approver L2)",
      role: "Level 2 Keymaster",
      icon: Key,
      desc: "Keymasters inspect general church reserve funds, check account liquidity limits, and sign state permits.",
      elementName: "Keymaster Security Control Checkpoint",
      tooltip: "Approval steps code to 'APPROVED_L2', highlighting this item as physically certifiable for active cash or cheque release.",
      color: "from-emerald-500 to-violet-500"
    },
    {
      title: "Step 4: Disbursement List (Finance Office)",
      role: "Finance Officer / Admin",
      icon: CheckCircle,
      desc: "The treasury release team issues a paper banking log or check number, updates bank details, and prints compliance audit copies.",
      elementName: "Ledger Settlement Core Panel",
      tooltip: "Sets the status to 'DISBURSED'. The requisition amounts are permanently deducted from the department budget pool.",
      color: "from-violet-500 to-amber-500"
    }
  ];

  // Documentation Articles
  const docArticles: HelpDocArticle[] = useMemo(() => [
    {
      id: "onboarding",
      category: "Onboarding & Security",
      title: "Account Registration & Zero-Trust Syncing",
      keywords: ["signup", "onboarding", "waiting room", "registration", "access", "pending", "roles"],
      summary: "Understanding the quarantine stage keeping newly created accounts secure from arbitrary file and budget viewing.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            The STANDS Portal is governed by a strict <strong>Zero-Trust Quarantine Protocol</strong>. Newly registered accounts cannot read database objects or budget allocations until manually approved.
          </p>
          <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 space-y-2">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block">Operational Safety Rules:</span>
            <ul className="list-disc pl-4 space-y-1 text-slate-500 dark:text-slate-400 text-[11.5px] leading-relaxed">
              <li>Newly registered accounts are tagged as <code>PENDING</code>.</li>
              <li>They are automatically funneled into the <strong>Waiting Room Dashboard</strong>, with no access to sidebar routes.</li>
              <li>A Super Administrator must verify their legal name, assign an active <strong>Ministry Group</strong> line, and toggle status to <strong>"Active"</strong>.</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: "requisitions",
      category: "Requisitions Engine",
      title: "How to Draft and Submit Requisition Items",
      keywords: ["create", "requisition", "receipts", "vendors", "budget", "draft", "files", "attachment"],
      summary: "Comprehensive checklist to compile requisitions, configure accurate vendors, and ensure auto budget validation doesn't flag warnings.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            Submissions are permanently linked to your assigned department budget line. Always follow files and amounts standards to guarantee rapid verifier throughput:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-xl border border-indigo-150/20 dark:border-indigo-900/40">
              <span className="text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest block mb-1">Receipt Attachment rules</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Legible pictures or document receipts must be uploaded. Avoid blurry shots or cutoff supplier details, or L1 verifiers will flag corrections required.
              </p>
            </div>
            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-150/20 dark:border-emerald-900/40">
              <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block mb-1">Ecosystem Vendor Validation</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                Connect your item to registered vendors from the active roster. For new suppliers, propose them on-the-fly under the vendor input dialog.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "approvals",
      category: "Verification Pipelines",
      title: "Approval Flow: Granular L1 / L2 Logic",
      keywords: ["approval", "l1", "l2", "verifier", "keymaster", "vetting", "signoff", "reject", "rejection"],
      summary: "Understand the separate checks applied by Level 1 Compliancy Verifiers and Level 2 Treasury Keymasters.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            The two points of digital check provide secondary and primary layers of protection against church treasury exhaustion:
          </p>
          <div className="space-y-2.5">
            <div className="p-3.5 border-l-4 border-blue-500 bg-slate-50 dark:bg-slate-900 rounded-r-2xl">
              <span className="text-[9px] font-black text-blue-500 uppercase tracking-wider block">Level 1: Compliance Guard (Vetting)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Verifiers confirm lines, tax percentages, items, and matches. They signature-approve to state <code>APPROVED_L1</code>, locking basic values from subsequent manual tampering.
              </p>
            </div>
            <div className="p-3.5 border-l-4 border-purple-500 bg-slate-50 dark:bg-slate-900 rounded-r-2xl">
              <span className="text-[9px] font-black text-purple-500 uppercase tracking-wider block">Level 2: Cash Allocation (Keymasters)</span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-normal">
                Keymasters look at actual liquid pool limits and general banking balances. Approving upgrades the token state to <code>APPROVED_L2</code> which permits physical payouts.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: "budgets",
      category: "Budgets & Ledgers",
      title: "Supplementary Budget Increments & Rules",
      keywords: ["supplementary", "budget", "override", "adjustments", "pool", "financial", "treasury"],
      summary: "Learn how emergency supplementary reserve increments are submitted, managed, and controlled.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            If a Ministry Group's default allocated budget runs low, representatives can propose a <strong>Supplementary Budget Override</strong>.
          </p>
          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-100 dark:border-slate-800 rounded-xl">
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
              Superadmins can configure global variables inside the <strong>Access Control Panel</strong>. Toggling the "State Switcher" hides the supplementary buttons, shutting down outstanding user requests when budget lines lock.
            </p>
          </div>
        </div>
      )
    },
    {
      id: "disbursements",
      category: "Treasury Release",
      title: "Physical Funds Disbursement Logging",
      keywords: ["disburse", "pay", "payout", "payment", "cheque", "check", "cash", "ledger", "settlement"],
      summary: "How physical transaction codes, cheque tokens, and printed treasury vouchers are synced into transaction history.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            The final stage of any requisition is <strong>Disbursement</strong>. A Finance Auditor executes this physical checkout in the <strong>Budgets & Ledger</strong> interface.
          </p>
          <ul className="space-y-1.5 text-slate-500 dark:text-slate-400 text-[11px] list-disc pl-4">
            <li>Treasury references (e.g. Cheque Numbers, Bank Remittance codes) must be entered.</li>
            <li>Upon submittal, transaction status locks into <code>DISBURSED</code>, creating an immutable ledger stamp block.</li>
            <li>Users can instantly generate and print official, pre-populated disbursement validation slips directly.</li>
          </ul>
        </div>
      )
    },
    {
      id: "auditing",
      category: "System Integrity",
      title: "Immutable Auditing Logs & Slack Piping",
      keywords: ["audit", "system log", "trail", "security", "slack", "notification", "ip address", "metadata"],
      summary: "Understand how the system logs user behaviors, security locks, device settings, and prints write-only audit arrays.",
      content: (
        <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300 font-medium">
          <p>
            To fulfill general regulatory audit compliances, STANDS registers every state mutation within an <strong>immutable write-only audit block array</strong>.
          </p>
          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100/40 dark:border-rose-950 rounded-xl flex items-start gap-2.5">
            <Lock size={14} className="text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-normal font-semibold">
              <strong>Tamper Prohibition:</strong> Audit trail entries are write-only. No portal participant—including the main creator or Superadmin profiles—can delete or edit logged event logs, guaranteeing unblemished forensic accounting.
            </p>
          </div>
        </div>
      )
    }
  ], []);

  // Filter logic
  const filteredArticles = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return docArticles;
    return docArticles.filter(article => {
      return (
        article.title.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query) ||
        article.summary.toLowerCase().includes(query) ||
        article.keywords.some(keyword => keyword.includes(query))
      );
    });
  }, [searchQuery, docArticles]);

  return (
    <div className="space-y-6 md:space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header banner */}
      <div id="help-page-header" className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 md:p-8 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-[2rem] border border-white/5 relative overflow-hidden text-white shadow-xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <BookOpen size={160} className="text-white" />
        </div>
        
        <div className="space-y-3.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded-full border border-white/10">
            <Sparkles size={11} className="text-indigo-400 animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-widest text-indigo-200">Interactive Support Center</span>
          </div>
          
          <div>
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-wider">Help Documentation & Sandbox</h2>
            <p className="text-[10px] md:text-xs text-slate-300 font-semibold max-w-lg leading-relaxed mt-1">
              Configure system knowledge profiles, read access level parameters, and experience our modular transaction simulators in real-time.
            </p>
          </div>

          {onPlayTour && (
            <button
              onClick={onPlayTour}
              className="px-4.5 py-2.5 bg-indigo-600 hover:bg-indigo-500 hover:scale-[1.03] text-white font-black text-[9px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/30 flex items-center gap-2 group cursor-pointer w-fit"
            >
              <Sparkles size={13} className="group-hover:scale-115 transition-transform text-indigo-200 animate-pulse" />
              Launch Guided Portal Tour
            </button>
          )}
        </div>

        <div className="relative shrink-0 w-full md:w-80 relative z-10 mt-2 md:mt-0">
          <input
            type="text"
            placeholder="Search topic or keyword..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 dark:bg-slate-900/40 border border-white/15 hover:border-white/20 focus:border-white rounded-2xl py-3 pl-11 pr-4 text-xs font-semibold placeholder-white/50 text-white outline-none transition-all shadow-inner uppercase tracking-wider text-ellipsis"
          />
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/50" />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Grid: 1. Guided Sandbox Simulator, 2. Interactive Flow Map */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
        
        {/* Left Column: Interactive Map & Live Sandbox Simulator */}
        <div className="lg:col-span-12 space-y-6 md:space-y-8">
          
          {/* Main Visual flow nodes map */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Activity size={15} className="text-primary animate-pulse" />
                  Ecosystem Stage Progression (Live Map)
                </h3>
                <p className="text-[9px] text-muted font-medium mt-0.5">Click any stage indicator to preview corresponding validation requirements.</p>
              </div>
              
              <div className="flex gap-1 bg-slate-200/50 dark:bg-slate-950/40 p-1 rounded-xl w-fit">
                {tourSteps.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`px-3 py-1 rounded-lg text-[9px] font-black tracking-widest uppercase transition-all cursor-pointer ${
                      activeStep === idx 
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-950 shadow-sm" 
                        : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                    }`}
                  >
                    0{idx + 1}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 md:p-8 bg-slate-50/20 dark:bg-slate-950/10">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                {tourSteps.map((step, idx) => {
                  const StepIcon = step.icon;
                  const isSelected = activeStep === idx;
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => setActiveStep(idx)}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group select-none min-h-[140px] flex flex-col justify-between ${
                        isSelected 
                          ? "bg-white dark:bg-slate-900 border-primary shadow-lg ring-1 ring-primary/40" 
                          : "bg-white dark:bg-slate-900 border-border opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      <div className="space-y-2 relative z-10">
                        <div className="flex items-start gap-2.5">
                          <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                            <StepIcon size={15} />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <span className="text-[8px] font-black tracking-widest text-[#4f46e5] uppercase block truncate">
                              {step.role}
                            </span>
                            <p className="text-[11px] font-black text-foreground truncate uppercase tracking-tight">{step.title.split(": ")[1]}</p>
                          </div>
                        </div>

                        <p className="text-[10px] text-muted font-semibold leading-relaxed">
                          {step.desc}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center gap-1.5 text-[9px] font-black text-primary uppercase tracking-wider group-hover:gap-2 transition-all">
                        <span>Click for details</span>
                        <ChevronRight size={10} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Connected details tooltip box */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  className="mt-6 p-5 bg-gradient-to-r from-indigo-50/50 to-indigo-100/10 dark:from-slate-900 dark:to-slate-900/60 border border-primary/20 rounded-[2rem] flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative overflow-hidden"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-[8px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">
                        Interactive Overlay Highlight
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-2">
                      <Info size={14} className="text-primary shrink-0 animate-bounce" />
                      Target UI Control: {tourSteps[activeStep].elementName}
                    </h4>
                    <p className="text-[11px] md:text-xs text-slate-600 dark:text-slate-300 font-semibold leading-relaxed">
                      {tourSteps[activeStep].tooltip}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 px-4 py-3 border border-border rounded-xl shrink-0 min-w-[200px] flex flex-col justify-center space-y-1.5 shadow-sm">
                    <span className="text-[8px] font-black text-muted tracking-widest uppercase block">Validation Handler</span>
                    <span className="text-[10px] font-bold text-foreground">Action Signature Required:</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <UserCircle2 size={13} className="text-[#4f46e5]" />
                      <span className="text-[9px] font-black text-slate-800 dark:text-white uppercase tracking-wider">
                        {activeStep < 3 ? tourSteps[activeStep + 1].role.replace("_", " ") : "TREASURY_SETTLEMENT"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

          {/* Step-by-Step Interactive Sandbox Simulator */}
          <section id="help-sandbox-simulator" className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm relative">
            <div className="px-6 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                  <Sliders size={16} className="text-primary animate-pulse" />
                  Live Requisition Sandbox Simulator
                </h3>
                <p className="text-[9px] text-muted font-medium mt-0.5">Simulate a requisition's journey across access levels and observe requirements in real-time.</p>
              </div>

              <button
                onClick={resetSandbox}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-[9px] uppercase tracking-widest rounded-lg flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <RotateCcw size={11} className="shrink-0" />
                Reset Sandbox
              </button>
            </div>

            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 bg-slate-50/10 dark:bg-slate-950/5">
              
              {/* Left Side: Simulation Controls */}
              <div className="lg:col-span-5 space-y-5">
                <span className="text-[9px] font-black text-[#4f46e5] uppercase tracking-widest block">Sandbox Stage Controls</span>
                
                {/* Visual Step Timeline */}
                <div className="flex justify-between items-center relative py-2">
                  <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-slate-200 dark:bg-slate-800 -translate-y-1/2 z-0" />
                  {[1, 2, 3, 4].map((stepNum) => (
                    <button
                      key={stepNum}
                      onClick={() => setSimStep(stepNum)}
                      className={`w-7 h-7 rounded-lg font-black text-xs relative z-10 flex items-center justify-center transition-all ${
                        simStep >= stepNum
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-450"
                      }`}
                    >
                      {stepNum}
                    </button>
                  ))}
                </div>

                {/* Simulation variables controller form */}
                <div className="p-5 bg-white dark:bg-slate-900 border border-border rounded-xl space-y-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-foreground">Change variables to test compliance alerts:</p>
                  
                  {simStep === 1 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase">Sample Requisition Name</label>
                        <input
                          type="text"
                          value={simTitle}
                          onChange={(e) => setSimTitle(e.target.value)}
                          className="w-full bg-background border border-border px-3 py-1.5 text-xs font-semibold rounded-lg focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase flex justify-between">
                          <span>Amount Requested (USD)</span>
                          <span className={`${simAmount > 800 ? "text-rose-500" : "text-[#4f46e5]"}`}>
                            {simAmount > 800 ? "⚠️ Limit Alert" : "Limits Safe"}
                          </span>
                        </label>
                        <input
                          type="number"
                          value={simAmount}
                          onChange={(e) => setSimAmount(Number(e.target.value))}
                          className="w-full bg-background border border-border px-3 py-1.5 text-xs font-semibold rounded-lg focus:outline-none focus:border-primary"
                        />
                        <p className="text-[9px] text-muted font-medium italic select-none">Values above $800 require higher vetting notes verification.</p>
                      </div>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase">L1 Vetting Decision Reason</label>
                        <select
                          value={simL1Reason}
                          onChange={(e) => setSimL1Reason(e.target.value)}
                          className="w-full bg-background border border-border px-3 py-1.5 text-xs font-semibold rounded-lg focus:outline-none focus:border-primary uppercase tracking-wider cursor-pointer"
                        >
                          <option value="">Compliant (Invoice Match)</option>
                          <option value="blurry">Flag as "Invoice Blurry"</option>
                          <option value="mismatch">Flag as "Price Mismatch"</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {simStep === 3 && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-muted uppercase">L2 Reserve Treasury Decision</label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => setSimL2Status("approved")}
                            className={`px-3 py-1.5 font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                              simL2Status === "approved" 
                                ? "bg-emerald-500 text-white" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Approved
                          </button>
                          <button
                            onClick={() => setSimL2Status("rejected")}
                            className={`px-3 py-1.5 font-black text-[9px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer ${
                              simL2Status === "rejected" 
                                ? "bg-red-500 text-white" 
                                : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            Flag Deficit
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {simStep === 4 && (
                    <div className="space-y-3">
                      <div className="space-y-1 font-semibold text-xs leading-relaxed">
                        <label className="text-[9px] font-black text-muted uppercase">Enter Cheque / Transfer ID #</label>
                        <input
                          type="text"
                          value={simRefNumber}
                          onChange={(e) => setSimRefNumber(e.target.value)}
                          placeholder="e.g. CHQ-908722"
                          className="w-full bg-background border border-border px-3 py-1.5 text-xs font-semibold rounded-lg focus:outline-none focus:border-primary"
                        />
                        <p className="text-[9px] text-muted italic">This seals the transaction, converting the original item draft to the final DISBURSED state.</p>
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-2">
                    <button
                      onClick={() => setSimStep(prev => prev < 4 ? prev + 1 : 1)}
                      className="w-full bg-[#4f46e5] text-white py-2 px-4 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#4338ca] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>{simStep === 4 ? "Restart Journey" : "Next Sandbox Step"}</span>
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Side: Mock Interface visualizer */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden flex flex-col justify-between shadow-md">
                
                {/* Mock Application Frame Header */}
                <div className="px-5 py-3 border-b border-border bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between select-none">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <span className="text-[9px] font-mono tracking-wider font-semibold text-slate-400">STANDS SYSTEM PREVIEW • SANDBOX MODULATOR</span>
                  <div className="w-10" />
                </div>

                {/* Simulated Content Area based on current active step */}
                <div className="p-6 md:p-8 flex-1 flex flex-col justify-center min-h-[220px]">
                  <AnimatePresence mode="wait">
                    {simStep === 1 && (
                      <motion.div
                        key="sim-1"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-full uppercase">
                            Draft Status: SUBMITTED
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">#REQ-8902</span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 space-y-1.5 relative group border border-dashed border-border">
                          <span className="text-[8px] font-black text-muted uppercase block">Requisition Title</span>
                          <h4 className="text-xs font-black text-foreground uppercase tracking-wider">{simTitle || "Untitled Item"}</h4>
                          
                          <div className="flex justify-between items-center pt-2">
                            <div>
                              <span className="text-[8px] font-black text-muted uppercase block">Allocated Group Pool</span>
                              <span className="text-[10px] font-semibold text-[#4f46e5]">Youth Ministry</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[8px] font-black text-muted uppercase block">Est Amount</span>
                              <span className="text-xs font-black text-[#4f46e5]">${simAmount}</span>
                            </div>
                          </div>
                        </div>

                        {simAmount > 800 ? (
                          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900 rounded-xl flex items-center gap-2">
                            <AlertCircle size={14} className="text-red-500 shrink-0" />
                            <p className="text-[9.5px] font-bold text-red-500 leading-normal">
                              High Value Limit reached: This requires Level 2 auditing attention.
                            </p>
                          </div>
                        ) : (
                          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900 rounded-xl flex items-center gap-2">
                            <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                            <p className="text-[9.5px] font-bold text-emerald-500 leading-normal">
                              Budget matches department reserves perfectly. Ready for Level 1 compliance.
                            </p>
                          </div>
                        )}
                      </motion.div>
                    )}

                    {simStep === 2 && (
                      <motion.div
                        key="sim-2"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase ${
                            simL1Reason === "" 
                              ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400" 
                              : "bg-amber-100 text-amber-700"
                          }`}>
                            L1 Level: {simL1Reason === "" ? "APPROVED_L1" : "CORRECTIONS REQUESTED"}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">Vetting Workspace</span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-border space-y-2.5">
                          <span className="text-[8px] font-black text-muted tracking-widest uppercase">Verified compliance checklist</span>
                          <div className="space-y-1.5 md:space-y-2">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-350">
                              <Check size={11} className="text-emerald-500" />
                              <span>Supplier invoice matched database</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-350">
                              <Check size={11} className="text-emerald-500" />
                              <span>Vendor registered in tax records</span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-350">
                              {simL1Reason === "" ? (
                                <Check size={11} className="text-emerald-500" />
                              ) : (
                                <X size={11} className="text-rose-500" />
                              )}
                              <span>
                                {simL1Reason === "" 
                                  ? "Receipt attachment matches exactly" 
                                  : simL1Reason === "blurry" 
                                    ? "Rejected: Upload is blurry (Resolution Low)" 
                                    : "Rejected: Price mismatches quote"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {simStep === 3 && (
                      <motion.div
                        key="sim-3"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-semibold px-2.5 py-1 rounded-full uppercase ${
                            simL2Status === "approved" 
                              ? "bg-purple-100 text-purple-700" 
                              : "bg-red-100 text-red-700"
                          }`}>
                            L2 STATE: {simL2Status === "approved" ? "APPROVED_L2" : "RESERVE OVERFLOW"}
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">Keymaster Audit</span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 shadow-inner border border-border space-y-3">
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>Department Liquidity Cap:</span>
                            <span className="font-bold text-slate-800 dark:text-white">$10,000.00</span>
                          </div>
                          
                          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                            <span>Simulation Cost Deduction:</span>
                            <span className="font-bold text-[#4f46e5]">${simAmount}.00</span>
                          </div>

                          <div className="h-[1px] bg-slate-200 dark:bg-slate-800" />

                          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-300">
                            <span>Outstanding Budget Margin:</span>
                            <span className={`font-black ${simL2Status === "approved" ? "text-emerald-500" : "text-rose-500"}`}>
                              ${10000 - simAmount}.00 {simL2Status === "rejected" && "(Flagged Reserve Locked)"}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {simStep === 4 && (
                      <motion.div
                        key="sim-4"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full uppercase leading-none">
                            Transaction Sealed: DISBURSED
                          </span>
                          <span className="text-[9px] font-mono text-slate-400">Disbursement Complete</span>
                        </div>

                        <div className="p-5 rounded-2xl border border-emerald-100/50 dark:border-emerald-950 bg-emerald-50/10 dark:bg-slate-950/20 text-center space-y-2">
                          <ShieldCheck size={28} className="text-emerald-500 mx-auto animate-bounce" />
                          <div>
                            <span className="text-[8px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Bank Ledger Stamp</span>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">
                              Outstanding balance successfully released. Cheque reference indexed as:
                            </p>
                            <span className="inline-block mt-1 font-mono font-bold text-[10px] text-slate-800 dark:text-white px-2 py-0.5 bg-slate-100 dark:bg-slate-900 rounded">
                              {simRefNumber || "CHQ-0019283"}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Simulated Bottom Navigation */}
                <div className="px-5 py-4 border-t border-border bg-slate-50 dark:bg-slate-950/30 text-[10px] font-semibold text-muted flex items-center justify-between select-none">
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Live Simulator Ready</span>
                  </div>
                  <span>Sandbox Engine V2.0</span>
                </div>

              </div>
            </div>
          </section>

        </div>

        {/* Access Matrix section */}
        <div className="lg:col-span-12 space-y-6 md:space-y-8">
          
          {/* Permission levels tabs layout */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                Granular Separation of Duties & Restrictions
              </h3>
              <p className="text-[9px] text-muted font-medium mt-0.5 font-semibold">Click on each operational tier below to filter system-enforced permission matrices.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-border">
              {[
                { id: UserRole.CHURCH_GROUP, label: "Ministry Rep", desc: "Submit Requisitions", color: "border-blue-500" },
                { id: UserRole.APPROVER_L1, label: "L1 Verifier", desc: "Digital Vetting", color: "border-indigo-500" },
                { id: UserRole.APPROVER_L2, label: "L2 Keymaster", desc: "Treasury Authorization", color: "border-violet-500" },
                { id: UserRole.SUPER_ADMIN, label: "Super Admin", desc: "Full Operational Control", color: "border-emerald-500" }
              ].map((roleItem) => {
                const isSelected = selectedRole === roleItem.id;
                return (
                  <button
                    key={roleItem.id}
                    onClick={() => setSelectedRole(roleItem.id as any)}
                    className={`px-6 py-4.5 text-left transition-all relative border-b-2 md:border-b-0 md:border-r border-border last:border-r-0 cursor-pointer ${
                      isSelected 
                        ? `bg-slate-50 dark:bg-slate-900/60 pb-5 md:pb-4.5 font-bold border-b-indigo-500 ${roleItem.color}` 
                        : "hover:bg-slate-50/50 dark:hover:bg-slate-900/20"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <User size={13} className={isSelected ? "text-primary" : "text-slate-400"} />
                        <span className={`text-[10px] font-black uppercase tracking-wider ${isSelected ? "text-primary hover:text-indigo-600" : "text-slate-705 dark:text-slate-300"}`}>
                          {roleItem.label}
                        </span>
                      </div>
                      <span className="text-[9px] block text-muted font-black leading-tight uppercase tracking-wider">{roleItem.desc}</span>
                    </div>
                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary hidden md:block" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedRole}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-8"
                >
                  {/* Left columns: Core operations permitted checklist */}
                  <div className="space-y-4 lg:col-span-2">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      Permitted Dashboard Operations of {selectedRole.replace("_", " ")}
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {selectedRole === UserRole.CHURCH_GROUP && [
                        "Draft and edit requisitions in direct correlation to the group’s assigned budget codes.",
                        "Upload and replace proof receipts/supplier invoices (JPEG & PNG formats allowed).",
                        "Audit transaction history logs connected back to submitted items.",
                        "Request supplementary budget upgrades when assigned departments exhaust allocations."
                      ].map((act, i) => (
                        <div key={i} className="p-4 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-900/40 dark:hover:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 flex items-start gap-3 transition-colors">
                          <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#4f46e5] flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{act}</p>
                        </div>
                      ))}

                      {selectedRole === UserRole.APPROVER_L1 && [
                        "Examine and vet raw receipt invoices, verify tax codes, and check item details.",
                        "Approve compliance drafts, raising values to APPROVED_L1 to lock critical values.",
                        "Flag item discrepancies, bouncing requests back to Ministry Representatives for replacements.",
                        "Append verifier compliance auditing notes that accompany the request downstream."
                      ].map((act, i) => (
                        <div key={i} className="p-4 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-900/40 dark:hover:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 flex items-start gap-3 transition-colors">
                          <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#4f46e5] flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{act}</p>
                        </div>
                      ))}

                      {selectedRole === UserRole.APPROVER_L2 && [
                        "Validate and sign APPROVED_L1 items after cross-examining general fund checking registers.",
                        "Analyze and maintain aggregate cash reserve pools and view compliance warning notices.",
                        "Perform final digital authorization signatures, upgrading entries to APPROVED_L2 status.",
                        "Verify and log overall monthly/weekly cash projection layouts."
                      ].map((act, i) => (
                        <div key={i} className="p-4 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-900/40 dark:hover:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 flex items-start gap-3 transition-colors">
                          <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#4f46e5] flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{act}</p>
                        </div>
                      ))}

                      {selectedRole === UserRole.SUPER_ADMIN && [
                        "Process final bank ledger disbursements, logging individual cheque index reference numbers.",
                        "Manipulate roles and override security permissions inside global Users parameters.",
                        "Activate System-Offline mode to freeze general write routes during system upgrades.",
                        "Approve or decline supplementary emergency budget pools instantly on submission."
                      ].map((act, i) => (
                        <div key={i} className="p-4 bg-slate-50 hover:bg-slate-100/50 dark:bg-slate-900/40 dark:hover:bg-slate-950/20 rounded-2xl border border-slate-100 dark:border-slate-900 flex items-start gap-3 transition-colors">
                          <span className="w-5 h-5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[#4f46e5] flex items-center justify-center font-black text-[9px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-semibold">{act}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right column: Enforced constraints & Security rules */}
                  <div className="space-y-4 bg-slate-50 dark:bg-slate-900 p-5 md:p-6 rounded-[2rem] border border-border">
                    <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-1.5">
                      <Lock size={14} className="text-rose-500 shrink-0" />
                      System-Enforced Enclosure Constraints
                    </h4>
                    
                    <p className="text-[10px] text-muted leading-relaxed font-semibold italic">
                      Every boundary rule detailed below is backed by server-side Supabase database row-level security (RLS) policies.
                    </p>

                    <div className="space-y-3.5 pt-1.5">
                      {selectedRole === UserRole.CHURCH_GROUP && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block">FORBIDDEN ACTIONS</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Cannot bypass approvals to approve items.<br />
                              • Cannot access supplementary configuration sliders.<br />
                              • Cannot update global group budgets or write audit records.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest block">COMPLIANCE METRIC</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Exceeded requests emit an instant high-budget check validation error.
                            </p>
                          </div>
                        </>
                      )}

                      {selectedRole === UserRole.APPROVER_L1 && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block">FORBIDDEN ACTIONS</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Cannot bypass L1 verification steps directly to L2 approvals.<br />
                              • Cannot configure cheque references or trigger ledger settlements.<br />
                              • Cannot alter custom user assignments or permissions toggler.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest block">AUDITOR RULE</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Must evaluate uploaded receipt documents for legitimacy before signoff.
                            </p>
                          </div>
                        </>
                      )}

                      {selectedRole === UserRole.APPROVER_L2 && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block">FORBIDDEN ACTIONS</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Cannot edit requisition input parameters or draft values.<br />
                              • Cannot edit custom ledger settings values directly.<br />
                              • Cannot unlock restricted profile accounts quarantined in the waiting room.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest block">TREASURY PROTOCOL</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Authorizations must match active bank reserves, avoiding liquid treasury deficit.
                            </p>
                          </div>
                        </>
                      )}

                      {selectedRole === UserRole.SUPER_ADMIN && (
                        <>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest block">COMPLIANCE SAFETY ALERTS</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Even Administrators are bound by write-only logs.<br />
                              • Deletion of items leaves a logged breadcrumb in the audit database.
                            </p>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest block">PORTAL PRIVILEGES</span>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-normal">
                              • Super Administrators can debug, format, and override statuses but cannot erase historical logs.
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </section>

        </div>

        {/* Knowledge-base structured search column */}
        <div className="lg:col-span-12 space-y-6 md:space-y-8">
          
          {/* Keyboard Shortcuts Helper Panel */}
          <section id="help-keyboard-shortcuts" className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <Key size={16} className="text-primary animate-pulse" />
                Keyboard Shortcuts & Quick Access
              </h3>
              <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100/40 dark:border-indigo-900/40 px-3 py-1.5 rounded-xl">
                SYSTEM ACCESSIBILITY
              </span>
            </div>
            <div className="p-6 md:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Shortcut Item 1 */}
                <div className="p-5 bg-slate-50/40 dark:bg-slate-900/10 hover:bg-slate-50/80 dark:hover:bg-slate-900/30 rounded-2xl border border-border transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Global System Search
                    </h4>
                    <p className="text-[10px] text-muted leading-relaxed font-semibold">
                      Instantly focus the search bar from anywhere to search requisitions or settings.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    <kbd className="px-2 py-1 bg-slate-150/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg text-[10px] font-mono font-black shadow-sm text-foreground select-none">Ctrl</kbd>
                    <span className="text-[9px] font-bold text-slate-400">+</span>
                    <kbd className="px-2 py-1 bg-slate-150/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg text-[10px] font-mono font-black shadow-sm text-foreground select-none">K</kbd>
                  </div>
                </div>

                {/* Shortcut Item 2 */}
                <div className="p-5 bg-slate-50/40 dark:bg-slate-900/10 hover:bg-slate-50/80 dark:hover:bg-slate-900/30 rounded-2xl border border-border transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Dismiss / Escape Modals
                    </h4>
                    <p className="text-[10px] text-muted leading-relaxed font-semibold">
                      Close drawers, notifications, profile prompts, or blur focused inputs instantly.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    <kbd className="px-2 py-1 bg-slate-150/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg text-[10px] font-mono font-black shadow-sm text-foreground select-none">Esc</kbd>
                  </div>
                </div>

                {/* Shortcut Item 3 */}
                <div className="p-5 bg-slate-50/40 dark:bg-slate-900/10 hover:bg-slate-50/80 dark:hover:bg-slate-900/30 rounded-2xl border border-border transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Next Attachment
                    </h4>
                    <p className="text-[10px] text-muted leading-relaxed font-semibold">
                      Navigate to the next receipt or quote file when viewing in fullscreen mode.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    <span className="text-[9px] font-semibold text-muted mr-1">In Viewer:</span>
                    <kbd className="px-2 py-1 bg-slate-150/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg text-[10px] font-mono font-black shadow-sm text-foreground select-none">→</kbd>
                  </div>
                </div>

                {/* Shortcut Item 4 */}
                <div className="p-5 bg-slate-50/40 dark:bg-slate-900/10 hover:bg-slate-50/80 dark:hover:bg-slate-900/30 rounded-2xl border border-border transition-all flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h4 className="text-[10px] font-black text-foreground uppercase tracking-widest">
                      Previous Attachment
                    </h4>
                    <p className="text-[10px] text-muted leading-relaxed font-semibold">
                      Navigate to the previous receipt or quote file when viewing in fullscreen mode.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 pt-1.5">
                    <span className="text-[9px] font-semibold text-muted mr-1">In Viewer:</span>
                    <kbd className="px-2 py-1 bg-slate-150/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-750 rounded-lg text-[10px] font-mono font-black shadow-sm text-foreground select-none">←</kbd>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* Documentation Support Articles */}
          <section className="bg-card rounded-[2rem] border border-border overflow-hidden shadow-sm">
            <div className="px-8 py-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
              <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] flex items-center gap-2">
                <BookOpen size={16} className="text-primary" />
                Support Knowledge Articles ({filteredArticles.length})
              </h3>
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")}
                  className="px-3 py-1.5 bg-indigo-50 dark:bg-slate-900 hover:bg-indigo-100 text-[#4f46e5] font-black text-[9px] uppercase tracking-widest border border-indigo-200 dark:border-slate-800 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <RotateCcw size={11} className="shrink-0" />
                  Reset Search
                </button>
              )}
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {filteredArticles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredArticles.map((article) => (
                    <div 
                      key={article.id}
                      className="p-6 bg-slate-50/20 dark:bg-slate-900/10 hover:bg-slate-50/60 dark:hover:bg-slate-900/30 rounded-[2rem] border border-border transition-all flex flex-col justify-between"
                    >
                      <div className="space-y-3">
                        <span className="text-[8px] font-black text-primary uppercase tracking-widest px-2.5 py-1 bg-indigo-50 dark:bg-slate-950/40 rounded-full border border-indigo-100/40 dark:border-slate-800 w-fit block select-none">
                          {article.category}
                        </span>
                        <h4 className="text-xs font-black text-foreground uppercase tracking-widest leading-snug">
                          {article.title}
                        </h4>
                        <p className="text-[10px] md:text-sm text-muted leading-relaxed font-semibold italic">
                          {article.summary}
                        </p>
                        
                        <div className="pt-3 border-t border-dashed border-border">
                          {article.content}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 mt-5">
                        {article.keywords.map((kw, i) => (
                          <span key={i} className="text-[8.5px] font-mono font-medium text-slate-400 bg-slate-100 dark:bg-slate-950 px-2 py-0.5 rounded">
                            #{kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center border border-dashed border-border rounded-[2.5rem] bg-slate-50/30 dark:bg-slate-900/10 space-y-3">
                  <HelpCircle size={40} className="text-slate-400 mx-auto animate-bounce" />
                  <div className="space-y-1">
                    <p className="text-xs font-black text-foreground uppercase tracking-wider">No matching articles found</p>
                    <p className="text-[10px] text-muted max-w-sm mx-auto font-medium leading-relaxed">
                      We scanned titles, keywords, summaries, and categories but could not find a match for "{searchQuery}". Please refine your term.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

        </div>

      </div>

    </div>
  );
};
