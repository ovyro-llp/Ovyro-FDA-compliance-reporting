"use client";

import React, { useState, useEffect } from "react";
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
    id: "RESTAURANT" as const,
    title: "Dine-In & Casual Restaurant",
    icon: "🍽️",
    badge: "FSSAI Schedule 4",
    desc: "Line refrigeration monitoring, hot holding temp checks, sanitization & cleaning logs.",
  },
  {
    id: "CLOUD_KITCHEN" as const,
    title: "Cloud & Delivery Kitchen",
    icon: "🛵",
    badge: "Delivery SOP",
    desc: "Rider dispatch thermal checks (>65°C / <5°C), tamper-evident bag sealing & quick prep audits.",
  },
  {
    id: "CAFE" as const,
    title: "Cafe, Bakery & QSR",
    icon: "☕",
    badge: "Barista & Chiller",
    desc: "Pastry display chillers (+2°C to +6°C), espresso dial-in, steam wand chemical sanitize & TDS logs.",
  },
  {
    id: "MANUFACTURING" as const,
    title: "Food & Material Processing",
    icon: "🏭",
    badge: "HACCP & Batch QA",
    desc: "Inbound raw materials, supplier COA verification, moisture % log & insect UV trap checks.",
  },
];

const OUTLET_SCALES = [
  {
    count: 1,
    title: "1 Location (Single Store / Facility)",
    icon: "🏪",
    badge: "Solo Facility",
    desc: "Single restaurant, cafe, dark kitchen, or production plant.",
  },
  {
    count: 2,
    title: "2 – 3 Locations",
    icon: "🏢",
    badge: "Growing Brand",
    desc: "Expanding business with 2 to 3 branch outlets.",
  },
  {
    count: 5,
    title: "4 – 5 Locations",
    icon: "🏬",
    badge: "Multi-Unit",
    desc: "Standardized cross-outlet operations with central hygiene reports.",
  },
  {
    count: 8,
    title: "6 – 10 Locations",
    icon: "🏙️",
    badge: "Regional Fleet",
    desc: "City-wide branch network with area manager oversight.",
  },
  {
    count: 10,
    title: "10+ Locations",
    icon: "🌐",
    badge: "Enterprise",
    desc: "Large multi-city brand or franchise network.",
  },
];

const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Night"];

export default function OnboardClient({ user, organization, products }: OnboardClientProps) {
  const router = useRouter();

  // Single Question Index: 1 to 5
  // Q1: Business Type
  // Q2: Number of Outlets
  // Q3: Operating Shifts
  // Q4: Food Safety Risk Modules
  // Q5: Plan Selection & Checkout (with Skip Option)
  const [questionIdx, setQuestionIdx] = useState<number>(1);

  // Form State
  const [industry, setIndustry] = useState<"RESTAURANT" | "CLOUD_KITCHEN" | "CAFE" | "MANUFACTURING">("RESTAURANT");
  const [outletCount, setOutletCount] = useState<number>(1);
  const [facilityName, setFacilityName] = useState(
    organization.primaryOutlet?.name || `${organization.name} - Location 1`
  );
  const [selectedShifts, setSelectedShifts] = useState<string[]>(["Morning", "Evening"]);
  const [modules, setModules] = useState({
    hasColdStorage: true,
    hasFryers: false,
    hasDeliveryDispatch: false,
    hasEspressoBeverage: false,
    hasRawMaterialIntake: false,
    hasPestControl: true,
  });
  const [contactPhone, setContactPhone] = useState(organization.contactPhone || "");
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
      if (selectedShifts.length === 1) return;
      setSelectedShifts(selectedShifts.filter((s) => s !== shift));
    } else {
      setSelectedShifts([...selectedShifts, shift]);
    }
  };

  const toggleModule = (key: keyof typeof modules) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Keyboard navigation: Enter to advance (when not in checkout)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        if (questionIdx === 1) {
          e.preventDefault();
          setQuestionIdx(2);
        } else if (questionIdx === 2) {
          e.preventDefault();
          setQuestionIdx(3);
        } else if (questionIdx === 3 && selectedShifts.length > 0) {
          e.preventDefault();
          setQuestionIdx(4);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [questionIdx, selectedShifts]);

  // Advance from Q4 (Modules) to Q5 (Plan) by saving preferences to API
  const handleSavePreferencesAndProceedToPlan = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industryPreset: industry,
          outletCount,
          facilityName: facilityName || `${organization.name} - Location 1`,
          shifts: selectedShifts,
          contactPhone,
          modules,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to configure workspace");

      setQuestionIdx(5);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message || "Failed to update facility preferences");
    } finally {
      setSaving(false);
    }
  };

  // Action on Q5: Skip payment and preview templates directly in software
  const handleSkipPayment = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industryPreset: industry,
          outletCount,
          facilityName: facilityName || `${organization.name} - Location 1`,
          shifts: selectedShifts,
          contactPhone,
          modules,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to initialize workspace templates");
      }

      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to redirect to software preview");
      setSaving(false);
    }
  };

  // Final Action on Q5: Launch Dodo Payments checkout
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
          returnUrl: `${window.location.origin}/onboard/setup?session_id={CHECKOUT_SESSION_ID}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch Dodo Payments checkout");

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        router.push("/onboard/setup");
      }
    } catch (err: any) {
      setError(err.message || "Failed to initiate payment");
      setSaving(false);
    }
  };

  const progressPercentage = (questionIdx / 5) * 100;

  return (
    <div className="onboard-wizard-wrapper">
      {/* Sticky Header with Animated Progress Bar */}
      <header className="onboard-wizard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#111111", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>
            OV
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#111111" }}>{organization.name}</div>
            <div style={{ fontSize: "11px", color: "#777774" }}>
              Question {questionIdx} of 5
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12px", color: "#777774" }}>
            Signed in as <strong>{user.email}</strong>
          </span>
        </div>

        <div className="onboard-progress-track">
          <div className="onboard-progress-fill" style={{ width: `${progressPercentage}%` }} />
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div style={{ position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)", zIndex: 100, background: "#FEF2F2", color: "#991B1B", border: "1px solid #FECACA", padding: "8px 16px", borderRadius: "8px", fontSize: "13.5px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          {error}
        </div>
      )}

      {/* Main Single-Question Container */}
      <main className="onboard-wizard-content">
        {/* QUESTION 1: BUSINESS TYPE */}
        {questionIdx === 1 && (
          <div key="q-1" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">What type of food business do you operate?</h1>
            <p className="onboard-anim-sub">
              We customize your compliance checklists and regulatory reporting standards based on your operational model.
            </p>

            <div className="onboard-anim-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {PRESETS.map((p) => {
                  const isSelected = industry === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleIndustrySelect(p.id)}
                      className={`onboard-template-card ${isSelected ? "selected" : ""}`}
                    >
                      <div style={{ fontSize: "24px", marginTop: "2px" }}>{p.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "600", fontSize: "15px", color: "#111111" }}>{p.title}</span>
                          <span style={{ fontSize: "11px", background: "#F0EEE9", color: "#666662", padding: "2px 6px", borderRadius: "4px", fontWeight: "500" }}>
                            {p.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#666664", lineHeight: "1.4" }}>
                          {p.desc}
                        </div>
                      </div>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: isSelected ? "5px solid #111111" : "2px solid #D2CFC7", background: "#FFFFFF", alignSelf: "center", boxSizing: "border-box" }} />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <div className="onboard-kbd-hint">
                  Press <span className="onboard-kbd-tag">Enter ↵</span> to continue
                </div>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(2)}
                  className="onboard-primary-btn"
                >
                  Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTION 2: NUMBER OF OUTLETS */}
        {questionIdx === 2 && (
          <div key="q-2" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">How many outlets or facilities do you operate?</h1>
            <p className="onboard-anim-sub">
              Select your facility scale. We configure multi-unit reporting and compliance dashboards automatically.
            </p>

            <div className="onboard-anim-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {OUTLET_SCALES.map((scale) => {
                  const isSelected = outletCount === scale.count;
                  return (
                    <div
                      key={scale.count}
                      onClick={() => setOutletCount(scale.count)}
                      className={`onboard-template-card ${isSelected ? "selected" : ""}`}
                    >
                      <div style={{ fontSize: "24px", marginTop: "2px" }}>{scale.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontWeight: "600", fontSize: "15px", color: "#111111" }}>{scale.title}</span>
                          <span style={{ fontSize: "11px", background: "#F0EEE9", color: "#666662", padding: "2px 6px", borderRadius: "4px", fontWeight: "500" }}>
                            {scale.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#666664", lineHeight: "1.4" }}>
                          {scale.desc}
                        </div>
                      </div>
                      <div style={{ width: "20px", height: "20px", borderRadius: "50%", border: isSelected ? "5px solid #111111" : "2px solid #D2CFC7", background: "#FFFFFF", alignSelf: "center", boxSizing: "border-box" }} />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(1)}
                  className="onboard-secondary-btn"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(3)}
                  className="onboard-primary-btn"
                >
                  Continue to Shifts →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTION 3: OPERATING SHIFTS */}
        {questionIdx === 3 && (
          <div key="q-3" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">What operating shifts do you run each day?</h1>
            <p className="onboard-anim-sub">
              Checklists will be scheduled and verified per shift. Select all shifts that operate at this location.
            </p>

            <div className="onboard-anim-card">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px", marginBottom: "28px" }}>
                {SHIFT_OPTIONS.map((shift) => {
                  const isChecked = selectedShifts.includes(shift);
                  return (
                    <div
                      key={shift}
                      onClick={() => toggleShift(shift)}
                      style={{
                        padding: "16px 12px",
                        textAlign: "center",
                        borderRadius: "10px",
                        border: "1.5px solid",
                        borderColor: isChecked ? "#111111" : "#E2E0D8",
                        background: isChecked ? "#111111" : "#FFFFFF",
                        color: isChecked ? "#FFFFFF" : "#333330",
                        cursor: "pointer",
                        fontWeight: "600",
                        fontSize: "14px",
                        transition: "all 0.15s ease",
                        userSelect: "none",
                      }}
                    >
                      <div style={{ fontSize: "18px", marginBottom: "6px" }}>
                        {shift === "Morning" ? "🌅" : shift === "Afternoon" ? "☀️" : shift === "Evening" ? "🌆" : "🌙"}
                      </div>
                      {shift}
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(2)}
                  className="onboard-secondary-btn"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(4)}
                  disabled={selectedShifts.length === 0}
                  className="onboard-primary-btn"
                >
                  Continue to Risk Areas →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTION 4: RISK MODULES */}
        {questionIdx === 4 && (
          <div key="q-4" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">Which food safety areas apply to your kitchen?</h1>
            <p className="onboard-anim-sub">
              We activate dedicated FDA & FSSAI logging modules for each selected area.
            </p>

            <div className="onboard-anim-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "24px" }}>
                {[
                  { key: "hasColdStorage" as const, title: "Walk-In Chillers & Deep Freezers", desc: "Temperature compliance (-18°C to +4°C) with automated alert thresholds", icon: "❄️" },
                  { key: "hasFryers" as const, title: "Deep Fryers & Cooking Oil Quality", desc: "Total Polar Compounds (TPC < 25%) and smoke point discard tracking", icon: "🍳" },
                  { key: "hasDeliveryDispatch" as const, title: "Rider Dispatch & Tamper Bag Seals", desc: "Delivery handover temperature, packaging integrity, and timestamp logs", icon: "🛵" },
                  { key: "hasEspressoBeverage" as const, title: "Espresso Machine, Steam Wand & Water", desc: "Group head flush, milk sanitization, and TDS hardness PPM records", icon: "☕" },
                  { key: "hasRawMaterialIntake" as const, title: "Inbound Raw Material & Supplier QA", desc: "Supplier invoice, batch COA, expiry check, and quarantine status", icon: "📦" },
                  { key: "hasPestControl" as const, title: "Pest Bait Stations & Fly Killers", desc: "Insect light trap (ILT) catch counts and bait station physical integrity", icon: "🪤" },
                ].map((mod) => {
                  const isActive = modules[mod.key];
                  return (
                    <div
                      key={mod.key}
                      onClick={() => toggleModule(mod.key)}
                      className={`onboard-template-card ${isActive ? "selected" : ""}`}
                    >
                      <span style={{ fontSize: "20px" }}>{mod.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: "600", fontSize: "14.5px", color: "#111111" }}>{mod.title}</div>
                        <div style={{ fontSize: "12.5px", color: "#666664" }}>{mod.desc}</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={isActive}
                        onChange={() => {}}
                        style={{ width: "18px", height: "18px", accentColor: "#111111", cursor: "pointer" }}
                      />
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(3)}
                  className="onboard-secondary-btn"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferencesAndProceedToPlan}
                  disabled={saving}
                  className="onboard-primary-btn"
                >
                  {saving ? "Configuring..." : "Continue to Plan Selection →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* QUESTION 5: PLAN SELECTION & CHECKOUT */}
        {questionIdx === 5 && (
          <div key="q-5" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">Choose your compliance subscription</h1>
            <p className="onboard-anim-sub">
              Your workspace is tailored and ready. Select your billing plan to activate live daily checklists and team onboarding.
            </p>

            <div className="onboard-anim-card" style={{ maxWidth: "700px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px", marginBottom: "28px" }}>
                {/* Monthly Plan */}
                <div
                  onClick={() => setSelectedPlan("MONTHLY")}
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    border: "2px solid",
                    borderColor: selectedPlan === "MONTHLY" ? "#111111" : "#E2E0D8",
                    background: selectedPlan === "MONTHLY" ? "#FAF9F5" : "#FFFFFF",
                    cursor: "pointer",
                    transition: "all 0.16s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontWeight: "600", fontSize: "16px", color: "#111111" }}>Monthly Plan</span>
                    <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: selectedPlan === "MONTHLY" ? "5px solid #111111" : "2px solid #CBC8C0" }} />
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#111111", marginBottom: "4px" }}>
                    {formatINR(products.MONTHLY.priceINR)}
                    <span style={{ fontSize: "14px", fontWeight: "500", color: "#666664" }}> / month</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#666664", lineHeight: "1.4", marginTop: "12px" }}>
                    {products.MONTHLY.description}
                  </div>
                </div>

                {/* Annual Plan */}
                <div
                  onClick={() => setSelectedPlan("ANNUAL")}
                  style={{
                    padding: "20px",
                    borderRadius: "12px",
                    border: "2px solid",
                    borderColor: selectedPlan === "ANNUAL" ? "#111111" : "#E2E0D8",
                    background: selectedPlan === "ANNUAL" ? "#FAF9F5" : "#FFFFFF",
                    cursor: "pointer",
                    position: "relative",
                    transition: "all 0.16s ease",
                  }}
                >
                  <span style={{ position: "absolute", top: "-10px", right: "16px", background: "#059669", color: "#FFFFFF", fontSize: "11px", fontWeight: "600", padding: "2px 8px", borderRadius: "10px" }}>
                    SAVE ₹1,000 / YR
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                    <span style={{ fontWeight: "600", fontSize: "16px", color: "#111111" }}>Annual Plan</span>
                    <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: selectedPlan === "ANNUAL" ? "5px solid #111111" : "2px solid #CBC8C0" }} />
                  </div>
                  <div style={{ fontSize: "28px", fontWeight: "700", color: "#111111", marginBottom: "4px" }}>
                    {formatINR(products.ANNUAL.priceINR)}
                    <span style={{ fontSize: "14px", fontWeight: "500", color: "#666664" }}> / year</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#666664", lineHeight: "1.4", marginTop: "12px" }}>
                    {products.ANNUAL.description}
                  </div>
                </div>
              </div>

              {/* Dodo Payments Trust Badge */}
              <div style={{ background: "#F6F5F0", border: "1px solid #ECEAE5", borderRadius: "8px", padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
                <span style={{ fontSize: "18px" }}>🔒</span>
                <span style={{ fontSize: "13px", color: "#555550" }}>
                  Secured & processed exclusively via <strong>Dodo Payments</strong>. Automated GST invoices, instant activation, and immediate post-payment team setup.
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px", flexWrap: "wrap", gap: "12px" }}>
                <button
                  type="button"
                  onClick={() => setQuestionIdx(4)}
                  className="onboard-secondary-btn"
                >
                  ← Back
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={handleSkipPayment}
                    disabled={saving}
                    className="onboard-secondary-btn"
                    style={{
                      padding: "10px 18px",
                      borderRadius: "8px",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#444440",
                      border: "1.5px solid #DCD9D2",
                      background: "#FFFFFF",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    Skip for now & explore software →
                  </button>
                  <button
                    type="button"
                    onClick={handleProceedToDodoPayment}
                    disabled={saving}
                    className="onboard-primary-btn"
                    style={{ minWidth: "220px" }}
                  >
                    {saving ? "Launching Dodo Checkout..." : "Proceed to Payment via Dodo →"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
