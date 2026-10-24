"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import { formatDate } from "@/lib/permissions";

interface SubmissionsRecord {
  id: string;
  date: string;
  shift?: string | null;
  complianceScore?: number | null;
  supervisorName?: string;
  supervisorSigned?: boolean;
  comments?: string;
  correctiveAction?: string;
  status: string;
  createdAt: string;
  data: any;
  submittedBy?: { name?: string; email?: string };
  outlet?: { id: string; name: string; code?: string | null; icon: string };
  template?: { id: string; slug: string; title: string; icon: string; category: string };
}

interface ReportsClientProps {
  submissions: SubmissionsRecord[];
  outlets: Array<{ id: string; name: string; icon: string }>;
  templates: Array<{ id: string; title: string; icon: string; category: string; slug: string }>;
}

interface NormalizedCheckpoint {
  id?: string;
  name: string;
  type: string;
  result: string;
  badgeType: "pass" | "breach" | "na" | "info";
  staff?: string;
  time?: string;
  notes?: string;
}

function extractNormalizedCheckpoints(data: any): NormalizedCheckpoint[] {
  if (!data) return [];
  const list: NormalizedCheckpoint[] = [];

  // Dynamic schema checkpoints
  if (data.checkpoints && typeof data.checkpoints === "object") {
    Object.values(data.checkpoints).forEach((cp: any) => {
      const type = cp.itemType || "STATUS";
      let result = "";
      let badgeType: "pass" | "breach" | "na" | "info" = "info";

      if (type === "TEMPERATURE") {
        if (cp.temp === "NA" || cp.temp === "N/A" || !cp.temp) {
          result = "N/A";
          badgeType = "na";
        } else {
          const num = parseFloat(cp.temp);
          const min = cp.min ?? -20;
          const max = cp.max ?? 10;
          const unit = cp.unit || "°C";
          if (!isNaN(num) && (num < min || num > max)) {
            result = `${cp.temp}${unit} ⚠️ (Out: ${min} to ${max}${unit})`;
            badgeType = "breach";
          } else {
            result = `${cp.temp}${unit} (Safe: ${min} to ${max}${unit})`;
            badgeType = "pass";
          }
        }
      } else if (type === "NUMERIC") {
        if (cp.value === "NA" || cp.value === "N/A" || cp.value === "") {
          result = "N/A";
          badgeType = "na";
        } else {
          const num = parseFloat(cp.value);
          const hasMin = cp.min !== undefined && cp.min !== null;
          const hasMax = cp.max !== undefined && cp.max !== null;
          const unit = cp.unit || "";
          if (!isNaN(num) && ((hasMin && num < cp.min) || (hasMax && num > cp.max))) {
            result = `${cp.value} ${unit} ⚠️ (Target: ${cp.min ?? "-∞"} - ${cp.max ?? "+∞"} ${unit})`;
            badgeType = "breach";
          } else {
            result = `${cp.value} ${unit} ✓`;
            badgeType = "pass";
          }
        }
      } else if (type === "CLEAN_DIRTY") {
        if (cp.status === "NA" || cp.status === "N/A") {
          result = "N/A";
          badgeType = "na";
        } else if (cp.status === "CLEAN" || cp.status === "YES") {
          result = "Clean & Sanitized";
          badgeType = "pass";
        } else {
          result = "Needs Attention";
          badgeType = "breach";
        }
      } else if (type === "TEXT") {
        result = cp.value || "Logged";
        badgeType = "info";
      } else if (type === "TIME") {
        result = cp.time || "Logged";
        badgeType = "info";
      } else {
        if (cp.status === "NA" || cp.status === "N/A") {
          result = "N/A";
          badgeType = "na";
        } else if (cp.status === "YES" || cp.status === "PASS" || cp.status === "DONE" || cp.status === true) {
          result = "YES / Pass";
          badgeType = "pass";
        } else {
          result = "NO / Flagged";
          badgeType = "breach";
        }
      }

      list.push({
        name: cp.name || "Checkpoint",
        type,
        result,
        badgeType,
        staff: cp.assignee,
        time: cp.time,
        notes: cp.notes,
      });
    });
    return list;
  }

  // Legacy format: items
  if (Array.isArray(data.items)) {
    data.items.forEach((it: any) => {
      const isPass = it.status === "YES" || it.status === "DONE" || it.status === true;
      const isNa = it.status === "NA" || it.status === "N/A";
      list.push({
        name: it.name || "Housekeeping Item",
        type: "Housekeeping",
        result: it.status || "YES",
        badgeType: isNa ? "na" : isPass ? "pass" : "breach",
        staff: it.cleanedBy,
        time: it.time,
      });
    });
  }

  // Legacy format: completedItems
  if (Array.isArray(data.completedItems)) {
    data.completedItems.forEach((ci: any) => {
      const isPass = ci.status === "YES" || ci.status === "DONE" || ci.status === true;
      const isNa = ci.status === "NA" || ci.status === "N/A";
      list.push({
        name: ci.name || "Equipment Unit",
        type: ci.category || "Equipment",
        result: ci.status || "YES",
        badgeType: isNa ? "na" : isPass ? "pass" : "breach",
        staff: ci.cleanedBy,
        time: ci.time,
      });
    });
  }

  // Legacy format: readings
  if (Array.isArray(data.readings)) {
    data.readings.forEach((r: any) => {
      const isBreach = r.status === "BREACH";
      list.push({
        name: r.name || "Refrigeration Unit",
        type: "Cold Chain",
        result: `AM: ${r.morningTemp || "N/A"}°C | PM: ${r.eveningTemp || "N/A"}°C (${r.referenceTemp || "Standard"})`,
        badgeType: isBreach ? "breach" : "pass",
      });
    });
  }

  // Legacy format: locations
  if (Array.isArray(data.locations)) {
    data.locations.forEach((loc: any) => {
      const isPass = loc.status === "YES" || loc.status === "INTACT";
      const isNa = loc.status === "NA" || loc.status === "N/A";
      list.push({
        name: loc.location || "Glass/Fixture",
        type: "Structural / Safety",
        result: loc.status || "YES",
        badgeType: isNa ? "na" : isPass ? "pass" : "breach",
        staff: loc.cleanedBy,
      });
    });
  }

  // Legacy format: tasks
  if (Array.isArray(data.tasks)) {
    data.tasks.forEach((t: any) => {
      const isPass = t.status === "YES" || t.status === "DONE";
      const isNa = t.status === "NA" || t.status === "N/A";
      list.push({
        name: t.task || "Task",
        type: t.category || "Maintenance",
        result: t.status || "YES",
        badgeType: isNa ? "na" : isPass ? "pass" : "breach",
        staff: t.completedBy,
        notes: t.notes,
      });
    });
  }

  return list;
}

export default function ReportsClient({
  submissions,
  outlets,
  templates,
}: ReportsClientProps) {
  const [selectedOutlet, setSelectedOutlet] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split("T")[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return submissions.filter((sub) => {
      if (selectedOutlet !== "all" && sub.outlet?.id !== selectedOutlet) return false;
      if (selectedTemplate !== "all" && sub.template?.id !== selectedTemplate) return false;
      if (selectedStatus !== "all" && sub.status !== selectedStatus) return false;
      if (dateFrom && sub.date < dateFrom) return false;
      if (dateTo && sub.date > dateTo) return false;
      return true;
    });
  }, [submissions, selectedOutlet, selectedTemplate, selectedStatus, dateFrom, dateTo]);

  const avgCompliance = useMemo(() => {
    if (!filtered.length) return 100;
    const total = filtered.reduce((acc, curr) => acc + (curr.complianceScore ?? 100), 0);
    return Math.round(total / filtered.length);
  }, [filtered]);

  const exportCSV = () => {
    const headers = [
      "Date",
      "Facility",
      "Checklist / SOP",
      "Category",
      "Shift",
      "Compliance Score",
      "Submitted By",
      "Supervisor",
      "Signed",
      "Status",
      "Comments",
      "Corrective Action",
    ];

    const sanitizeCell = (val: string | number | null | undefined): string => {
      let str = String(val ?? "");
      // Prevent CSV formula injection in spreadsheet software (CWE-1236)
      if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filtered.map((sub) => [
      sanitizeCell(sub.date),
      sanitizeCell(sub.outlet?.name),
      sanitizeCell(sub.template?.title),
      sanitizeCell(sub.template?.category),
      sanitizeCell(sub.shift || "General"),
      sanitizeCell(`${sub.complianceScore ?? 100}%`),
      sanitizeCell(sub.submittedBy?.name),
      sanitizeCell(sub.supervisorName),
      sanitizeCell(sub.supervisorSigned ? "Yes" : "No"),
      sanitizeCell(sub.status),
      sanitizeCell(sub.comments),
      sanitizeCell(sub.correctiveAction),
    ]);

    const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((e) => e.join(","))].join("\r\n");
    // UTF-8 BOM ensures Excel properly parses special characters and accents
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const blobUrl = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", blobUrl);
    link.setAttribute("download", `Audit_Compliance_Report_${dateFrom}_to_${dateTo}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="admin-page-container">
      {/* Official Print Letterhead Header with Logo */}
      <div className="print-only-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0f172a", paddingBottom: "12px", marginBottom: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <Image src="/logo.png" alt="OVYRO Logo" width={44} height={44} className="w-11 h-11 object-contain" />
            <div>
              <h1 style={{ fontSize: "20px", fontWeight: "800", margin: 0, color: "#0f172a", letterSpacing: "-0.02em" }}>OVYRO Compliance & Audit Report</h1>
              <p style={{ fontSize: "12px", color: "#64748b", margin: 0 }}>Official Digital Hygiene, Safety & Regulatory Verification Record</p>
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: "11px", color: "#64748b" }}>
            <div><strong>Generated:</strong> {new Date().toLocaleDateString("en-IN", { dateStyle: "medium" })}</div>
            <div><strong>Classification:</strong> Verified Compliance Trail</div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Reports & Exports</h1>
          <p className="admin-page-subtitle">
            View inspection records, compliance scores, and download CSV audit trails.
          </p>
        </div>
        <div className="header-actions-group">
          <button onClick={() => window.print()} className="btn-secondary-action">
            Print
          </button>
          <button onClick={exportCSV} className="btn-create-primary">
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="reports-kpi-grid">
        <div className="kpi-card">
          <span className="kpi-title">Submissions</span>
          <span className="kpi-value">{filtered.length}</span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Avg Score</span>
          <span className={`kpi-value ${avgCompliance < 85 ? "warning" : "good"}`}>
            {avgCompliance}%
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">Verified</span>
          <span className="kpi-value">
            {filtered.filter((s) => s.supervisorSigned || s.status === "VERIFIED").length}
          </span>
        </div>
        <div className="kpi-card">
          <span className="kpi-title">CAPA Actions</span>
          <span className="kpi-value">{filtered.filter((s) => !!s.correctiveAction).length}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="reports-filter-card">
        <div className="filter-item">
          <label>Facility / Outlet</label>
          <select
            value={selectedOutlet}
            onChange={(e) => setSelectedOutlet(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Outlets</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.icon} {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>Report Tab</label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Report Tabs</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.icon} {t.title}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-item">
          <label>From Date</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="filter-input"
          />
        </div>

        <div className="filter-item">
          <label>To Date</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="filter-input"
          />
        </div>
      </div>

      {/* Submissions Table */}
      <div className="table-card">
        <div className="table-header-bar">
          <h3>Submission Log ({filtered.length} entries)</h3>
        </div>

        <div className="table-responsive">
          <table className="audit-table">
            <thead>
              <tr>
                <th>Date & Shift</th>
                <th>Facility</th>
                <th>Checklist / Template</th>
                <th>Score</th>
                <th>Submitted By</th>
                <th>Supervisor Sign-off</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty-table-cell">
                    No submissions found matching your filters.
                  </td>
                </tr>
              ) : (
                filtered.map((sub) => {
                  const isExpanded = expandedId === sub.id;
                  return (
                    <React.Fragment key={sub.id}>
                      <tr className={isExpanded ? "row-expanded" : ""}>
                        <td>
                          <div className="font-semibold">{formatDate(sub.date)}</div>
                          {sub.shift && <span className="shift-pill">{sub.shift}</span>}
                        </td>
                        <td>
                          <span>
                            {sub.outlet?.icon} {sub.outlet?.name}
                          </span>
                        </td>
                        <td>
                          <div className="font-semibold">
                            {sub.template?.icon} {sub.template?.title}
                          </div>
                          <span className="category-subtext">{sub.template?.category}</span>
                        </td>
                        <td>
                          <span className="score-badge-table">{sub.complianceScore ?? 100}%</span>
                        </td>
                        <td>{sub.submittedBy?.name || "Staff Member"}</td>
                        <td>
                          {sub.supervisorSigned ? (
                            <span className="signed-tag">✓ {sub.supervisorName || "Signed"}</span>
                          ) : (
                            <span className="unsigned-tag">Pending Sign-off</span>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill ${sub.status.toLowerCase()}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                            className="btn-details-toggle"
                          >
                            {isExpanded ? "Hide ▲" : "View Details ▼"}
                          </button>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="expanded-details-row">
                          <td colSpan={8}>
                            <div className="details-panel">
                              <div className="details-notes-grid">
                                <div>
                                  <strong>Supervisor Remarks:</strong>
                                  <p>{sub.comments || "None"}</p>
                                </div>
                                <div>
                                  <strong>Corrective Action (CAPA):</strong>
                                  <p>{sub.correctiveAction || "None required"}</p>
                                </div>
                              </div>

                              {/* Structured Checkpoints Inspection View */}
                              {(() => {
                                const checkpoints = extractNormalizedCheckpoints(sub.data);
                                const passCount = checkpoints.filter((c) => c.badgeType === "pass").length;
                                const breachCount = checkpoints.filter((c) => c.badgeType === "breach").length;
                                const naCount = checkpoints.filter((c) => c.badgeType === "na").length;

                                return (
                                  <div style={{ marginTop: "1rem" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
                                      <strong style={{ fontSize: "0.95rem" }}>
                                        Audit Inspection Details ({checkpoints.length} Checkpoints Logged):
                                      </strong>
                                      <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem" }}>
                                        <span style={{ background: "#f0fdf4", color: "#166534", padding: "2px 8px", borderRadius: "12px", border: "1px solid #bbf7d0", fontWeight: 600 }}>
                                          ✓ {passCount} In-Spec / Pass
                                        </span>
                                        {breachCount > 0 && (
                                          <span style={{ background: "#fef2f2", color: "#991b1b", padding: "2px 8px", borderRadius: "12px", border: "1px solid #fecaca", fontWeight: 600 }}>
                                            ⚠️ {breachCount} Breaches / Action
                                          </span>
                                        )}
                                        {naCount > 0 && (
                                          <span style={{ background: "#f8fafc", color: "#64748b", padding: "2px 8px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                                            — {naCount} N/A
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {checkpoints.length > 0 ? (
                                      <div className="table-responsive" style={{ background: "white", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                        <table className="audit-table" style={{ margin: 0 }}>
                                          <thead>
                                            <tr>
                                              <th>Checkpoint Name</th>
                                              <th>Type</th>
                                              <th>Recorded Value / Status</th>
                                              <th>Inspected By</th>
                                              <th>Time</th>
                                              <th>Notes</th>
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {checkpoints.map((cp, cIdx) => (
                                              <tr key={cIdx} style={{ backgroundColor: cp.badgeType === "breach" ? "#fff1f2" : undefined }}>
                                                <td style={{ fontWeight: 600 }}>{cp.name}</td>
                                                <td>
                                                  <span className="category-pill" style={{ fontSize: "0.75rem" }}>{cp.type}</span>
                                                </td>
                                                <td>
                                                  <span
                                                    style={{
                                                      display: "inline-block",
                                                      padding: "2px 8px",
                                                      borderRadius: "4px",
                                                      fontSize: "0.8rem",
                                                      fontWeight: 600,
                                                      backgroundColor:
                                                        cp.badgeType === "pass"
                                                          ? "#dcfce7"
                                                          : cp.badgeType === "breach"
                                                          ? "#fee2e2"
                                                          : cp.badgeType === "na"
                                                          ? "#f1f5f9"
                                                          : "#e0f2fe",
                                                      color:
                                                        cp.badgeType === "pass"
                                                          ? "#15803d"
                                                          : cp.badgeType === "breach"
                                                          ? "#b91c1c"
                                                          : cp.badgeType === "na"
                                                          ? "#64748b"
                                                          : "#0369a1",
                                                    }}
                                                  >
                                                    {cp.result}
                                                  </span>
                                                </td>
                                                <td style={{ fontSize: "0.85rem", color: "#475569" }}>{cp.staff || "—"}</td>
                                                <td style={{ fontSize: "0.85rem", color: "#475569" }}>{cp.time || "—"}</td>
                                                <td style={{ fontSize: "0.8rem", color: "#64748b" }}>{cp.notes || "—"}</td>
                                              </tr>
                                            ))}
                                          </tbody>
                                        </table>
                                      </div>
                                    ) : (
                                      <p style={{ fontSize: "0.85rem", color: "#64748b", margin: "0.5rem 0" }}>No structured checkpoints logged in this submission.</p>
                                    )}

                                    <details style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
                                      <summary style={{ cursor: "pointer", fontWeight: 600 }}>View Raw JSON Data Payload</summary>
                                      <div className="raw-data-preview" style={{ marginTop: "0.5rem" }}>
                                        <pre>{JSON.stringify(sub.data, null, 2)}</pre>
                                      </div>
                                    </details>
                                  </div>
                                );
                              })()}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
