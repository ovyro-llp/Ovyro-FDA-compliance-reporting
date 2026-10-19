"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface StaffMember {
  id: string;
  name: string;
  role: string;
  isRegistered?: boolean;
}

interface TemplateItem {
  id: string;
  name: string;
  itemType?: string;
  defaultAssignee?: string;
}

interface TemplateSection {
  id: string;
  title: string;
  items: TemplateItem[];
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
    sections?: TemplateSection[];
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

  // Wizard Steps: 1 = Add Staff, 2 = Select Templates, 3 = Assign Staff Dropdown, 4 = Complete
  const [step, setStep] = useState<number>(1);
  const [paymentSynced, setPaymentSynced] = useState<boolean>(false);
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

  // Step 3: Active template for assigning staff
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);

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
      })
        .then((res) => res.json())
        .then(() => setPaymentSynced(true))
        .catch(() => setPaymentSynced(true));
    }
  }, [sessionId, organization.id]);

  // Combined staff names for dropdown
  const allStaffNames = React.useMemo(() => {
    const list = [
      currentUser.name,
      ...staffList.map((s) => s.name),
      "General Staff",
    ];
    return Array.from(new Set(list.filter(Boolean)));
  }, [currentUser.name, staffList]);

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
      // optimistic state retained, toast subtle info
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

  // Step 2 -> Step 3: Create any selected preset templates not already created
  const handleProceedToAssignStaff = async () => {
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
                    { id: "item-1", name: "Operational Area Hygiene Check", defaultAssignee: allStaffNames[0] || "Staff Member" },
                    { id: "item-2", name: "Equipment Sanitization & Calibration", defaultAssignee: allStaffNames[1] || "Shift Supervisor" },
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
      setStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "Failed to configure templates" });
    } finally {
      setSaving(false);
    }
  };

  // Step 3: Update default assignee for an item
  const handleAssignItemStaff = (templateId: string, sectionIdx: number, itemIdx: number, staffName: string) => {
    setTemplates((prev) =>
      prev.map((tmpl) => {
        if (tmpl.id !== templateId) return tmpl;
        const newSchema = { ...tmpl.schema };
        const sections = [...(newSchema.sections || [])];
        if (sections[sectionIdx]) {
          const items = [...(sections[sectionIdx].items || [])];
          if (items[itemIdx]) {
            items[itemIdx] = { ...items[itemIdx], defaultAssignee: staffName };
            sections[sectionIdx] = { ...sections[sectionIdx], items };
            newSchema.sections = sections;
          }
        }
        return { ...tmpl, schema: newSchema };
      })
    );
  };

  // Bulk assign all items in a section
  const handleBulkAssignSection = (templateId: string, sectionIdx: number, staffName: string) => {
    setTemplates((prev) =>
      prev.map((tmpl) => {
        if (tmpl.id !== templateId) return tmpl;
        const newSchema = { ...tmpl.schema };
        const sections = [...(newSchema.sections || [])];
        if (sections[sectionIdx]) {
          const items = (sections[sectionIdx].items || []).map((it) => ({
            ...it,
            defaultAssignee: staffName,
          }));
          sections[sectionIdx] = { ...sections[sectionIdx], items };
          newSchema.sections = sections;
        }
        return { ...tmpl, schema: newSchema };
      })
    );
  };

  // Step 3 -> Step 4: Persist updated template schemas and complete setup
  const handleSaveAssignmentsAndFinish = async () => {
    setSaving(true);
    try {
      for (const tmpl of templates) {
        await fetch(`/api/admin/templates/${tmpl.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: tmpl.title,
            category: tmpl.category,
            icon: tmpl.icon,
            frequency: tmpl.frequency,
            schema: tmpl.schema,
          }),
        });
      }
      setStep(4);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setToast({ type: "error", msg: err.message || "Failed to save assignments" });
    } finally {
      setSaving(false);
    }
  };

  const progressPercentage = step === 1 ? 25 : step === 2 ? 55 : step === 3 ? 85 : 100;
  const currentTemplate = templates[activeTemplateIndex] || templates[0];

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
              {step === 1 && "Step 1 of 3: Add Your Team"}
              {step === 2 && "Step 2 of 3: Select Checklists"}
              {step === 3 && "Step 3 of 3: Assign Staff"}
              {step === 4 && "Setup Complete"}
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
                  {/* Current Admin Tag */}
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
              Select the reporting templates relevant to your operation. You can customize them or assign staff in the next step.
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
                  placeholder="e.g. End of Day Bakery Closing & Sanitization..."
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
                  onClick={handleProceedToAssignStaff}
                  disabled={saving || (selectedPresets.length === 0 && !customTemplateTitle.trim() && templates.length === 0)}
                  className="onboard-primary-btn"
                >
                  {saving ? "Setting up Checklists..." : "Continue to Staff Assignment →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: EDIT ASSIGN STAFF VIEW */}
        {step === 3 && (
          <div key="step-3" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <h1 className="onboard-anim-title">Assign staff to report items</h1>
            <p className="onboard-anim-sub">
              Choose which team member is responsible for each checklist item. In daily reporting, their name will appear in the assignee dropdown.
            </p>

            <div className="onboard-anim-card" style={{ maxWidth: "820px" }}>
              {/* Template Tab Switcher if multiple templates */}
              {templates.length > 1 && (
                <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px", borderBottom: "1px solid #ECEAE5" }}>
                  {templates.map((tmpl, idx) => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => setActiveTemplateIndex(idx)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: "8px",
                        border: "1px solid",
                        borderColor: activeTemplateIndex === idx ? "#111111" : "#E2E0D8",
                        background: activeTemplateIndex === idx ? "#111111" : "#FFFFFF",
                        color: activeTemplateIndex === idx ? "#FFFFFF" : "#444442",
                        fontSize: "13px",
                        fontWeight: "600",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{tmpl.icon || "📋"}</span>
                      <span>{tmpl.title}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Template Sections & Checkpoint Assignment Rows */}
              {currentTemplate && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "#111111" }}>
                        {currentTemplate.icon} {currentTemplate.title}
                      </div>
                      <div style={{ fontSize: "12px", color: "#777774" }}>
                        Configure default assignees from your registered team members
                      </div>
                    </div>
                  </div>

                  {(!currentTemplate.schema.sections || currentTemplate.schema.sections.length === 0) ? (
                    <div style={{ padding: "24px", textAlign: "center", color: "#777774", fontSize: "14px", background: "#FBFBFA", borderRadius: "8px" }}>
                      This template has no checklist items defined yet. You can add items later in Template Manager.
                    </div>
                  ) : (
                    currentTemplate.schema.sections.map((section, secIdx) => (
                      <div key={section.id || secIdx} style={{ marginBottom: "20px", border: "1px solid #EBE9E4", borderRadius: "10px", overflow: "hidden" }}>
                        {/* Section Header with Bulk Assign Tool */}
                        <div style={{ background: "#F7F6F2", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", borderBottom: "1px solid #EBE9E4" }}>
                          <span style={{ fontSize: "13.5px", fontWeight: "600", color: "#222220" }}>
                            {section.title} ({section.items?.length || 0} items)
                          </span>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "11.5px", color: "#666662" }}>Assign all in section to:</span>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleBulkAssignSection(currentTemplate.id, secIdx, e.target.value);
                                }
                              }}
                              defaultValue=""
                              style={{ height: "30px", fontSize: "12px", borderRadius: "6px", border: "1px solid #CBC8C0", background: "#FFFFFF", color: "#111111", padding: "0 6px" }}
                            >
                              <option value="" disabled>Select staff...</option>
                              {allStaffNames.map((name) => (
                                <option key={name} value={name}>{name}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Items Table */}
                        <div style={{ padding: "8px 16px" }}>
                          {(section.items || []).map((item, itemIdx) => (
                            <div
                              key={item.id || itemIdx}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "10px 0",
                                borderBottom: itemIdx === section.items.length - 1 ? "none" : "1px solid #F2F1EC",
                                gap: "12px",
                              }}
                            >
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "14px", fontWeight: "500", color: "#1F1F1E" }}>
                                  {item.name}
                                </div>
                              </div>
                              <div style={{ flex: "0 0 200px" }}>
                                <select
                                  value={item.defaultAssignee || allStaffNames[0]}
                                  onChange={(e) => handleAssignItemStaff(currentTemplate.id, secIdx, itemIdx, e.target.value)}
                                  style={{
                                    width: "100%",
                                    height: "36px",
                                    padding: "0 10px",
                                    border: "1.5px solid #D2CFC7",
                                    borderRadius: "6px",
                                    fontSize: "13px",
                                    fontWeight: "500",
                                    background: "#FFFFFF",
                                    color: "#111111",
                                    outline: "none",
                                  }}
                                >
                                  {allStaffNames.map((staff) => (
                                    <option key={staff} value={staff}>
                                      {staff}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #ECEAE5", paddingTop: "20px", marginTop: "12px" }}>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="onboard-secondary-btn"
                >
                  ← Back to Checklists
                </button>
                <button
                  type="button"
                  onClick={handleSaveAssignmentsAndFinish}
                  disabled={saving}
                  className="onboard-primary-btn"
                >
                  {saving ? "Saving Assignments..." : "Finish Setup & Launch 🚀"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 4: LAUNCH READY / CELEBRATION */}
        {step === 4 && (
          <div key="step-4" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "56px", height: "56px", borderRadius: "50%", background: "#ECFDF5", border: "1.5px solid #10B981", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", marginBottom: "16px" }}>
              🎉
            </div>
            <h1 className="onboard-anim-title">Your business is ready for compliance!</h1>
            <p className="onboard-anim-sub">
              Your staff members are linked and ready to record audits. Every daily submission will automatically log assignees and timestamps.
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
