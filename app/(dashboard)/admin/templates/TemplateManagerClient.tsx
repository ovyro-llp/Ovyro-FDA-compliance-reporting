"use client";

import React, { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import PaywallModal from "@/components/PaywallModal";

export type ItemInputType = "STATUS" | "TEMPERATURE" | "NUMERIC" | "TEXT" | "TIME" | "CLEAN_DIRTY";

interface SectionItem {
  id: string;
  name: string;
  itemType?: ItemInputType;
  defaultAssignee?: string;
  category?: string;
  machineNumber?: string;
  referenceTemp?: string;
  targetMinTemp?: number;
  targetMaxTemp?: number;
  targetValue?: number;
  unitLabel?: string;
  minAllowed?: number;
  maxAllowed?: number;
  placeholder?: string;
}

interface Section {
  id: string;
  title: string;
  items: SectionItem[];
}

interface TemplateManagerClientProps {
  initialTemplates: any[];
  outlets: Array<{ id: string; name: string; icon: string; shifts?: string[] }>;
}

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function IconTrash({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function IconPlus({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="5" y2="19" />
      <line x1="5" x2="19" y1="12" y2="12" />
    </svg>
  );
}

const DEFAULT_STAFF = [
  "Staff Member",
  "Shift Supervisor",
  "Kitchen Lead",
  "Head Chef",
  "Operator / Cleaner",
  "Barista",
  "Steward",
  "Technician",
];

const PRESETS: Record<string, { title: string; category: string; icon: string; frequency: string; description: string; sections: Section[] }> = {
  HOUSEKEEPING: {
    title: "Daily Housekeeping & Area SOP",
    category: "HOUSEKEEPING",
    icon: "🧹",
    frequency: "SHIFT_WISE",
    description: "Daily hygiene inspection across food preparation, customer and storage areas.",
    sections: [
      {
        id: "sec-1",
        title: "Main Kitchen & Prep Area",
        items: [
          { id: "item-1", name: "Floor & Drain Washing", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "item-2", name: "Preparation Tables Sanitization", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "item-3", name: "Wash Sinks & Grease Trap", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "item-4", name: "Trash Bins Emptied & Lined", itemType: "STATUS", defaultAssignee: "Staff Member" },
        ],
      },
      {
        id: "sec-2",
        title: "Customer & Service Area",
        items: [
          { id: "item-5", name: "Dining Tables & Chairs", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "item-6", name: "Cash Counter & POS Screen", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "item-7", name: "Restrooms & Handwash Station", itemType: "STATUS", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  TEMPERATURE: {
    title: "Cold Chain & Refrigeration Log",
    category: "TEMPERATURE",
    icon: "🧊",
    frequency: "DAILY",
    description: "HACCP compliant temperature monitoring for chillers, walk-ins and freezers.",
    sections: [
      {
        id: "sec-1",
        title: "Kitchen Chillers & Freezers",
        items: [
          { id: "temp-1", name: "Under-counter Chiller", itemType: "TEMPERATURE", machineNumber: "1", referenceTemp: "+3 to +8°C", targetMinTemp: 3, targetMaxTemp: 8 },
          { id: "temp-2", name: "Meat & Dairy Refrigerator", itemType: "TEMPERATURE", machineNumber: "2", referenceTemp: "+2 to +6°C", targetMinTemp: 2, targetMaxTemp: 6 },
          { id: "temp-3", name: "Deep Freezer #1", itemType: "TEMPERATURE", machineNumber: "1", referenceTemp: "-22 to -18°C", targetMinTemp: -22, targetMaxTemp: -18 },
        ],
      },
      {
        id: "sec-2",
        title: "Display Chillers",
        items: [
          { id: "temp-4", name: "Pastry & Dessert Display", itemType: "TEMPERATURE", machineNumber: "1", referenceTemp: "+2 to +8°C", targetMinTemp: 2, targetMaxTemp: 8 },
          { id: "temp-5", name: "Beverage Cooler", itemType: "TEMPERATURE", machineNumber: "2", referenceTemp: "+4 to +10°C", targetMinTemp: 4, targetMaxTemp: 10 },
        ],
      },
    ],
  },
  CHEMICAL_SANITIZER: {
    title: "Chemical Sanitizer & Dishwashing Log",
    category: "CHEMICAL",
    icon: "🧪",
    frequency: "SHIFT_WISE",
    description: "Chlorine/Quat concentration testing (PPM) and commercial dishwashing rinse temperature verification.",
    sections: [
      {
        id: "sec-1",
        title: "Sanitizer Sinks & Spray Solutions",
        items: [
          { id: "chem-1", name: "3-Compartment Sink Sanitizer (Quat/Chlorine)", itemType: "NUMERIC", targetValue: 200, unitLabel: "PPM", minAllowed: 150, maxAllowed: 400, defaultAssignee: "Staff Member" },
          { id: "chem-2", name: "Food Contact Surface Sanitizer Bottles", itemType: "NUMERIC", targetValue: 200, unitLabel: "PPM", minAllowed: 150, maxAllowed: 400, defaultAssignee: "Staff Member" },
        ],
      },
      {
        id: "sec-2",
        title: "Commercial Dishwasher Verification",
        items: [
          { id: "chem-3", name: "Dishwasher Wash Cycle Temp", itemType: "TEMPERATURE", targetMinTemp: 60, targetMaxTemp: 65, machineNumber: "1", referenceTemp: "+60 to +65°C", defaultAssignee: "Shift Supervisor" },
          { id: "chem-4", name: "Dishwasher Final Sanitizing Rinse Temp", itemType: "TEMPERATURE", targetMinTemp: 82, targetMaxTemp: 90, machineNumber: "1", referenceTemp: "+82 to +90°C", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
  FOOD_SAFETY_HACCP: {
    title: "Cooking Core & Hot Holding Log",
    category: "COOKING_HACCP",
    icon: "🍳",
    frequency: "SHIFT_WISE",
    description: "HACCP critical control point logging: core internal cooking temperatures and hot holding tolerances.",
    sections: [
      {
        id: "sec-1",
        title: "Core Cooking Critical Temperatures (Min 75°C)",
        items: [
          { id: "haccp-1", name: "Poultry & Chicken Core Internal Temp", itemType: "TEMPERATURE", targetMinTemp: 75, targetMaxTemp: 95, referenceTemp: "Min 75°C", defaultAssignee: "Kitchen Lead" },
          { id: "haccp-2", name: "Minced Meat / Burgers Internal Temp", itemType: "TEMPERATURE", targetMinTemp: 70, targetMaxTemp: 90, referenceTemp: "Min 70°C", defaultAssignee: "Kitchen Lead" },
        ],
      },
      {
        id: "sec-2",
        title: "Hot Holding Display Units (Min 63°C)",
        items: [
          { id: "haccp-3", name: "Bain Marie Display Unit #1", itemType: "TEMPERATURE", targetMinTemp: 63, targetMaxTemp: 85, referenceTemp: "Min 63°C", defaultAssignee: "Staff Member" },
          { id: "haccp-4", name: "Soup & Gravy Kettle Warmer", itemType: "TEMPERATURE", targetMinTemp: 65, targetMaxTemp: 85, referenceTemp: "Min 65°C", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  EQUIPMENT: {
    title: "Kitchen Equipment Cleaning Log",
    category: "EQUIPMENT",
    icon: "⚙️",
    frequency: "DAILY",
    description: "Sanitization and cleaning schedule for all kitchen and cafe machinery.",
    sections: [
      {
        id: "sec-1",
        title: "Cooking Equipment",
        items: [
          { id: "eq-1", name: "Convection Oven", itemType: "CLEAN_DIRTY", category: "Cooking", defaultAssignee: "Staff Member" },
          { id: "eq-2", name: "Commercial Fryer", itemType: "CLEAN_DIRTY", category: "Cooking", defaultAssignee: "Staff Member" },
          { id: "eq-3", name: "Dough Mixer & Hook", itemType: "CLEAN_DIRTY", category: "Baking", defaultAssignee: "Staff Member" },
        ],
      },
      {
        id: "sec-2",
        title: "Beverage Machinery",
        items: [
          { id: "eq-4", name: "Espresso Machine Group Heads", itemType: "CLEAN_DIRTY", category: "Beverage", defaultAssignee: "Staff Member" },
          { id: "eq-5", name: "Ice Dispenser Machine", itemType: "CLEAN_DIRTY", category: "Beverage", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  SAFETY_GLASS: {
    title: "Glass, Pest & Facility Safety",
    category: "SAFETY_GLASS",
    icon: "🪟",
    frequency: "DAILY",
    description: "Structural safety, glass panel integrity, and pest traps audit.",
    sections: [
      {
        id: "sec-1",
        title: "Glass & Structure",
        items: [
          { id: "sf-1", name: "Front Entrance Glass Door", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "sf-2", name: "Display Glass Enclosure", itemType: "STATUS", defaultAssignee: "Staff Member" },
          { id: "sf-3", name: "Pest Bait Stations & Fly Catchers", itemType: "STATUS", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  BLANK: {
    title: "New Custom Report Tab",
    category: "CUSTOM",
    icon: "📋",
    frequency: "DAILY",
    description: "Custom operational inspection checklist built from scratch.",
    sections: [
      {
        id: "sec-1",
        title: "Inspection Section 1",
        items: [
          { id: "custom-1", name: "First Inspection Checkpoint", itemType: "STATUS", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  MAINTENANCE: {
    title: "Monthly Deep Maintenance & Servicing",
    category: "MAINTENANCE",
    icon: "🗓️",
    frequency: "MONTHLY",
    description: "Periodic preventative maintenance for heavy electrical and mechanical assets.",
    sections: [
      {
        id: "sec-1",
        title: "HVAC & Heavy Machinery",
        items: [
          { id: "mm-1", name: "Air Conditioning Condenser Clean", category: "HVAC", defaultAssignee: "Technician" },
          { id: "mm-2", name: "Diesel Generator Battery & Fuel Check", category: "Electrical", defaultAssignee: "Technician" },
          { id: "mm-3", name: "Fire Extinguisher Pressure Gauge", category: "Safety", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
  RAW_MATERIAL_MANUFACTURING: {
    title: "Raw Material Intake & Batch QA Inspection",
    category: "RAW_MATERIAL_MANUFACTURING",
    icon: "🏭",
    frequency: "DAILY",
    description: "Raw material receipt, supplier batch QA, COA verification, moisture % & core temperature.",
    sections: [
      {
        id: "sec-rm-1",
        title: "Raw Material Inbound Receiving",
        items: [
          { id: "rm-1", name: "Supplier Invoice & Batch / Lot Number Verified", itemType: "STATUS", defaultAssignee: "QA Inspector" },
          { id: "rm-2", name: "Certificate of Analysis (COA) Enclosed & Verified", itemType: "STATUS", defaultAssignee: "QA Inspector" },
          { id: "rm-3", name: "Transport Vehicle Hygiene & Packaging Seal Intact", itemType: "STATUS", defaultAssignee: "QA Inspector" },
          { id: "rm-4", name: "Inbound Core / Surface Temperature (°C)", itemType: "TEMPERATURE", referenceTemp: "-18 to +4°C", targetMinTemp: -18, targetMaxTemp: 4, defaultAssignee: "QA Inspector" },
        ],
      },
      {
        id: "sec-rm-2",
        title: "Sensory, Moisture & Chemical Quality Checks",
        items: [
          { id: "rm-5", name: "Sensory Evaluation (Aroma, Color, Absence of foreign particles)", itemType: "STATUS", defaultAssignee: "QA Inspector" },
          { id: "rm-6", name: "Moisture Content % Logged (Safe Tolerance < 12%)", itemType: "NUMERIC", targetValue: 10, unitLabel: "%", minAllowed: 5, maxAllowed: 12, defaultAssignee: "QA Inspector" },
          { id: "rm-7", name: "Raw Batch Allergen Labeling & Segregation Applied", itemType: "STATUS", defaultAssignee: "Floor Lead" },
          { id: "rm-8", name: "Quarantine Tagging / Approved for Production Stamp", itemType: "STATUS", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
  CLOUD_KITCHEN_DISPATCH: {
    title: "Cloud Kitchen Dispatch & Tamper-Proof Audit",
    category: "CLOUD_KITCHEN_DISPATCH",
    icon: "🛵",
    frequency: "SHIFT_WISE",
    description: "Delivery order assembly, hot holding >65°C, tamper-evident security seal, and rider bag sanitization.",
    sections: [
      {
        id: "sec-ck-1",
        title: "Food Assembly & Thermal Safety",
        items: [
          { id: "ck-1", name: "Hot Food Dispatch Holding Temp (Min 65°C)", itemType: "TEMPERATURE", referenceTemp: "Min 65°C", targetMinTemp: 65, targetMaxTemp: 90, defaultAssignee: "Dispatch Lead" },
          { id: "ck-2", name: "Cold Beverages & Desserts Chilled (< 5°C)", itemType: "TEMPERATURE", referenceTemp: "+2 to +5°C", targetMinTemp: 2, targetMaxTemp: 5, defaultAssignee: "Dispatch Lead" },
          { id: "ck-3", name: "Allergen Warning & Expiry / Consume-By Label Attached", itemType: "STATUS", defaultAssignee: "Packer" },
        ],
      },
      {
        id: "sec-ck-2",
        title: "Tamper-Proof Packaging & Delivery Partner Audit",
        items: [
          { id: "ck-4", name: "Tamper-Evident Security Seal Applied Across Container", itemType: "STATUS", defaultAssignee: "Packer" },
          { id: "ck-5", name: "Spill-Proof Lid & Steam Vent Sealed", itemType: "STATUS", defaultAssignee: "Packer" },
          { id: "ck-6", name: "Delivery Partner Insulated Bag Sanitized & Clean", itemType: "STATUS", defaultAssignee: "Dispatch Lead" },
          { id: "ck-7", name: "Handover Timestamp & Order ID Verified on POS", itemType: "STATUS", defaultAssignee: "Dispatch Lead" },
        ],
      },
    ],
  },
  CAFE_BAKERY: {
    title: "Specialty Cafe & Espresso Equipment Log",
    category: "CAFE_BAKERY",
    icon: "☕",
    frequency: "SHIFT_WISE",
    description: "Espresso machine dial-in, milk steam wand sanitization, water filtration TDS, and bakery chiller.",
    sections: [
      {
        id: "sec-cafe-1",
        title: "Espresso Machine & Dial-in Calibration",
        items: [
          { id: "cafe-1", name: "Group Head Shower Screen Flush & Clean", itemType: "CLEAN_DIRTY", defaultAssignee: "Head Barista" },
          { id: "cafe-2", name: "9-Bar Pump Pressure & Boiler Temp Calibrated", itemType: "STATUS", defaultAssignee: "Head Barista" },
          { id: "cafe-3", name: "Espresso Dose, Yield & Extraction Time (25-30s)", itemType: "STATUS", defaultAssignee: "Head Barista" },
          { id: "cafe-4", name: "Water Filtration Hardness / TDS Log (< 150 PPM)", itemType: "NUMERIC", targetValue: 120, unitLabel: "PPM", minAllowed: 50, maxAllowed: 150, defaultAssignee: "Head Barista" },
        ],
      },
      {
        id: "sec-cafe-2",
        title: "Milk Hygiene & Bakery Display Counter",
        items: [
          { id: "cafe-5", name: "Steam Wand Purged & Milk Residue Chemical Soak", itemType: "CLEAN_DIRTY", defaultAssignee: "Barista" },
          { id: "cafe-6", name: "Milk Pitchers Sanitizer Rinse Bath", itemType: "STATUS", defaultAssignee: "Barista" },
          { id: "cafe-7", name: "Bakery / Croissant Display Counter Temp (+2 to +6°C)", itemType: "TEMPERATURE", referenceTemp: "+2 to +6°C", targetMinTemp: 2, targetMaxTemp: 6, defaultAssignee: "Staff Member" },
          { id: "cafe-8", name: "Pastry Tongs & Service Trays Sanitized", itemType: "STATUS", defaultAssignee: "Staff Member" },
        ],
      },
    ],
  },
  FSSAI_COMPLIANCE: {
    title: "FSSAI Schedule 4 & Cooking Oil TPC Audit",
    category: "FSSAI_COMPLIANCE",
    icon: "🇮🇳",
    frequency: "DAILY",
    description: "FSSAI regulatory audit: cooking oil Total Polar Compounds (TPC % < 25), medical fitness & FIFO.",
    sections: [
      {
        id: "sec-fssai-1",
        title: "Cooking Oil TPC & Safe Frying Compliance",
        items: [
          { id: "fssai-1", name: "Cooking Oil Total Polar Compounds (TPC %) Test", itemType: "NUMERIC", targetValue: 15, unitLabel: "TPC %", minAllowed: 0, maxAllowed: 25, defaultAssignee: "Kitchen Lead" },
          { id: "fssai-2", name: "Oil Discard Logged If TPC > 25% or Smoky", itemType: "STATUS", defaultAssignee: "Kitchen Lead" },
          { id: "fssai-3", name: "Deep Fryer Strainer & Sediment Trap Cleaned", itemType: "CLEAN_DIRTY", defaultAssignee: "Staff Member" },
        ],
      },
      {
        id: "sec-fssai-2",
        title: "FSSAI Schedule 4 Food Safety Hygiene",
        items: [
          { id: "fssai-4", name: "Food Handlers Clean Uniform, Apron & Hairnet Check", itemType: "STATUS", defaultAssignee: "Shift Supervisor" },
          { id: "fssai-5", name: "Absence of Open Cuts, Burns or Illness (Medical Fitness)", itemType: "STATUS", defaultAssignee: "Shift Supervisor" },
          { id: "fssai-6", name: "First-In-First-Out (FIFO) Date Tagging on All Prep", itemType: "STATUS", defaultAssignee: "Kitchen Lead" },
          { id: "fssai-7", name: "Pest Bait Stations & Insect Light Trap (ILT) Inspected", itemType: "STATUS", defaultAssignee: "Shift Supervisor" },
          { id: "fssai-8", name: "Potable Water Filter Cartridge & RO / UV Operational", itemType: "STATUS", defaultAssignee: "Shift Supervisor" },
        ],
      },
    ],
  },
};

export default function TemplateManagerClient({
  initialTemplates,
  outlets,
}: TemplateManagerClientProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>(initialTemplates);
  const [editingTemplate, setEditingTemplate] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Editor form state
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("HOUSEKEEPING");
  const [customCategory, setCustomCategory] = useState("");
  const [icon, setIcon] = useState("📋");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("DAILY");
  const [shifts, setShifts] = useState<string[]>(["Morning", "Evening"]);
  const [customShiftInput, setCustomShiftInput] = useState("");
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);

  // Archive state & filtering
  const [archiveFilter, setArchiveFilter] = useState<"all" | "active" | "archived">("all");
  const [isArchived, setIsArchived] = useState(false);

  // Sections & Builder state
  const [builderMode, setBuilderMode] = useState<"visual" | "bulk" | "preview">("visual");
  const [sections, setSections] = useState<Section[]>([]);
  const [bulkText, setBulkText] = useState("");

  const activeCount = useMemo(() => templates.filter((t) => !t.isArchived).length, [templates]);
  const archivedCount = useMemo(() => templates.filter((t) => !!t.isArchived).length, [templates]);

  const filteredTemplates = useMemo(() => {
    if (archiveFilter === "active") return templates.filter((t) => !t.isArchived);
    if (archiveFilter === "archived") return templates.filter((t) => !!t.isArchived);
    return templates;
  }, [templates, archiveFilter]);

  const availableShiftsPool = useMemo(() => {
    const set = new Set<string>(["Morning", "Afternoon", "Evening", "Night"]);
    outlets.forEach((o) => {
      const rawShifts: any = o.shifts;
      const sArr: string[] = Array.isArray(rawShifts)
        ? rawShifts
        : typeof rawShifts === "string"
        ? (() => {
            try {
              return JSON.parse(rawShifts);
            } catch {
              return rawShifts.split(",").map((s: string) => s.trim());
            }
          })()
        : [];
      sArr.forEach((s: string) => {
        if (s && typeof s === "string") set.add(s.trim());
      });
    });
    return Array.from(set).filter(Boolean);
  }, [outlets]);

  const handleAddCustomShift = () => {
    const trimmed = customShiftInput.trim();
    if (!trimmed) return;
    if (!shifts.includes(trimmed)) {
      setShifts([...shifts, trimmed]);
    }
    setCustomShiftInput("");
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    const preset = PRESETS.HOUSEKEEPING;
    setTitle(preset.title);
    setSlug("daily-housekeeping-sop");
    setCategory(preset.category);
    setCustomCategory("");
    setIcon(preset.icon);
    setDescription(preset.description);
    setFrequency(preset.frequency);
    setShifts(["Morning", "Afternoon", "Evening", "Night"]);
    setCustomShiftInput("");
    setSelectedOutlets(outlets.map((o) => o.id));
    setSections(JSON.parse(JSON.stringify(preset.sections)));
    setBulkText(
      preset.sections
        .flatMap((s) => s.items.map((i) => i.name))
        .join("\n")
    );
    setBuilderMode("visual");
    setError(null);
    setIsArchived(false);
    setIsModalOpen(true);
  };

  const handlePresetSelect = (catKey: string) => {
    const p = PRESETS[catKey] || PRESETS.HOUSEKEEPING;
    setTitle(p.title);
    if (!editingTemplate) {
      setSlug(p.title.toLowerCase().replace(/[^a-z0-9]/g, "-"));
    }
    setCategory(p.category);
    setCustomCategory("");
    setIcon(p.icon);
    setDescription(p.description);
    setFrequency(p.frequency);
    setSections(JSON.parse(JSON.stringify(p.sections)));
    setBulkText(p.sections.flatMap((s) => s.items.map((i) => i.name)).join("\n"));
  };

  const handleOpenEdit = (tpl: any) => {
    setEditingTemplate(tpl);
    setIsArchived(!!tpl.isArchived);
    setTitle(tpl.title || "");
    setSlug(tpl.slug || "");
    const standardCategories = ["HOUSEKEEPING", "TEMPERATURE", "EQUIPMENT", "SAFETY_GLASS", "CHEMICAL", "COOKING_HACCP", "MAINTENANCE"];
    if (standardCategories.includes(tpl.category)) {
      setCategory(tpl.category);
      setCustomCategory("");
    } else {
      setCategory("CUSTOM");
      setCustomCategory(tpl.category || "");
    }
    setIcon(tpl.icon || "📋");
    setDescription(tpl.description || "");
    setFrequency(tpl.frequency || "DAILY");
    setSelectedOutlets((tpl.outletTemplates || []).map((ot: any) => ot.outletId));

    const parsedSchema = safeJson(tpl.schema, { sections: [] });
    
    // Shifts
    if (parsedSchema.shifts && Array.isArray(parsedSchema.shifts)) {
      setShifts(parsedSchema.shifts);
    } else {
      setShifts(["Morning", "Evening"]);
    }
    setCustomShiftInput("");

    // Sections
    if (parsedSchema.sections && Array.isArray(parsedSchema.sections) && parsedSchema.sections.length > 0) {
      setSections(JSON.parse(JSON.stringify(parsedSchema.sections)));
      const extracted = parsedSchema.sections
        .flatMap((s: any) => (s.items || []).map((i: any) => i.name || i.task || i.location))
        .join("\n");
      setBulkText(extracted);
    } else {
      // Fallback default
      const defaultSecs: Section[] = [
        {
          id: "sec-1",
          title: `${tpl.title} Checkpoints`,
          items: [
            { id: "item-1", name: "Main Inspection Area", itemType: "STATUS", defaultAssignee: "Staff Member" },
          ],
        },
      ];
      setSections(defaultSecs);
      setBulkText("Main Inspection Area");
    }

    setBuilderMode("visual");
    setError(null);
    setIsModalOpen(true);
  };

  // Section manipulation helpers
  const handleAddSection = () => {
    const newSec: Section = {
      id: `sec-${Date.now().toString().slice(-4)}`,
      title: `New Section ${sections.length + 1}`,
      items: [
        {
          id: `item-${Date.now().toString().slice(-4)}`,
          name: "New Checkpoint Item",
          defaultAssignee: DEFAULT_STAFF[0],
          targetMinTemp: category === "TEMPERATURE" ? 2 : undefined,
          targetMaxTemp: category === "TEMPERATURE" ? 8 : undefined,
          referenceTemp: category === "TEMPERATURE" ? "+2 to +8°C" : undefined,
        },
      ],
    };
    setSections([...sections, newSec]);
  };

  const handleDeleteSection = (secIndex: number) => {
    if (sections.length <= 1) {
      alert("Template must have at least one section.");
      return;
    }
    setSections(sections.filter((_, idx) => idx !== secIndex));
  };

  const handleUpdateSectionTitle = (secIndex: number, newTitle: string) => {
    const updated = [...sections];
    updated[secIndex].title = newTitle;
    setSections(updated);
  };

  const handleAddItem = (secIndex: number) => {
    const updated = [...sections];
    const sec = updated[secIndex];
    const count = (sec.items || []).length + 1;
    const defaultType: ItemInputType = category === "TEMPERATURE" ? "TEMPERATURE" : "STATUS";
    const newItem: SectionItem = {
      id: `item-${Date.now().toString().slice(-4)}-${count}`,
      name: `Checkpoint #${count}`,
      itemType: defaultType,
      defaultAssignee: DEFAULT_STAFF[0],
      category: sec.title,
      targetMinTemp: defaultType === "TEMPERATURE" ? 2 : undefined,
      targetMaxTemp: defaultType === "TEMPERATURE" ? 8 : undefined,
      referenceTemp: defaultType === "TEMPERATURE" ? "+2 to +8°C" : undefined,
      machineNumber: defaultType === "TEMPERATURE" ? `${count}` : undefined,
      targetValue: 200,
      unitLabel: "PPM",
      minAllowed: 150,
      maxAllowed: 400,
    };
    sec.items = [...(sec.items || []), newItem];
    setSections(updated);
  };

  const handleUpdateItem = (secIndex: number, itemIndex: number, field: keyof SectionItem, value: any) => {
    const updated = [...sections];
    const item = { ...updated[secIndex].items[itemIndex], [field]: value };
    
    // Auto sync referenceTemp if min/max changed for temperature
    if (field === "targetMinTemp" || field === "targetMaxTemp") {
      const min = field === "targetMinTemp" ? value : item.targetMinTemp ?? 0;
      const max = field === "targetMaxTemp" ? value : item.targetMaxTemp ?? 10;
      item.referenceTemp = `${min > 0 ? "+" + min : min} to ${max > 0 ? "+" + max : max}°C`;
    }

    if (field === "itemType") {
      if (value === "TEMPERATURE") {
        item.targetMinTemp = item.targetMinTemp ?? 2;
        item.targetMaxTemp = item.targetMaxTemp ?? 8;
        item.referenceTemp = item.referenceTemp ?? "+2 to +8°C";
        item.machineNumber = item.machineNumber ?? `${itemIndex + 1}`;
      } else if (value === "NUMERIC") {
        item.targetValue = item.targetValue ?? 200;
        item.unitLabel = item.unitLabel ?? "PPM";
        item.minAllowed = item.minAllowed ?? 150;
        item.maxAllowed = item.maxAllowed ?? 400;
      }
    }

    updated[secIndex].items[itemIndex] = item;
    setSections(updated);
  };

  const handleDeleteItem = (secIndex: number, itemIndex: number) => {
    const updated = [...sections];
    updated[secIndex].items = updated[secIndex].items.filter((_, idx) => idx !== itemIndex);
    setSections(updated);
  };

  // Convert Bulk text into sections
  const handleApplyBulkText = () => {
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert("Please enter at least one line of items.");
      return;
    }

    const newItems: SectionItem[] = lines.map((name, idx) => {
      if (category === "TEMPERATURE") {
        return {
          id: `temp-${idx + 1}`,
          name,
          itemType: "TEMPERATURE",
          machineNumber: `${idx + 1}`,
          referenceTemp: "+2 to +8°C",
          targetMinTemp: 2,
          targetMaxTemp: 8,
          defaultAssignee: DEFAULT_STAFF[idx % DEFAULT_STAFF.length],
        };
      }
      return {
        id: `item-${idx + 1}`,
        name,
        itemType: "STATUS",
        defaultAssignee: DEFAULT_STAFF[idx % DEFAULT_STAFF.length],
        category: title,
      };
    });

    setSections([
      {
        id: "sec-1",
        title: `${title} Checklist Items`,
        items: newItems,
      },
    ]);
    setBuilderMode("visual");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    // Validate sections
    if (!sections.length || !sections.some((s) => s.items && s.items.length > 0)) {
      setError("Please add at least one checkpoint item to the template.");
      setSaving(false);
      return;
    }

    const finalCategory = category === "CUSTOM" && customCategory.trim() ? customCategory.trim().toUpperCase() : category;

    const schema = {
      type: finalCategory,
      frequency,
      shifts: frequency === "SHIFT_WISE" ? shifts : undefined,
      sections,
    };

    const payload = {
      title,
      slug: slug || title.toLowerCase().replace(/[^a-z0-9]/g, "-"),
      category: finalCategory,
      icon,
      description,
      frequency,
      isArchived,
      schema,
      outletIds: selectedOutlets,
    };

    try {
      const url = editingTemplate
        ? `/api/admin/templates/${editingTemplate.id}`
        : "/api/admin/templates";
      const method = editingTemplate ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        setError("Subscription required to create or modify templates. Upgrade via Dodo Payments.");
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to save template");

      showToast(editingTemplate ? `✓ "${title}" updated successfully!` : `✓ "${title}" created successfully!`);
      setIsModalOpen(false);

      // Refresh list
      const listRes = await fetch("/api/admin/templates");
      if (listRes.ok) {
        const d = await listRes.json();
        setTemplates(d.templates || []);
      }
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleArchive = async (tpl: any) => {
    const willArchive = !tpl.isArchived;
    const confirmMsg = willArchive
      ? `Archive Report Tab "${tpl.title}"?\n\nIt will be hidden from daily operations and outlet checklists. Historical audit logs will remain safe.`
      : `Restore Report Tab "${tpl.title}"?\n\nIt will become active and reappear in assigned outlet checklists.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/admin/templates/${tpl.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: willArchive }),
      });

      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to update archive status");

      setTemplates((prev) =>
        prev.map((t) => (t.id === tpl.id ? { ...t, isArchived: willArchive } : t))
      );
      showToast(json.message || (willArchive ? `✓ "${tpl.title}" archived.` : `✓ "${tpl.title}" restored.`));
      router.refresh();
    } catch (err: any) {
      alert(err.message || "Failed to update archive status");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete Report Tab "${name}"? All associated checklist assignments will be removed.`)) return;
    try {
      const res = await fetch(`/api/admin/templates/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (res.status === 402 || json.paywall) {
        setShowPaywall(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Failed to delete report tab");

      setTemplates((prev) => prev.filter((t) => t.id !== id));
      showToast(`✓ Report Tab "${name}" deleted.`);

      const listRes = await fetch("/api/admin/templates");
      if (listRes.ok) {
        const d = await listRes.json();
        setTemplates(d.templates || []);
      }
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Failed to delete report tab");
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

      {/* Header */}
      <div className="admin-header-row">
        <div>
          <h1 className="admin-page-title">Form Templates</h1>
          <p className="admin-page-subtitle">
            Create and assign checklists, temperature logs, and inspection sheets.
          </p>
        </div>
        <button onClick={handleOpenCreate} className="btn-create-primary">
          <span>➕</span> Create New Report Tab
        </button>
      </div>

      {/* Archive / Active Tabs Filter */}
      <div className="template-filter-tabs">
        <button
          type="button"
          onClick={() => setArchiveFilter("all")}
          className={`filter-tab-pill ${archiveFilter === "all" ? "active" : ""}`}
        >
          All Report Tabs ({templates.length})
        </button>
        <button
          type="button"
          onClick={() => setArchiveFilter("active")}
          className={`filter-tab-pill ${archiveFilter === "active" ? "active" : ""}`}
        >
          ✓ Active ({activeCount})
        </button>
        <button
          type="button"
          onClick={() => setArchiveFilter("archived")}
          className={`filter-tab-pill ${archiveFilter === "archived" ? "active" : ""}`}
        >
          📦 Archived ({archivedCount})
        </button>
      </div>

      {/* Templates / Report Tabs Grid */}
      <div className="templates-grid">
        {filteredTemplates.length === 0 ? (
          <div className="empty-state-card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "3rem" }}>
            <span style={{ fontSize: "2.5rem" }}>{archiveFilter === "archived" ? "📦" : "📑"}</span>
            <h3 style={{ margin: "1rem 0 0.5rem" }}>
              {archiveFilter === "archived" ? "No Archived Report Tabs" : "No Report Tabs Configured"}
            </h3>
            <p style={{ color: "#64748b", marginBottom: "1.5rem" }}>
              {archiveFilter === "archived"
                ? "You haven't archived any report tabs yet. Active tabs can be archived at any time to hide them from daily staff operations."
                : "Get started by creating your first Report Tab or choosing a quick-start preset."}
            </p>
            {archiveFilter !== "archived" && (
              <button onClick={handleOpenCreate} className="btn-create-primary" style={{ display: "inline-flex" }}>
                <span>➕</span> Create New Report Tab
              </button>
            )}
          </div>
        ) : (
          filteredTemplates.map((tpl) => {
            const assignedCount = (tpl.outletTemplates || []).length;
            const parsed = safeJson(tpl.schema, {});
            const totalItems = (parsed.sections || []).reduce(
              (acc: number, s: any) => acc + (s.items || []).length,
              0
            );

            return (
              <div key={tpl.id} className={`template-card ${tpl.isArchived ? "is-archived" : ""}`}>
                <div className="template-card-header">
                  <div className="template-icon-circle">{tpl.icon || "📋"}</div>
                  <div className="template-badges">
                    {tpl.isArchived ? (
                      <span className="badge-archived">📦 Archived</span>
                    ) : (
                      <span className="badge-active">✓ Active</span>
                    )}
                    <span className="badge-category">{tpl.category}</span>
                    <span className="badge-freq">{tpl.frequency}</span>
                  </div>
                </div>

                <h3 className="template-title">{tpl.title}</h3>
                <p className="template-desc">{tpl.description || "No description provided."}</p>

                <div className="template-meta-row">
                  <span className="meta-item">
                    🏢 {assignedCount} {assignedCount === 1 ? "Outlet" : "Outlets"}
                  </span>
                  <span className="meta-item">
                    📋 {totalItems} {totalItems === 1 ? "Item" : "Items"}
                  </span>
                  <span className="meta-item">
                    📝 {tpl._count?.submissions || 0} Records
                  </span>
                  <span className="meta-item">v{tpl.version || 1}</span>
                </div>

                <div className="template-actions-row">
                  <button
                    onClick={() => handleOpenEdit(tpl)}
                    className="btn-action-edit"
                    title="Edit configuration & checkpoints"
                  >
                    ✏️ Edit
                  </button>
                  {tpl.isArchived ? (
                    <button
                      onClick={() => handleToggleArchive(tpl)}
                      className="btn-action-restore"
                      title="Restore to active outlet checklists"
                    >
                      ♻️ Restore
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleArchive(tpl)}
                      className="btn-action-archive"
                      title="Archive report tab and hide from operations"
                    >
                      📦 Archive
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tpl.id, tpl.title)}
                    className="btn-action-delete"
                    title="Permanently delete template"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>


      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card modal-lg">
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="modal-icon">{icon}</span>
                <div>
                  <h2>{editingTemplate ? `Edit: ${editingTemplate.title}` : "Create New Report Tab"}</h2>
                  <p className="modal-subtitle">Configure sections, checkpoints, equipment items, shifts & outlet distribution</p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="modal-close-btn"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="modal-form">
              {error && <div className="form-error-banner">{error}</div>}

              {/* Quick Presets Bar (For New Templates) */}
              {!editingTemplate && (
                <div className="preset-selector-row">
                  <div className="preset-header-info">
                    <span className="preset-label">
                      <span>⚡</span> Quick SOP Presets
                    </span>
                    <span className="preset-hint">Pre-fill standard industry sections and checkpoints</span>
                  </div>
                  <div className="preset-scroll-track">
                    {Object.keys(PRESETS).map((key) => {
                      const isActive = category === PRESETS[key].category || (key === "BLANK" && category === "CUSTOM");
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handlePresetSelect(key)}
                          className={`preset-btn ${isActive ? "active" : ""}`}
                        >
                          <span>{PRESETS[key].icon}</span>
                          <span>{key === "BLANK" ? "Start Blank" : key.replace(/_/g, " ")}</span>
                          {isActive && <span style={{ fontSize: "0.7rem", marginLeft: "2px" }}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Form Metadata */}
              <div className="form-section-card">
                <h3 className="section-subtitle">
                  <span>⚙️</span> 1. Report Tab Information &amp; Settings
                </h3>

                {/* Title & Icon Header Row */}
                <div className="form-group" style={{ marginBottom: "1rem" }}>
                  <label>Report Tab Title &amp; Icon *</label>
                  <div className="notion-title-icon-group">
                    <div className="notion-icon-input-wrap">
                      <input
                        type="text"
                        value={icon}
                        onChange={(e) => setIcon(e.target.value)}
                        placeholder="🧹"
                        className="notion-icon-input"
                        title="Tab Emoji Icon"
                      />
                    </div>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => {
                        setTitle(e.target.value);
                        if (!editingTemplate) {
                          setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-"));
                        }
                      }}
                      placeholder="e.g. Daily Housekeeping & Area SOP"
                      className="form-input"
                      style={{ flex: 1, minHeight: "44px", fontSize: "0.95rem", fontWeight: 600 }}
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Category Archetype</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="form-select"
                      style={{ minHeight: "38px" }}
                    >
                      <option value="HOUSEKEEPING">🧹 Housekeeping &amp; Area SOPs</option>
                      <option value="TEMPERATURE">🧊 Temperature &amp; Cold Chain</option>
                      <option value="EQUIPMENT">⚙️ Equipment Cleaning Log</option>
                      <option value="SAFETY_GLASS">🪟 Safety, Glass &amp; Pest</option>
                      <option value="CHEMICAL">🧪 Chemical Sanitizer &amp; PPM</option>
                      <option value="COOKING_HACCP">🍳 Cooking Core &amp; Hot Holding</option>
                      <option value="RAW_MATERIAL_MANUFACTURING">🏭 Raw Material &amp; Batch QA</option>
                      <option value="CLOUD_KITCHEN_DISPATCH">🛵 Cloud Kitchen Dispatch</option>
                      <option value="CAFE_BAKERY">☕ Cafe, Bakery &amp; Roastery</option>
                      <option value="FSSAI_COMPLIANCE">🇮🇳 FSSAI Schedule 4 &amp; Oil TPC</option>
                      <option value="MAINTENANCE">🗓️ Periodic Maintenance</option>
                      <option value="CUSTOM">✨ Custom Category Name...</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Audit Frequency</label>
                    <select
                      value={frequency}
                      onChange={(e) => setFrequency(e.target.value)}
                      className="form-select"
                      style={{ minHeight: "38px" }}
                    >
                      <option value="SHIFT_WISE">Shift-Wise (Morning, Evening, etc.)</option>
                      <option value="DAILY">Daily (Once per day)</option>
                      <option value="WEEKLY">Weekly</option>
                      <option value="MONTHLY">Monthly</option>
                    </select>
                  </div>
                </div>

                <div className="form-row-2" style={{ marginTop: "0.6rem" }}>
                  <div className="form-group">
                    <label>URL Slug *</label>
                    <input
                      type="text"
                      required
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      placeholder="e.g. daily-housekeeping-sop"
                      className="form-input"
                      disabled={!!editingTemplate}
                      style={{ fontSize: "0.85rem", color: "#4B5563", minHeight: "38px" }}
                    />
                  </div>

                  <div className="form-group">
                    <label>Description (Optional)</label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Instructions for operators and supervisors..."
                      className="form-input"
                      style={{ fontSize: "0.85rem", minHeight: "38px" }}
                    />
                  </div>
                </div>

                {category === "CUSTOM" && (
                  <div className="form-group" style={{ marginTop: "0.6rem" }}>
                    <label>Custom Category Name *</label>
                    <input
                      type="text"
                      required
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="e.g. OIL_FRYER_LOG, ALLERGEN_AUDIT, PERSONAL_HYGIENE"
                      className="form-input"
                      style={{ minHeight: "38px" }}
                    />
                  </div>
                )}

                {/* Shift Configuration if SHIFT_WISE */}
                {frequency === "SHIFT_WISE" && (
                  <div className="form-group shift-config-box" style={{ marginTop: "1rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                      <label style={{ margin: 0, fontWeight: 700, fontSize: "0.82rem", color: "#111827" }}>
                        Required Operational Shifts ({shifts.length} active)
                      </label>
                      <span className="field-hint" style={{ margin: 0 }}>Select shifts that must log this SOP</span>
                    </div>

                    <div className="shift-tags-row">
                      {availableShiftsPool.map((s) => {
                        const isChecked = shifts.includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => {
                              if (isChecked) {
                                setShifts(shifts.filter((x) => x !== s));
                              } else {
                                setShifts([...shifts, s]);
                              }
                            }}
                            className={`shift-pill-btn ${isChecked ? "active" : ""}`}
                          >
                            <span>{isChecked ? "✓" : "+"}</span>
                            <span>{s} Shift</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Add Custom Shift to Template */}
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                      <input
                        type="text"
                        value={customShiftInput}
                        onChange={(e) => setCustomShiftInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomShift();
                          }
                        }}
                        placeholder="Add custom shift (e.g. Closing, Late Night)..."
                        className="form-input"
                        style={{ flex: 1, fontSize: "0.82rem", minHeight: "34px" }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomShift}
                        className="btn-add-item-small"
                        style={{ padding: "0.35rem 0.85rem" }}
                      >
                        ➕ Add Shift
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Sections & Checkpoint Builder */}
              <div className="form-section-card">
                <div className="section-header-bar">
                  <div>
                    <h3 className="section-subtitle">2. Sections & Inspection Checkpoints</h3>
                    <p className="field-hint">
                      Add sections and checkpoint rows. For Temperature categories, specify min/max safe temperature tolerances.
                    </p>
                  </div>
                  <div className="builder-mode-tabs">
                    <button
                      type="button"
                      onClick={() => setBuilderMode("visual")}
                      className={`mode-tab-btn ${builderMode === "visual" ? "active" : ""}`}
                    >
                      🎨 Visual Builder
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderMode("bulk")}
                      className={`mode-tab-btn ${builderMode === "bulk" ? "active" : ""}`}
                    >
                      📝 Bulk Quick-Paste
                    </button>
                    <button
                      type="button"
                      onClick={() => setBuilderMode("preview")}
                      className={`mode-tab-btn ${builderMode === "preview" ? "active" : ""}`}
                    >
                      👁️ Live Preview
                    </button>
                  </div>
                </div>

                {/* Mode 1: Visual Structured Builder */}
                {builderMode === "visual" && (
                  <div className="visual-builder-container">
                    {sections.map((sec, secIdx) => (
                      <div key={sec.id || secIdx} className="builder-section-card">
                        <div className="builder-section-header">
                          <div className="section-title-input-wrap">
                            <span className="sec-number">Section {secIdx + 1}:</span>
                            <input
                              type="text"
                              value={sec.title}
                              onChange={(e) => handleUpdateSectionTitle(secIdx, e.target.value)}
                              placeholder="Section Title (e.g. Kitchen Cold Storage)"
                              className="section-title-input"
                            />
                          </div>
                          <div className="section-actions">
                            <button
                              type="button"
                              onClick={() => handleAddItem(secIdx)}
                              className="btn-add-item-small"
                            >
                              <IconPlus />
                              <span>Add Item</span>
                            </button>
                            {sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleDeleteSection(secIdx)}
                                className="btn-delete-section"
                                title="Delete Section"
                                aria-label="Delete Section"
                              >
                                <IconTrash />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="builder-items-list">
                          {sec.items.map((item, itemIdx) => (
                            <div key={item.id || itemIdx} className="builder-item-card">
                              <div className="builder-item-main-row">
                                <span className="item-index">{itemIdx + 1}</span>

                                <div className="item-input-main">
                                  <input
                                    type="text"
                                    value={item.name}
                                    onChange={(e) =>
                                      handleUpdateItem(secIdx, itemIdx, "name", e.target.value)
                                    }
                                    placeholder="Checkpoint / Equipment / Task Name"
                                    className="item-name-field"
                                  />
                                </div>

                                {/* Item Type Selector */}
                                <div className="item-type-col">
                                  <select
                                    value={item.itemType || (category === "TEMPERATURE" ? "TEMPERATURE" : "STATUS")}
                                    onChange={(e) =>
                                      handleUpdateItem(secIdx, itemIdx, "itemType", e.target.value as ItemInputType)
                                    }
                                    className="item-select"
                                    title="Checkpoint Input Type"
                                  >
                                    <option value="STATUS">✓/✕ Pass / Fail</option>
                                    <option value="TEMPERATURE">🧊 Temperature</option>
                                    <option value="NUMERIC">🔢 Numeric / PPM</option>
                                    <option value="CLEAN_DIRTY">🧼 Clean / Action</option>
                                    <option value="TEXT">📝 Text / Notes</option>
                                    <option value="TIME">🕒 Time Verification</option>
                                  </select>
                                </div>

                                {/* Assignee */}
                                <div className="item-assignee-col">
                                  <select
                                    value={item.defaultAssignee || DEFAULT_STAFF[0]}
                                    onChange={(e) =>
                                      handleUpdateItem(secIdx, itemIdx, "defaultAssignee", e.target.value)
                                    }
                                    className="item-select"
                                  >
                                    {DEFAULT_STAFF.map((st) => (
                                      <option key={st} value={st}>
                                        {st}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Delete Item */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(secIdx, itemIdx)}
                                  className="btn-delete-item"
                                  title="Remove checkpoint"
                                >
                                  ✕
                                </button>
                              </div>

                              {/* Temperature Specific Columns */}
                              {(item.itemType === "TEMPERATURE" || (!item.itemType && category === "TEMPERATURE")) && (
                                <div className="builder-item-extra-row">
                                  <span className="extra-row-label">Safe Range:</span>
                                  <div className="temp-range-inputs">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={item.targetMinTemp ?? 2}
                                      onChange={(e) =>
                                        handleUpdateItem(
                                          secIdx,
                                          itemIdx,
                                          "targetMinTemp",
                                          parseFloat(e.target.value)
                                        )
                                      }
                                      placeholder="Min"
                                      className="temp-num-input"
                                      title="Minimum Safe Temperature (°C)"
                                    />
                                    <span className="temp-to">to</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={item.targetMaxTemp ?? 8}
                                      onChange={(e) =>
                                        handleUpdateItem(
                                          secIdx,
                                          itemIdx,
                                          "targetMaxTemp",
                                          parseFloat(e.target.value)
                                        )
                                      }
                                      placeholder="Max"
                                      className="temp-num-input"
                                      title="Maximum Safe Temperature (°C)"
                                    />
                                    <span className="temp-unit">°C</span>
                                  </div>

                                  <div className="unit-number-wrap">
                                    <span className="extra-row-label">Unit #:</span>
                                    <input
                                      type="text"
                                      value={item.machineNumber || `${itemIdx + 1}`}
                                      onChange={(e) =>
                                        handleUpdateItem(
                                          secIdx,
                                          itemIdx,
                                          "machineNumber",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Unit #"
                                      className="unit-num-input"
                                      title="Machine / Unit Number"
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Numeric / Chemical Specific Columns */}
                              {item.itemType === "NUMERIC" && (
                                <div className="builder-item-extra-row">
                                  <span className="extra-row-label">Tolerance:</span>
                                  <div className="temp-range-inputs">
                                    <input
                                      type="number"
                                      value={item.minAllowed ?? 150}
                                      onChange={(e) =>
                                        handleUpdateItem(secIdx, itemIdx, "minAllowed", parseFloat(e.target.value))
                                      }
                                      placeholder="Min"
                                      className="temp-num-input"
                                    />
                                    <span className="temp-to">to</span>
                                    <input
                                      type="number"
                                      value={item.maxAllowed ?? 400}
                                      onChange={(e) =>
                                        handleUpdateItem(secIdx, itemIdx, "maxAllowed", parseFloat(e.target.value))
                                      }
                                      placeholder="Max"
                                      className="temp-num-input"
                                    />
                                    <input
                                      type="text"
                                      value={item.unitLabel || "PPM"}
                                      onChange={(e) =>
                                        handleUpdateItem(secIdx, itemIdx, "unitLabel", e.target.value)
                                      }
                                      placeholder="Unit"
                                      className="unit-num-input"
                                      style={{ width: "55px" }}
                                    />
                                  </div>
                                </div>
                              )}

                              {/* Text Specific Columns */}
                              {item.itemType === "TEXT" && (
                                <div className="builder-item-extra-row">
                                  <span className="extra-row-label">Field Hint:</span>
                                  <input
                                    type="text"
                                    value={item.placeholder || ""}
                                    onChange={(e) =>
                                      handleUpdateItem(secIdx, itemIdx, "placeholder", e.target.value)
                                    }
                                    placeholder="e.g. Enter lot / serial number..."
                                    className="item-name-field"
                                    style={{ flex: 1, minHeight: "30px" }}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="btn-add-section-dashed"
                    >
                      ➕ Add Another Section
                    </button>
                  </div>
                )}

                {/* Mode 2: Bulk Text Editor */}
                {builderMode === "bulk" && (
                  <div className="bulk-builder-container">
                    <p className="field-hint">
                      Paste or type checkpoint items one per line. Clicking "Apply Items" will automatically populate the visual checklist.
                    </p>
                    <textarea
                      rows={8}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Kitchen Fryer 1&#10;Main Convection Oven&#10;Cold Prep Table&#10;Dishwashing Sink"
                      className="form-textarea"
                    />
                    <button
                      type="button"
                      onClick={handleApplyBulkText}
                      className="btn-apply-bulk"
                    >
                      ⚡ Apply & Convert to Checkpoints
                    </button>
                  </div>
                )}

                {/* Mode 3: Live Preview */}
                {builderMode === "preview" && (
                  <div className="preview-container">
                    <div className="preview-header-mock">
                      <span className="preview-badge">{category}</span>
                      <h4>{title || "Untitled Template"}</h4>
                      <p>{description || "No description provided."}</p>
                    </div>

                    {sections.map((sec, sIdx) => (
                      <div key={sIdx} className="preview-section-mock">
                        <div className="preview-section-title">{sec.title}</div>
                        <table className="preview-table-mock">
                          <thead>
                            <tr>
                              <th>Checkpoint</th>
                              <th>Default Assignee</th>
                              {category === "TEMPERATURE" && <th>Tolerance</th>}
                              <th>Preview Input</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sec.items.map((it, iIdx) => (
                              <tr key={iIdx}>
                                <td className="font-semibold">{it.name}</td>
                                <td>{it.defaultAssignee || "Staff"}</td>
                                {category === "TEMPERATURE" && (
                                  <td>
                                    <span className="safe-range-badge">
                                      {it.targetMinTemp}°C to {it.targetMaxTemp}°C
                                    </span>
                                  </td>
                                )}
                                <td>
                                  {category === "TEMPERATURE" ? (
                                    <select disabled className="mock-input" style={{ width: "100%", padding: "0.35rem 0.5rem", borderRadius: "4px" }}>
                                      <option>{it.targetMinTemp !== undefined ? `${((it.targetMinTemp + (it.targetMaxTemp ?? 8)) / 2).toFixed(1)}°C (Optimal)` : "4.0°C (Safe)"}</option>
                                    </select>
                                  ) : (
                                    <div className="touch-btn-toggle" style={{ opacity: 0.9 }}>
                                      <button type="button" className="touch-btn-option active-yes" style={{ padding: "0.2rem 0.45rem", fontSize: "0.7rem" }}>
                                        ✓ YES
                                      </button>
                                      <button type="button" className="touch-btn-option" style={{ padding: "0.2rem 0.45rem", fontSize: "0.7rem" }}>
                                        ✕ NO
                                      </button>
                                      <button type="button" className="touch-btn-option" style={{ padding: "0.2rem 0.45rem", fontSize: "0.7rem" }}>
                                        — N/A
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Outlet Distribution */}
              <div className="form-section-card">
                <div className="outlet-assign-header">
                  <h3 className="section-subtitle">3. Assign Report Tab to Facilities & Outlets</h3>
                  <div className="outlet-quick-buttons">
                    <button
                      type="button"
                      onClick={() => setSelectedOutlets(outlets.map((o) => o.id))}
                      className="btn-link-small"
                    >
                      Select All
                    </button>
                    <span>•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedOutlets([])}
                      className="btn-link-small"
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div className="outlet-checkboxes-grid">
                  {outlets.map((o) => {
                    const isSelected = selectedOutlets.includes(o.id);
                    return (
                      <label key={o.id} className={`outlet-checkbox-card ${isSelected ? "selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedOutlets([...selectedOutlets, o.id]);
                            } else {
                              setSelectedOutlets(selectedOutlets.filter((id) => id !== o.id));
                            }
                          }}
                          style={{ accentColor: "#059669", width: "16px", height: "16px" }}
                        />
                        <span>
                          {o.icon} {o.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Archive Status Toggle (when editing existing template) */}
              {editingTemplate && (
                <div
                  className="form-section-card"
                  style={{
                    background: isArchived ? "#fff7ed" : "#f8fafc",
                    border: isArchived ? "1px solid #fed7aa" : "1px solid var(--border)",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: 600, fontSize: "0.95rem" }}>
                    <input
                      type="checkbox"
                      checked={isArchived}
                      onChange={(e) => setIsArchived(e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#ea580c" }}
                    />
                    <span>📦 Archive this Report Tab</span>
                  </label>
                  <p style={{ margin: "6px 0 0 28px", fontSize: "0.82rem", color: "#64748b" }}>
                    Archiving hides this tab from active daily outlet checklists and operator navigation while preserving all historical audit submissions.
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="modal-actions-bar">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-cancel"
                >
                  Cancel
                </button>
                <div className="modal-summary-pill">
                  <span>📋</span>
                  <span>{sections.reduce((acc, s) => acc + s.items.length, 0)} Checkpoints • {sections.length} Section{sections.length === 1 ? "" : "s"}</span>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary-save"
                >
                  {saving ? "Saving Report Tab..." : editingTemplate ? "Update Report Tab" : "Create Report Tab"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        title="Template Management Paywalled"
        description="Customizing checklists, adding new reporting sections, or archiving templates requires an active OVYRO FDA subscription via Dodo Payments."
      />
    </div>
  );
}
