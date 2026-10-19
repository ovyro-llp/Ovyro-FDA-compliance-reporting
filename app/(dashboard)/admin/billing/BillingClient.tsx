"use client";

import React, { useState } from "react";

interface BillingRecord {
  id: string;
  amount: number;
  currency: string;
  billingCycle: string;
  status: string;
  invoiceNumber?: string | null;
  paidAt?: string | null;
  createdAt: string;
  dodoPaymentId?: string | null;
  dodoSubscriptionId?: string | null;
  checkoutUrl?: string | null;
  notes?: string | null;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  monthlyFee: number;
  billingStatus: string;
  billingInterval?: string | null;
  dodoSubscriptionId?: string | null;
  dodoProductId?: string | null;
  nextBillingDate?: string | null;
  lastPaymentDate?: string | null;
  billingRecords?: BillingRecord[];
}

interface BillingClientProps {
  organization: Organization;
  products: {
    MONTHLY: { id: string; name: string; priceINR: number; interval: string; description: string };
    ANNUAL: { id: string; name: string; priceINR: number; interval: string; description: string };
  };
  userRole: string;
}

function IconCheckCircle({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
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

function IconRefresh({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
    </svg>
  );
}

export default function BillingClient({ organization, products, userRole }: BillingClientProps) {
  const [org, setOrg] = useState<Organization>(organization);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [selectedInterval, setSelectedInterval] = useState<"MONTHLY" | "ANNUAL">(
    org.billingInterval === "ANNUAL" ? "ANNUAL" : "MONTHLY"
  );

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const isPaid = org.billingStatus === "PAID";
  const isAnnual = org.billingInterval === "ANNUAL" || org.plan === "ENTERPRISE";

  const handlePayViaDodo = async (interval: "MONTHLY" | "ANNUAL") => {
    setLoading(true);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: org.id,
          planInterval: interval,
          returnUrl: `${window.location.origin}/onboard/setup?session_id={CHECKOUT_SESSION_ID}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize Dodo checkout");

      if (data.checkoutUrl) {
        // Redirect directly to Dodo Payments checkout
        window.location.href = data.checkoutUrl;
      }
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
      setLoading(false);
    }
  };

  const handleSyncWithDodo = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sync failed");

      if (data.result?.organization) {
        setOrg((prev) => ({
          ...prev,
          ...data.result.organization,
        }));
      }

      setToast({ type: "success", msg: "Subscription status verified with Dodo Payments!" });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Page Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Billing & Plans</h1>
          <p className="admin-page-subtitle">
            Manage your subscription, billing interval, and payment status.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleSyncWithDodo}
            disabled={syncing}
            className="btn-create-primary"
            style={{ background: "#f8fafc", color: "#334155", border: "1px solid #cbd5e1", boxShadow: "none" }}
            title="Check latest payment status with Dodo Payments"
          >
            <IconRefresh className={syncing ? "spin-animate" : ""} />
            <span>{syncing ? "Checking..." : "Sync Status"}</span>
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

      {/* Current Subscription Card */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h2 className="card-title">Active Membership Overview</h2>
            <p className="card-subtitle">Organization: <strong>{org.name}</strong></p>
          </div>
          <div>
            <span className={`payment-toggle-pill ${isPaid ? "paid" : "pending"}`} style={{ fontSize: "0.85rem", padding: "0.4rem 0.85rem" }}>
              <span className="payment-dot" />
              <span>{isPaid ? "Subscription Active" : "Payment Pending"}</span>
            </span>
          </div>
        </div>

        <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1.25rem", borderBottom: "1px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Current Plan</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem", color: "#065f46" }}>
              {isAnnual ? products.ANNUAL.name : products.MONTHLY.name}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.15rem" }}>
              {isAnnual ? products.ANNUAL.description : products.MONTHLY.description}
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Billing Rate</div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginTop: "0.25rem" }}>
              {formatINR(org.monthlyFee)}
              <span style={{ fontSize: "0.8rem", fontWeight: 500, color: "var(--text-muted)" }}>
                {" "}/ {isAnnual ? "year" : "month"}
              </span>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#059669", marginTop: "0.15rem" }}>
              Includes all daily FDA logs & audit exports
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Dodo Subscription ID</div>
            <div style={{ fontSize: "0.95rem", fontWeight: 600, marginTop: "0.25rem", fontFamily: "monospace" }}>
              {org.dodoSubscriptionId || "Pending First Payment"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Payment Gateway: Dodo Payments (INR)
            </div>
          </div>

          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Renewal Date</div>
            <div style={{ fontSize: "1.1rem", fontWeight: 600, marginTop: "0.25rem" }}>
              {org.nextBillingDate ? new Date(org.nextBillingDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "After Checkout"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              Auto-renews via Dodo Payments
            </div>
          </div>
        </div>

        {/* Action Callout */}
        <div style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", background: isPaid ? "#f8fafc" : "#fffbeb" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.95rem", color: isPaid ? "var(--text-primary)" : "#92400e" }}>
              {isPaid ? "Your compliance reporting subscription is active." : "Your subscription requires payment confirmation via Dodo Payments."}
            </div>
            <div style={{ fontSize: "0.8rem", color: isPaid ? "var(--text-muted)" : "#b45309", marginTop: "0.2rem" }}>
              Pay securely via UPI, Cards, Netbanking, or Corporate billing through Dodo Payments.
            </div>
          </div>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={() => handlePayViaDodo(selectedInterval)}
              disabled={loading}
              className="btn-primary-action"
            >
              <IconExternalLink />
              <span>{loading ? "Redirecting..." : isPaid ? "Change Plan / Extend Subscription" : "Pay via Dodo Payments"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Plan Selection & Upgrades */}
      <div className="card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header">
          <h2 className="card-title">Select Dodo Payments Subscription Plan</h2>
          <p className="card-subtitle">Choose the subscription frequency that best matches your food business operations.</p>
        </div>

        <div style={{ padding: "1.25rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem" }}>
          {/* Monthly Plan */}
          <div
            onClick={() => setSelectedInterval("MONTHLY")}
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: `2px solid ${selectedInterval === "MONTHLY" ? "#059669" : "var(--border)"}`,
              background: selectedInterval === "MONTHLY" ? "#ecfdf5" : "white",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#065f46" }}>
                  {products.MONTHLY.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                  Monthly Billing Cycle
                </div>
              </div>
              <span className="plan-badge pro">Monthly</span>
            </div>

            <div style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.75rem 0", color: "#059669" }}>
              ₹500 <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748b" }}>/ month</span>
            </div>

            <ul style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: "1.2rem", margin: "1rem 0" }}>
              <li>Unlimited Daily Shift Logs</li>
              <li>Digital Temperature & TPC Logs</li>
              <li>FSSAI Schedule 4 Compliance</li>
              <li>Digital Supervisor Sign-off</li>
              <li>Standard WhatsApp Alerts</li>
            </ul>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePayViaDodo("MONTHLY");
              }}
              disabled={loading}
              className="btn-create-primary"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <span>Subscribe Monthly (₹500)</span>
            </button>
          </div>

          {/* Annual Plan */}
          <div
            onClick={() => setSelectedInterval("ANNUAL")}
            style={{
              padding: "1.25rem",
              borderRadius: "var(--radius-md)",
              border: `2px solid ${selectedInterval === "ANNUAL" ? "#059669" : "var(--border)"}`,
              background: selectedInterval === "ANNUAL" ? "#ecfdf5" : "white",
              cursor: "pointer",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#065f46" }}>
                  {products.ANNUAL.name}
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.2rem" }}>
                  Annual Billing Cycle (Recommended)
                </div>
              </div>
              <span style={{ fontSize: "0.7rem", background: "#dcfce7", color: "#166534", padding: "0.2rem 0.5rem", borderRadius: "9999px", fontWeight: 700 }}>
                Save ₹1,000 / year
              </span>
            </div>

            <div style={{ fontSize: "1.75rem", fontWeight: 800, margin: "0.75rem 0", color: "#059669" }}>
              ₹5,000 <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "#64748b" }}>/ year</span>
            </div>

            <ul style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.6, paddingLeft: "1.2rem", margin: "1rem 0" }}>
              <li>Everything in Monthly Plan</li>
              <li>Priority Auditor Inspection PDF Pack</li>
              <li>Automated Regulatory Compliance Seals</li>
              <li>Multi-Facility Centralized Export</li>
              <li>Dedicated Account Support</li>
            </ul>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePayViaDodo("ANNUAL");
              }}
              disabled={loading}
              className="btn-primary-action"
              style={{ width: "100%", justifyContent: "center" }}
            >
              <span>Subscribe Annual (₹5,000)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Invoice & Payment History */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Dodo Payments Receipts & Invoices</h2>
          <p className="card-subtitle">Official payment transaction records and tax invoices from Dodo Payments.</p>
        </div>

        <div className="table-responsive">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Invoice / Receipt #</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Billing Cycle</th>
                <th>Payment Gateway</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(!org.billingRecords || org.billingRecords.length === 0) ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)" }}>
                    No payment transactions recorded yet. Complete checkout to generate your first invoice.
                  </td>
                </tr>
              ) : (
                org.billingRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="font-semibold" style={{ fontFamily: "monospace" }}>
                        {record.invoiceNumber || record.id.slice(0, 12)}
                      </div>
                      {record.dodoSubscriptionId && (
                        <span className="muted-text" style={{ fontSize: "0.7rem", display: "block" }}>
                          Sub: {record.dodoSubscriptionId.slice(0, 16)}...
                        </span>
                      )}
                    </td>
                    <td>
                      {new Date(record.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td>
                      <span className="font-semibold">{formatINR(record.amount)}</span>
                    </td>
                    <td>
                      <span style={{ textTransform: "capitalize" }}>{record.billingCycle.toLowerCase()}</span>
                    </td>
                    <td>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontWeight: 600, color: "#065f46" }}>
                        <span>🦤 Dodo Payments</span>
                      </span>
                    </td>
                    <td>
                      <span className={`payment-toggle-pill ${record.status === "PAID" ? "paid" : "pending"}`}>
                        <span className="payment-dot" />
                        <span>{record.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
