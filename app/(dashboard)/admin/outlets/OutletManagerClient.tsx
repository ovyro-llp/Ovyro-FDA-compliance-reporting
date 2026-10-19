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
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const handleDuplicate = async (outlet: any) => {
    setDuplicatingId(outlet.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/outlets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "duplicate",
          sourceOutletId: outlet.id,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to duplicate facility");
      }

      setOutlets((prev) => [...prev, json.outlet]);
      refreshOutlets();
      showToast(`✅ Facility "${outlet.name}" duplicated with all report tabs!`);
    } catch (err: any) {
      alert(err.message || "Failed to duplicate facility");
    } finally {
      setDuplicatingId(null);
    }
  };

  React.useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

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
                <button
                  onClick={() => handleDuplicate(outlet)}
                  disabled={duplicatingId === outlet.id}
                  className="btn-action-duplicate"
                  title="Duplicate facility and copy all assigned report templates"
                >
                  {duplicatingId === outlet.id ? "Duplicating..." : "📋 Duplicate"}
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

      {/* Notion Dialog Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="modal-card">
            <div className="notion-modal-header">
              <div className="notion-modal-title-row">
                <span className="notion-modal-icon">{icon || "🏢"}</span>
                <h2 className="notion-modal-title">{editingOutlet ? `Edit: ${editingOutlet.name}` : "Add Facility / Outlet"}</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="notion-modal-close-btn"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave}>
              <div className="notion-modal-body">
                {error && (
                  <div className="notion-callout red" style={{ marginBottom: "14px" }}>
                    <span className="notion-callout-icon">⚠️</span>
                    <span>{error}</span>
                  </div>
                )}

                <div className="notion-form-row">
                  <div className="notion-form-group">
                    <label className="notion-form-label">Facility Name *</label>
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
                      className="notion-input"
                    />
                  </div>

                  <div className="notion-form-group">
                    <label className="notion-form-label">Location Code</label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="e.g. DT-01"
                      className="notion-input"
                    />
                  </div>
                </div>

                <div className="notion-form-row">
                  <div className="notion-form-group">
                    <label className="notion-form-label">Facility Archetype</label>
                    <select
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className="notion-select"
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

                  <div className="notion-form-group">
                    <label className="notion-form-label">Icon Emoji</label>
                    <div className="notion-icon-picker-row">
                      <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        className="notion-input notion-icon-input"
                        maxLength={4}
                      />
                      <div className="notion-icon-presets">
                        {FACILITY_ICONS.map((ic) => (
                          <button
                            key={ic}
                            type="button"
                            onClick={() => setIcon(ic)}
                            className={`notion-icon-pill ${icon === ic ? "active" : ""}`}
                          >
                            {ic}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {type === "CUSTOM" && (
                  <div className="notion-form-group">
                    <label className="notion-form-label">Custom Facility Type Name *</label>
                    <input
                      type="text"
                      required
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      placeholder="e.g. ROOFTOP DINING, GELATO LAB, PATISSERIE"
                      className="notion-input"
                    />
                  </div>
                )}

                <div className="notion-form-group">
                  <label className="notion-form-label">Address / Location Details</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street address, unit number, city..."
                    className="notion-input"
                  />
                </div>

                {/* Dynamic Shift Manager */}
                <div className="notion-form-group" style={{ background: "#FAF9F6", padding: "12px 14px", borderRadius: "8px", border: "1px solid #EBEAE8" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <label className="notion-form-label" style={{ margin: 0 }}>Operational Shifts ({shifts.length})</label>
                    <span style={{ fontSize: "11px", color: "#7D7A75" }}>Checklists are submitted per shift</span>
                  </div>

                  {/* Shift Quick Presets */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    <span style={{ fontSize: "11px", color: "#7D7A75", alignSelf: "center", marginRight: "2px" }}>Presets:</span>
                    {[
                      { label: "2 Shifts", items: ["Morning", "Evening"] },
                      { label: "3 Shifts", items: ["Morning", "Afternoon", "Night"] },
                      { label: "Restaurant", items: ["Breakfast", "Lunch", "Dinner", "Closing"] },
                      { label: "Bakery", items: ["Early Prep", "Baking Shift", "Packing & Dispatch"] },
                      { label: "Cafe", items: ["Opening", "Mid-Day", "Closing"] },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setShifts(p.items)}
                        className="notion-preset-pill"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Active Shifts Chips */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "10px" }}>
                    {shifts.map((s) => (
                      <span key={s} className="notion-shift-chip">
                        🕒 {s}
                        <button
                          type="button"
                          onClick={() => handleRemoveShift(s)}
                          className="notion-shift-remove-btn"
                          title={`Remove ${s} shift`}
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Add Custom Shift */}
                  <div style={{ display: "flex", gap: "8px", width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>
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
                      placeholder="Add custom shift & press Add"
                      className="notion-input"
                      style={{ flex: 1, minWidth: 0, fontSize: "12.5px" }}
                    />
                    <button
                      type="button"
                      onClick={handleAddShift}
                      className="notion-preset-pill"
                      style={{ padding: "6px 12px", fontWeight: 600, flexShrink: 0 }}
                    >
                      + Add Shift
                    </button>
                  </div>
                </div>

                {/* Assigned Templates */}
                <div className="notion-form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label className="notion-form-label" style={{ margin: 0 }}>Assign Report Tabs to this Facility</label>
                    <div style={{ display: "flex", gap: "8px", fontSize: "11px" }}>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplates(allTemplates.map((t) => t.id))}
                        className="notion-preset-pill"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTemplates([])}
                        className="notion-preset-pill"
                      >
                        Clear All
                      </button>
                    </div>
                  </div>

                  <div className="notion-template-checkbox-grid">
                    {allTemplates.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "#7D7A75" }}>No report tabs created yet.</span>
                    ) : (
                      allTemplates.map((t) => {
                        const isChecked = selectedTemplates.includes(t.id);
                        return (
                          <label
                            key={t.id}
                            className={`notion-template-checkbox-item ${isChecked ? "checked" : ""}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedTemplates([...selectedTemplates, t.id]);
                                } else {
                                  setSelectedTemplates(selectedTemplates.filter((id) => id !== t.id));
                                }
                              }}
                              style={{ accentColor: "#2C2C2B" }}
                            />
                            <span>
                              {t.icon} {t.title}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="notion-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="notion-btn-secondary"
                  style={{ padding: "8px 16px" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="notion-save-button"
                  style={{ width: "auto", padding: "8px 20px" }}
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
