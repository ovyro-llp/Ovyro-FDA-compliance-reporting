"use client";

import React, { useState } from "react";
import { Lock, ShieldCheck, CheckCircle2, ArrowRight, X, AlertTriangle } from "lucide-react";

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  organizationId?: string;
}

export default function PaywallModal({
  isOpen,
  onClose,
  title = "Active Subscription Required",
  description = "You can inspect all templates for free. To submit daily shift reports, edit checklist templates, or add team members, subscribe via Dodo Payments.",
  organizationId,
}: PaywallModalProps) {
  const [plan, setPlan] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleCheckout = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          planInterval: plan,
          returnUrl: `${window.location.origin}/admin/billing?session_id={CHECKOUT_SESSION_ID}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to initiate Dodo Payments checkout");
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error("No checkout URL returned from payment provider");
      }
    } catch (err: any) {
      console.error("[PAYWALL_CHECKOUT_ERROR]:", err);
      setError(err.message || "Failed to launch payment checkout");
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25)",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          zIndex: 10001,
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "1.25rem 1.5rem",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "#eff6ff",
                color: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#0f172a" }}>
                {title}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Verified Dodo Payments Gateway
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Close dialog"
            style={{
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "50%",
              width: "32px",
              height: "32px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: "1.25rem 1.5rem" }}>
          <p
            style={{
              fontSize: "0.85rem",
              color: "#475569",
              lineHeight: 1.5,
              margin: "0 0 1rem 0",
            }}
          >
            {description}
          </p>

          {error && (
            <div
              style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                padding: "0.65rem 0.85rem",
                borderRadius: "8px",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Pricing Options */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", marginBottom: "1.25rem" }}>
            {/* Monthly */}
            <div
              onClick={() => setPlan("MONTHLY")}
              style={{
                padding: "1rem",
                borderRadius: "14px",
                border: `2px solid ${plan === "MONTHLY" ? "#2563eb" : "#e2e8f0"}`,
                background: plan === "MONTHLY" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: plan === "MONTHLY" ? "#1e40af" : "#1e293b" }}>
                  Monthly Plan
                </span>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.45rem",
                    borderRadius: "6px",
                    background: plan === "MONTHLY" ? "#dbeafe" : "#f1f5f9",
                    color: plan === "MONTHLY" ? "#1e40af" : "#64748b",
                  }}
                >
                  Monthly
                </span>
              </div>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#2563eb", marginTop: "0.4rem" }}>
                ₹500 <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>/mo</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.3rem" }}>
                Cancel anytime
              </div>
            </div>

            {/* Annual */}
            <div
              onClick={() => setPlan("ANNUAL")}
              style={{
                padding: "1rem",
                borderRadius: "14px",
                border: `2px solid ${plan === "ANNUAL" ? "#2563eb" : "#e2e8f0"}`,
                background: plan === "ANNUAL" ? "#eff6ff" : "#ffffff",
                cursor: "pointer",
                position: "relative",
                transition: "all 0.15s ease",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: "-10px",
                  right: "10px",
                  background: "#f97316",
                  color: "#ffffff",
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "0.15rem 0.5rem",
                  borderRadius: "9999px",
                  boxShadow: "0 2px 4px rgba(249, 115, 22, 0.3)",
                }}
              >
                SAVE ₹1,000
              </span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: plan === "ANNUAL" ? "#1e40af" : "#1e293b" }}>
                  Annual Plan
                </span>
                <span
                  style={{
                    fontSize: "0.65rem",
                    fontWeight: 700,
                    padding: "0.2rem 0.45rem",
                    borderRadius: "6px",
                    background: plan === "ANNUAL" ? "#dbeafe" : "#f1f5f9",
                    color: plan === "ANNUAL" ? "#1e40af" : "#64748b",
                  }}
                >
                  Yearly
                </span>
              </div>
              <div style={{ fontSize: "1.45rem", fontWeight: 800, color: "#2563eb", marginTop: "0.4rem" }}>
                ₹5,000 <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "#64748b" }}>/yr</span>
              </div>
              <div style={{ fontSize: "0.72rem", color: "#64748b", marginTop: "0.3rem" }}>
                ₹416 / month billed annually
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              fontSize: "0.825rem",
              color: "#334155",
              margin: "0 0 1.35rem 0",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
              <span>Full write access to submit daily shift &amp; temperature checklists</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
              <span>Digital supervisor sign-offs &amp; audit timestamp verification</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
              <span>Custom checklist creation, editing &amp; dynamic roles setup</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <CheckCircle2 size={16} className="text-blue-600 flex-shrink-0" />
              <span>Instant tax invoice &amp; payment receipts via email</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "0.7rem 1rem",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#475569",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Keep Previewing
            </button>

            <button
              type="button"
              onClick={handleCheckout}
              disabled={loading}
              style={{
                flex: 2,
                padding: "0.7rem 1rem",
                borderRadius: "12px",
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
                boxShadow: "0 3px 10px rgba(37, 99, 235, 0.3)",
              }}
            >
              <span>{loading ? "Launching Dodo Checkout..." : `Subscribe with Dodo (${plan === "MONTHLY" ? "₹500/mo" : "₹5,000/yr"}) →`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
