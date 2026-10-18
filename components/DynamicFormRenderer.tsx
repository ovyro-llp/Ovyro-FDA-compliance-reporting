"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import PaywallModal from "@/components/PaywallModal";

export interface DynamicFormRendererProps {
  outlet: {
    id: string;
    name: string;
    code?: string | null;
    icon: string;
    shifts?: string[];
  };
  template: {
    id: string;
    slug: string;
    title: string;
    category: string;
    icon: string;
    description?: string | null;
    frequency: string;
    schema: any;
  };
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  availableStaff?: string[];
}

export default function DynamicFormRenderer({
  outlet,
  template,
  currentUser,
  availableStaff = [
    "Staff Member",
    "Shift Supervisor",
    "Kitchen Lead",
    "Operator",
    "Technician",
  ],
}: DynamicFormRendererProps) {
  const router = useRouter();
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const parsedSchema = useMemo(() => {
    if (!template.schema) return { sections: [] };
    if (typeof template.schema === "string") {
      try {
        return JSON.parse(template.schema);
      } catch {
        return { sections: [] };
      }
    }
    return template.schema;
  }, [template.schema]);

  const availableShifts = useMemo(() => {
    if (parsedSchema?.shifts && Array.isArray(parsedSchema.shifts)) {
      return parsedSchema.shifts;
    }
    if (outlet.shifts && Array.isArray(outlet.shifts)) {
      return outlet.shifts;
    }
    return ["Morning", "Afternoon", "Evening", "Night"];
  }, [parsedSchema, outlet.shifts]);

  const [selectedShift, setSelectedShift] = useState<string>(availableShifts[0] || "General");

  const [formData, setFormData] = useState<any>({});
  const [comments, setComments] = useState<string>("");
  const [correctiveAction, setCorrectiveAction] = useState<string>("");
  const [supervisorName, setSupervisorName] = useState<string>("");
  const [supervisorSigned, setSupervisorSigned] = useState<boolean>(false);
  const [existingSubmissionId, setExistingSubmissionId] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [showPaywall, setShowPaywall] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Load existing submission for selected date & shift
  useEffect(() => {
    let isCancelled = false;
    async function loadSubmission() {
      setLoading(true);
      try {
        const isShiftWise = template.frequency === "SHIFT_WISE";
        const queryParams = new URLSearchParams({
          outletId: outlet.id,
          templateId: template.id,
          date: selectedDate,
        });

        const res = await fetch(`/api/submissions?${queryParams.toString()}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const json = await res.json();
        const submissions = json.submissions || [];

        const matching = isShiftWise
          ? submissions.find((s: any) => s.shift === selectedShift)
          : submissions[0];

        if (!isCancelled) {
          if (matching) {
            setExistingSubmissionId(matching.id);
            setFormData(matching.data || {});
            setComments(matching.comments || "");
            setCorrectiveAction(matching.correctiveAction || "");
            setSupervisorName(matching.supervisorName || "");
            setSupervisorSigned(!!matching.supervisorSigned);
          } else {
            setExistingSubmissionId(null);
            setFormData(getInitialDataForSchema(parsedSchema, template.category, availableStaff, currentUser?.name));
            setComments("");
            setCorrectiveAction("");
            setSupervisorSigned(false);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    loadSubmission();
    return () => {
      isCancelled = true;
    };
  }, [outlet.id, template.id, template.category, template.frequency, parsedSchema, selectedDate, selectedShift, availableStaff, currentUser?.name]);

const TIME_OPTIONS = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", "09:00", "09:30",
  "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30",
  "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30",
  "22:00", "22:30", "23:00", "23:30"
];

function formatTimeSlot(timeStr: string) {
  if (!timeStr) return "09:00 AM";
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h)) return timeStr;
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  const minStr = m < 10 ? `0${m}` : `${m}`;
  return `${hour12}:${minStr} ${ampm}`;
}

function TouchTempSelect({
  value,
  min,
  max,
  onChange,
}: {
  value?: string;
  min: number;
  max: number;
  onChange: (val: string) => void;
}) {
  const numVal = parseFloat(value || "");
  const isBreach = !isNaN(numVal) && (numVal < min || numVal > max);
  const isSelected = value !== undefined && value !== "";

  return (
    <div className="temp-touch-box">
      <select
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        className={`touch-temp-select ${
          isBreach ? "temp-out-of-bounds" : isSelected && value !== "N/A" ? "temp-in-bounds" : ""
        }`}
      >
        <option value="">Select Temp (°C)...</option>
        <option value="N/A">— N/A (Unit Off / Empty)</option>

        <optgroup label="Deep Freezer Range (-25°C to -10°C)">
          {[
            "-25.0", "-24.0", "-23.0", "-22.0", "-21.0", "-20.0", "-19.0", "-18.0",
            "-17.0", "-16.0", "-15.0", "-14.0", "-13.0", "-12.0", "-11.0", "-10.0"
          ].map((t) => (
            <option key={t} value={t}>
              {t}°C {parseFloat(t) >= min && parseFloat(t) <= max ? "✓ (Safe)" : "⚠️"}
            </option>
          ))}
        </optgroup>

        <optgroup label="Chill / Cold Hold (-9°C to 0°C)">
          {["-9.0", "-8.0", "-7.0", "-6.0", "-5.0", "-4.0", "-3.0", "-2.0", "-1.0", "0.0"].map((t) => (
            <option key={t} value={t}>
              {t}°C {parseFloat(t) >= min && parseFloat(t) <= max ? "✓ (Safe)" : "⚠️"}
            </option>
          ))}
        </optgroup>

        <optgroup label="Standard Refrigerator (+0.5°C to +8.0°C)">
          {[
            "0.5", "1.0", "1.5", "2.0", "2.5", "3.0", "3.5", "4.0",
            "4.5", "5.0", "5.5", "6.0", "6.5", "7.0", "7.5", "8.0"
          ].map((t) => (
            <option key={t} value={t}>
              {t}°C {parseFloat(t) >= min && parseFloat(t) <= max ? "✓ (Safe)" : "⚠️"}
            </option>
          ))}
        </optgroup>

        <optgroup label="Display / Ambient (+8.5°C to +30.0°C)">
          {[
            "8.5", "9.0", "9.5", "10.0", "11.0", "12.0", "13.0", "14.0",
            "15.0", "16.0", "18.0", "20.0", "22.0", "25.0", "30.0"
          ].map((t) => (
            <option key={t} value={t}>
              {t}°C {parseFloat(t) >= min && parseFloat(t) <= max ? "✓ (Safe)" : "⚠️"}
            </option>
          ))}
        </optgroup>
      </select>
      <button
        type="button"
        className={`na-toggle-btn ${value === "N/A" ? "active" : ""}`}
        onClick={() => onChange(value === "N/A" ? "" : "N/A")}
        title="Quick N/A Toggle"
      >
        N/A
      </button>
    </div>
  );
}

function CleanDirtyNaToggle({
  value,
  onChange,
}: {
  value?: string;
  onChange: (val: "CLEAN" | "DIRTY" | "NA") => void;
}) {
  const current =
    value === "DIRTY" || value === "NEEDS_CLEANING"
      ? "DIRTY"
      : value === "NA" || value === "N/A"
      ? "NA"
      : "CLEAN";

  return (
    <div className="touch-btn-toggle">
      <button
        type="button"
        onClick={() => onChange("CLEAN")}
        className={`touch-btn-option ${current === "CLEAN" ? "active-yes" : ""}`}
        title="Clean & Sanitized"
      >
        Clean
      </button>
      <button
        type="button"
        onClick={() => onChange("DIRTY")}
        className={`touch-btn-option ${current === "DIRTY" ? "active-no" : ""}`}
        title="Needs Cleaning / Attention"
      >
        Needs Attn
      </button>
      <button
        type="button"
        onClick={() => onChange("NA")}
        className={`touch-btn-option ${current === "NA" ? "active-na" : ""}`}
        title="Not Applicable"
      >
        N/A
      </button>
    </div>
  );
}

function YesNoNaToggle({
  value,
  onChange,
}: {
  value?: "YES" | "NO" | "NA" | string | boolean;
  onChange: (val: "YES" | "NO" | "NA") => void;
}) {
  const current =
    value === true || value === "YES" || value === "DONE" || value === "INTACT"
      ? "YES"
      : value === false || value === "NO" || value === "PENDING" || value === "DAMAGED"
      ? "NO"
      : value === "NA" || value === "N/A"
      ? "NA"
      : "YES";

  return (
    <div className="touch-btn-toggle">
      <button
        type="button"
        onClick={() => onChange("YES")}
        className={`touch-btn-option ${current === "YES" ? "active-yes" : ""}`}
      >
        Pass
      </button>
      <button
        type="button"
        onClick={() => onChange("NO")}
        className={`touch-btn-option ${current === "NO" ? "active-no" : ""}`}
      >
        Fail
      </button>
      <button
        type="button"
        onClick={() => onChange("NA")}
        className={`touch-btn-option ${current === "NA" ? "active-na" : ""}`}
      >
        N/A
      </button>
    </div>
  );
}

function getInitialDataForSchema(
  schema: any,
  category: string,
  availableStaff: string[] = ["Staff Member"],
  currentUserName?: string
) {
  const sections = schema?.sections || [];
  const defaultStaff = (availableStaff && availableStaff[0]) || currentUserName || "Staff Member";

  const hasItemTypes = sections.some((s: any) =>
    (s.items || []).some((it: any) => it.itemType)
  );

  const isLegacyCategory = [
    "HOUSEKEEPING",
    "EQUIPMENT",
    "TEMPERATURE",
    "SAFETY_GLASS",
  ].includes(category);

  // If dynamic category OR explicitly typed items
  if (!isLegacyCategory || hasItemTypes) {
    const checkpoints: Record<string, any> = {};
    sections.forEach((sec: any) => {
      (sec.items || []).forEach((item: any) => {
        const id = item.id || `item-${Math.random().toString(36).substring(2, 9)}`;
        const itemType = item.itemType || (item.targetMinTemp !== undefined ? "TEMPERATURE" : "STATUS");
        const min = item.targetMinTemp ?? item.targetMin;
        const max = item.targetMaxTemp ?? item.targetMax;
        let initialTemp = "";
        if (itemType === "TEMPERATURE" && min !== undefined && max !== undefined) {
          initialTemp = ((min + max) / 2).toFixed(1);
        }
        checkpoints[id] = {
          id,
          name: item.name || item.task || "Checkpoint",
          itemType,
          status: itemType === "CLEAN_DIRTY" ? "CLEAN" : "YES",
          value: item.targetValue !== undefined ? String(item.targetValue) : "",
          temp: initialTemp,
          time: item.defaultTime || "09:00",
          assignee: item.defaultAssignee || defaultStaff,
          notes: "",
          min,
          max,
          unit: item.unit || (itemType === "TEMPERATURE" ? "°C" : ""),
        };
      });
    });
    return { checkpoints };
  }

  if (category === "HOUSEKEEPING") {
    let items = sections.flatMap((s: any) =>
      (s.items || []).map((item: any) => ({
        id: item.id || `hk-${Math.random()}`,
        name: item.name || item.task || "Housekeeping Zone",
        status: "YES",
        cleanedBy: item.defaultAssignee || defaultStaff,
        time: item.defaultTime || "09:00",
      }))
    );
    if (!items.length) {
      items = [
        { id: "hk-1", name: "Main Kitchen & Prep Counter", status: "YES", cleanedBy: defaultStaff, time: "09:00" },
        { id: "hk-2", name: "Dishwashing & Sanitation Station", status: "YES", cleanedBy: defaultStaff, time: "09:30" },
        { id: "hk-3", name: "Storage & Walk-in Cooler Floors", status: "YES", cleanedBy: defaultStaff, time: "10:00" },
      ];
    }
    return { items };
  } else if (category === "EQUIPMENT") {
    let completedItems = sections.flatMap((s: any) =>
      (s.items || []).map((item: any) => ({
        id: item.id || `eq-${Math.random()}`,
        name: item.name || "Equipment Unit",
        category: item.category || s.title || "Kitchen Equipment",
        cleanedBy: item.defaultAssignee || defaultStaff,
        checkedBy: currentUserName || "Supervisor",
        status: "YES",
        time: item.defaultTime || "09:00",
      }))
    );
    if (!completedItems.length) {
      completedItems = [
        { id: "eq-1", name: "Deep Fryer Unit 1", category: "Hot Line", cleanedBy: defaultStaff, checkedBy: currentUserName || "Supervisor", status: "YES", time: "09:00" },
        { id: "eq-2", name: "Main Combi Oven", category: "Hot Line", cleanedBy: defaultStaff, checkedBy: currentUserName || "Supervisor", status: "YES", time: "09:15" },
      ];
    }
    return { completedItems };
  } else if (category === "TEMPERATURE") {
    let readings = sections.flatMap((s: any) =>
      (s.items || []).map((item: any) => {
        const min = item.targetMinTemp ?? 2;
        const max = item.targetMaxTemp ?? 8;
        const safeMid = ((min + max) / 2).toFixed(1);
        return {
          id: item.id || `temp-${Math.random()}`,
          name: item.name || "Refrigeration Unit",
          machineNumber: item.machineNumber || "",
          referenceTemp: item.referenceTemp || `${min}°C to ${max}°C`,
          morningTemp: safeMid,
          eveningTemp: safeMid,
          status: "NORMAL",
        };
      })
    );
    if (!readings.length) {
      readings = [
        { id: "temp-1", name: "Walk-in Meat Chiller", machineNumber: "1", referenceTemp: "+2°C to +4°C", morningTemp: "3.0", eveningTemp: "3.0", status: "NORMAL" },
        { id: "temp-2", name: "Dairy & Produce Cooler", machineNumber: "2", referenceTemp: "+2°C to +6°C", morningTemp: "4.0", eveningTemp: "4.0", status: "NORMAL" },
      ];
    }
    return { readings };
  } else if (category === "SAFETY_GLASS") {
    let locations = sections.flatMap((s: any) =>
      (s.items || []).map((item: any) => ({
        id: item.id || `sg-${Math.random()}`,
        location: item.name || item.location || "Glass Panel",
        status: "YES",
        cleanedBy: item.defaultAssignee || defaultStaff,
      }))
    );
    if (!locations.length) {
      locations = [
        { id: "sg-1", location: "Front Display Case Glass", status: "YES", cleanedBy: defaultStaff },
        { id: "sg-2", location: "Service Counter Sneeze Guard", status: "YES", cleanedBy: defaultStaff },
      ];
    }
    return { locations };
  } else if (category === "MAINTENANCE" || category === "CUSTOM") {
    let tasks = sections.flatMap((s: any) =>
      (s.items || []).map((item: any) => ({
        id: item.id || `maint-${Math.random()}`,
        task: item.name || item.task || "Maintenance Task",
        category: item.category || s.title || "Facility",
        completedBy: item.defaultAssignee || defaultStaff,
        status: "YES",
        notes: "",
      }))
    );
    if (!tasks.length) {
      tasks = [
        { id: "maint-1", task: "AC Filter Cleaning & Air Flow Check", category: "HVAC", completedBy: defaultStaff, status: "YES", notes: "" },
        { id: "maint-2", task: "Exhaust Hood Grease Filter Inspection", category: "Ventilation", completedBy: defaultStaff, status: "YES", notes: "" },
      ];
    }
    return { tasks };
  }
  return {};
}

  // Calculate Compliance Score
  const complianceScore = useMemo(() => {
    if (formData.checkpoints && Object.keys(formData.checkpoints).length > 0) {
      let total = 0;
      let valid = 0;
      Object.values(formData.checkpoints).forEach((cp: any) => {
        const type = cp.itemType || "STATUS";
        if (type === "STATUS") {
          if (cp.status === "NA" || cp.status === "N/A") return;
          total++;
          if (cp.status === "YES" || cp.status === "PASS" || cp.status === true) valid++;
        } else if (type === "CLEAN_DIRTY") {
          if (cp.status === "NA" || cp.status === "N/A") return;
          total++;
          if (cp.status === "CLEAN" || cp.status === "YES") valid++;
        } else if (type === "TEMPERATURE") {
          if (cp.temp === "NA" || cp.temp === "N/A" || !cp.temp) return;
          total++;
          const tVal = parseFloat(cp.temp);
          if (!isNaN(tVal)) {
            const min = cp.min ?? -20;
            const max = cp.max ?? 10;
            if (tVal >= min && tVal <= max) valid++;
          }
        } else if (type === "NUMERIC") {
          if (cp.value === "NA" || cp.value === "N/A" || cp.value === "") return;
          total++;
          const nVal = parseFloat(cp.value);
          if (!isNaN(nVal)) {
            const hasMin = cp.min !== undefined && cp.min !== null;
            const hasMax = cp.max !== undefined && cp.max !== null;
            if (hasMin && hasMax) {
              if (nVal >= cp.min && nVal <= cp.max) valid++;
            } else if (hasMin) {
              if (nVal >= cp.min) valid++;
            } else if (hasMax) {
              if (nVal <= cp.max) valid++;
            } else {
              valid++;
            }
          }
        }
      });
      return total === 0 ? 100 : Math.round((valid / total) * 100);
    }

    if (template.category === "TEMPERATURE") {
      const readings = formData.readings || [];
      if (!readings.length) return 100;
      let total = 0;
      let valid = 0;
      readings.forEach((r: any) => {
        if (r.morningTemp !== "" && r.morningTemp !== "N/A" && r.morningTemp !== "NA") {
          total++;
          if (r.status !== "BREACH") valid++;
        }
        if (r.eveningTemp !== "" && r.eveningTemp !== "N/A" && r.eveningTemp !== "NA") {
          total++;
          if (r.status !== "BREACH") valid++;
        }
      });
      return total === 0 ? 100 : Math.round((valid / total) * 100);
    }

    // Dynamic checklist items
    let allItems: any[] = [];
    if (template.category === "HOUSEKEEPING") {
      allItems = formData.items || [];
    } else if (template.category === "EQUIPMENT") {
      allItems = formData.completedItems || [];
    } else if (template.category === "SAFETY_GLASS") {
      allItems = formData.locations || [];
    } else if (template.category === "MAINTENANCE" || template.category === "CUSTOM") {
      allItems = formData.tasks || [];
    }

    if (!allItems.length) return 100;

    let yesCount = 0;
    let noCount = 0;
    allItems.forEach((it: any) => {
      const val =
        it.status !== undefined
          ? it.status
          : it.checked === true
          ? "YES"
          : it.checked === false
          ? "NO"
          : "YES";

      if (val === "YES" || val === "DONE" || val === "INTACT" || val === true) {
        yesCount++;
      } else if (val === "NO" || val === "PENDING" || val === "DAMAGED" || val === false) {
        noCount++;
      }
      // "NA" / "N/A" is excluded from the denominator so it does not penalize compliance
    });

    const scoredTotal = yesCount + noCount;
    if (scoredTotal === 0) return 100;
    return Math.round((yesCount / scoredTotal) * 100);
  }, [formData, template.category]);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const payload = {
        id: existingSubmissionId || undefined,
        outletId: outlet.id,
        templateId: template.id,
        date: selectedDate,
        shift: template.frequency === "SHIFT_WISE" ? selectedShift : "General",
        data: formData,
        comments,
        correctiveAction,
        supervisorName: supervisorName || currentUser.name,
        supervisorSigned,
        complianceScore,
        status: supervisorSigned ? "VERIFIED" : "SUBMITTED",
      };

      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        setMessage({
          type: "error",
          text: "Active Dodo Payments subscription required to submit reports. Upgrade to unlock.",
        });
        return;
      }
      if (!res.ok) throw new Error(json.error || "Save failed");

      setMessage({ type: "success", text: "Report submitted & saved successfully!" });
      if (json.submission?.id) {
        setExistingSubmissionId(json.submission.id);
      }
      router.refresh();
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save submission." });
    } finally {
      setSaving(false);
    }
  };

  const sections = parsedSchema?.sections || [];

  const isDynamicTemplate = useMemo(() => {
    if (formData.checkpoints && Object.keys(formData.checkpoints).length > 0) return true;
    const hasItemType = sections.some((s: any) =>
      (s.items || []).some((i: any) => i.itemType)
    );
    if (hasItemType) return true;
    const legacyCategories = ["HOUSEKEEPING", "EQUIPMENT", "TEMPERATURE", "SAFETY_GLASS"];
    return !legacyCategories.includes(template.category);
  }, [formData.checkpoints, sections, template.category]);

  return (
    <div className="dynamic-sheet-container">
      {/* Clean Minimal Header */}
      <div className="sheet-header-minimal">
        <div className="hidden sm:flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            ← Dashboard
          </button>
          <span className="text-xs font-semibold text-slate-500">
            {outlet.name}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              {template.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-sm"
            />
            {availableShifts.length > 1 && (
              <select
                value={selectedShift}
                onChange={(e) => setSelectedShift(e.target.value)}
                className="text-xs font-medium bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 shadow-sm"
              >
                {availableShifts.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      {message && (
        <div className={`notification-toast ${message.type}`}>
          <span>{message.type === "success" ? "✓" : "⚠️"}</span>
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="toast-close">
            ✕
          </button>
        </div>
      )}

      {loading ? (
        <div className="loading-card">
          <div className="spinner" />
          <p>Loading audit checklist & historical data...</p>
        </div>
      ) : (
        <div className="sheet-body-content">
          {/* 0. UNIVERSAL DYNAMIC CHECKLIST (Custom report tabs, custom categories, or typed items) */}
          {isDynamicTemplate && (
            <div className="sections-grid">
              {sections.map((sec: any) => {
                const secItems = sec.items || [];
                return (
                  <div key={sec.id} className="checklist-section-card">
                    <div className="checklist-section-header">
                      <div>
                        <h2 className="checklist-section-title">{sec.title}</h2>
                        <span className="checklist-section-count">{secItems.length} checkpoints</span>
                      </div>
                      <div className="checklist-batch-actions">
                        <button
                          type="button"
                          className="batch-btn pass"
                          onClick={() => {
                            const updatedCheckpoints = { ...(formData.checkpoints || {}) };
                            secItems.forEach((it: any) => {
                              const cp = updatedCheckpoints[it.id] || {
                                id: it.id,
                                name: it.name || it.task,
                                itemType: it.itemType || "STATUS",
                              };
                              const type = cp.itemType || it.itemType || "STATUS";
                              const min = cp.min ?? it.targetMinTemp ?? it.targetMin;
                              const max = cp.max ?? it.targetMaxTemp ?? it.targetMax;

                              if (type === "CLEAN_DIRTY") cp.status = "CLEAN";
                              else if (type === "STATUS") cp.status = "YES";
                              else if (type === "TEMPERATURE" && min !== undefined && max !== undefined) {
                                cp.temp = ((min + max) / 2).toFixed(1);
                              } else if (type === "NUMERIC" && it.targetValue !== undefined) {
                                cp.value = String(it.targetValue);
                              }
                              updatedCheckpoints[it.id] = cp;
                            });
                            setFormData({ ...formData, checkpoints: updatedCheckpoints });
                          }}
                        >
                          All Pass
                        </button>
                        <button
                          type="button"
                          className="batch-btn na"
                          onClick={() => {
                            const updatedCheckpoints = { ...(formData.checkpoints || {}) };
                            secItems.forEach((it: any) => {
                              const cp = updatedCheckpoints[it.id] || {
                                id: it.id,
                                name: it.name || it.task,
                                itemType: it.itemType || "STATUS",
                              };
                              cp.status = "NA";
                              if (cp.itemType === "TEMPERATURE") cp.temp = "N/A";
                              if (cp.itemType === "NUMERIC") cp.value = "N/A";
                              updatedCheckpoints[it.id] = cp;
                            });
                            setFormData({ ...formData, checkpoints: updatedCheckpoints });
                          }}
                        >
                          All N/A
                        </button>
                        <button
                          type="button"
                          className="batch-btn fail"
                          onClick={() => {
                            const updatedCheckpoints = { ...(formData.checkpoints || {}) };
                            secItems.forEach((it: any) => {
                              const cp = updatedCheckpoints[it.id] || {
                                id: it.id,
                                name: it.name || it.task,
                                itemType: it.itemType || "STATUS",
                              };
                              if (cp.itemType === "CLEAN_DIRTY") cp.status = "DIRTY";
                              else cp.status = "NO";
                              updatedCheckpoints[it.id] = cp;
                            });
                            setFormData({ ...formData, checkpoints: updatedCheckpoints });
                          }}
                        >
                          All Fail
                        </button>
                      </div>
                    </div>

                    <div className="checklist-items-stack">
                      {secItems.map((item: any, idx: number) => {
                        const itemType = item.itemType || (item.targetMinTemp !== undefined ? "TEMPERATURE" : "STATUS");
                        const min = item.targetMinTemp ?? item.targetMin;
                        const max = item.targetMaxTemp ?? item.targetMax;
                        const unit = item.unit || (itemType === "TEMPERATURE" ? "°C" : "");

                        const cp = (formData.checkpoints && formData.checkpoints[item.id]) || {
                          id: item.id,
                          name: item.name || item.task,
                          itemType,
                          status: itemType === "CLEAN_DIRTY" ? "CLEAN" : "YES",
                          value: item.targetValue !== undefined ? String(item.targetValue) : "",
                          temp: itemType === "TEMPERATURE" && min !== undefined && max !== undefined ? ((min + max) / 2).toFixed(1) : "",
                          time: item.defaultTime || "09:00",
                          assignee: item.defaultAssignee || availableStaff[0] || "Staff Member",
                          notes: "",
                          min,
                          max,
                          unit,
                        };

                        const updateCp = (changes: any) => {
                          setFormData({
                            ...formData,
                            checkpoints: {
                              ...(formData.checkpoints || {}),
                              [item.id]: { ...cp, ...changes },
                            },
                          });
                        };

                        const isBreach =
                          itemType === "TEMPERATURE" &&
                          cp.temp &&
                          cp.temp !== "N/A" &&
                          !isNaN(parseFloat(cp.temp)) &&
                          ((min !== undefined && parseFloat(cp.temp) < min) || (max !== undefined && parseFloat(cp.temp) > max));

                        return (
                          <div key={item.id || idx} className={`checkpoint-card ${isBreach ? "card-breach" : ""}`}>
                            <div className="checkpoint-card-top">
                              <div className="checkpoint-name">{item.name || item.task}</div>
                              {item.hint && <div className="checkpoint-hint">{item.hint}</div>}
                              {(min !== undefined || max !== undefined) && (
                                <span className="checkpoint-safe-badge">
                                  Safe: {min !== undefined ? `${min}` : "-∞"} to {max !== undefined ? `${max}` : "+∞"} {unit}
                                </span>
                              )}
                            </div>

                            <div className="checkpoint-action-row">
                              {itemType === "TEMPERATURE" && (
                                <div className="temp-control-wrap">
                                  <TouchTempSelect
                                    value={cp.temp}
                                    min={min ?? -20}
                                    max={max ?? 10}
                                    onChange={(val) => updateCp({ temp: val })}
                                  />
                                  {cp.temp && cp.temp !== "N/A" && (
                                    <span className={!isBreach ? "optimal-tag" : "breach-tag"}>
                                      {!isBreach ? "✓ In Spec" : "⚠️ Breach"}
                                    </span>
                                  )}
                                </div>
                              )}

                              {itemType === "NUMERIC" && (
                                <div className="numeric-control-wrap">
                                  <input
                                    type="number"
                                    step="any"
                                    value={cp.value ?? ""}
                                    placeholder={`Value (${unit || "qty"})`}
                                    onChange={(e) => updateCp({ value: e.target.value })}
                                    className="control-input"
                                  />
                                  {unit && <span className="text-xs font-semibold text-slate-500">{unit}</span>}
                                  <button
                                    type="button"
                                    className={`na-toggle-btn ${cp.value === "N/A" ? "active" : ""}`}
                                    onClick={() => updateCp({ value: cp.value === "N/A" ? "" : "N/A" })}
                                  >
                                    N/A
                                  </button>
                                </div>
                              )}

                              {itemType === "CLEAN_DIRTY" && (
                                <CleanDirtyNaToggle
                                  value={cp.status}
                                  onChange={(val) => updateCp({ status: val })}
                                />
                              )}

                              {itemType === "STATUS" && (
                                <YesNoNaToggle
                                  value={cp.status}
                                  onChange={(val) => updateCp({ status: val })}
                                />
                              )}

                              {itemType === "TEXT" && (
                                <input
                                  type="text"
                                  value={cp.value || ""}
                                  placeholder="Observation or remark..."
                                  onChange={(e) => updateCp({ value: e.target.value })}
                                  className="control-input w-full"
                                />
                              )}
                            </div>

                            {(cp.status === "NO" || cp.status === "DIRTY" || isBreach || cp.notes) && (
                              <div className="checkpoint-note-box">
                                <input
                                  type="text"
                                  value={cp.notes || ""}
                                  placeholder="Observation or corrective action..."
                                  onChange={(e) => updateCp({ notes: e.target.value })}
                                  className="checkpoint-note-input"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 1. HOUSEKEEPING / MULTI-SHIFT CHECKLIST */}
          {!isDynamicTemplate && template.category === "HOUSEKEEPING" && (
            <div className="checklist-section-card">
              <div className="checklist-section-header">
                <div>
                  <h2 className="checklist-section-title">{sections[0]?.title || "Housekeeping & Sanitization"}</h2>
                  <span className="checklist-section-count">{(formData.items || []).length} checkpoints</span>
                </div>
                <div className="checklist-batch-actions">
                  <button
                    type="button"
                    className="batch-btn pass"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: (formData.items || []).map((i: any) => ({ ...i, status: "YES" })),
                      });
                    }}
                  >
                    All Pass
                  </button>
                  <button
                    type="button"
                    className="batch-btn na"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: (formData.items || []).map((i: any) => ({ ...i, status: "NA" })),
                      });
                    }}
                  >
                    All N/A
                  </button>
                </div>
              </div>

              <div className="checklist-items-stack">
                {(formData.items || []).map((item: any, idx: number) => (
                  <div key={item.id || idx} className="checkpoint-card">
                    <div className="checkpoint-card-top">
                      <span className="checkpoint-name">{item.name}</span>
                      <div className="checkpoint-action-row">
                        <YesNoNaToggle
                          value={item.status}
                          onChange={(val) => {
                            const newItems = [...(formData.items || [])];
                            newItems[idx] = { ...item, status: val };
                            setFormData({ ...formData, items: newItems });
                          }}
                        />
                      </div>
                    </div>
                    {(item.status === "NO" || item.notes) && (
                      <div className="checkpoint-note-box">
                        <input
                          type="text"
                          value={item.notes || ""}
                          placeholder="Observation or corrective note..."
                          onChange={(e) => {
                            const newItems = [...(formData.items || [])];
                            newItems[idx] = { ...item, notes: e.target.value };
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="checkpoint-note-input"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. EQUIPMENT SANITIZATION */}
          {!isDynamicTemplate && template.category === "EQUIPMENT" && (
            <div className="sections-grid">
              {sections.map((sec: any) => {
                const secItems = (formData.completedItems || []).filter((ci: any) =>
                  (sec.items || []).some((i: any) => i.id === ci.id || i.name === ci.name)
                );
                return (
                  <div key={sec.id} className="checklist-section-card">
                    <div className="checklist-section-header">
                      <div>
                        <h2 className="checklist-section-title">{sec.title}</h2>
                        <span className="checklist-section-count">{secItems.length} units</span>
                      </div>
                      <div className="checklist-batch-actions">
                        <button
                          type="button"
                          className="batch-btn pass"
                          onClick={() => {
                            const updated = (formData.completedItems || []).map((ci: any) => {
                              if ((sec.items || []).some((i: any) => i.id === ci.id || i.name === ci.name)) {
                                return { ...ci, status: "YES" };
                              }
                              return ci;
                            });
                            setFormData({ ...formData, completedItems: updated });
                          }}
                        >
                          All Pass
                        </button>
                        <button
                          type="button"
                          className="batch-btn na"
                          onClick={() => {
                            const updated = (formData.completedItems || []).map((ci: any) => {
                              if ((sec.items || []).some((i: any) => i.id === ci.id || i.name === ci.name)) {
                                return { ...ci, status: "NA" };
                              }
                              return ci;
                            });
                            setFormData({ ...formData, completedItems: updated });
                          }}
                        >
                          All N/A
                        </button>
                      </div>
                    </div>

                    <div className="checklist-items-stack">
                      {secItems.map((ci: any, idx: number) => {
                        const globalIdx = (formData.completedItems || []).findIndex(
                          (x: any) => x.id === ci.id
                        );
                        return (
                          <div key={ci.id || idx} className="checkpoint-card">
                            <div className="checkpoint-card-top">
                              <span className="checkpoint-name">{ci.name}</span>
                              <div className="checkpoint-action-row">
                                <YesNoNaToggle
                                  value={ci.status}
                                  onChange={(val) => {
                                    const newItems = [...formData.completedItems];
                                    newItems[globalIdx] = { ...ci, status: val };
                                    setFormData({ ...formData, completedItems: newItems });
                                  }}
                                />
                              </div>
                            </div>
                            {(ci.status === "NO" || ci.notes) && (
                              <div className="checkpoint-note-box">
                                <input
                                  type="text"
                                  value={ci.notes || ""}
                                  placeholder="Observation or corrective note..."
                                  onChange={(e) => {
                                    const newItems = [...formData.completedItems];
                                    newItems[globalIdx] = { ...ci, notes: e.target.value };
                                    setFormData({ ...formData, completedItems: newItems });
                                  }}
                                  className="checkpoint-note-input"
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 3. TEMPERATURE & COLD CHAIN LOG */}
          {!isDynamicTemplate && template.category === "TEMPERATURE" && (
            <div className="checklist-section-card">
              <div className="checklist-section-header">
                <div>
                  <h2 className="checklist-section-title">Cold Storage & Refrigeration</h2>
                  <span className="checklist-section-count">{(formData.readings || []).length} units</span>
                </div>
                <div className="checklist-batch-actions">
                  <button
                    type="button"
                    className="batch-btn pass"
                    onClick={() => {
                      const updated = (formData.readings || []).map((reading: any) => {
                        const schemaItem = sections
                          .flatMap((s: any) => s.items || [])
                          .find((i: any) => i.id === reading.id || i.name === reading.name);
                        const min = schemaItem?.targetMinTemp ?? 2;
                        const max = schemaItem?.targetMaxTemp ?? 8;
                        const safeMid = ((min + max) / 2).toFixed(1);
                        return {
                          ...reading,
                          morningTemp: safeMid,
                          eveningTemp: safeMid,
                        };
                      });
                      setFormData({ ...formData, readings: updated });
                    }}
                  >
                    All Safe
                  </button>
                  <button
                    type="button"
                    className="batch-btn na"
                    onClick={() => {
                      const updated = (formData.readings || []).map((reading: any) => ({
                        ...reading,
                        morningTemp: "N/A",
                        eveningTemp: "N/A",
                      }));
                      setFormData({ ...formData, readings: updated });
                    }}
                  >
                    All N/A
                  </button>
                </div>
              </div>

              <div className="checklist-items-stack">
                {(formData.readings || []).map((reading: any, idx: number) => {
                  const schemaItem = sections
                    .flatMap((s: any) => s.items || [])
                    .find((i: any) => i.id === reading.id || i.name === reading.name);
                  const min = schemaItem?.targetMinTemp ?? -20;
                  const max = schemaItem?.targetMaxTemp ?? 10;
                  const mNum = parseFloat(reading.morningTemp);
                  const eNum = parseFloat(reading.eveningTemp);
                  const isBreach =
                    (!isNaN(mNum) && (mNum < min || mNum > max)) ||
                    (!isNaN(eNum) && (eNum < min || eNum > max));

                  return (
                    <div key={reading.id || idx} className={`checkpoint-card ${isBreach ? "card-breach" : ""}`}>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div>
                          <span className="checkpoint-name">{reading.name}</span>
                          {reading.machineNumber && (
                            <span className="text-[11px] text-slate-400 font-medium ml-1.5">
                              #{reading.machineNumber}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                          {reading.referenceTemp || `${min}°C to ${max}°C`}
                        </span>
                      </div>

                      <div className="temp-slots-grid">
                        <div className="temp-slot">
                          <span className="temp-slot-label">Morning</span>
                          <TouchTempSelect
                            value={reading.morningTemp}
                            min={min}
                            max={max}
                            onChange={(val) => {
                              const newReadings = [...(formData.readings || [])];
                              newReadings[idx] = { ...reading, morningTemp: val };
                              setFormData({ ...formData, readings: newReadings });
                            }}
                          />
                        </div>
                        <div className="temp-slot">
                          <span className="temp-slot-label">Evening</span>
                          <TouchTempSelect
                            value={reading.eveningTemp}
                            min={min}
                            max={max}
                            onChange={(val) => {
                              const newReadings = [...(formData.readings || [])];
                              newReadings[idx] = { ...reading, eveningTemp: val };
                              setFormData({ ...formData, readings: newReadings });
                            }}
                          />
                        </div>
                      </div>

                      {isBreach && (
                        <div className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
                          ⚠️ Temperature Breach: Out of safe tolerance ({min}°C to {max}°C)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. SAFETY GLASS / PEST / FACILITY */}
          {!isDynamicTemplate && template.category === "SAFETY_GLASS" && (
            <div className="checklist-section-card">
              <div className="checklist-section-header">
                <div>
                  <h2 className="checklist-section-title">Safety & Structural Inspection</h2>
                  <span className="checklist-section-count">{(formData.locations || []).length} checkpoints</span>
                </div>
                <div className="checklist-batch-actions">
                  <button
                    type="button"
                    className="batch-btn pass"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        locations: (formData.locations || []).map((l: any) => ({ ...l, status: "YES" })),
                      });
                    }}
                  >
                    All Pass
                  </button>
                  <button
                    type="button"
                    className="batch-btn na"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        locations: (formData.locations || []).map((l: any) => ({ ...l, status: "NA" })),
                      });
                    }}
                  >
                    All N/A
                  </button>
                </div>
              </div>

              <div className="checklist-items-stack">
                {(formData.locations || []).map((loc: any, idx: number) => (
                  <div key={loc.id || idx} className="checkpoint-card">
                    <div className="checkpoint-card-top">
                      <span className="checkpoint-name">{loc.location}</span>
                      <div className="checkpoint-action-row">
                        <YesNoNaToggle
                          value={loc.status}
                          onChange={(val) => {
                            const newLocs = [...(formData.locations || [])];
                            newLocs[idx] = { ...loc, status: val };
                            setFormData({ ...formData, locations: newLocs });
                          }}
                        />
                      </div>
                    </div>
                    {(loc.status === "NO" || loc.notes) && (
                      <div className="checkpoint-note-box">
                        <input
                          type="text"
                          value={loc.notes || ""}
                          placeholder="Observation or corrective note..."
                          onChange={(e) => {
                            const newLocs = [...(formData.locations || [])];
                            newLocs[idx] = { ...loc, notes: e.target.value };
                            setFormData({ ...formData, locations: newLocs });
                          }}
                          className="checkpoint-note-input"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. MONTHLY MAINTENANCE & CUSTOM */}
          {!isDynamicTemplate && (template.category === "MAINTENANCE" || template.category === "CUSTOM") && (
            <div className="checklist-section-card">
              <div className="checklist-section-header">
                <div>
                  <h2 className="checklist-section-title">Periodic & Maintenance Tasks</h2>
                  <span className="checklist-section-count">{(formData.tasks || []).length} tasks</span>
                </div>
                <div className="checklist-batch-actions">
                  <button
                    type="button"
                    className="batch-btn pass"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        tasks: (formData.tasks || []).map((t: any) => ({ ...t, status: "YES" })),
                      });
                    }}
                  >
                    All Pass
                  </button>
                  <button
                    type="button"
                    className="batch-btn na"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        tasks: (formData.tasks || []).map((t: any) => ({ ...t, status: "NA" })),
                      });
                    }}
                  >
                    All N/A
                  </button>
                </div>
              </div>

              <div className="checklist-items-stack">
                {(formData.tasks || []).map((task: any, idx: number) => (
                  <div key={task.id || idx} className="checkpoint-card">
                    <div className="checkpoint-card-top">
                      <div>
                        <span className="checkpoint-name">{task.task}</span>
                        {task.category && (
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded ml-2">
                            {task.category}
                          </span>
                        )}
                      </div>
                      <div className="checkpoint-action-row">
                        <YesNoNaToggle
                          value={task.status}
                          onChange={(val) => {
                            const newTasks = [...(formData.tasks || [])];
                            newTasks[idx] = { ...task, status: val };
                            setFormData({ ...formData, tasks: newTasks });
                          }}
                        />
                      </div>
                    </div>
                    {(task.status === "NO" || task.notes) && (
                      <div className="checkpoint-note-box">
                        <input
                          type="text"
                          value={task.notes || ""}
                          placeholder="Observation or corrective note..."
                          onChange={(e) => {
                            const newTasks = [...(formData.tasks || [])];
                            newTasks[idx] = { ...task, notes: e.target.value };
                            setFormData({ ...formData, tasks: newTasks });
                          }}
                          className="checkpoint-note-input"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Minimal Shift Notes & Verification */}
          <div className="audit-footer-clean">
            <div className="footer-notes-box">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1 block">
                Shift Notes (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add shift observations or handover remarks..."
                rows={2}
                className="footer-textarea-clean"
              />
            </div>

            <div className="footer-signoff-row">
              <label className="signoff-checkbox-label">
                <input
                  type="checkbox"
                  id="signoff-checkbox"
                  checked={supervisorSigned}
                  onChange={(e) => setSupervisorSigned(e.target.checked)}
                  className="custom-checkbox"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Verified by {supervisorName || currentUser.name}
                </span>
              </label>
            </div>
          </div>

          {/* Sticky Bottom Save Action Bar */}
          <div className="sticky-action-bar">
            <div className="action-bar-inner">
              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="dot-live" />
                <span>
                  {existingSubmissionId ? "Saved Record" : "New Entry"} • {selectedDate}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="btn-primary-save"
              >
                {saving ? "Saving..." : existingSubmissionId ? "Update Submission" : "Submit Checklist"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Active Subscription Required"
        description="Your organization is currently on the Free Preview tier. To record official shift reports and submit inspection audits, activate your OVYRO FDA subscription via Dodo Payments."
      />
    </div>
  );
}
