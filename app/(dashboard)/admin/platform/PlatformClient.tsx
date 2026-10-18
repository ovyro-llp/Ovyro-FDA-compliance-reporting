"use client";

import React, { useState } from "react";
import Link from "next/link";

interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  status: string;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  createdAt: string;
  dodoPaymentId?: string | null;
  dodoSessionId?: string | null;
  dodoSubscriptionId?: string | null;
  checkoutUrl?: string | null;
}

interface OrganizationItem {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  monthlyFee: number;
  billingStatus: string;
  billingInterval?: string | null;
  dodoSubscriptionId?: string | null;
  dodoCustomerId?: string | null;
  dodoProductId?: string | null;
  paymentProvider?: string | null;
  nextBillingDate?: string | null;
  lastPaymentDate?: string | null;
  createdAt: string;
  _count: {
    users: number;
    outlets: number;
    templates: number;
    submissions: number;
  };
  billingRecords?: BillingRecord[];
}

interface Metrics {
  totalClients: number;
  totalUsers: number;
  totalOutlets: number;
  totalSubmissions: number;
  totalRevenueReceived: number;
  totalRevenuePending: number;
  mrr: number;
  paymentProvider?: string;
}

interface PlatformClientProps {
  initialMetrics: Metrics;
  initialOrganizations: OrganizationItem[];
}

// Crisp Lucide-style SVG Icons
function IconBuilding({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="20" x="4" y="2" rx="2" ry="2" />
      <path d="M9 22v-4h6v4" />
      <path d="M8 6h.01" />
      <path d="M16 6h.01" />
      <path d="M8 10h.01" />
      <path d="M16 10h.01" />
      <path d="M8 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  );
}

function IconUsers({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconCurrencyRupee({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12" />
      <path d="M6 8h12" />
      <path d="m6 13 8.5 8" />
      <path d="M6 13h3a4 4 0 0 0 0-8" />
    </svg>
  );
}

function IconAlertCircle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </svg>
  );
}

function IconCheckCircle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function IconPlus({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

function IconWhatsApp({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2zm5.78 14.12c-.24.68-1.4 1.26-1.92 1.34-.51.08-1.17.11-3.37-.8-2.2-1.02-3.62-3.26-3.73-3.41-.11-.15-.89-1.19-.89-2.27s.56-1.61.76-1.83c.2-.22.44-.28.58-.28.15 0 .29 0 .42.01.14.01.32-.05.5.38.18.44.63 1.54.69 1.65.06.11.1.24.02.39-.07.15-.11.24-.22.37-.11.13-.23.29-.33.39-.11.11-.23.23-.1.45.13.22.58.96 1.24 1.55.86.77 1.58 1.01 1.8 1.12.22.11.36.1.49-.06.13-.15.57-.66.72-.89.15-.22.3-.19.51-.11.21.08 1.33.63 1.56.74.23.11.38.17.44.27.06.1.06.59-.18 1.27z"/>
    </svg>
  );
}

function IconRefresh({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
  );
}

function IconExternalLink({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/>
      <line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export default function PlatformClient({
  initialMetrics,
  initialOrganizations,
}: PlatformClientProps) {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const [organizations, setOrganizations] = useState<OrganizationItem[]>(initialOrganizations);
  const [filterPlan, setFilterPlan] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnboardModal, setShowOnboardModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generatingCheckout, setGeneratingCheckout] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Active Checkout Dialog state
  const [activeCheckoutModal, setActiveCheckoutModal] = useState<{
    orgName: string;
    checkoutUrl: string;
    sessionId: string;
    amount: number;
    interval: string;
    contactPhone?: string | null;
  } | null>(null);

  // Form State for New Client Onboarding
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newAdminName, setNewAdminName] = useState("");
  const [newPassword, setNewPassword] = useState("Admin@123");
  const [newBillingInterval, setNewBillingInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [newPreset, setNewPreset] = useState("RESTAURANT");
  const [newFacilityName, setNewFacilityName] = useState("");

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const reloadData = async () => {
    try {
      const res = await fetch("/api/platform");
      const data = await res.json();
      if (data.organizations) {
        setOrganizations(data.organizations);
        setMetrics(data.metrics);
      }
    } catch (err: any) {
      console.error("Reload error:", err);
    }
  };

  // Sync all or specific organization with Dodo Payments API
  const handleSyncDodo = async (orgId?: string) => {
    setSyncing(true);
    try {
      const res = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgId ? { organizationId: orgId } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Dodo Payments synchronization failed");

      await reloadData();
      setToast({
        type: "success",
        msg: orgId
          ? "Client successfully synchronized with Dodo Payments API"
          : "All tenant subscriptions successfully synchronized with Dodo Payments API",
      });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
    } finally {
      setSyncing(false);
    }
  };

  // Generate live Dodo Payments Checkout session
  const handleGenerateCheckout = async (org: OrganizationItem, interval: "MONTHLY" | "ANNUAL" = "MONTHLY") => {
    setGeneratingCheckout(org.id);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          planInterval: interval,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create Dodo Payments checkout session");

      setActiveCheckoutModal({
        orgName: org.name,
        checkoutUrl: data.checkoutUrl,
        sessionId: data.sessionId,
        amount: data.amount,
        interval: data.interval,
        contactPhone: org.contactPhone,
      });

      await reloadData();
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
    } finally {
      setGeneratingCheckout(null);
    }
  };

  // Delete client organization
  const handleDeleteClient = async (org: OrganizationItem) => {
    if (org.slug === "default") {
      alert("The primary platform organization cannot be deleted.");
      return;
    }

    if (!confirm(`Are you sure you want to delete "${org.name}"? This will permanently remove all associated users, checklists, and facility outlets.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/platform?id=${org.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete client");

      setOrganizations((prev) => prev.filter((o) => o.id !== org.id));
      await reloadData();
      setToast({ type: "success", msg: `Organization "${org.name}" has been deleted.` });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
    }
  };

  const handleOnboardClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/platform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          slug: newSlug || newName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
          contactEmail: newEmail,
          contactPhone: newPhone,
          adminName: newAdminName || `${newName} Admin`,
          adminPassword: newPassword,
          billingInterval: newBillingInterval,
          industryPreset: newPreset,
          facilityName: newFacilityName || `${newName} - Primary Facility`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to onboard client");

      setShowOnboardModal(false);
      await reloadData();

      // If Dodo checkout link was generated, open the checkout dialog
      if (data.dodoCheckout?.checkoutUrl) {
        setActiveCheckoutModal({
          orgName: newName,
          checkoutUrl: data.dodoCheckout.checkoutUrl,
          sessionId: data.dodoCheckout.sessionId,
          amount: data.dodoCheckout.amount,
          interval: data.dodoCheckout.interval,
          contactPhone: newPhone,
        });
      }

      setToast({ type: "success", msg: `Client "${newName}" provisioned with Dodo Payments subscription!` });

      // Reset form
      setNewName("");
      setNewSlug("");
      setNewEmail("");
      setNewPhone("");
      setNewFacilityName("");
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ type: "success", msg: "Dodo Payments checkout link copied to clipboard!" });
  };

  const filteredOrgs = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      org.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (org.contactEmail && org.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterPlan === "PAID") return org.billingStatus === "PAID";
    if (filterPlan === "PENDING") return org.billingStatus !== "PAID";
    if (filterPlan === "MONTHLY") return org.billingInterval === "MONTHLY" || org.plan === "PRO";
    if (filterPlan === "ANNUAL") return org.billingInterval === "ANNUAL" || org.plan === "ENTERPRISE";

    return true;
  });

  return (
    <div className="platform-control-center">
      {/* Platform Header */}
      <div className="page-header-row">
        <div>
          <div className="platform-tag" style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}>
            <span>👑 SaaS Commercial Control Center</span>
            <span style={{ fontSize: "0.7rem", padding: "0.15rem 0.4rem", background: "#ecfdf5", color: "#059669", borderRadius: "4px", fontWeight: "bold" }}>
              Dodo Payments Live
            </span>
          </div>
          <h1 className="page-title">SaaS Client & Revenue Operations</h1>
          <p className="page-subtitle">
            All subscriptions and client collections are exclusively processed and synchronized in real-time through Dodo Payments (OVYRO FDA Reporting).
          </p>
        </div>
        <div className="header-actions-group" style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => handleSyncDodo()}
            disabled={syncing}
            className="btn-create-primary"
            style={{ background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", boxShadow: "none" }}
            title="Sync all client subscriptions from Dodo Payments"
          >
            <IconRefresh className={syncing ? "spin-animate" : ""} />
            <span>{syncing ? "Syncing..." : "Sync Dodo Payments"}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOnboardModal(true)}
            className="btn-primary-action"
          >
            <IconPlus className="btn-icon" />
            <span>Onboard New Food Business</span>
          </button>
        </div>
      </div>

      {toast && (
        <div className={`notification-toast ${toast.type}`}>
          <span>{toast.type === "success" ? "✓" : "⚠️"}</span>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} className="toast-close">✕</button>
        </div>
      )}

      {/* Dodo Product Plans Bar */}
      <div style={{
        background: "linear-gradient(135deg, #064e3b, #065f46)",
        borderRadius: "var(--radius-md)",
        padding: "1rem 1.25rem",
        color: "white",
        marginBottom: "1.5rem",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        boxShadow: "0 4px 12px rgba(6, 78, 59, 0.15)"
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.8, fontWeight: 700 }}>
            Active Subscription Catalog (Dodo Payments)
          </div>
          <div style={{ fontSize: "1.1rem", fontWeight: 700, marginTop: "0.2rem" }}>
            OVYRO FDA & Food Compliance Reporting
          </div>
        </div>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ background: "rgba(255,255,255,0.12)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>Monthly Subscription</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>₹500 / month</div>
            <div style={{ fontSize: "0.65rem", opacity: 0.7, fontFamily: "monospace" }}>pdt_0Npwj88UTNHuZ8GdvRcnV</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.12)", padding: "0.5rem 0.85rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)" }}>
            <div style={{ fontSize: "0.7rem", opacity: 0.8 }}>Annual Extended (Save ₹1,000)</div>
            <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>₹5,000 / year</div>
            <div style={{ fontSize: "0.65rem", opacity: 0.7, fontFamily: "monospace" }}>pdt_0NpwjFgGyqgduafnph03e</div>
          </div>
        </div>
      </div>

      {/* Global Financial & Operating Metric Cards */}
      <div className="stats-grid platform-metrics-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Active Clients / Tenants</span>
            <div className="stat-icon-wrap client-icon">
              <IconBuilding />
            </div>
          </div>
          <div className="stat-number">{metrics.totalClients}</div>
          <span className="stat-subtext">Across India & Global Food Ops</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Total People & Staff</span>
            <div className="stat-icon-wrap users-icon">
              <IconUsers />
            </div>
          </div>
          <div className="stat-number">{metrics.totalUsers}</div>
          <span className="stat-subtext">Across {metrics.totalOutlets} Facilities</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Payments Received (Dodo)</span>
            <div className="stat-icon-wrap success-icon">
              <IconCheckCircle />
            </div>
          </div>
          <div className="stat-number stat-green">{formatINR(metrics.totalRevenueReceived)}</div>
          <span className="stat-subtext">Verified Active Subscriptions</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <span className="stat-label">Payments Pending / Due</span>
            <div className="stat-icon-wrap warning-icon">
              <IconAlertCircle />
            </div>
          </div>
          <div className="stat-number stat-amber">{formatINR(metrics.totalRevenuePending)}</div>
          <span className="stat-subtext">Awaiting Dodo Checkout</span>
        </div>
      </div>

      {/* Client List & Dodo Subscription Operations */}
      <div className="card platform-client-card">
        <div className="card-header platform-client-toolbar">
          <div>
            <h2 className="card-title">Commercial Client Directory</h2>
            <p className="card-subtitle">
              Manage food businesses, generate official Dodo checkout links, and review synchronized subscription states.
            </p>
          </div>

          <div className="platform-filter-row">
            <input
              type="text"
              placeholder="Search client, email or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="platform-search-input"
            />
            <div className="platform-pill-group">
              <button
                type="button"
                onClick={() => setFilterPlan("ALL")}
                className={`filter-tab-pill ${filterPlan === "ALL" ? "active" : ""}`}
              >
                All ({organizations.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterPlan("PAID")}
                className={`filter-tab-pill ${filterPlan === "PAID" ? "active" : ""}`}
              >
                Active Paid ({organizations.filter((o) => o.billingStatus === "PAID").length})
              </button>
              <button
                type="button"
                onClick={() => setFilterPlan("PENDING")}
                className={`filter-tab-pill ${filterPlan === "PENDING" ? "active" : ""}`}
              >
                Pending ({organizations.filter((o) => o.billingStatus !== "PAID").length})
              </button>
            </div>
          </div>
        </div>

        {/* Clients Table */}
        <div className="table-responsive">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Food Business / Client</th>
                <th>Dodo Subscription</th>
                <th>Plan Tier</th>
                <th>Rate & Cycle</th>
                <th>Payment Status</th>
                <th>Dodo Payment Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No client accounts found matching current filter.
                  </td>
                </tr>
              ) : (
                filteredOrgs.map((org) => {
                  const isPaid = org.billingStatus === "PAID";
                  const isAnnual = org.billingInterval === "ANNUAL" || org.plan === "ENTERPRISE";
                  const cleanPhone = (org.contactPhone || "").replace(/[^0-9]/g, "");

                  // Find latest checkout URL if pending
                  const latestRecord = org.billingRecords?.[0];
                  const checkoutUrl = latestRecord?.checkoutUrl;

                  const origin = typeof window !== "undefined" ? window.location.origin : (process.env.NEXTAUTH_URL || "http://localhost:3000");
                  const whatsappMessage = encodeURIComponent(
                    `Hello ${org.name},\nHere is your official Dodo Payments subscription link for OVYRO FDA Reporting (${formatINR(org.monthlyFee)}/${isAnnual ? "year" : "month"}):\n${checkoutUrl || `${origin}/admin/platform`}\n\nPlease tap to complete payment securely via Dodo Payments. Thank you!`
                  );
                  const whatsappUrl = cleanPhone
                    ? `https://wa.me/${cleanPhone}?text=${whatsappMessage}`
                    : `https://wa.me/?text=${whatsappMessage}`;

                  return (
                    <tr key={org.id}>
                      <td>
                        <div className="user-name-cell">
                          <div className="client-avatar-sq">
                            {org.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">{org.name}</div>
                            <span className="user-email-sub">{org.contactEmail || org.slug}</span>
                            {org.contactPhone && (
                              <span className="muted-text" style={{ fontSize: "0.75rem", display: "block" }}>
                                📞 {org.contactPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        {org.dodoSubscriptionId ? (
                          <div>
                            <span style={{
                              display: "inline-block",
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              background: "#e0e7ff",
                              color: "#3730a3",
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              fontWeight: 600
                            }}>
                              {org.dodoSubscriptionId.slice(0, 16)}...
                            </span>
                            <span className="muted-text" style={{ fontSize: "0.7rem", display: "block", marginTop: "0.15rem" }}>
                              Synced via Dodo
                            </span>
                          </div>
                        ) : (
                          <span style={{
                            display: "inline-block",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            background: "#f1f5f9",
                            color: "#64748b",
                            fontSize: "0.75rem",
                            fontWeight: 500
                          }}>
                            Pending First Checkout
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`plan-badge ${isAnnual ? "enterprise" : "pro"}`}>
                          {isAnnual ? "Annual Extended" : "Monthly Standard"}
                        </span>
                      </td>
                      <td>
                        <span className="font-semibold">{formatINR(org.monthlyFee)}</span>
                        <span className="muted-text" style={{ fontSize: "0.75rem", display: "block" }}>
                          / {isAnnual ? "year" : "month"}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                          <span className={`payment-toggle-pill ${isPaid ? "paid" : "pending"}`}>
                            <span className="payment-dot" />
                            <span>{isPaid ? "Active (Dodo)" : "Pending (Dodo)"}</span>
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                          {/* 1-Click Pay or Generate Dodo Checkout Link */}
                          <button
                            type="button"
                            onClick={() => handleGenerateCheckout(org, isAnnual ? "ANNUAL" : "MONTHLY")}
                            disabled={generatingCheckout === org.id}
                            className="btn-create-primary"
                            style={{
                              padding: "0.35rem 0.65rem",
                              fontSize: "0.75rem",
                              minHeight: "34px",
                              gap: "0.3rem",
                              background: isPaid ? "#0284c7" : "#059669"
                            }}
                            title="Generate and open official Dodo Payments checkout link"
                          >
                            <IconExternalLink />
                            <span>{generatingCheckout === org.id ? "Generating..." : isPaid ? "Renew / Change" : "Get Dodo Link"}</span>
                          </button>

                          {/* WhatsApp Reminder with Dodo Checkout Link */}
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-whatsapp"
                            style={{ minHeight: "34px" }}
                            title="Send official Dodo Payments checkout link via WhatsApp"
                          >
                            <IconWhatsApp />
                            <span>WhatsApp</span>
                          </a>

                          {/* Instant Dodo Sync */}
                          <button
                            type="button"
                            onClick={() => handleSyncDodo(org.id)}
                            className="btn-action-small"
                            style={{ padding: "0.35rem 0.5rem", minHeight: "34px" }}
                            title="Sync live status with Dodo Payments API"
                          >
                            <IconRefresh />
                          </button>

                          {/* Delete Tenant */}
                          {org.slug !== "default" && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClient(org)}
                              className="btn-action-small"
                              style={{ padding: "0.35rem 0.5rem", minHeight: "34px", color: "#dc2626" }}
                              title="Delete client organization"
                            >
                              <IconTrash />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active Checkout Dialog Modal */}
      {activeCheckoutModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: "1.2rem", fontWeight: 700 }}>Dodo Payments Checkout Session</h2>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Client: {activeCheckoutModal.orgName} • Plan: {activeCheckoutModal.interval} ({formatINR(activeCheckoutModal.amount)})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveCheckoutModal(null)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: "1.25rem 0" }}>
              <div style={{
                background: "#f8fafc",
                padding: "1rem",
                borderRadius: "var(--radius-md)",
                border: "1px solid #e2e8f0",
                marginBottom: "1.25rem"
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#64748b", textTransform: "uppercase", marginBottom: "0.35rem" }}>
                  Live Dodo Checkout URL
                </div>
                <div style={{
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                  background: "white",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1"
                }}>
                  {activeCheckoutModal.checkoutUrl}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <a
                  href={activeCheckoutModal.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary-action"
                  style={{ textDecoration: "none", width: "100%" }}
                >
                  <IconExternalLink />
                  <span>Open Checkout Gateway</span>
                </a>

                <button
                  type="button"
                  onClick={() => copyToClipboard(activeCheckoutModal.checkoutUrl)}
                  className="btn-create-primary"
                  style={{ background: "#475569", width: "100%" }}
                >
                  <span>📋 Copy Payment Link</span>
                </button>
              </div>

              {activeCheckoutModal.contactPhone && (
                <div style={{ marginTop: "1rem" }}>
                  <a
                    href={`https://wa.me/${activeCheckoutModal.contactPhone.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
                      `Hello ${activeCheckoutModal.orgName},\nHere is your official Dodo Payments checkout link for OVYRO FDA Reporting (${formatINR(activeCheckoutModal.amount)}/${activeCheckoutModal.interval.toLowerCase()}):\n${activeCheckoutModal.checkoutUrl}\n\nPlease tap the link to complete payment securely via Dodo Payments.`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-whatsapp"
                    style={{ width: "100%", justifyContent: "center", padding: "0.65rem", fontSize: "0.85rem" }}
                  >
                    <IconWhatsApp />
                    <span>Send Link to Client on WhatsApp ({activeCheckoutModal.contactPhone})</span>
                  </a>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setActiveCheckoutModal(null)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard New Client Bottom-Sheet Modal */}
      {showOnboardModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2>Onboard New Food Business Client</h2>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Client will be provisioned with Dodo Payments subscription & customized industry presets
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowOnboardModal(false)}
                className="modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleOnboardClient}>
              <div className="modal-body">
                {/* 1. Food Business Category Presets */}
                <div className="form-group">
                  <label>Food Business Industry Classification</label>
                  <div className="industry-presets-grid">
                    <div
                      className={`industry-preset-card ${newPreset === "RESTAURANT" ? "active" : ""}`}
                      onClick={() => setNewPreset("RESTAURANT")}
                    >
                      <div className="preset-name">🍽️ Fine Dining & Casual Dine-In</div>
                      <div className="preset-desc">Kitchen temp checks, food contact sanitization, FSSAI schedule 4</div>
                    </div>

                    <div
                      className={`industry-preset-card ${newPreset === "CLOUD_KITCHEN" ? "active" : ""}`}
                      onClick={() => setNewPreset("CLOUD_KITCHEN")}
                    >
                      <div className="preset-name">🛵 Cloud Kitchen & Dark Kitchen</div>
                      <div className="preset-desc">Rider dispatch bag sanitization, thermal core temp, security tamper seals</div>
                    </div>

                    <div
                      className={`industry-preset-card ${newPreset === "CAFE" ? "active" : ""}`}
                      onClick={() => setNewPreset("CAFE")}
                    >
                      <div className="preset-name">☕ Cafe & Bakery Display</div>
                      <div className="preset-desc">Chilled pastry display (+4°C), espresso dial-in, steam wand sanitation</div>
                    </div>

                    <div
                      className={`industry-preset-card ${newPreset === "MANUFACTURING" ? "active" : ""}`}
                      onClick={() => setNewPreset("MANUFACTURING")}
                    >
                      <div className="preset-name">🏭 Raw Material & Food Processing</div>
                      <div className="preset-desc">Batch moisture %, supplier COA audit, pest control UV, sensory triage</div>
                    </div>
                  </div>
                </div>

                {/* 2. Business Entity Information */}
                <div className="form-grid" style={{ marginTop: "1rem" }}>
                  <div className="form-group">
                    <label>Business / Brand Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Bengal Sweets & Spices"
                      value={newName}
                      onChange={(e) => {
                        setNewName(e.target.value);
                        if (!newSlug) {
                          setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                        }
                      }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Unique Workspace Slug *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. royal-bengal"
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                    />
                  </div>
                </div>

                {/* 3. Dodo Subscription Plan Selection */}
                <div className="form-group" style={{ marginTop: "1rem" }}>
                  <label>Dodo Payments Subscription Plan</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                    <div
                      onClick={() => setNewBillingInterval("MONTHLY")}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "var(--radius-md)",
                        border: `2px solid ${newBillingInterval === "MONTHLY" ? "#059669" : "var(--border)"}`,
                        background: newBillingInterval === "MONTHLY" ? "#ecfdf5" : "white",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#065f46" }}>
                        OVYRO FDA Reporting (Monthly)
                      </div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0.25rem 0", color: "#059669" }}>
                        ₹500 <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>/ month</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Standard monthly compliance subscription
                      </div>
                    </div>

                    <div
                      onClick={() => setNewBillingInterval("ANNUAL")}
                      style={{
                        padding: "0.85rem",
                        borderRadius: "var(--radius-md)",
                        border: `2px solid ${newBillingInterval === "ANNUAL" ? "#059669" : "var(--border)"}`,
                        background: newBillingInterval === "ANNUAL" ? "#ecfdf5" : "white",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#065f46" }}>
                          OVYRO FDA Extended (Annual)
                        </div>
                        <span style={{ fontSize: "0.65rem", background: "#dcfce7", color: "#166534", padding: "0.15rem 0.35rem", borderRadius: "4px", fontWeight: 700 }}>
                          Save ₹1,000
                        </span>
                      </div>
                      <div style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0.25rem 0", color: "#059669" }}>
                        ₹5,000 <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>/ year</span>
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                        Full year uninterrupted FDA compliance
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Contact & Facility */}
                <div className="form-grid" style={{ marginTop: "1rem" }}>
                  <div className="form-group">
                    <label>Client Admin Email *</label>
                    <input
                      type="email"
                      required
                      placeholder="owner@royalbengal.com"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>WhatsApp Contact Phone</label>
                    <input
                      type="tel"
                      placeholder="+91 98765 43210"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-grid" style={{ marginTop: "1rem" }}>
                  <div className="form-group">
                    <label>Initial Facility / Outlet Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Indiranagar Central Kitchen"
                      value={newFacilityName}
                      onChange={(e) => setNewFacilityName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Initial Admin Password</label>
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowOnboardModal(false)}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-action"
                >
                  <span>{saving ? "Provisioning Client..." : "Provision Client & Create Dodo Subscription"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
