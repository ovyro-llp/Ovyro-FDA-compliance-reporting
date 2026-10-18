import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformOwner } from "@/lib/permissions";
import { createDodoCheckoutSession, syncOrganizationWithDodo, DODO_CONFIG } from "@/lib/dodo";
import bcrypt from "bcryptjs";

// GET: Fetch global SaaS platform metrics & all client organizations in sync with Dodo Payments
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string };
  if (!isPlatformOwner(user)) {
    return NextResponse.json({ error: "Forbidden: SaaS Platform Owner access required" }, { status: 403 });
  }

  try {
    const [
      totalClients,
      totalUsers,
      totalOutlets,
      totalSubmissions,
      organizations,
    ] = await Promise.all([
      prisma.organization.count(),
      prisma.user.count(),
      prisma.outlet.count(),
      prisma.formSubmission.count(),
      prisma.organization.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: {
              users: true,
              outlets: true,
              templates: true,
              submissions: true,
            },
          },
          billingRecords: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
      }),
    ]);

    // Calculate SaaS Financials in INR
    let totalRevenueReceived = 0;
    let totalRevenuePending = 0;

    for (const org of organizations) {
      const fee = org.monthlyFee || (org.plan === "ENTERPRISE" ? 5000 : 500);
      if (org.billingStatus === "PAID") {
        totalRevenueReceived += fee;
      } else {
        totalRevenuePending += fee;
      }
    }

    return NextResponse.json({
      metrics: {
        totalClients,
        totalUsers,
        totalOutlets,
        totalSubmissions,
        totalRevenueReceived,
        totalRevenuePending,
        mrr: totalRevenueReceived,
        paymentProvider: "DODO_PAYMENTS",
      },
      dodoProducts: DODO_CONFIG.products,
      organizations,
    });
  } catch (err: any) {
    console.error("[PLATFORM_API_GET_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to load platform data" }, { status: 500 });
  }
}

// POST: Onboard a brand new SaaS client organization and create their Dodo Payments checkout session
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string };
  if (!isPlatformOwner(user)) {
    return NextResponse.json({ error: "Forbidden: SaaS Platform Owner access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const {
      name,
      slug,
      contactEmail,
      contactPhone,
      adminName,
      adminPassword,
      plan = "PRO",
      facilityType = "RESTAURANT",
      facilityName,
      industryPreset = "RESTAURANT",
      billingInterval = "MONTHLY",
    } = body;

    if (!name || !contactEmail || !adminPassword) {
      return NextResponse.json({ error: "Company name, contact email, and admin password are required" }, { status: 400 });
    }

    const cleanSlug = (slug || name)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-");

    const existingOrg = await prisma.organization.findUnique({
      where: { slug: cleanSlug },
    });

    if (existingOrg) {
      return NextResponse.json({ error: `Organization with slug "${cleanSlug}" already exists` }, { status: 409 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email: contactEmail.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json({ error: `User with email "${contactEmail}" already exists` }, { status: 409 });
    }

    // Determine Dodo Product & Pricing
    const isAnnual = billingInterval === "ANNUAL" || plan === "ENTERPRISE";
    const selectedProduct = isAnnual ? DODO_CONFIG.products.ANNUAL : DODO_CONFIG.products.MONTHLY;

    const nextMonth = new Date();
    if (isAnnual) {
      nextMonth.setFullYear(nextMonth.getFullYear() + 1);
    } else {
      nextMonth.setMonth(nextMonth.getMonth() + 1);
    }

    // 1. Create Organization with Dodo Payments as exclusive provider
    const org = await prisma.organization.create({
      data: {
        name,
        slug: cleanSlug,
        plan: selectedProduct.planCode,
        status: "ACTIVE",
        contactEmail: contactEmail.toLowerCase().trim(),
        contactPhone: contactPhone || "",
        monthlyFee: selectedProduct.priceINR,
        billingInterval: selectedProduct.interval,
        dodoProductId: selectedProduct.id,
        paymentProvider: "DODO_PAYMENTS",
        billingStatus: "PENDING",
        nextBillingDate: nextMonth,
        settings: JSON.stringify({
          timezone: "Asia/Kolkata",
          currency: "INR",
          industryPreset,
        }),
      },
    });

    // 2. Create Dynamic Roles for the new Client
    await prisma.customRole.create({
      data: {
        organizationId: org.id,
        name: "Shift Supervisor",
        description: "Floor supervisor with audit verification and sign-off authority",
        permissions: JSON.stringify(["submit_checklists", "supervisor_signoff", "view_reports"]),
      },
    });

    await prisma.customRole.create({
      data: {
        organizationId: org.id,
        name: industryPreset === "CAFE" ? "Head Barista" : industryPreset === "MANUFACTURING" ? "QA Inspector" : "Kitchen Lead",
        description: "Operational team lead responsible for hygiene and SOP standards",
        permissions: JSON.stringify(["submit_checklists", "supervisor_signoff", "view_reports"]),
      },
    });

    await prisma.customRole.create({
      data: {
        organizationId: org.id,
        name: "Line Worker / Cleaner",
        description: "Floor staff responsible for executing daily checklist logs",
        permissions: JSON.stringify(["submit_checklists"]),
      },
    });

    // 3. Create First Outlet
    const initialOutlet = await prisma.outlet.create({
      data: {
        organizationId: org.id,
        name: facilityName || `${name} - Main Facility`,
        code: `${cleanSlug.slice(0, 3).toUpperCase()}-01`,
        type: facilityType,
        icon: facilityType === "FACTORY" ? "🏭" : facilityType === "CLOUD_KITCHEN" ? "🛵" : facilityType === "BAKERY" ? "☕" : "📍",
        shifts: JSON.stringify(["Morning", "Evening"]),
      },
    });

    // 4. Create Org Admin User
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const adminUser = await prisma.user.create({
      data: {
        organizationId: org.id,
        name: adminName || `${name} Admin`,
        email: contactEmail.toLowerCase().trim(),
        passwordHash,
        role: "ORG_ADMIN",
        permissions: JSON.stringify([
          "submit_checklists",
          "supervisor_signoff",
          "view_reports",
          "export_audit_pack",
          "manage_templates",
          "manage_outlets",
          "manage_team",
          "manage_roles",
          "edit_submissions",
        ]),
      },
    });

    // Link user to outlet
    await prisma.userOutlet.create({
      data: {
        userId: adminUser.id,
        outletId: initialOutlet.id,
        role: "ORG_ADMIN",
      },
    });

    // 5. Generate Initial Dodo Payments Checkout Link
    let dodoCheckout = null;
    try {
      dodoCheckout = await createDodoCheckoutSession({
        organizationId: org.id,
        planInterval: selectedProduct.interval,
        customerEmail: contactEmail.toLowerCase().trim(),
        customerName: name,
        customerPhone: contactPhone,
      });
    } catch (dodoErr: any) {
      console.error("[DODO_AUTO_CHECKOUT_ERROR]:", dodoErr);
    }

    return NextResponse.json({
      success: true,
      organization: org,
      adminUser: { id: adminUser.id, email: adminUser.email, name: adminUser.name },
      dodoCheckout,
    }, { status: 201 });
  } catch (err: any) {
    console.error("[PLATFORM_API_POST_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to onboard new client" }, { status: 500 });
  }
}

// PATCH: Sync with Dodo Payments, generate checkout sessions, or update tenant details
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string };
  if (!isPlatformOwner(user)) {
    return NextResponse.json({ error: "Forbidden: SaaS Platform Owner access required" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { id, action, billingInterval, plan, status, contactPhone, contactEmail } = body;

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Action 1: Sync with Dodo Payments API
    if (action === "sync_dodo") {
      const syncResult = await syncOrganizationWithDodo(id);
      return NextResponse.json({ success: true, syncResult });
    }

    // Action 2: Generate fresh Dodo checkout session URL
    if (action === "create_checkout") {
      const interval = billingInterval || org.billingInterval || "MONTHLY";
      const checkout = await createDodoCheckoutSession({
        organizationId: id,
        planInterval: interval === "ANNUAL" ? "ANNUAL" : "MONTHLY",
        customerEmail: org.contactEmail || "billing@reporting.app",
        customerName: org.name,
        customerPhone: org.contactPhone || undefined,
      });
      return NextResponse.json({ success: true, checkout });
    }

    // Action 3: General tenant update
    const updateData: any = {};
    if (plan !== undefined) updateData.plan = plan;
    if (status !== undefined) updateData.status = status;
    if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
    if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
    if (billingInterval !== undefined) {
      updateData.billingInterval = billingInterval;
      updateData.monthlyFee = billingInterval === "ANNUAL" ? DODO_CONFIG.products.ANNUAL.priceINR : DODO_CONFIG.products.MONTHLY.priceINR;
      updateData.dodoProductId = billingInterval === "ANNUAL" ? DODO_CONFIG.products.ANNUAL.id : DODO_CONFIG.products.MONTHLY.id;
    }

    const updated = await prisma.organization.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, organization: updated });
  } catch (err: any) {
    console.error("[PLATFORM_API_PATCH_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to update client" }, { status: 500 });
  }
}

// DELETE: Offboard/delete a tenant organization (SaaS platform owner only)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string };
  if (!isPlatformOwner(user)) {
    return NextResponse.json({ error: "Forbidden: SaaS Platform Owner access required" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const targetOrg = await prisma.organization.findUnique({ where: { id } });
    if (!targetOrg) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Safety guard: Cannot delete primary/default platform organization
    if (targetOrg.slug === "default") {
      return NextResponse.json({ error: "Cannot delete the primary platform organization" }, { status: 400 });
    }

    // Delete organization and cascaded relations
    await prisma.organization.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: `Organization ${targetOrg.name} deleted successfully` });
  } catch (err: any) {
    console.error("[PLATFORM_API_DELETE_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to delete client organization" }, { status: 500 });
  }
}
