"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  isRegistered?: boolean;
}

interface TemplateRecord {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  description: string | null;
  frequency: string;
  schema: {
    sections?: any[];
    [key: string]: any;
  };
}

interface SetupWizardProps {
  organization: {
    id: string;
    name: string;
    plan: string;
    billingStatus: string;
  };
  initialOutlets: Array<{ id: string; name: string; code: string | null; icon: string }>;
  initialTemplates: TemplateRecord[];
  initialStaff: StaffMember[];
  currentUser: {
    name: string;
    email: string;
    role: string;
  };
  sessionId?: string;
}

const PRESET_TEMPLATES = [
  {
    title: "Daily Housekeeping & Hygiene SOP",
    category: "HOUSEKEEPING",
    icon: "🧹",
    frequency: "SHIFT_WISE",
    description: "Daily sanitization and inspection for food prep and customer areas.",
    sections: [
      {
        id: "sec-1",
        title: "Sanitation & Production Floor",
        items: [
          { id: "hk-1", name: "Food Prep Stainless Steel Tables Sanitized", defaultAssignee: "Kitchen Steward" },
          { id: "hk-2", name: "Floor Mopping with Food-Grade Disinfectant", defaultAssignee: "Dishwasher / Cleaner" },
          { id: "hk-3", name: "Exhaust Hood Filters & Grease Traps Inspected", defaultAssignee: "Kitchen Steward" },
          { id: "hk-4", name: "Handwash Sink Soap & Paper Towels Restocked", defaultAssignee: "Dishwasher / Cleaner" },
        ],
      },
    ],
  },
  {
    title: "Inbound Raw Material Receiving & QA",
    category: "RECEIVING",
    icon: "📦",
    frequency: "DAILY",
    description: "Inspection of supplier batch numbers, vehicle hygiene, and core delivery temperatures.",
    sections: [
      {
        id: "sec-1",
        title: "Inbound Verification & Safety",
        items: [
          { id: "rm-1", name: "Supplier Invoice & Batch / Lot Number Verified", defaultAssignee: "QA Inspector" },
          { id: "rm-2", name: "Transport Vehicle Hygiene & Packaging Seal Intact", defaultAssignee: "QA Inspector" },
          { id: "rm-3", name: "Inbound Core / Surface Temperature (°C)", defaultAssignee: "QA Inspector" },
          { id: "rm-4", name: "Raw Batch Allergen Labeling & Segregation Applied", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
  {
    title: "Cloud Kitchen Dispatch & Food Delivery",
    category: "DISPATCH",
    icon: "🛵",
    frequency: "DAILY",
    description: "Tamper-evident sealing, holding temperature, and delivery handover audit.",
    sections: [
      {
        id: "sec-1",
        title: "Dispatch Handover Checks",
        items: [
          { id: "ck-1", name: "Hot Food Dispatch Holding Temp (Min 65°C)", defaultAssignee: "Line Cook" },
          { id: "ck-2", name: "Tamper-Evident Security Seal Applied Across Container", defaultAssignee: "Line Cook" },
          { id: "ck-3", name: "Delivery Partner Insulated Bag Sanitized & Clean", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
  {
    title: "Espresso Machine Calibration & Barista Log",
    category: "BARISTA",
    icon: "☕",
    frequency: "SHIFT_WISE",
    description: "Espresso extraction, boiler pressure, water filtration TDS, and milk wand sanitization.",
    sections: [
      {
        id: "sec-1",
        title: "Barista Calibration",
        items: [
          { id: "bar-1", name: "Group Head Shower Screen Flush & Clean", defaultAssignee: "Barista" },
          { id: "bar-2", name: "9-Bar Pump Pressure & Boiler Temp Calibrated", defaultAssignee: "Barista" },
          { id: "bar-3", name: "Steam Wand Purged & Milk Residue Chemical Soak", defaultAssignee: "Barista" },
        ],
      },
    ],
  },
  {
    title: "FSSAI Deep Fryer Oil (TPC) & Personnel Hygiene",
    category: "COMPLIANCE",
    icon: "🍳",
    frequency: "DAILY",
    description: "Total Polar Compounds oil test, uniform cleanliness, and pest station inspection.",
    sections: [
      {
        id: "sec-1",
        title: "Oil & Personal Hygiene",
        items: [
          { id: "fs-1", name: "Cooking Oil Total Polar Compounds (Safe < 25%)", defaultAssignee: "Kitchen Steward" },
          { id: "fs-2", name: "Food Handlers Clean Uniform, Apron & Hairnet Check", defaultAssignee: "Shift Supervisor" },
          { id: "fs-3", name: "Pest Bait Stations & Insect Light Trap Inspected", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
];

export default function SetupWizardClient({
  organization,
  initialOutlets,
  initialTemplates,
  initialStaff,
  currentUser,
  sessionId,
}: SetupWizardProps) {
  const router = useRouter();

  // Wizard Steps: 1 = Add Staff, 2 = Select Templates, 3 = Launch Ready (Celebration)
  const [step, setStep] = useState<number>(1);
  const [saving, setSaving] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Step 1: Staff list
  const [staffList, setStaffList] = useState<StaffMember[]>(initialStaff);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState("Kitchen Steward");

  // Step 2: Templates selection
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates);
  const [selectedPresets, setSelectedPresets] = useState<string[]>(["Daily Housekeeping & Hygiene SOP"]);
  const [customTemplateTitle, setCustomTemplateTitle] = useState("");

  // Auto-dismiss toast notification
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Background checkout session sync
  useEffect(() => {
    if (sessionId) {
      fetch("/api/payments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, organizationId: organization.id }),
      }).catch(() => {});
    }
  }, [sessionId, organization.id]);

  // Add staff handler
  const handleAddStaff = async (nameToAdd?: string, roleToAdd?: string) => {
    const name = (nameToAdd || newStaffName).trim();
    const role = (roleToAdd || newStaffRole).trim() || "Staff Member";

    if (!name) return;

    if (staffList.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      setToast({ type: "error", msg: `${name} is already in your team list` });
      return;
    }

    const optimisticMember: StaffMember = {
      id: `staff-${Date.now()}`,
      name,
      role,
      isRegistered: false,
    };

    setStaffList((prev) => [...prev, optimisticMember]);
    setNewStaffName("");

    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role }),
      });
      if (!res.ok) throw new Error("Failed to save staff member");
    } catch {
      // optimistic state retained
    }
  };

  // Remove staff handler
  const handleRemoveStaff = async (staffId: string, staffName: string) => {
    setStaffList((prev) => prev.filter((s) => s.id !== staffId && s.name !== staffName));
    try {
      await fetch(`/api/admin/staff?name=${encodeURIComponent(staffName)}`, {
        method: "DELETE",
      });
    } catch {
      // ignore
    }
  };

  // Step 1 -> Step 2
  const handleProceedToTemplates = () => {
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Step 2 -> Step 3 (Celebration / Complete): Save templates & launch
  const handleSaveChecklistsAndComplete = async () => {
    setSaving(true);
    try {
      const outletId = initialOutlets[0]?.id;
      const createdList: TemplateRecord[] = [...templates];

      for (const presetTitle of selectedPresets) {
        const alreadyExists = templates.some((t) => t.title.toLowerCase() === presetTitle.toLowerCase());
        if (!alreadyExists) {
          const presetObj = PRESET_TEMPLATES.find((p) => p.title === presetTitle);
          if (presetObj) {
            const res = await fetch("/api/admin/templates", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title: presetObj.title,
                category: presetObj.category,
                icon: presetObj.icon,
                frequency: presetObj.frequency,
                description: presetObj.description,
                schema: { sections: presetObj.sections },
                outletIds: outletId ? [outletId] : [],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.template) {
                createdList.push(data.template);
              }
            }
          }
        }
      }

      // If user typed a custom template title
      if (customTemplateTitle.trim()) {
        const res = await fetch("/api/admin/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: customTemplateTitle.trim(),
            category: "CUSTOM",
            icon: "📋",
            frequency: "DAILY",
            description: "Custom operational checklist",
            schema: {
              sections: [
                {
                  id: "sec-1",
                  title: "General Checkpoints",
                  items: [
                    { id: "item-1", name: "Operational Area Hygiene Check", defaultAssignee: "Staff Member" },
                    { id: "item-2", name: "Equipment Sanitization & Calibration", defaultAssignee: "Shift Supervisor" },
                  ],
                },
              ],
            },
            outletIds: outletId ? [outletId] : [],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.template) {
            createdList.push(data.template);
          }
        }
      }

      setTemplates(createdList);
      setStep(3); // Directly advance to Celebration
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "Failed to configure checklists" });
    } finally {
      setSaving(false);
    }
  };

  const progressPercentage = step === 1 ? 50 : 100;

  return (
    <div className="onboard-wizard-wrapper">
      {/* Top Navigation & Progress Bar */}
      <header className="onboard-wizard-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#111111", color: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", fontSize: "14px" }}>
            OV
          </div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "600", color: "#111111" }}>{organization.name}</div>
            <div style={{ fontSize: "11px", color: "#777774" }}>
              {step === 1 && "Step 1 of 2: Add Your Team"}
              {step === 2 && "Step 2 of 2: Select Checklists"}
              {step === 3 && "Setup Complete"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {sessionId && (
            <span style={{ fontSize: "12px", background: "#ECFDF5", color: "#065F46", padding: "4px 8px", borderRadius: "12px", border: "1px solid #A7F3D0", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              ✓ Subscribed
            </span>
          )}
          <button
            onClick={() => router.push("/dashboard")}
            style={{ background: "transparent", border: "none", color: "#666664", fontSize: "13px", cursor: "pointer", textDecoration: "underline" }}
          >
            Skip to Dashboard
          </button>
        </div>

        <div className="onboard-progress-track">
          <div className="onboard-progress-fill" style={{ width: `${progressPercentage}%` }} />
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div style={{ position: "fixed", top: "70px", left: "50%", transform: "translateX(-50%)", zIndex: 100, background: toast.type === "error" ? "#FEF2F2" : "#F0FDF4", color: toast.type === "error" ? "#991B1B" : "#166534", border: `1px solid ${toast.type === "error" ? "#FECACA" : "#BBF7D0"}`, padding: "8px 16px", borderRadius: "8px", fontSize: "13.5px", boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          {toast.msg}
        </div>
      )}

      {/* Wizard Content Container */}
      <main className="onboard-wizard-content">
        {/* STEP 1: ADD EMPLOYEES & CLEANING STAFF */}
        {step === 1 && (
          <div key="step-1" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">Who works in your kitchen or facility?</h1>
            <p className="onboard-anim-sub">
              Add your cleaning staff, operators, and supervisors. They will appear in report dropdowns when daily hygiene checks are logged.
            </p>

            <div className="onboard-anim-card">
              {/* Inline Add Input */}
              <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="Staff or cleaner's full name..."
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddStaff();
                    }
                  }}
                  style={{ flex: "1 1 240px", height: "46px", padding: "0 14px", border: "1.5px solid #DCD9D2", borderRadius: "8px", fontSize: "15px", outline: "none", background: "#FFFFFF", color: "#111111" }}
                />
                <select
                  value={newStaffRole}
                  onChange={(e) => setNewStaffRole(e.target.value)}
                  style={{ width: "180px", height: "46px", padding: "0 10px", border: "1.5px solid #DCD9D2", borderRadius: "8px", fontSize: "14px", background: "#FFFFFF", color: "#111111", outline: "none" }}
                >
                  <option value="Kitchen Steward">Kitchen Steward</option>
                  <option value="Dishwasher / Cleaner">Dishwasher / Cleaner</option>
                  <option value="Line Cook">Line Cook</option>
                  <option value="QA Inspector">QA Inspector</option>
                  <option value="Shift Supervisor">Shift Supervisor</option>
                  <option value="Barista">Barista</option>
                  <option value="Operator">General Operator</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleAddStaff()}
                  disabled={!newStaffName.trim()}
                  className="onboard-primary-btn"
                  style={{ height: "46px", minHeight: "46px", padding: "0 20px" }}
                >
                  + Add Staff
                </button>
              </div>

              {/* Quick Add Suggestions */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ fontSize: "12px", fontWeight: "600", color: "#777774", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
                  Quick Add Presets:
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {[
                    { name: "Sunil Kumar", role: "Kitchen Steward" },
                    { name: "Ramesh Pawar", role: "Dishwasher / Cleaner" },
                    { name: "Priya Sharma", role: "QA Inspector" },
                    { name: "Vikas Verma", role: "Shift Supervisor" },
                    { name: "Rahul Deshmukh", role: "Line Cook" },
                    { name: "Anil Shinde", role: "Barista" },
                  ].map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="onboard-quick-chip"
                      onClick={() => handleAddStaff(preset.name, preset.role)}
                    >
                      + {preset.name} ({preset.role})
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Staff List Tags */}
              <div style={{ borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#333330", marginBottom: "12px" }}>
                  Active Team Members ({staffList.length + 1}):
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", minHeight: "40px" }}>
                  <span className="onboard-staff-pill" style={{ background: "#EBF3FE", borderColor: "#C7DCFD" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#2563EB" }} />
                    {currentUser.name} (Admin / Owner)
                  </span>

                  {staffList.map((member) => (
                    <span key={member.id} className="onboard-staff-pill">
                      <span>{member.name}</span>
                      <span style={{ fontSize: "11px", color: "#666664", background: "rgba(0,0,0,0.05)", padding: "2px 6px", borderRadius: "10px" }}>
                        {member.role}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveStaff(member.id, member.name)}
                        style={{ border: "none", background: "transparent", color: "#999994", cursor: "pointer", fontSize: "14px", lineHeight: "1", padding: "0 2px" }}
                        title="Remove staff member"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div style={{ marginTop: "32px", display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <div className="onboard-kbd-hint">
                  Tip: Press <span className="onboard-kbd-tag">Enter ↵</span> to quickly add staff
                </div>
                <button
                  type="button"
                  onClick={handleProceedToTemplates}
                  className="onboard-primary-btn"
                >
                  Continue to Checklists →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CHOOSE OR CREATE REPORTING TEMPLATES */}
        {step === 2 && (
          <div key="step-2" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">Which compliance checklists do you need?</h1>
            <p className="onboard-anim-sub">
              Select the reporting templates relevant to your operation. They will be immediately activated for your daily audits.
            </p>

            <div className="onboard-anim-card">
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {PRESET_TEMPLATES.map((tmpl) => {
                  const isSelected = selectedPresets.includes(tmpl.title);
                  return (
                    <div
                      key={tmpl.title}
                      className={`onboard-template-card ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedPresets((prev) =>
                          isSelected ? prev.filter((t) => t !== tmpl.title) : [...prev, tmpl.title]
                        );
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ width: "18px", height: "18px", marginTop: "2px", accentColor: "#111111", cursor: "pointer" }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                          <span style={{ fontSize: "18px" }}>{tmpl.icon}</span>
                          <span style={{ fontWeight: "600", fontSize: "15px", color: "#111111" }}>{tmpl.title}</span>
                          <span style={{ fontSize: "11px", background: "#F0EEE9", color: "#666662", padding: "2px 6px", borderRadius: "4px", fontWeight: "500" }}>
                            {tmpl.frequency}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#666664", lineHeight: "1.4" }}>
                          {tmpl.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Custom Blank Template Option */}
              <div style={{ borderTop: "1px solid #ECEAE5", paddingTop: "16px", marginBottom: "24px" }}>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#333330", marginBottom: "8px" }}>
                  Need a custom checklist?
                </div>
                <input
                  type="text"
                  placeholder="e.g. End of Day Kitchen Closing SOP..."
                  value={customTemplateTitle}
                  onChange={(e) => setCustomTemplateTitle(e.target.value)}
                  style={{ width: "100%", height: "44px", padding: "0 14px", border: "1.5px solid #DCD9D2", borderRadius: "8px", fontSize: "14.5px", outline: "none", background: "#FFFFFF", color: "#111111", boxSizing: "border-box" }}
                />
              </div>

              {/* Actions Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px" }}>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="onboard-secondary-btn"
                >
                  ← Back to Team
                </button>
                <button
                  type="button"
                  onClick={handleSaveChecklistsAndComplete}
                  disabled={saving || (selectedPresets.length === 0 && !customTemplateTitle.trim() && templates.length === 0)}
                  className="onboard-primary-btn"
                >
                  {saving ? "Setting up Checklists..." : "Finish Setup & Launch 🚀"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: CELEBRATION / LAUNCH READY */}
        {step === 3 && (
          <div key="step-3" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#ECFDF5", border: "1.5px solid #10B981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "16px" }}>
              🎉
            </div>
            <h1 className="onboard-anim-title">Your business is ready for compliance!</h1>
            <p className="onboard-anim-sub">
              Your team and checklists are linked. You can log daily shift audits, record temperatures, and track compliance scorecards immediately.
            </p>

            <div className="onboard-anim-card" style={{ textAlign: "center" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", marginBottom: "28px" }}>
                <div style={{ background: "#FAF9F6", border: "1px solid #ECEAE5", padding: "16px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#111111" }}>{staffList.length + 1}</div>
                  <div style={{ fontSize: "13px", color: "#666664" }}>Staff Members Active</div>
                </div>
                <div style={{ background: "#FAF9F6", border: "1px solid #ECEAE5", padding: "16px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#111111" }}>{templates.length}</div>
                  <div style={{ fontSize: "13px", color: "#666664" }}>Checklists Configured</div>
                </div>
                <div style={{ background: "#FAF9F6", border: "1px solid #ECEAE5", padding: "16px", borderRadius: "10px" }}>
                  <div style={{ fontSize: "24px", fontWeight: "700", color: "#10B981" }}>100%</div>
                  <div style={{ fontSize: "13px", color: "#666664" }}>Compliance Readiness</div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="onboard-primary-btn"
                  style={{ minWidth: "200px" }}
                >
                  Go to Daily Checklists →
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/admin/templates")}
                  className="onboard-secondary-btn"
                >
                  Open Template Manager
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
