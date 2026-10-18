"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useOutlet } from "@/components/OutletContext";

interface OutletManagerClientProps {
  initialOutlets: any[];
  allTemplates: Array<{ id: string; title: string; icon: string; category: string }>;
}

const FACILITY_ICONS = ["🏢", "🍽️", "🥐", "🍳", "🏭", "📦", "☕", "🍕", "🍔", "🏪", "🚚", "🥖"];

export default function OutletManagerClient({
  initialOutlets,
  allTemplates,
}: OutletManagerClientProps) {
  const router = useRouter();
  const { refreshOutlets } = useOutlet();
  const [outlets, setOutlets] = useState<any[]>(initialOutlets);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOutlet, setEditingOutlet] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState("RESTAURANT");
  const [customType, setCustomType] = useState("");
  const [icon, setIcon] = useState("🏢");
  const [address, setAddress] = useState("");
  const [shifts, setShifts] = useState<string[]>(["Morning", "Evening"]);
  const [customShiftInput, setCustomShiftInput] = useState("");
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenCreate = () => {
    setEditingOutlet(null);
    setName("");
    setCode("");
    setType("RESTAURANT");
    setCustomType("");
    setIcon("🏢");
    setAddress("");
    setShifts(["Morning", "Evening"]);
    setCustomShiftInput("");
    setSelectedTemplates(allTemplates.map((t) => t.id));
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (outlet: any) => {
    setEditingOutlet(outlet);
    setName(outlet.name);
    setCode(outlet.code || "");
    const isStandardType = ["RESTAURANT", "CAFE", "BAKERY", "CLOUD_KITCHEN", "CENTRAL_PRODUCTION", "COMMISSARY", "BAR", "FOOD_TRUCK", "FACTORY", "WAREHOUSE"].includes(outlet.type);
    if (isStandardType) {
      setType(outlet.type || "RESTAURANT");
      setCustomType("");
    } else {
      setType("CUSTOM");
      setCustomType(outlet.type || "");
    }
    setIcon(outlet.icon || "🏢");
    setAddress(outlet.address || "");
    const parsedShifts = Array.isArray(outlet.shifts)
      ? outlet.shifts
      : typeof outlet.shifts === "string"
      ? (() => {
          try {
            return JSON.parse(outlet.shifts);
          } catch {
            return outlet.shifts.split(",").map((s: string) => s.trim()).filter(Boolean);
          }
        })()
      : ["Morning", "Evening"];
    setShifts(parsedShifts.length > 0 ? parsedShifts : ["Morning", "Evening"]);
    setCustomShiftInput("");
    setSelectedTemplates((outlet.outletTemplates || []).map((ot: any) => ot.templateId || ot.template?.id));
    setError(null);
    setIsModalOpen(true);
  };

  const handleAddShift = () => {
    const trimmed = customShiftInput.trim();
    if (!trimmed) return;
    if (shifts.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      alert(`Shift "${trimmed}" is already added.`);
      return;
    }
    setShifts([...shifts, trimmed]);
    setCustomShiftInput("");
  };

  const handleRemoveShift = (shiftToRemove: string) => {
    if (shifts.length <= 1) {
      alert("At least one shift is required.");
      return;
    }
    setShifts(shifts.filter((s) => s !== shiftToRemove));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const finalType = type === "CUSTOM" && customType.trim() ? customType.trim().toUpperCase() : type;

    const payload = {
      id: editingOutlet?.id,
      name: name.trim(),
      code: code.trim() || null,
      type: finalType,
      icon: icon.trim() || "🏢",
      address: address.trim(),
      shifts: shifts.length > 0 ? shifts : ["Morning", "Evening"],
      templateIds: selectedTemplates,
    };

    try {
      const url = "/api/admin/outlets";
      const method = editingOutlet ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save outlet");

      showToast(editingOutlet ? `✓ "${name}" updated successfully!` : `✓ "${name}" created successfully!`);
      setIsModalOpen(false);

      // Refresh local list and global context
      const listRes = await fetch("/api/admin/outlets");
      if (listRes.ok) {
        const d = await listRes.json();
        setOutlets(d.outlets || []);
      }
      if (refreshOutlets) {
        await refreshOutlets();
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, outletName: string) => {
    if (outlets.length <= 1) {
      alert("Cannot delete the only facility. Your organization must have at least one active facility.");
      return;
    }

    if (!confirm(`Are you sure you want to delete facility "${outletName}"? All associated checklist assignments will be unlinked.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/outlets?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete outlet");

      setOutlets((prev) => prev.filter((o) => o.id !== id));
      showToast(`Facility "${outletName}" deleted.`);
      if (refreshOutlets) {
        await refreshOutlets();
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete facility");
    }
  };

  return (
    <div className="admin-page-container">
      {/* Toast */}
      {successToast && (
        <div className="notification-toast success">
          <span>✓</span>
          <span>{successToast}</span>
        </div>
      )}

      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Outlets & Facilities</h1>
          <p className="admin-page-subtitle">
            Manage locations, operational shifts, and form assignments.
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn-create-primary">
          Add Facility
        </button>
      </div>

      <div className="outlets-grid">
        {outlets.map((outlet) => {
          const tpls = outlet.outletTemplates || [];
          const shifts = Array.isArray(outlet.shifts) ? outlet.shifts : ["Morning", "Evening"];

          return (
            <div key={outlet.id} className="outlet-card">
              <div className="outlet-card-header">
                <div className="outlet-icon-circle">{outlet.icon || "🏢"}</div>
                <div className="outlet-header-meta">
                  <span className="outlet-type-badge">{outlet.type}</span>
                  {outlet.code && <span className="outlet-code-badge">{outlet.code}</span>}
                </div>
              </div>

              <h3 className="outlet-title">{outlet.name}</h3>
              {outlet.address && <p className="outlet-address">📍 {outlet.address}</p>}

              <div className="outlet-shifts-row">
                <span className="shifts-label">Shifts:</span>
                {shifts.map((s: string) => (
                  <span key={s} className="shift-chip">
                    {s}
                  </span>
                ))}
              </div>

              <div className="outlet-templates-section">
                <div className="section-label">Active Report Tabs ({tpls.length})</div>
                <div className="template-chips-wrap">
                  {tpls.length === 0 ? (
                    <span className="text-muted text-sm">No report tabs assigned</span>
                  ) : (
                    tpls.map((ot: any) => (
                      <span key={ot.template?.id || ot.id} className="template-chip">
                        {ot.template?.icon || "📋"} {ot.template?.title}
                      </span>
                    ))
                  )}
                </div>
              </div>

              <div className="outlet-stats-row">
                <span>👥 {outlet._count?.userOutlets || 0} Staff</span>
                <span>📋 {outlet._count?.submissions || 0} Submissions</span>
              </div>

              <div className="outlet-card-actions">
                <button
                  onClick={() => handleOpenEdit(outlet)}
                  className="btn-action-edit"
                >
                  ✏️ Edit Facility
                </button>
                {outlets.length > 1 && (
                  <button
                    onClick={() => handleDelete(outlet.id, outlet.name)}
                    className="btn-action-delete"
                    title="Delete Facility"
                  >
                    🗑️ Delete
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{editingOutlet ? `Edit: ${editingOutlet.name}` : "Add New Facility / Outlet"}</h2>
              <button onClick={() => setIsModalOpen(false)} className="modal-close-btn">
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="modal-form">
              {error && <div className="form-error-banner">{error}</div>}

              <div className="form-row-2">
                <div className="form-group">
                  <label>Facility / Outlet Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!editingOutlet && !code) {
                        setCode(
                          e.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 6)
                        );
                      }
                    }}
                    placeholder="e.g. Downtown Central Kitchen"
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label>Location Code</label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. DT-01"
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Facility Archetype / Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="form-select"
                  >
                    <option value="RESTAURANT">🍽️ Restaurant</option>
                    <option value="CAFE">☕ Cafe & Coffee Bar</option>
                    <option value="BAKERY">🥐 Bakery & Confectionery</option>
                    <option value="CLOUD_KITCHEN">🍳 Cloud Kitchen / QSR</option>
                    <option value="CENTRAL_PRODUCTION">🏭 Central Production / Commissary</option>
                    <option value="WAREHOUSE">📦 Warehouse & Cold Storage</option>
                    <option value="BAR">🍸 Bar & Lounge</option>
                    <option value="FOOD_TRUCK">🚚 Food Truck & Mobile Unit</option>
                    <option value="CUSTOM">✨ Custom Facility Type...</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Icon Emoji</label>
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <input
                      type="text"
                      value={icon}
                      onChange={(e) => setIcon(e.target.value)}
                      placeholder="e.g. 🏢"
                      className="form-input"
                      style={{ width: "70px", textAlign: "center", fontSize: "1.2rem" }}
                    />
                    <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                      {FACILITY_ICONS.slice(0, 7).map((ic) => (
                        <button
                          key={ic}
                          type="button"
                          onClick={() => setIcon(ic)}
                          style={{
                            border: "1px solid #cbd5e1",
                            background: icon === ic ? "#e2e8f0" : "white",
                            borderRadius: "4px",
                            padding: "2px 6px",
                            cursor: "pointer",
                            fontSize: "0.9rem",
                          }}
                        >
                          {ic}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {type === "CUSTOM" && (
                <div className="form-group">
                  <label>Custom Facility Type Name *</label>
                  <input
                    type="text"
                    required
                    value={customType}
                    onChange={(e) => setCustomType(e.target.value)}
                    placeholder="e.g. ROOFTOP DINING, GELATO LAB, PATISSERIE"
                    className="form-input"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Address / Location Details</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street address, unit number, city..."
                  className="form-input"
                />
              </div>

              {/* Dynamic Shift Manager */}
              <div className="form-group shift-config-box">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <label style={{ margin: 0 }}>Dynamic Operational Shifts ({shifts.length})</label>
                  <span className="field-hint" style={{ margin: 0 }}>Operators log checklists per shift</span>
                </div>

                {/* Shift Quick Presets */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.6rem" }}>
                  <span style={{ fontSize: "0.72rem", color: "#64748b", alignSelf: "center" }}>⚡ Shift Presets:</span>
                  {[
                    { label: "2 Shifts", items: ["Morning", "Evening"] },
                    { label: "3 Shifts", items: ["Morning", "Afternoon", "Night"] },
                    { label: "Restaurant Service", items: ["Breakfast", "Lunch", "Dinner", "Closing"] },
                    { label: "Bakery / Production", items: ["Early Prep", "Baking Shift", "Packing & Dispatch"] },
                    { label: "Cafe Service", items: ["Opening", "Mid-Day", "Closing"] },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setShifts(p.items)}
                      className="preset-btn"
                      style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {/* Active Shifts Chips */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", marginBottom: "0.65rem" }}>
                  {shifts.map((s) => (
                    <span
                      key={s}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        background: "#e0e7ff",
                        color: "#3730a3",
                        fontWeight: 600,
                        fontSize: "0.78rem",
                        padding: "0.3rem 0.6rem",
                        borderRadius: "999px",
                      }}
                    >
                      🕒 {s}
                      <button
                        type="button"
                        onClick={() => handleRemoveShift(s)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#4338ca",
                          fontWeight: "bold",
                          padding: "0 2px",
                          lineHeight: 1,
                        }}
                        title={`Remove ${s} shift`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add Custom Shift */}
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={customShiftInput}
                    onChange={(e) => setCustomShiftInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddShift();
                      }
                    }}
                    placeholder="Type custom shift name (e.g. Late Night, Prep Shift, Dinner) & press Add"
                    className="form-input"
                    style={{ flex: 1, fontSize: "0.82rem" }}
                  />
                  <button
                    type="button"
                    onClick={handleAddShift}
                    className="btn-add-item-small"
                    style={{ padding: "0.4rem 0.85rem" }}
                  >
                    ➕ Add Shift
                  </button>
                </div>
              </div>

              <div className="form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <label style={{ margin: 0 }}>Assign Report Tabs to this Facility</label>
                  <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplates(allTemplates.map((t) => t.id))}
                      className="btn-link-small"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedTemplates([])}
                      className="btn-link-small"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="outlet-checkboxes-grid">
                  {allTemplates.length === 0 ? (
                    <span className="text-muted text-sm">No report tabs created yet. You can create report tabs in the Report Tabs Manager.</span>
                  ) : (
                    allTemplates.map((t) => (
                      <label key={t.id} className="outlet-checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedTemplates.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTemplates([...selectedTemplates, t.id]);
                            } else {
                              setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                            }
                          }}
                        />
                        <span>
                          {t.icon} {t.title}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>


              <div className="modal-actions-bar">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-save"
                >
                  {saving ? "Saving Facility..." : editingOutlet ? "Update Facility" : "Add Facility"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
