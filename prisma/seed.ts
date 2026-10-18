import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── GENERIC STARTER TEMPLATES ────────────────────────────────────────────────

const GENERIC_HOUSEKEEPING_SCHEMA = {
  type: "HOUSEKEEPING",
  shifts: ["Morning", "Evening"],
  allowPhotoEvidence: true,
  sections: [
    {
      id: "sec-kitchen",
      title: "Food Preparation & Cooking Area",
      items: [
        { id: "hk-1", name: "Main Floor & Drains Washed", defaultAssignee: "Staff Member" },
        { id: "hk-2", name: "Food Prep Tables & Stainless Surfaces Sanitized", defaultAssignee: "Staff Member" },
        { id: "hk-3", name: "Wash Sinks, Faucets & Grease Trap", defaultAssignee: "Staff Member" },
        { id: "hk-4", name: "Cooking Range, Grills & Hood Exhaust", defaultAssignee: "Staff Member" },
        { id: "hk-5", name: "Waste Dustbins Emptied & Relined", defaultAssignee: "Staff Member" },
      ],
    },
    {
      id: "sec-service",
      title: "Service, Dining & Storage Areas",
      items: [
        { id: "hk-6", name: "Service Counter & POS Terminal", defaultAssignee: "Staff Member" },
        { id: "hk-7", name: "Tables, Chairs & High-Touch Points", defaultAssignee: "Staff Member" },
        { id: "hk-8", name: "Restrooms & Handwash Stations Cleaned", defaultAssignee: "Staff Member" },
        { id: "hk-9", name: "Dry Storage Racks & Inventory Area", defaultAssignee: "Staff Member" },
      ],
    },
  ],
};

const GENERIC_TEMPERATURE_SCHEMA = {
  type: "TEMPERATURE",
  unit: "°C",
  allowPhotoEvidence: true,
  sections: [
    {
      id: "sec-cold-storage",
      title: "Refrigeration & Cold Storage Units",
      items: [
        { id: "temp-1", name: "Main Walk-in / Reach-in Chiller", machineNumber: "1", referenceTemp: "+2 to +6°C", targetMinTemp: 2, targetMaxTemp: 6 },
        { id: "temp-2", name: "Under-counter Prep Chiller", machineNumber: "2", referenceTemp: "+3 to +8°C", targetMinTemp: 3, targetMaxTemp: 8 },
        { id: "temp-3", name: "Deep Storage Freezer", machineNumber: "1", referenceTemp: "-22 to -18°C", targetMinTemp: -22, targetMaxTemp: -18 },
        { id: "temp-4", name: "Display Cooler / Beverage Refrigerator", machineNumber: "1", referenceTemp: "+2 to +8°C", targetMinTemp: 2, targetMaxTemp: 8 },
      ],
    },
  ],
};

const GENERIC_EQUIPMENT_SCHEMA = {
  type: "EQUIPMENT",
  allowPhotoEvidence: true,
  sections: [
    {
      id: "sec-machinery",
      title: "Kitchen & Production Machinery",
      items: [
        { id: "eq-1", name: "Commercial Oven / Baking Chamber", category: "Cooking", defaultAssignee: "Staff Member" },
        { id: "eq-2", name: "Fryer / Cooking Range", category: "Cooking", defaultAssignee: "Staff Member" },
        { id: "eq-3", name: "Mixer / Food Processor", category: "Prep Tools", defaultAssignee: "Staff Member" },
        { id: "eq-4", name: "Coffee Machine / Beverage Dispenser", category: "Beverage", defaultAssignee: "Staff Member" },
        { id: "eq-5", name: "Refrigeration Exterior & Door Gaskets", category: "Cold Storage", defaultAssignee: "Staff Member" },
      ],
    },
  ],
};

const GENERIC_SAFETY_SCHEMA = {
  type: "SAFETY_GLASS",
  sections: [
    {
      id: "sec-safety",
      title: "Facility, Glass & Pest Safety",
      items: [
        { id: "sf-1", name: "Main Glass Doors & Frontage Panels", defaultAssignee: "Staff Member" },
        { id: "sf-2", name: "Display Counter Glass Enclosures", defaultAssignee: "Staff Member" },
        { id: "sf-3", name: "Pest Control Bait Stations & Fly Catchers", defaultAssignee: "Staff Member" },
        { id: "sf-4", name: "Emergency Exits & Fire Extinguisher Seals", defaultAssignee: "Supervisor" },
      ],
    },
  ],
};

async function main() {
  const existingOrgCount = await prisma.organization.count();
  if (existingOrgCount > 0 && process.env.FORCE_SEED !== "true") {
    console.log("ℹ️ Database is already initialized. Skipping seed to protect production data.");
    console.log("💡 (Tip: Set FORCE_SEED=true if you explicitly wish to reset and re-seed the database).");
    return;
  }

  console.log("🧹 Initializing clean multi-tenant SaaS workspace...");

  // 1. Wipe old submission and template mappings
  await prisma.formSubmission.deleteMany({});
  await prisma.userTemplateAccess.deleteMany({});
  await prisma.outletTemplate.deleteMany({});
  await prisma.formTemplate.deleteMany({});
  await prisma.userOutlet.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.customRole.deleteMany({});
  await prisma.outlet.deleteMany({});
  await prisma.organization.deleteMany({});

  console.log("✨ All previous data cleared successfully.");

  const defaultPassword = await bcrypt.hash("Admin@123", 12);
  const staffPassword = await bcrypt.hash("Staff@123", 12);

  // 2. Create Brand / Organization
  const org = await prisma.organization.create({
    data: {
      name: "My Enterprise Kitchen",
      slug: "my-enterprise",
      plan: "PRO",
      status: "ACTIVE",
      settings: JSON.stringify({
        timezone: "Asia/Kolkata",
        currency: "INR",
        branding: {
          primaryColor: "#059669",
          companyName: "My Enterprise Kitchen",
        },
      }),
    },
  });

  console.log(`✅ Organization created: ${org.name}`);

  // 3. Create Dynamic Roles
  const supervisorRole = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: "Shift Supervisor",
      description: "Shift supervisor with audit verification and sign-off authority",
      permissions: JSON.stringify(["submit_checklists", "supervisor_signoff", "view_reports"]),
    },
  });

  const managerRole = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: "General Manager",
      description: "Facility manager with full reporting, team and outlet access",
      permissions: JSON.stringify([
        "submit_checklists",
        "supervisor_signoff",
        "view_reports",
        "export_audit_pack",
        "manage_team",
      ]),
    },
  });

  const chefRole = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: "Head Chef / Kitchen Lead",
      description: "Kitchen leader managing food safety and recipe sanitation SOPs",
      permissions: JSON.stringify(["submit_checklists", "supervisor_signoff", "view_reports"]),
    },
  });

  const workerRole = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: "Line Worker / Cleaner",
      description: "Floor staff responsible for executing daily housekeeping and equipment logs",
      permissions: JSON.stringify(["submit_checklists"]),
    },
  });

  const auditorRole = await prisma.customRole.create({
    data: {
      organizationId: org.id,
      name: "Quality Auditor",
      description: "Quality assurance auditor with export and inspection permissions",
      permissions: JSON.stringify(["submit_checklists", "view_reports", "export_audit_pack"]),
    },
  });

  console.log("✅ Dynamic Custom Roles created (Supervisor, GM, Chef, Staff, Quality Auditor)!");

  // 4. Create Initial Starter Outlet
  const outlet = await prisma.outlet.create({
    data: {
      organizationId: org.id,
      name: "Main Facility & Kitchen",
      code: "MAIN-01",
      type: "RESTAURANT",
      icon: "🏢",
      address: "123 Business Boulevard",
      shifts: JSON.stringify(["Morning", "Evening"]),
    },
  });

  console.log(`✅ Facility created: ${outlet.name} (${outlet.code})`);

  // 5. Create Admin & Supervisor Users
  const admin = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Admin User",
      email: "admin@reporting.app",
      passwordHash: defaultPassword,
      role: "ORG_ADMIN",
      permissions: JSON.stringify([
        "submit_checklists",
        "supervisor_signoff",
        "view_reports",
        "export_audit_pack",
        "manage_templates",
        "manage_outlets",
        "manage_team",
      ]),
    },
  });

  const supervisor = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: "Supervisor Lead",
      email: "supervisor@reporting.app",
      passwordHash: staffPassword,
      role: "SUPERVISOR",
      customRoleId: supervisorRole.id,
      permissions: JSON.stringify(["submit_checklists", "supervisor_signoff", "view_reports"]),
    },
  });

  // Link admin & supervisor to the main outlet
  await prisma.userOutlet.createMany({
    data: [
      { userId: admin.id, outletId: outlet.id, role: "ORG_ADMIN" },
      { userId: supervisor.id, outletId: outlet.id, role: "SUPERVISOR" },
    ],
  });

  console.log("✅ Admin & Supervisor accounts created.");

  // 6. Create Starter Templates
  const templates = [
    {
      slug: "daily-hygiene-sop",
      title: "Daily Housekeeping & Hygiene SOP",
      category: "HOUSEKEEPING",
      icon: "🧹",
      description: "Daily hygiene & sanitization checklist across production and service areas",
      frequency: "SHIFT_WISE",
      schema: GENERIC_HOUSEKEEPING_SCHEMA,
    },
    {
      slug: "temperature-log",
      title: "Cold Chain & Refrigeration Log",
      category: "TEMPERATURE",
      icon: "🧊",
      description: "Chillers, walk-ins and freezers temperature monitoring with safe tolerances",
      frequency: "DAILY",
      schema: GENERIC_TEMPERATURE_SCHEMA,
    },
    {
      slug: "equipment-cleaning",
      title: "Kitchen Equipment Cleaning Log",
      category: "EQUIPMENT",
      icon: "⚙️",
      description: "Machinery, ovens, fryers and prep tools cleaning schedule",
      frequency: "DAILY",
      schema: GENERIC_EQUIPMENT_SCHEMA,
    },
    {
      slug: "facility-safety",
      title: "Facility, Glass & Pest Inspection",
      category: "SAFETY_GLASS",
      icon: "🪟",
      description: "Glass panels, pest control traps and facility integrity checks",
      frequency: "DAILY",
      schema: GENERIC_SAFETY_SCHEMA,
    },
  ];

  for (const [idx, t] of templates.entries()) {
    const template = await prisma.formTemplate.create({
      data: {
        organizationId: org.id,
        title: t.title,
        slug: t.slug,
        category: t.category,
        icon: t.icon,
        description: t.description,
        frequency: t.frequency,
        schema: JSON.stringify(t.schema),
      },
    });

    await prisma.outletTemplate.create({
      data: {
        outletId: outlet.id,
        templateId: template.id,
        order: idx,
        isEnabled: true,
      },
    });
  }

  console.log("✅ Generic starter templates created and assigned to Main Facility.");
  console.log("\n🎉 CLEAN SLATE READY!");
  console.log("-----------------------------------------");
  console.log("🔑 Admin Login: admin@reporting.app");
  console.log("🔑 Password:   Admin@123");
  console.log("🔑 Supervisor: supervisor@reporting.app / Staff@123");
  console.log("-----------------------------------------\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
