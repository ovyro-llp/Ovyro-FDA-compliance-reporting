"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface OnboardClientProps {
  user: {
    name: string;
    email: string;
  };
  organization: {
    id: string;
    name: string;
    contactPhone?: string | null;
    billingStatus: string;
    primaryOutlet: {
      id: string;
      name: string;
      type: string;
    } | null;
  };
  products: {
    MONTHLY: { id: string; name: string; priceINR: number; interval: string; description: string };
    ANNUAL: { id: string; name: string; priceINR: number; interval: string; description: string };
  };
}

const PRESETS = [
  {
    id: "RESTAURANT",
    title: "Dine-In & Casual Restaurant",
    icon: "🍽️",
    badge: "FSSAI Schedule 4",
    desc: "Line refrigeration monitoring, hot holding temp checks, food contact sanitization & deep cleaning logs.",
  },
  {
    id: "CLOUD_KITCHEN",
    title: "Cloud & Dark Kitchen",
    icon: "🛵",
    badge: "Delivery SOP",
    desc: "Rider dispatch thermal checks (>65°C / <5°C), tamper-evident bag sealing & high-velocity sanitization.",
  },
  {
    id: "CAFE",
    title: "Cafe, Bakery & QSR",
    icon: "☕",
    badge: "Barista & Chiller",
    desc: "Display pastry chiller temperature (+2°C to +6°C), espresso dial-in, steam wand chemical sanitize & water TDS.",
  },
  {
    id: "MANUFACTURING",
    title: "Food & Material Processing",
    icon: "🏭",
    badge: "HACCP & Batch QA",
    desc: "Raw material receipt, supplier COA verification, moisture % log, insect UV light trap & quarantine tracking.",
  },
];

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Night"];

export default function OnboardClient({ user, organization, products }: OnboardClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: Industry Preset
  const [industry, setIndustry] = useState<"RESTAURANT" | "CLOUD_KITCHEN" | "CAFE" | "MANUFACTURING">("RESTAURANT");

  // Step 2: Risk Modules & Facility Details
  const [modules, setModules] = useState({
    hasColdStorage: true,
    hasFryers: false,
    hasDeliveryDispatch: false,
    hasEspressoBeverage: false,
    hasRawMaterialIntake: false,
    hasPestControl: true,
  });

  const [facilityName, setFacilityName] = useState(
    organization.primaryOutlet?.name || `${organization.name} - Main Facility`
  );
  const [selectedShifts, setSelectedShifts] = useState<string[]>(["Morning", "Evening"]);
  const [contactPhone, setContactPhone] = useState(organization.contactPhone || "");

  // Placed templates returned from API
  const [placedTemplates, setPlacedTemplates] = useState<Array<{ id: string; title: string; category: string }>>([]);

  // Step 3: Subscription Plan
  const [selectedPlan, setSelectedPlan] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const formatINR = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const handleIndustrySelect = (type: "RESTAURANT" | "CLOUD_KITCHEN" | "CAFE" | "MANUFACTURING") => {
    setIndustry(type);
    // Adjust default risk modules based on business type
    setModules({
      hasColdStorage: true,
      hasFryers: type === "RESTAURANT" || type === "CLOUD_KITCHEN",
      hasDeliveryDispatch: type === "CLOUD_KITCHEN" || type === "RESTAURANT",
      hasEspressoBeverage: type === "CAFE",
      hasRawMaterialIntake: type === "MANUFACTURING",
      hasPestControl: true,
    });
  };

  const toggleShift = (shift: string) => {
    if (selectedShifts.includes(shift)) {
      if (selectedShifts.length === 1) return; // Keep at least one
      setSelectedShifts(selectedShifts.filter((s) => s !== shift));
    } else {
      setSelectedShifts([...selectedShifts, shift]);
    }
  };

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSavePreferencesAndContinue = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industryPreset: industry,
          facilityName,
          shifts: selectedShifts,
          contactPhone,
          modules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to configure workspace");

      if (data.templates) {
        setPlacedTemplates(data.templates);
      }

      setStep(3);
    } catch (err: any) {
      setError(err.message || "Failed to update facility preferences");
    } finally {
      setSaving(false);
    }
  };

  const handleProceedToDodoPayment = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: organization.id,
          planInterval: selectedPlan,
          returnUrl: `${window.location.origin}/admin/billing?session_id={CHECKOUT_SESSION_ID}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch Dodo Payments checkout");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push("/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
      setSaving(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-primary, #f8f6f1)",
      padding: "2.5rem 1rem",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: "680px",
        background: "var(--bg-card, #ffffff)",
        borderRadius: "var(--radius-lg, 16px)",
        boxShadow: "0 4px 20px rgba(44, 30, 20, 0.06), 0 1px 3px rgba(44, 30, 20, 0.04)",
        border: "1px solid var(--border, #e6dfd5)",
        overflow: "hidden",
      }}>
        {/* Top Header */}
        <div style={{
          padding: "1.75rem 2rem 1.25rem 2rem",
          borderBottom: "1px solid var(--border, #e6dfd5)",
          background: "#ffffff",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: "linear-gradient(135deg, #78350f, #92400e)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "1.1rem",
              }}>
                📋
              </div>
              <div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-primary, #1c1917)" }}>
                  Reporting SaaS
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #78716c)" }}>
                  Workspace: <strong>{organization.name}</strong>
                </div>
              </div>
            </div>

            {/* Authenticated User Pill */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.3rem 0.75rem",
              background: "var(--bg-primary, #f8f6f1)",
              borderRadius: "9999px",
              border: "1px solid var(--border, #e6dfd5)",
              fontSize: "0.75rem",
              color: "var(--text-secondary, #44403c)",
            }}>
              <span>👤</span>
              <span>{user.name}</span>
            </div>
          </div>

          {/* Stepper Segmented Control */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: "0.5rem",
            marginTop: "1.5rem",
            padding: "0.25rem",
            background: "var(--bg-primary, #f8f6f1)",
            borderRadius: "var(--radius-sm, 8px)",
          }}>
            <div style={{
              padding: "0.45rem",
              textAlign: "center",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: step === 1 ? "#ffffff" : "transparent",
              color: step === 1 ? "var(--text-primary, #1c1917)" : "var(--text-muted, #78716c)",
              boxShadow: step === 1 ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.2s ease",
            }}>
              1. Operation Type
            </div>

            <div style={{
              padding: "0.45rem",
              textAlign: "center",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: step === 2 ? "#ffffff" : "transparent",
              color: step === 2 ? "var(--text-primary, #1c1917)" : "var(--text-muted, #78716c)",
              boxShadow: step === 2 ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.2s ease",
            }}>
              2. Facility & Shifts
            </div>

            <div style={{
              padding: "0.45rem",
              textAlign: "center",
              borderRadius: "6px",
              fontSize: "0.75rem",
              fontWeight: 600,
              background: step === 3 ? "#ffffff" : "transparent",
              color: step === 3 ? "var(--text-primary, #1c1917)" : "var(--text-muted, #78716c)",
              boxShadow: step === 3 ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
              transition: "all 0.2s ease",
            }}>
              3. Subscription
            </div>
          </div>
        </div>

        {error && (
          <div style={{
            background: "var(--danger-bg, rgba(220, 38, 38, 0.09))",
            color: "var(--danger, #dc2626)",
            padding: "0.75rem 1.5rem",
            fontSize: "0.85rem",
            borderBottom: "1px solid var(--border, #e6dfd5)",
            fontWeight: 500,
          }}>
            ⚠️ {error}
          </div>
        )}

        <div style={{ padding: "1.75rem 2rem" }}>
          {/* ─── STEP 1: Operation Classification ─────────────────────────── */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #1c1917)", margin: "0 0 0.25rem 0" }}>
                  What kind of food operation do you run?
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #78716c)", margin: 0 }}>
                  We will automatically configure your pre-loaded audit checklists, temperature monitoring rules, and equipment SOPs.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0.85rem" }}>
                {PRESETS.map((p) => {
                  const isSelected = industry === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleIndustrySelect(p.id as any)}
                      style={{
                        padding: "1rem 1.25rem",
                        borderRadius: "var(--radius-md, 12px)",
                        border: `1.5px solid ${isSelected ? "#059669" : "var(--border, #e6dfd5)"}`,
                        background: isSelected ? "#f0fdf4" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "1rem",
                        transition: "var(--transition, 0.2s ease)",
                      }}
                    >
                      <span style={{ fontSize: "1.85rem" }}>{p.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: isSelected ? "#065f46" : "var(--text-primary, #1c1917)" }}>
                            {p.title}
                          </span>
                          <span style={{
                            fontSize: "0.65rem",
                            padding: "0.15rem 0.45rem",
                            borderRadius: "4px",
                            background: isSelected ? "#dcfce7" : "var(--bg-primary, #f8f6f1)",
                            color: isSelected ? "#166534" : "var(--text-muted, #78716c)",
                            fontWeight: 700,
                            letterSpacing: "0.03em",
                            textTransform: "uppercase",
                          }}>
                            {p.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--text-secondary, #44403c)", marginTop: "0.3rem", lineHeight: 1.45 }}>
                          {p.desc}
                        </div>
                      </div>
                      <div style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        border: `2px solid ${isSelected ? "#059669" : "var(--border, #e6dfd5)"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: "2px",
                      }}>
                        {isSelected && <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#059669" }} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "1.75rem" }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn-create-primary"
                  style={{ minWidth: "150px", justifyContent: "center" }}
                >
                  <span>Continue →</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Facility & Operational Risk Profile ────────────────── */}
          {step === 2 && (
            <div>
              <div style={{ marginBottom: "1.25rem" }}>
                <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #1c1917)", margin: "0 0 0.25rem 0" }}>
                  Operational Equipment &amp; Risk Profile
                </h2>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #78716c)", margin: 0 }}>
                  Select the specific equipment and compliance risks present in your facility to generate your custom templates.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1.25rem" }}>
                {/* Modules Grid */}
                <div>
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #44403c)", marginBottom: "0.5rem", display: "block" }}>
                    Select Relevant Equipment &amp; Stations
                  </label>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.6rem" }}>
                    {[
                      { key: "hasColdStorage", label: "Commercial Cold Storage & Chillers", icon: "❄️", desc: "Walk-in & reach-in fridge temp logs (-18°C / +4°C)" },
                      { key: "hasFryers", label: "Deep Fryers & Cooking Oil", icon: "🍟", desc: "Total Polar Compounds (TPC) & discard log" },
                      { key: "hasDeliveryDispatch", label: "Delivery Dispatch & Bags", icon: "🛵", desc: "Thermal bag checks (>65°C / <5°C) & tamper seal verify" },
                      { key: "hasEspressoBeverage", label: "Espresso Bar & Filtration", icon: "☕", desc: "Steam wand chemical purge, TDS & water filtration" },
                      { key: "hasRawMaterialIntake", label: "Raw Material Receiving", icon: "📦", desc: "Supplier COA verification & raw batch quarantine" },
                      { key: "hasPestControl", label: "Pest Traps & Bait Stations", icon: "🪤", desc: "UV fly trap & perimeter bait inspection log" },
                    ].map((item) => {
                      const active = modules[item.key as keyof typeof modules];
                      return (
                        <div
                          key={item.key}
                          onClick={() => toggleModule(item.key as keyof typeof modules)}
                          style={{
                            padding: "0.75rem 0.9rem",
                            borderRadius: "10px",
                            border: `1.5px solid ${active ? "#059669" : "var(--border, #e6dfd5)"}`,
                            background: active ? "#ecfdf5" : "#ffffff",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <span style={{ fontSize: "1.3rem" }}>{item.icon}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: 600, color: active ? "#065f46" : "#1c1917" }}>
                              {item.label}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "#78716c", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {item.desc}
                            </div>
                          </div>
                          <div style={{
                            width: "18px",
                            height: "18px",
                            borderRadius: "4px",
                            border: `1.5px solid ${active ? "#059669" : "#cbd5e1"}`,
                            background: active ? "#059669" : "transparent",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "white",
                            fontSize: "11px",
                            fontWeight: 700,
                          }}>
                            {active ? "✓" : ""}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #44403c)", marginBottom: "0.3rem", display: "block" }}>
                    Primary Facility / Kitchen Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    placeholder="e.g. Indiranagar Central Kitchen"
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-sm, 8px)",
                      border: "1px solid var(--border, #e6dfd5)",
                      fontSize: "0.9rem",
                      width: "100%",
                      background: "var(--bg-input, #ffffff)",
                    }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #44403c)", marginBottom: "0.3rem", display: "block" }}>
                    Operational Daily Shifts
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                    {SHIFT_OPTIONS.map((shift) => {
                      const isActive = selectedShifts.includes(shift);
                      return (
                        <button
                          key={shift}
                          type="button"
                          onClick={() => toggleShift(shift)}
                          style={{
                            padding: "0.45rem 0.9rem",
                            borderRadius: "9999px",
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            border: `1.5px solid ${isActive ? "#059669" : "var(--border, #e6dfd5)"}`,
                            background: isActive ? "#ecfdf5" : "#ffffff",
                            color: isActive ? "#065f46" : "var(--text-secondary, #44403c)",
                            transition: "var(--transition, 0.2s ease)",
                          }}
                        >
                          {isActive ? "✓ " : ""}{shift} Shift
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-secondary, #44403c)", marginBottom: "0.3rem", display: "block" }}>
                    WhatsApp Supervisor Alert Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "var(--radius-sm, 8px)",
                      border: "1px solid var(--border, #e6dfd5)",
                      fontSize: "0.9rem",
                      width: "100%",
                      background: "var(--bg-input, #ffffff)",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="modal-footer btn-secondary"
                  style={{ border: "1px solid var(--border, #e6dfd5)", padding: "0.55rem 1.25rem", borderRadius: "8px", background: "white", cursor: "pointer" }}
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferencesAndContinue}
                  disabled={saving || !facilityName.trim()}
                  className="btn-create-primary"
                  style={{ minWidth: "200px", justifyContent: "center" }}
                >
                  <span>{saving ? "Placing Templates..." : "Generate Templates & Continue →"}</span>
                </button>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Templates Placed & Dodo Subscription Activation ───── */}
          {step === 3 && (
            <div>
              {/* Success Callout of placed templates */}
              <div style={{
                padding: "1rem 1.25rem",
                borderRadius: "12px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                marginBottom: "1.5rem",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#065f46", fontWeight: 700, fontSize: "0.95rem" }}>
                  <span>🎉</span>
                  <span>{placedTemplates.length || "Tailored"} Compliance Templates Placed in Your Account!</span>
                </div>
                <p style={{ margin: "0.4rem 0 0.75rem 0", fontSize: "0.8rem", color: "#047857", lineHeight: 1.45 }}>
                  Based on your answers, our engine has custom-built your SOP sheets and pre-loaded them into your facility. You can inspect all templates for free.
                </p>

                {placedTemplates.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {placedTemplates.map((t) => (
                      <span
                        key={t.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #a7f3d0",
                          color: "#065f46",
                          padding: "0.25rem 0.6rem",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        📋 {t.title}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {organization.billingStatus === "PAID" ? (
                <>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.25rem 0.6rem", borderRadius: "4px", background: "#f0fdf4", color: "#059669", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                      <span>✓</span>
                      <span>Pro Subscription Active</span>
                    </div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #1c1917)", margin: "0 0 0.25rem 0" }}>
                      Your Workspace is Fully Activated!
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #78716c)", margin: 0 }}>
                      You have full access to submit daily shift reports, add team members, and customize regulatory audit sheets.
                    </p>
                  </div>

                  <div style={{
                    padding: "1.25rem",
                    borderRadius: "var(--radius-md, 12px)",
                    background: "#f0fdf4",
                    border: "1px solid #a7f3d0",
                    marginBottom: "1.5rem",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, color: "#065f46", fontSize: "1rem" }}>
                          Annual Pro Compliance Plan
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "#047857", marginTop: "0.2rem" }}>
                          Full Operations &amp; Audit Access • Active
                        </div>
                      </div>
                      <span className="plan-badge pro" style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}>
                        Active Plan
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
                    <Link
                      href="/admin/billing"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.6rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #e6dfd5)",
                        background: "#ffffff",
                        color: "var(--text-primary, #1c1917)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <span>Receipts &amp; Invoices →</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => router.push("/dashboard")}
                      className="btn-create-primary"
                      style={{ minWidth: "220px", justifyContent: "center" }}
                    >
                      <span>Open Operations Dashboard →</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ marginBottom: "1.25rem" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.5rem", borderRadius: "4px", background: "#f0fdf4", color: "#059669", fontSize: "0.75rem", fontWeight: 700, marginBottom: "0.4rem" }}>
                      <span>🦤 Dodo Payments Official Gateway</span>
                    </div>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--text-primary, #1c1917)", margin: "0 0 0.25rem 0" }}>
                      Activate Full Operations Access
                    </h2>
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted, #78716c)", margin: 0 }}>
                      A paid subscription is required to submit daily shift reports, add team members, or modify audit sheets.
                    </p>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>
                    {/* Monthly Plan */}
                    <div
                      onClick={() => setSelectedPlan("MONTHLY")}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "var(--radius-md, 12px)",
                        border: `2px solid ${selectedPlan === "MONTHLY" ? "#059669" : "var(--border, #e6dfd5)"}`,
                        background: selectedPlan === "MONTHLY" ? "#f0fdf4" : "#ffffff",
                        cursor: "pointer",
                        transition: "var(--transition, 0.2s ease)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#065f46" }}>
                            {products.MONTHLY.name}
                          </div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #78716c)", marginTop: "0.15rem" }}>
                            Monthly Flex
                          </div>
                        </div>
                        <span className="plan-badge pro" style={{ fontSize: "0.65rem", padding: "0.15rem 0.45rem", borderRadius: "4px" }}>
                          Monthly
                        </span>
                      </div>

                      <div style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.6rem 0", color: "#059669" }}>
                        ₹500 <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted, #78716c)" }}>/ month</span>
                      </div>

                      <ul style={{ fontSize: "0.78rem", color: "var(--text-secondary, #44403c)", paddingLeft: "1.1rem", lineHeight: 1.5, margin: "0.5rem 0" }}>
                        <li>Submit daily shift audits &amp; checklists</li>
                        <li>Digital supervisor sign-off</li>
                        <li>Add team members &amp; roles</li>
                      </ul>
                    </div>

                    {/* Annual Plan */}
                    <div
                      onClick={() => setSelectedPlan("ANNUAL")}
                      style={{
                        padding: "1.25rem",
                        borderRadius: "var(--radius-md, 12px)",
                        border: `2px solid ${selectedPlan === "ANNUAL" ? "#059669" : "var(--border, #e6dfd5)"}`,
                        background: selectedPlan === "ANNUAL" ? "#f0fdf4" : "#ffffff",
                        cursor: "pointer",
                        position: "relative",
                        transition: "var(--transition, 0.2s ease)",
                      }}
                    >
                      <span style={{
                        position: "absolute",
                        top: "10px",
                        right: "10px",
                        background: "#dcfce7",
                        color: "#166534",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.45rem",
                        borderRadius: "9999px",
                      }}>
                        Save ₹1,000 / yr
                      </span>

                      <div>
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#065f46" }}>
                          {products.ANNUAL.name}
                        </div>
                        <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #78716c)", marginTop: "0.15rem" }}>
                          Annual Extended Plan
                        </div>
                      </div>

                      <div style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.6rem 0", color: "#059669" }}>
                        ₹5,000 <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted, #78716c)" }}>/ year</span>
                      </div>

                      <ul style={{ fontSize: "0.78rem", color: "var(--text-secondary, #44403c)", paddingLeft: "1.1rem", lineHeight: 1.5, margin: "0.5rem 0" }}>
                        <li>Everything in Monthly Plan</li>
                        <li>Priority regulatory audit export</li>
                        <li>Full team access &amp; custom roles</li>
                      </ul>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", flexWrap: "wrap", gap: "1rem" }}>
                    <Link
                      href="/dashboard"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        padding: "0.6rem 1rem",
                        borderRadius: "8px",
                        border: "1px solid var(--border, #e6dfd5)",
                        background: "#ffffff",
                        color: "var(--text-primary, #1c1917)",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      <span>📋 Inspect My Templates First →</span>
                    </Link>

                    <button
                      type="button"
                      onClick={handleProceedToDodoPayment}
                      disabled={saving}
                      className="btn-create-primary"
                      style={{ minWidth: "220px", justifyContent: "center" }}
                    >
                      <span>{saving ? "Launching Dodo Checkout..." : `Subscribe with Dodo (${formatINR(products[selectedPlan].priceINR)})`}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
