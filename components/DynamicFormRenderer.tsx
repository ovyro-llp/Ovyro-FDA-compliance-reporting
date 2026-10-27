"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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

  // Dual View & Staff Configuration State
  const canEditTemplate = useMemo(() => {
    return ["ORG_ADMIN", "SUPER_ADMIN", "ADMIN", "SUPERVISOR", "MANAGER"].includes(currentUser?.role);
  }, [currentUser?.role]);

  const [viewMode, setViewMode] = useState<"AUDIT" | "ADMIN">("AUDIT");
  const [editableSchema, setEditableSchema] = useState<any>(parsedSchema);
  const [allStaffList, setAllStaffList] = useState<string[]>(availableStaff);
  const [isSavingSchema, setIsSavingSchema] = useState<boolean>(false);
  const [newCleanerName, setNewCleanerName] = useState<string>("");
  const [newCleanerRole, setNewCleanerRole] = useState<string>("Kitchen Steward");

  useEffect(() => {
    setEditableSchema(parsedSchema);
  }, [parsedSchema]);

  const handleAddGroundStaff = async () => {
    const clean = newCleanerName.trim();
    if (!clean) {
      setMessage({ type: "error", text: "Please enter a staff or cleaner name." });
      return;
    }
    try {
      const res = await fetch("/api/admin/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clean, role: newCleanerRole.trim() || "Staff Member" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402 || data.paywall) {
        setShowPaywall(true);
        setMessage({ type: "error", text: "Active Dodo Payments subscription required to add ground staff." });
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Failed to add ground staff");
      }
      setAllStaffList((prev) => (prev.includes(clean) ? prev : [...prev, clean]));
      setNewCleanerName("");
      setMessage({ type: "success", text: `Added "${clean}" to cleaning roster.` });
      router.refresh();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message || "Failed to add ground staff" });
    }
  };

  const handleSaveSchema = async () => {
    setIsSavingSchema(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/templates/${template.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema: editableSchema }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save template configuration");

      setMessage({ type: "success", text: "Staff assignments & template configuration saved successfully!" });
      router.refresh();
      setViewMode("AUDIT");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to save configuration" });
    } finally {
      setIsSavingSchema(false);
    }
  };

  function getEligibleStaffForItem(item: any, sec?: any) {
    if (item?.assignedStaff && Array.isArray(item.assignedStaff) && item.assignedStaff.length > 0) {
      return item.assignedStaff;
    }
    if (sec?.assignedStaff && Array.isArray(sec.assignedStaff) && sec.assignedStaff.length > 0) {
      return sec.assignedStaff;
    }
    return allStaffList.length > 0 ? allStaffList : ["Staff Member"];
  }

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
  min = 2,
  max = 8,
  onChange,
}: {
  value?: string;
  min?: number;
  max?: number;
  onChange: (val: string) => void;
}) {
  const [isCustomMode, setIsCustomMode] = useState(false);
  const isNa = value === "N/A" || value === "NA";
  const numVal = parseFloat(value || "");

  const safeMin = Math.min(min ?? 2, max ?? 8);
  const safeMax = Math.max(min ?? 2, max ?? 8);
  const isBreach = !isNa && !isNaN(numVal) && (numVal < safeMin || numVal > safeMax);
  const isSafe = !isNa && !isNaN(numVal) && numVal >= safeMin && numVal <= safeMax;

  const span = safeMax - safeMin;
  let step = 1;
  if (span <= 4) step = 0.5;
  else if (span <= 20) step = 1;
  else if (span <= 50) step = 2;
  else step = 5;

  const formatDec = (n: number) => {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  };

  const safeOptions: Array<{ val: string; num: number; label: string }> = [];
  const mid = Math.round(((safeMin + safeMax) / 2) * 10) / 10;

  for (let t = safeMin; t <= safeMax + 0.0001; t += step) {
    const rounded = Math.round(t * 10) / 10;
    const signStr = rounded > 0 ? `+${formatDec(rounded)}` : `${formatDec(rounded)}`;
    let tag = "";
    if (Math.abs(rounded - safeMin) < 0.001) tag = " (Min Safe)";
    else if (Math.abs(rounded - safeMax) < 0.001) tag = " (Max Safe)";
    else if (Math.abs(rounded - mid) < 0.001) tag = " (Optimal)";

    safeOptions.push({
      val: formatDec(rounded),
      num: rounded,
      label: `${signStr}°C${tag}`,
    });
  }

  // Warning/breach options just outside range
  const breachOptions: Array<{ val: string; num: number; label: string }> = [];
  for (let i = 2; i >= 1; i--) {
    const bVal = Math.round((safeMin - i * step) * 10) / 10;
    const signStr = bVal > 0 ? `+${formatDec(bVal)}` : `${formatDec(bVal)}`;
    breachOptions.push({
      val: formatDec(bVal),
      num: bVal,
      label: `⚠️ ${signStr}°C (Critical Cold)`,
    });
  }
  for (let i = 1; i <= 2; i++) {
    const bVal = Math.round((safeMax + i * step) * 10) / 10;
    const signStr = bVal > 0 ? `+${formatDec(bVal)}` : `${formatDec(bVal)}`;
    breachOptions.push({
      val: formatDec(bVal),
      num: bVal,
      label: `⚠️ ${signStr}°C (Critical Warm)`,
    });
  }

  const allKnown = [...safeOptions, ...breachOptions];
  const matchedOpt = !isNa && value !== "" && value !== undefined
    ? allKnown.find((opt) => Math.abs(opt.num - numVal) < 0.05)
    : null;

  const currentSelectVal = isNa ? "NA" : (isCustomMode || (value && !matchedOpt) ? "CUSTOM" : (matchedOpt ? matchedOpt.val : ""));

  return (
    <div className="notion-temp-wrap">
      <div className={`notion-temp-box ${isBreach ? "breach" : isSafe ? "safe" : ""}`}>
        {isCustomMode || (value && !matchedOpt && !isNa && value !== "") ? (
          <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "4px" }}>
            <input
              type="number"
              step="any"
              placeholder={`${safeMin} to ${safeMax}`}
              value={isNa ? "" : (value ?? "")}
              disabled={isNa}
              onChange={(e) => onChange(e.target.value)}
              className="notion-temp-input"
              autoFocus
            />
            <span className="notion-temp-unit">°C</span>
            <button
              type="button"
              onClick={() => {
                setIsCustomMode(false);
                if (!matchedOpt && safeOptions.length > 0) {
                  onChange(safeOptions[Math.floor(safeOptions.length / 2)].val);
                }
              }}
              title="Switch back to dropdown selection"
              style={{
                border: "none",
                background: "transparent",
                color: "#7D7A75",
                fontSize: "12px",
                cursor: "pointer",
                padding: "2px 4px",
                whiteSpace: "nowrap",
              }}
            >
              ▼ Dropdown
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
            <select
              value={currentSelectVal}
              disabled={isNa}
              onChange={(e) => {
                const sel = e.target.value;
                if (sel === "NA") {
                  onChange("N/A");
                } else if (sel === "CUSTOM") {
                  setIsCustomMode(true);
                } else {
                  setIsCustomMode(false);
                  onChange(sel);
                }
              }}
              className="notion-temp-select"
            >
              <option value="" disabled>
                Choose Temp ({safeMin > 0 ? `+${safeMin}` : safeMin}°C to {safeMax > 0 ? `+${safeMax}` : safeMax}°C)...
              </option>
              <optgroup label="✅ Safe Range (Click to Select)">
                {safeOptions.map((opt) => (
                  <option key={opt.val} value={opt.val}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <optgroup label="⚠️ Critical Breach (Out of Range)">
                {breachOptions.map((opt) => (
                  <option key={opt.val} value={opt.val}>
                    {opt.label}
                  </option>
                ))}
              </optgroup>
              <option value="CUSTOM">✏️ Custom Reading (Type manually)...</option>
              <option value="NA">— Not In Use / N/A</option>
            </select>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          if (isNa) {
            setIsCustomMode(false);
            const defaultMid = safeOptions[Math.floor(safeOptions.length / 2)]?.val || "0";
            onChange(defaultMid);
          } else {
            onChange("N/A");
          }
        }}
        className={`notion-temp-na-btn ${isNa ? "active" : ""}`}
        title="Toggle N/A"
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
    <div className="notion-toggle-group">
      <button
        type="button"
        onClick={() => onChange("CLEAN")}
        className={`notion-toggle-btn ${current === "CLEAN" ? "active-pass" : ""}`}
      >
        Clean
      </button>
      <button
        type="button"
        onClick={() => onChange("DIRTY")}
        className={`notion-toggle-btn ${current === "DIRTY" ? "active-fail" : ""}`}
      >
        Needs Attn
      </button>
      <button
        type="button"
        onClick={() => onChange("NA")}
        className={`notion-toggle-btn ${current === "NA" ? "active-na" : ""}`}
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
    <div className="notion-toggle-group">
      <button
        type="button"
        onClick={() => onChange("YES")}
        className={`notion-toggle-btn ${current === "YES" ? "active-pass" : ""}`}
      >
        Pass
      </button>
      <button
        type="button"
        onClick={() => onChange("NO")}
        className={`notion-toggle-btn ${current === "NO" ? "active-fail" : ""}`}
      >
        Fail
      </button>
      <button
        type="button"
        onClick={() => onChange("NA")}
        className={`notion-toggle-btn ${current === "NA" ? "active-na" : ""}`}
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
      {/* ─── Notion Document Header & Breadcrumb ───────────────────────────── */}
      <div className="notion-doc-header">
        <div className="notion-doc-breadcrumb">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Image
              src="/logo.png"
              alt="OVYRO"
              width={16}
              height={16}
              className="w-4 h-4 object-contain inline-block"
            />
            <span>Workspace</span>
          </button>
          <span className="notion-doc-breadcrumb-sep">/</span>
          <span>{outlet.name}</span>
          <span className="notion-doc-breadcrumb-sep">/</span>
          <span className="active">{template.title}</span>
        </div>

        <div className="notion-doc-title-row">
          <span className="notion-doc-icon">{template.icon || "📋"}</span>
          <h1 className="notion-doc-title">{template.title}</h1>
        </div>

        <div className="notion-doc-meta-bar">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="notion-doc-input"
          />
          {availableShifts.length > 1 && (
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="notion-doc-select"
            >
              {availableShifts.map((s: string) => (
                <option key={s} value={s}>
                  {s} Shift
                </option>
              ))}
            </select>
          )}
          <span className={`notion-score-tag ${complianceScore === 100 ? "" : "warning"}`}>
            {complianceScore}% Score
          </span>
        </div>
      </div>

      {/* ─── Notion Callout Toast Notification ─────────────────────────────── */}
      {message && (
        <div className={`notion-callout ${message.type === "success" ? "green" : "red"}`} style={{ marginBottom: '16px' }}>
          <span className="notion-callout-icon">{message.type === "success" ? "✅" : "⚠️"}</span>
          <div style={{ flex: 1, fontWeight: 500 }}>{message.text}</div>
          <button
            type="button"
            onClick={() => setMessage(null)}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#7D7A75', fontSize: '14px', padding: '0 4px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─── Dual View Switcher (Audit View vs Admin/Edit View) ───────────────── */}
      {canEditTemplate && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div className="notion-view-switcher" style={{ marginBottom: 0 }}>
            <button
              type="button"
              className={`notion-view-btn ${viewMode === "AUDIT" ? "active" : ""}`}
              onClick={() => setViewMode("AUDIT")}
            >
              📝 Audit & Reporting View
            </button>
            <button
              type="button"
              className={`notion-view-btn ${viewMode === "ADMIN" ? "active" : ""}`}
              onClick={() => setViewMode("ADMIN")}
            >
              ⚙️ Edit / Assign Staff View
            </button>
          </div>
          {viewMode === "ADMIN" && (
            <button
              type="button"
              onClick={handleSaveSchema}
              disabled={isSavingSchema}
              className="notion-save-button"
              style={{ width: "auto", padding: "6px 16px", fontSize: "12.5px" }}
            >
              {isSavingSchema ? "Saving..." : "💾 Save Staff Assignments"}
            </button>
          )}
        </div>
      )}

      {viewMode === "ADMIN" ? (
        <div className="notion-admin-editor-wrap">
          {/* Ground Staff Roster & Inline Add */}
          <div className="notion-admin-section-card">
            <div className="notion-admin-section-header">
              <div>
                <h3 className="notion-admin-section-title">👥 Ground Staff Roster ({allStaffList.length} members)</h3>
                <span style={{ fontSize: "12px", color: "#7D7A75" }}>
                  Active team members and floor cleaners available to be assigned to checklist tasks
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
              <input
                type="text"
                value={newCleanerName}
                onChange={(e) => setNewCleanerName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddGroundStaff();
                  }
                }}
                placeholder="New Cleaner / Staff Name (e.g. Ramesh Kumar)"
                className="notion-input"
                style={{ flex: 1, minWidth: "180px" }}
              />
              <input
                type="text"
                value={newCleanerRole}
                onChange={(e) => setNewCleanerRole(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddGroundStaff();
                  }
                }}
                placeholder="Role (e.g. Kitchen Steward)"
                className="notion-input"
                style={{ width: "180px" }}
              />
              <button
                type="button"
                onClick={handleAddGroundStaff}
                className="notion-preset-pill"
                style={{ padding: "8px 14px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}
              >
                + Add Ground Staff
              </button>
            </div>

            <div className="notion-staff-pill-wrap">
              {allStaffList.map((st) => (
                <span key={st} className="notion-shift-chip">
                  👤 {st}
                </span>
              ))}
            </div>
          </div>

          {/* Section & Checkpoint Staff Assignment Editor */}
          {(editableSchema.sections || []).map((sec: any, secIdx: number) => {
            const secItems = sec.items || [];
            const secStaff: string[] = Array.isArray(sec.assignedStaff) ? sec.assignedStaff : [];

            const toggleSectionStaff = (staffName: string) => {
              const updatedSections = [...(editableSchema.sections || [])];
              const current = [...secStaff];
              const next = current.includes(staffName)
                ? current.filter((s) => s !== staffName)
                : [...current, staffName];
              updatedSections[secIdx] = { ...sec, assignedStaff: next };
              setEditableSchema({ ...editableSchema, sections: updatedSections });
            };

            return (
              <div key={sec.id || secIdx} className="notion-admin-section-card">
                <div className="notion-admin-section-header">
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <input
                      type="text"
                      value={sec.title}
                      onChange={(e) => {
                        const updatedSections = [...editableSchema.sections];
                        updatedSections[secIdx] = { ...sec, title: e.target.value };
                        setEditableSchema({ ...editableSchema, sections: updatedSections });
                      }}
                      className="notion-input"
                      style={{ fontWeight: 650, fontSize: "15px" }}
                    />
                  </div>
                  <span style={{ fontSize: "12px", color: "#7D7A75" }}>
                    {secItems.length} checkpoints
                  </span>
                </div>

                <div style={{ marginBottom: "14px", background: "#F7F6F3", padding: "10px 12px", borderRadius: "6px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#7D7A75", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                    Section Default Staff Pool (Visible for all items in this section):
                  </span>
                  <div className="notion-staff-pill-wrap">
                    {allStaffList.map((st) => {
                      const isSelected = secStaff.includes(st);
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => toggleSectionStaff(st)}
                          className={`notion-staff-pill ${isSelected ? "active" : ""}`}
                        >
                          {isSelected ? "✓" : "+"} {st}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  {secItems.map((item: any, itIdx: number) => {
                    const itemStaff: string[] = Array.isArray(item.assignedStaff) ? item.assignedStaff : [];

                    const toggleItemStaff = (staffName: string) => {
                      const updatedSections = [...editableSchema.sections];
                      const updatedItems = [...secItems];
                      const current = [...itemStaff];
                      const next = current.includes(staffName)
                        ? current.filter((s) => s !== staffName)
                        : [...current, staffName];
                      updatedItems[itIdx] = { ...item, assignedStaff: next };
                      updatedSections[secIdx] = { ...sec, items: updatedItems };
                      setEditableSchema({ ...editableSchema, sections: updatedSections });
                    };

                    return (
                      <div key={item.id || itIdx} className="notion-admin-item-row">
                        <div className="notion-admin-item-top">
                          <input
                            type="text"
                            value={item.name || item.task || ""}
                            onChange={(e) => {
                              const updatedSections = [...editableSchema.sections];
                              const updatedItems = [...secItems];
                              updatedItems[itIdx] = { ...item, name: e.target.value, task: e.target.value };
                              updatedSections[secIdx] = { ...sec, items: updatedItems };
                              setEditableSchema({ ...editableSchema, sections: updatedSections });
                            }}
                            className="notion-input"
                            style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}
                          />
                          <select
                            value={item.defaultAssignee || ""}
                            onChange={(e) => {
                              const updatedSections = [...editableSchema.sections];
                              const updatedItems = [...secItems];
                              updatedItems[itIdx] = { ...item, defaultAssignee: e.target.value };
                              updatedSections[secIdx] = { ...sec, items: updatedItems };
                              setEditableSchema({ ...editableSchema, sections: updatedSections });
                            }}
                            className="notion-select"
                            style={{ width: "160px", fontSize: "12px" }}
                          >
                            <option value="">Default cleaner...</option>
                            {allStaffList.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <span style={{ fontSize: "11px", color: "#7D7A75", fontWeight: 600 }}>
                            Staff who clean this specific item (Select to restrict dropdown, or leave empty to use section pool):
                          </span>
                          <div className="notion-staff-pill-wrap">
                            {allStaffList.map((st) => {
                              const isSelected = itemStaff.includes(st);
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => toggleItemStaff(st)}
                                  className={`notion-staff-pill ${isSelected ? "active" : ""}`}
                                >
                                  {isSelected ? "✓" : "+"} {st}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "12px" }}>
            <button
              type="button"
              onClick={() => setViewMode("AUDIT")}
              className="notion-btn-secondary"
              style={{ padding: "9px 18px" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSchema}
              disabled={isSavingSchema}
              className="notion-save-button"
              style={{ width: "auto", padding: "9px 24px" }}
            >
              {isSavingSchema ? "Saving Configuration..." : "💾 Save Form & Staff Assignments"}
            </button>
          </div>
        </div>
      ) : loading ? (
        <div className="loading-card">
          <div className="spinner" />
          <p>Loading audit checklist & historical data...</p>
        </div>
      ) : (
        <div className="sheet-body-content">
          {/* 0. UNIVERSAL DYNAMIC CHECKLIST (Custom report tabs, custom categories, or typed items) */}
          {isDynamicTemplate && (
            <div>
              {sections.map((sec: any) => {
                const secItems = sec.items || [];
                return (
                  <div key={sec.id} className="notion-section-block">
                    <div className="notion-section-header-row">
                      <div className="notion-section-title-wrap">
                        <h2 className="notion-section-title">{sec.title}</h2>
                        <span className="notion-section-badge">{secItems.length} checkpoints</span>
                      </div>
                      <div className="notion-section-actions">
                        <button
                          type="button"
                          className="notion-action-btn pass"
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
                          className="notion-action-btn"
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
                          className="notion-action-btn fail"
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

                    <div>
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

                        const eligibleStaff = getEligibleStaffForItem(item, sec);

                        return (
                          <div key={item.id || idx} className={`notion-checkpoint-card ${isBreach ? "card-breach" : ""}`}>
                            <div className="notion-checkpoint-title-row">
                              <span className="notion-item-index">{idx + 1}</span>
                              <h3 className="notion-checkpoint-title">{item.name || item.task}</h3>
                              {(min !== undefined || max !== undefined) && (
                                <span className="notion-checkpoint-spec">
                                  Safe: {min !== undefined ? `${min}` : "-∞"} to {max !== undefined ? `${max}` : "+∞"} {unit}
                                </span>
                              )}
                            </div>
                            {item.hint && <div className="notion-checkpoint-hint">{item.hint}</div>}

                            <div className="notion-checkpoint-footer">
                              <div className="notion-staff-row">
                                <span className="notion-staff-label">🧹 Cleaned by:</span>
                                <select
                                  value={cp.cleanedBy || cp.assignee || eligibleStaff[0]}
                                  onChange={(e) => updateCp({ cleanedBy: e.target.value, assignee: e.target.value })}
                                  className="notion-staff-select"
                                >
                                  {eligibleStaff.map((st: string) => (
                                    <option key={st} value={st}>
                                      {st}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="notion-checkpoint-action">
                                {itemType === "TEMPERATURE" && (
                                  <TouchTempSelect
                                    value={cp.temp}
                                    min={min ?? -20}
                                    max={max ?? 10}
                                    onChange={(val) => updateCp({ temp: val })}
                                  />
                                )}

                                {itemType === "NUMERIC" && (
                                  <div className="notion-numeric-wrap">
                                    <input
                                      type="number"
                                      step="any"
                                      value={cp.value ?? ""}
                                      placeholder={`Value (${unit || "qty"})`}
                                      onChange={(e) => updateCp({ value: e.target.value })}
                                      className="notion-numeric-input"
                                    />
                                    {unit && <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#7D7A75' }}>{unit}</span>}
                                    <button
                                      type="button"
                                      className={`notion-temp-na-btn ${cp.value === "N/A" ? "active" : ""}`}
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
                                    className="notion-callout-input"
                                    style={{ border: '1px solid #E6E5E3', borderRadius: '6px', padding: '4px 8px', background: '#FFFFFF', minHeight: '28px', maxWidth: '200px' }}
                                  />
                                )}
                              </div>
                            </div>

                            {(cp.status === "NO" || cp.status === "DIRTY" || isBreach || cp.notes) && (
                              <div className={`notion-callout ${isBreach || cp.status === "NO" || cp.status === "DIRTY" ? "red" : "yellow"}`}>
                                <span className="notion-callout-icon">{isBreach || cp.status === "NO" || cp.status === "DIRTY" ? "🚨" : "📝"}</span>
                                <input
                                  type="text"
                                  value={cp.notes || ""}
                                  placeholder={isBreach ? "Corrective action for temperature breach..." : "Observation or corrective note..."}
                                  onChange={(e) => updateCp({ notes: e.target.value })}
                                  className="notion-callout-input"
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
            <div className="notion-section-block">
              <div className="notion-section-header-row">
                <div className="notion-section-title-wrap">
                  <h2 className="notion-section-title">{sections[0]?.title || "Housekeeping & Sanitization"}</h2>
                  <span className="notion-section-badge">{(formData.items || []).length} checkpoints</span>
                </div>
                <div className="notion-section-actions">
                  <button
                    type="button"
                    className="notion-action-btn pass"
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
                    className="notion-action-btn"
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

              <div>
                {(formData.items || []).map((item: any, idx: number) => {
                  const eligibleStaff = getEligibleStaffForItem(item, sections[0]);
                  return (
                    <div key={item.id || idx} className="notion-checkpoint-card">
                      <div className="notion-checkpoint-title-row">
                        <span className="notion-item-index">{idx + 1}</span>
                        <h3 className="notion-checkpoint-title">{item.name}</h3>
                      </div>
                      <div className="notion-checkpoint-footer">
                        <div className="notion-staff-row">
                          <span className="notion-staff-label">🧹 Cleaned by:</span>
                          <select
                            value={item.cleanedBy || eligibleStaff[0]}
                            onChange={(e) => {
                              const newItems = [...(formData.items || [])];
                              newItems[idx] = { ...item, cleanedBy: e.target.value };
                              setFormData({ ...formData, items: newItems });
                            }}
                            className="notion-staff-select"
                          >
                            {eligibleStaff.map((st: string) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                        <div className="notion-checkpoint-action">
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
                      <div className={`notion-callout ${item.status === "NO" ? "red" : "yellow"}`}>
                        <span className="notion-callout-icon">{item.status === "NO" ? "🚨" : "📝"}</span>
                        <input
                          type="text"
                          value={item.notes || ""}
                          placeholder={item.status === "NO" ? "Specify issue or action taken..." : "Observation or corrective note..."}
                          onChange={(e) => {
                            const newItems = [...(formData.items || [])];
                            newItems[idx] = { ...item, notes: e.target.value };
                            setFormData({ ...formData, items: newItems });
                          }}
                          className="notion-callout-input"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          )}

          {/* 2. EQUIPMENT SANITIZATION */}
          {!isDynamicTemplate && template.category === "EQUIPMENT" && (
            <div>
              {sections.map((sec: any) => {
                const secItems = (formData.completedItems || []).filter((ci: any) =>
                  (sec.items || []).some((i: any) => i.id === ci.id || i.name === ci.name)
                );
                return (
                  <div key={sec.id} className="notion-section-block">
                    <div className="notion-section-header-row">
                      <div className="notion-section-title-wrap">
                        <h2 className="notion-section-title">{sec.title}</h2>
                        <span className="notion-section-badge">{secItems.length} units</span>
                      </div>
                      <div className="notion-section-actions">
                        <button
                          type="button"
                          className="notion-action-btn pass"
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
                          className="notion-action-btn"
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

                    <div>
                      {secItems.map((ci: any, idx: number) => {
                        const globalIdx = (formData.completedItems || []).findIndex(
                          (x: any) => x.id === ci.id
                        );
                        const eligibleStaff = getEligibleStaffForItem(ci, sec);
                        return (
                          <div key={ci.id || idx} className="notion-checkpoint-card">
                            <div className="notion-checkpoint-title-row">
                              <span className="notion-item-index">{idx + 1}</span>
                              <h3 className="notion-checkpoint-title">{ci.name}</h3>
                            </div>
                            <div className="notion-checkpoint-footer">
                              <div className="notion-staff-row">
                                <span className="notion-staff-label">🧹 Sanitized by:</span>
                                <select
                                  value={ci.cleanedBy || eligibleStaff[0]}
                                  onChange={(e) => {
                                    const newItems = [...formData.completedItems];
                                    newItems[globalIdx] = { ...ci, cleanedBy: e.target.value };
                                    setFormData({ ...formData, completedItems: newItems });
                                  }}
                                  className="notion-staff-select"
                                >
                                  {eligibleStaff.map((st: string) => (
                                    <option key={st} value={st}>{st}</option>
                                  ))}
                                </select>
                              </div>
                              <div className="notion-checkpoint-action">
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
                              <div className={`notion-callout ${ci.status === "NO" ? "red" : "yellow"}`}>
                                <span className="notion-callout-icon">{ci.status === "NO" ? "🚨" : "📝"}</span>
                                <input
                                  type="text"
                                  value={ci.notes || ""}
                                  placeholder={ci.status === "NO" ? "Specify equipment issue or defect..." : "Observation or corrective note..."}
                                  onChange={(e) => {
                                    const newItems = [...formData.completedItems];
                                    newItems[globalIdx] = { ...ci, notes: e.target.value };
                                    setFormData({ ...formData, completedItems: newItems });
                                  }}
                                  className="notion-callout-input"
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
            <div className="notion-section-block">
              <div className="notion-section-header-row">
                <div className="notion-section-title-wrap">
                  <h2 className="notion-section-title">Cold Storage & Refrigeration</h2>
                  <span className="notion-section-badge">{(formData.readings || []).length} units</span>
                </div>
                <div className="notion-section-actions">
                  <button
                    type="button"
                    className="notion-action-btn pass"
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
                    className="notion-action-btn"
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

              <div>
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

                  const eligibleStaff = getEligibleStaffForItem(reading, sections[0]);

                  return (
                    <div key={reading.id || idx} className={`notion-checkpoint-card ${isBreach ? "card-breach" : ""}`}>
                      <div className="notion-checkpoint-title-row">
                        <span className="notion-item-index">{idx + 1}</span>
                        <h3 className="notion-checkpoint-title">
                          {reading.name}
                          {reading.machineNumber && ` #${reading.machineNumber}`}
                        </h3>
                        <span className="notion-checkpoint-spec">
                          {reading.referenceTemp || `${min}°C to ${max}°C`}
                        </span>
                      </div>
                      <div className="notion-checkpoint-meta-row">
                        <div className="notion-staff-row">
                          <span className="notion-staff-label">❄️ Maintained / Cleaned by:</span>
                          <select
                            value={reading.maintainedBy || reading.cleanedBy || eligibleStaff[0]}
                            onChange={(e) => {
                              const newReadings = [...(formData.readings || [])];
                              newReadings[idx] = { ...reading, maintainedBy: e.target.value, cleanedBy: e.target.value };
                              setFormData({ ...formData, readings: newReadings });
                            }}
                            className="notion-staff-select"
                          >
                            {eligibleStaff.map((st: string) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="notion-temp-slots">
                        <div className="notion-temp-slot-item">
                          <span className="notion-temp-slot-label">Morning</span>
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
                        <div className="notion-temp-slot-item">
                          <span className="notion-temp-slot-label">Evening</span>
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
                        <div className="notion-callout red">
                          <span className="notion-callout-icon">🚨</span>
                          <span>Temperature Breach: Out of safe tolerance ({min}°C to {max}°C)</span>
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
            <div className="notion-section-block">
              <div className="notion-section-header-row">
                <div className="notion-section-title-wrap">
                  <h2 className="notion-section-title">Safety & Structural Inspection</h2>
                  <span className="notion-section-badge">{(formData.locations || []).length} checkpoints</span>
                </div>
                <div className="notion-section-actions">
                  <button
                    type="button"
                    className="notion-action-btn pass"
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
                    className="notion-action-btn"
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

              <div>
                {(formData.locations || []).map((loc: any, idx: number) => {
                  const eligibleStaff = getEligibleStaffForItem(loc, sections[0]);
                  return (
                    <div key={loc.id || idx} className="notion-checkpoint-card">
                      <div className="notion-checkpoint-title-row">
                        <span className="notion-item-index">{idx + 1}</span>
                        <h3 className="notion-checkpoint-title">{loc.location}</h3>
                      </div>
                      <div className="notion-checkpoint-footer">
                        <div className="notion-staff-row">
                          <span className="notion-staff-label">🧹 Cleaned by:</span>
                          <select
                            value={loc.cleanedBy || eligibleStaff[0]}
                            onChange={(e) => {
                              const newLocs = [...(formData.locations || [])];
                              newLocs[idx] = { ...loc, cleanedBy: e.target.value };
                              setFormData({ ...formData, locations: newLocs });
                            }}
                            className="notion-staff-select"
                          >
                            {eligibleStaff.map((st: string) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                        <div className="notion-checkpoint-action">
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
                      <div className={`notion-callout ${loc.status === "NO" ? "red" : "yellow"}`}>
                        <span className="notion-callout-icon">{loc.status === "NO" ? "🚨" : "📝"}</span>
                        <input
                          type="text"
                          value={loc.notes || ""}
                          placeholder={loc.status === "NO" ? "Specify damage, cracks or safety defect..." : "Observation or corrective note..."}
                          onChange={(e) => {
                            const newLocs = [...(formData.locations || [])];
                            newLocs[idx] = { ...loc, notes: e.target.value };
                            setFormData({ ...formData, locations: newLocs });
                          }}
                          className="notion-callout-input"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          )}

          {/* 5. MONTHLY MAINTENANCE & CUSTOM */}
          {!isDynamicTemplate && (template.category === "MAINTENANCE" || template.category === "CUSTOM") && (
            <div className="notion-section-block">
              <div className="notion-section-header-row">
                <div className="notion-section-title-wrap">
                  <h2 className="notion-section-title">Periodic & Maintenance Tasks</h2>
                  <span className="notion-section-badge">{(formData.tasks || []).length} tasks</span>
                </div>
                <div className="notion-section-actions">
                  <button
                    type="button"
                    className="notion-action-btn pass"
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
                    className="notion-action-btn"
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

              <div>
                {(formData.tasks || []).map((task: any, idx: number) => {
                  const eligibleStaff = getEligibleStaffForItem(task, sections[0]);
                  return (
                    <div key={task.id || idx} className="notion-checkpoint-card">
                      <div className="notion-checkpoint-title-row">
                        <span className="notion-item-index">{idx + 1}</span>
                        <h3 className="notion-checkpoint-title">{task.task}</h3>
                        {task.category && (
                          <span className="notion-checkpoint-spec">
                            {task.category}
                          </span>
                        )}
                      </div>
                      <div className="notion-checkpoint-footer">
                        <div className="notion-staff-row">
                          <span className="notion-staff-label">🔧 Completed by:</span>
                          <select
                            value={task.completedBy || eligibleStaff[0]}
                            onChange={(e) => {
                              const newTasks = [...(formData.tasks || [])];
                              newTasks[idx] = { ...task, completedBy: e.target.value };
                              setFormData({ ...formData, tasks: newTasks });
                            }}
                            className="notion-staff-select"
                          >
                            {eligibleStaff.map((st: string) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                        <div className="notion-checkpoint-action">
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
                      <div className={`notion-callout ${task.status === "NO" ? "red" : "yellow"}`}>
                        <span className="notion-callout-icon">{task.status === "NO" ? "🚨" : "📝"}</span>
                        <input
                          type="text"
                          value={task.notes || ""}
                          placeholder={task.status === "NO" ? "Observation or maintenance defect..." : "Observation or corrective note..."}
                          onChange={(e) => {
                            const newTasks = [...(formData.tasks || [])];
                            newTasks[idx] = { ...task, notes: e.target.value };
                            setFormData({ ...formData, tasks: newTasks });
                          }}
                          className="notion-callout-input"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          )}

          {/* Minimal Shift Notes & Verification */}
          <div className="notion-checkpoint-card" style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#7D7A75', display: 'block', marginBottom: '4px' }}>
                Shift Notes & Handover Remarks (Optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add shift observations or handover remarks..."
                rows={2}
                className="notion-textarea"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid #F1F1EF' }}>
              <input
                type="checkbox"
                id="signoff-checkbox"
                checked={supervisorSigned}
                onChange={(e) => setSupervisorSigned(e.target.checked)}
                className="notion-checkbox"
              />
              <label htmlFor="signoff-checkbox" style={{ fontSize: '12.5px', fontWeight: 500, color: '#2C2C2B', cursor: 'pointer' }}>
                Verified by {supervisorName || currentUser.name}
              </label>
            </div>
          </div>

          {/* Sticky Bottom Save Action Bar */}
          <div className="notion-submit-bar">
            <div className="notion-submit-bar-inner">
              <div className="notion-submit-status">
                <span className="notion-status-indicator" />
                <span>
                  {existingSubmissionId ? "Saved Record" : "New Entry"} • {selectedDate}
                </span>
              </div>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="notion-save-button"
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
