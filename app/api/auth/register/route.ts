import { NextResponse, NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, orgName, outletName } = body;

    if (!email || !password || !name) {
      return NextResponse.json(
        { error: "Name, email, and password are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user email already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please sign in." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password.trim(), 10);
    const resolvedOrgName = (orgName || `${name}'s Kitchen`).trim();
    const orgSlug = `${resolvedOrgName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now().toString().slice(-4)}`;
    const resolvedOutletName = (outletName || "Main Kitchen").trim();

    // 1. Create Organization (Starts in PENDING subscription preview state)
    const organization = await prisma.organization.create({
      data: {
        name: resolvedOrgName,
        slug: orgSlug,
        plan: "PRO",
        billingStatus: "PENDING",
        billingInterval: "ANNUAL",
        monthlyFee: 5000,
        contactEmail: cleanEmail,
        dodoSubscriptionId: null,
        nextBillingDate: null,
        lastPaymentDate: null,
        status: "ACTIVE",
        settings: JSON.stringify({
          timezone: "Asia/Kolkata",
          currency: "INR",
          shifts: ["Morning", "Evening", "Night"],
        }),
      },
    });

    // 2. Create Default Custom Roles
    const roles = [
      {
        name: "General Manager",
        description: "Full management permissions across all outlets",
        permissions: JSON.stringify([
          "manage_organization",
          "manage_templates",
          "manage_outlets",
          "manage_users",
          "submit_checklists",
          "verify_checklists",
          "export_reports",
        ]),
        isSystem: true,
      },
      {
        name: "Shift Supervisor",
        description: "Verify daily audits and supervise shift staff",
        permissions: JSON.stringify([
          "submit_checklists",
          "verify_checklists",
          "export_reports",
        ]),
        isSystem: true,
      },
      {
        name: "Kitchen Staff",
        description: "Execute and log daily operational checklists",
        permissions: JSON.stringify(["submit_checklists"]),
        isSystem: true,
      },
    ];

    for (const r of roles) {
      await prisma.customRole.create({
        data: {
          organizationId: organization.id,
          ...r,
        },
      });
    }

    // 3. Create Default Outlet / Facility
    const outlet = await prisma.outlet.create({
      data: {
        organizationId: organization.id,
        name: resolvedOutletName,
        code: "OUT-01",
        type: "RESTAURANT",
        icon: "🏢",
        shifts: JSON.stringify(["Morning", "Evening"]),
      },
    });

    // 4. Create User as ORG_ADMIN
    const user = await prisma.user.create({
      data: {
        organizationId: organization.id,
        name: name.trim(),
        email: cleanEmail,
        passwordHash,
        role: "ORG_ADMIN",
        permissions: JSON.stringify([
          "manage_organization",
          "manage_templates",
          "manage_outlets",
          "manage_users",
          "submit_checklists",
          "verify_checklists",
          "export_reports",
        ]),
      },
    });

    // Link user to outlet
    await prisma.userOutlet.create({
      data: {
        userId: user.id,
        outletId: outlet.id,
        role: "ORG_ADMIN",
      },
    });

    // 5. Create Starter Report Tabs / Templates
    const starterTemplates = [
      {
        title: "Daily Housekeeping & Hygiene SOP",
        slug: "daily-housekeeping-hygiene",
        category: "HOUSEKEEPING",
        icon: "🧹",
        frequency: "SHIFT_WISE",
        description: "Daily hygiene & sanitization checklist across production and service areas",
        schema: JSON.stringify({
          sections: [
            {
              id: "sec-1",
              title: "Kitchen & Production Areas",
              items: [
                { id: "hk-1", name: "Floors and Drains scrubbed & sanitized", defaultAssignee: "Staff Member" },
                { id: "hk-2", name: "Stainless Steel Prep Tables sanitized with food-grade disinfectant", defaultAssignee: "Staff Member" },
                { id: "hk-3", name: "Dishwashing area and grease trap cleaned", defaultAssignee: "Staff Member" },
                { id: "hk-4", name: "Trash bins emptied, washed & fresh liners installed", defaultAssignee: "Staff Member" },
              ],
            },
            {
              id: "sec-2",
              title: "Customer & Service Area",
              items: [
                { id: "hk-5", name: "Service counters and billing desk wiped & disinfected", defaultAssignee: "Staff Member" },
                { id: "hk-6", name: "Restroom hygiene, liquid soap & paper towels stocked", defaultAssignee: "Staff Member" },
              ],
            },
          ],
        }),
      },
      {
        title: "Cold Chain & Refrigeration Log",
        slug: "cold-chain-refrigeration-log",
        category: "TEMPERATURE",
        icon: "🧊",
        frequency: "DAILY",
        description: "HACCP compliant temperature monitoring for chillers, walk-ins and freezers.",
        schema: JSON.stringify({
          sections: [
            {
              id: "sec-1",
              title: "Refrigeration & Freezer Units",
              items: [
                { id: "tc-1", name: "Walk-in Cooler / Meat Chiller", machineNumber: "1", targetMinTemp: 0.5, targetMaxTemp: 4.0 },
                { id: "tc-2", name: "Dairy & Produce Refrigerator", machineNumber: "2", targetMinTemp: 1.0, targetMaxTemp: 5.0 },
                { id: "tc-3", name: "Deep Freezer / Ice Cream Unit", machineNumber: "3", targetMinTemp: -22.0, targetMaxTemp: -18.0 },
                { id: "tc-4", name: "Front Pastry Display Chiller", machineNumber: "4", targetMinTemp: 2.0, targetMaxTemp: 8.0 },
              ],
            },
          ],
        }),
      },
      {
        title: "Kitchen Equipment Cleaning Log",
        slug: "kitchen-equipment-cleaning",
        category: "EQUIPMENT",
        icon: "⚙️",
        frequency: "DAILY",
        description: "Sanitization and cleaning schedule for all kitchen and cafe machinery.",
        schema: JSON.stringify({
          sections: [
            {
              id: "sec-1",
              title: "Heavy Cooking Machinery",
              items: [
                { id: "eq-1", name: "Commercial Oven & Trays", category: "Cooking", defaultAssignee: "Staff Member" },
                { id: "eq-2", name: "Deep Fryer Oil Filtered & Basin Cleaned", category: "Cooking", defaultAssignee: "Staff Member" },
                { id: "eq-3", name: "Espresso Machine Group Heads Backflushed", category: "Beverage", defaultAssignee: "Staff Member" },
              ],
            },
          ],
        }),
      },
    ];

    let order = 0;
    for (const tpl of starterTemplates) {
      const createdTpl = await prisma.formTemplate.create({
        data: {
          organizationId: organization.id,
          ...tpl,
        },
      });

      await prisma.outletTemplate.create({
        data: {
          outletId: outlet.id,
          templateId: createdTpl.id,
          order: order++,
          isEnabled: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Account and workspace registered successfully!",
      email: cleanEmail,
    });
  } catch (error: any) {
    console.error("[REGISTER_ERROR]", error);
    const msg = String(error?.message || "");
    const isDbError =
      msg.includes("PrismaClient") ||
      msg.includes("database server") ||
      msg.includes("Can't reach database") ||
      msg.includes("FATAL") ||
      msg.includes("tenant/user");

    return NextResponse.json(
      {
        error: isDbError
          ? "Database service is temporarily unavailable. Please verify database connectivity."
          : (error.message || "Failed to create account. Please try again."),
      },
      { status: 500 }
    );
  }
}
