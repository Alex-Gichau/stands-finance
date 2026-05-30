/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { 
  Store, 
  Plus, 
  Search, 
  MapPin, 
  PhoneCall, 
  Package, 
  Calendar, 
  User, 
  X, 
  Loader2, 
  SlidersHorizontal,
  CornerDownRight, 
  Briefcase,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Download
} from "lucide-react";
import { useRequisitions } from "../contexts/RequisitionContext";
import { Vendor, UserRole } from "../types";
import { motion, AnimatePresence } from "motion/react";

export const VendorsPanel: React.FC = () => {
  const { vendors, addVendor, currentUser, triggerToast, addSystemLog } = useRequisitions();
  
  // Tab / Panel state
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedOfferingsFilter, setSelectedOfferingsFilter] = useState<string>("ALL");

  // Form fields state
  const [name, setName] = useState<string>("");
  const [contact, setContact] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [offerings, setOfferings] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Filter unique offerings for the dropdown filter
  const uniqueOfferings = useMemo(() => {
    const list = new Set<string>();
    vendors.forEach(v => {
      if (v.offerings) {
        v.offerings.split(",").forEach(item => {
          const trimmed = item.trim();
          if (trimmed) {
            list.add(trimmed.toLowerCase());
          }
        });
      }
    });
    return Array.from(list).map(item => item.charAt(0).toUpperCase() + item.slice(1));
  }, [vendors]);

  // Client-side search and filters
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      // Search term filter
      const matchesSearch = 
        v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.offerings || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.location || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.contact || "").toLowerCase().includes(searchTerm.toLowerCase());

      // Offerings Category filter
      let matchesOfferings = true;
      if (selectedOfferingsFilter !== "ALL") {
        matchesOfferings = (v.offerings || "").toLowerCase().includes(selectedOfferingsFilter.toLowerCase());
      }

      return matchesSearch && matchesOfferings;
    });
  }, [vendors, searchTerm, selectedOfferingsFilter]);

  // Statistics calculation for the filtered list
  const stats = useMemo(() => {
    const total = filteredVendors.length;
    
    // Recently added (e.g., within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentlyAdded = filteredVendors.filter(v => new Date(v.createdAt) >= thirtyDaysAgo).length;

    // Most offered service
    const serviceCounts: Record<string, number> = {};
    filteredVendors.forEach(v => {
      if (v.offerings) {
        v.offerings.split(",").forEach(item => {
          const trimmed = item.trim();
          if (trimmed) {
            const normalized = trimmed.toLowerCase();
            serviceCounts[normalized] = (serviceCounts[normalized] || 0) + 1;
          }
        });
      }
    });

    let mostOffered = "N/A";
    let maxCount = 0;
    for (const service in serviceCounts) {
      if (serviceCounts[service] > maxCount) {
        maxCount = serviceCounts[service];
        mostOffered = service.charAt(0).toUpperCase() + service.slice(1);
      }
    }
    
    return { total, recentlyAdded, mostOffered };
  }, [filteredVendors]);

  // Submit Handler to create vendor
  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "MEDIUM",
        message: "⚠️ Vendor name is required",
        timestamp: new Date().toISOString()
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await addVendor({
        name: name.trim(),
        contact: contact.trim() || undefined,
        location: location.trim() || undefined,
        offerings: offerings.trim() || undefined
      });

      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "LOW",
        message: `✅ Vendor "${name.trim()}" successfully registered!`,
        timestamp: new Date().toISOString()
      });

      // Reset Form State
      setName("");
      setContact("");
      setLocation("");
      setOfferings("");
      setShowAddForm(false);
    } catch (err: any) {
      triggerToast({
        type: "FINANCE_DISBURSEMENT",
        severity: "HIGH",
        message: `❌ Failed to register vendor: ${err.message || err}`,
        timestamp: new Date().toISOString()
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Offerings", "Contact", "Location", "Created At"];
    const csvContent = [
      headers.join(","),
      ...filteredVendors.map(v => [
        `"${v.name.replace(/"/g, '""')}"`,
        `"${(v.offerings || "").replace(/"/g, '""')}"`,
        `"${(v.contact || "").replace(/"/g, '""')}"`,
        `"${(v.location || "").replace(/"/g, '""')}"`,
        `"${v.createdAt}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `vendors_export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-700">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Store size={28} className="text-primary" />
            STANDS Vendor Directory
          </h2>
          <p className="text-sm text-muted font-medium max-w-xl">
            Diocesan permanent ledger of approved suppliers, service providers, and vendors under the STANDS verification program.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all"
            title="Download CSV"
          >
            <Download size={14} />
            <span>Export</span>
          </button>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary shrink-0 flex items-center gap-2"
          >
            {showAddForm ? <X size={16} /> : <Plus size={16} />}
            <span>{showAddForm ? "CLOSE MODULE" : "REGISTER NEW VENDOR"}</span>
          </button>
        </div>
      </div>

      {/* Slide-down Register Form */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form 
              onSubmit={handleCreateVendor}
              className="bg-card rounded-[2rem] border border-border shadow-md p-6 md:p-8 space-y-6"
            >
              <div className="border-b border-border/60 pb-3 flex justify-between items-center">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-1.5">
                  <CheckCircle2 size={14} />
                  Diocesan Supplier Registration Panel
                </h3>
                <span className="text-[9px] font-mono text-muted uppercase tracking-wider">Form_ID • DEV_STANDS</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Vendor Name */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                    🤝 Trade / Registered Vendor Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Acme Stationery Supply Ltd"
                    className="input-field h-12 bg-slate-50 border-slate-200 focus:bg-white text-xs md:text-sm font-semibold text-foreground px-4 rounded-xl"
                  />
                </div>

                {/* Offerings Category */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                    🛍️ Products / Services Offered
                  </label>
                  <input
                    type="text"
                    value={offerings}
                    onChange={(e) => setOfferings(e.target.value)}
                    placeholder="e.g. Stationery, Catering, Structural works, Tent Hire"
                    className="input-field h-12 bg-slate-50 border-slate-200 focus:bg-white text-xs md:text-sm font-semibold text-foreground px-4 rounded-xl"
                  />
                  <p className="text-[9px] text-muted ml-1">Use commas to separate offerings (e.g. "Tents, Sound, Chairs")</p>
                </div>

                {/* Contact Reference */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                    📞 Contact Reference (Phone/Email)
                  </label>
                  <input
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="e.g. +254 712 345678 or sales@firm.com"
                    className="input-field h-12 bg-slate-50 border-slate-200 focus:bg-white text-xs md:text-sm font-semibold text-foreground px-4 rounded-xl"
                  />
                </div>

                {/* Physical Location */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1 block">
                    📍 Business Operations / Physical Location
                  </label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Bishop Road, Nairobi"
                    className="input-field h-12 bg-slate-50 border-slate-200 focus:bg-white text-xs md:text-sm font-semibold text-foreground px-4 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-6 py-3 bg-slate-150 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  DISCARD_RECORD
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 hover:bg-primary/95 shadow-md shadow-primary/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Store size={16} />
                  )}
                  <span>COMMIT_RECORD_TO_LEDGER</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Directory Searching & Dynamic stats block */}
      <div className="bg-card rounded-[2rem] border border-border shadow-sm p-6 md:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row items-center gap-4 justify-between">
          
          {/* Quick search */}
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search via name, services, or locations..."
              className="w-full bg-slate-500/5 hover:bg-slate-500/10 focus:bg-white text-xs font-semibold px-10 py-3.5 rounded-2xl border border-border/50 focus:border-primary/50 text-foreground transition-all placeholder:text-muted/65 outline-none"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm("")} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Offerings Filter Tabs */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider hidden sm:inline mr-1">
              Filter:
            </span>
            <button
              onClick={() => setSelectedOfferingsFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                selectedOfferingsFilter === "ALL"
                  ? "bg-primary text-white shadow-sm"
                  : "bg-slate-500/5 hover:bg-slate-500/15 text-slate-500 dark:text-slate-400"
              }`}
            >
              All Types
            </button>
            {uniqueOfferings.slice(0, 5).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedOfferingsFilter(category)}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                  selectedOfferingsFilter.toLowerCase() === category.toLowerCase()
                    ? "bg-primary text-white shadow-sm"
                    : "bg-slate-500/5 hover:bg-slate-500/15 text-slate-500 dark:text-slate-400"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

        </div>

        {/* Dynamic mini statistics banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-500/5 rounded-2xl border border-border/40 select-none">
          <div className="text-center md:text-left md:border-r border-border/50 px-2 py-1">
            <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Total Vendors</p>
            <p className="text-xl font-black text-foreground mt-0.5">{stats.total}</p>
          </div>
          <div className="text-center md:text-left md:border-r border-border/50 px-2 py-1">
            <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Recently Added (30d)</p>
            <p className="text-xl font-black text-foreground mt-0.5">{stats.recentlyAdded}</p>
          </div>
          <div className="text-center md:text-left md:border-r border-border/50 px-2 py-1">
            <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Most Offered Service</p>
            <p className="text-xl font-black text-primary mt-0.5 text-base truncate" title={stats.mostOffered}>{stats.mostOffered}</p>
          </div>
          <div className="text-center md:text-left px-2 py-1">
            <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Access Clearance Level</p>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-500 mt-0.5 uppercase">STANDS_V_II</p>
          </div>
        </div>

        {/* Vendors Bento Grid */}
        {filteredVendors.length === 0 ? (
          <div className="py-16 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-500/5 border border-dashed border-border rounded-full flex items-center justify-center text-muted mx-auto">
              <Store size={24} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">No suppliers match your criteria</p>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                No matching entry was found in the diocesan ledger. Check spelling or register this vendor using the form.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredVendors.map((vendor) => (
                <motion.div
                  key={vendor.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="bg-card border border-border/60 hover:border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-all relative overflow-hidden group flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    {/* Header line */}
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center font-bold text-sm shrink-0">
                          {vendor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-foreground uppercase tracking-tight line-clamp-1 group-hover:text-primary transition-colors">
                            {vendor.name}
                          </h4>
                          <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-primary bg-primary/5 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                            verified supplier
                          </span>
                        </div>
                      </div>

                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" title="STANDS Active" />
                    </div>

                    {/* Offerings tags */}
                    <div className="flex flex-wrap gap-1.5">
                      {vendor.offerings ? (
                        vendor.offerings.split(",").map((o, idx) => (
                          <span 
                            key={idx} 
                            className="bg-slate-500/5 border border-border/30 text-slate-500 dark:text-slate-400 font-mono text-[8.5px] px-2 py-0.5 rounded-md font-bold uppercase"
                          >
                            {o.trim()}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic font-mono text-[8.5px]">General Products/Services</span>
                      )}
                    </div>

                    {/* Meta data (Phone + Location) */}
                    <div className="space-y-2 pt-2 border-t border-border/40 text-[10px] text-muted font-semibold">
                      <div className="flex items-center gap-2">
                        <PhoneCall size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{vendor.contact || "No reference contact"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={12} className="text-slate-400 shrink-0" />
                        <span className="truncate">{vendor.location || "Not specified"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Footing detail */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/40 text-[9px] text-muted font-bold select-none">
                    <span className="flex items-center gap-1">
                      <User size={10} />
                      Ref: {(vendor as any).addedBy || "Church Synced"}
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar size={10} />
                      {new Date(vendor.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
