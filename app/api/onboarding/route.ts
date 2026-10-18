import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateTailoredTemplatesForOrg, OnboardingAnswers } from "@/lib/template-generator";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId?: string; id?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "User is not assigned to an organization" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { industryPreset, facilityName, shifts, contactPhone, modules } = body;

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      include: {
        outlets: { take: 1 },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const businessType = (industryPreset || "RESTAURANT") as OnboardingAnswers["businessType"];
    const shiftList = Array.isArray(shifts) && shifts.length > 0 ? shifts : ["Morning", "Evening"];

    const outletType =
      businessType === "CLOUD_KITCHEN"
        ? "CLOUD_KITCHEN"
        : businessType === "CAFE"
        ? "BAKERY"
        : businessType === "MANUFACTURING"
        ? "FACTORY"
        : "RESTAURANT";

    const outletIcon =
      businessType === "CLOUD_KITCHEN"
        ? "🛵"
        : businessType === "CAFE"
        ? "☕"
        : businessType === "MANUFACTURING"
        ? "🏭"
        : "🍽️";

    // 1. Ensure or update primary outlet
    let primaryOutlet = org.outlets[0];
    if (!primaryOutlet) {
      primaryOutlet = await prisma.outlet.create({
        data: {
          organizationId: org.id,
          name: facilityName || "Main Kitchen / Facility",
          type: outletType,
          icon: outletIcon,
          shifts: JSON.stringify(shiftList),
        },
      });
    } else {
      primaryOutlet = await prisma.outlet.update({
        where: { id: primaryOutlet.id },
        data: {
          name: facilityName || primaryOutlet.name,
          type: outletType,
          icon: outletIcon,
          shifts: JSON.stringify(shiftList),
        },
      });
    }

    // 2. Generate and place tailored templates based on specific operational risk modules
    const operationalAnswers: OnboardingAnswers = {
      businessType,
      facilityName: facilityName || primaryOutlet.name,
      shifts: shiftList,
      contactPhone: contactPhone || undefined,
      modules: {
        hasColdStorage: modules?.hasColdStorage !== undefined ? Boolean(modules.hasColdStorage) : true,
        hasFryers: modules?.hasFryers !== undefined ? Boolean(modules.hasFryers) : false,
        hasDeliveryDispatch: modules?.hasDeliveryDispatch !== undefined ? Boolean(modules.hasDeliveryDispatch) : businessType === "CLOUD_KITCHEN",
        hasEspressoBeverage: modules?.hasEspressoBeverage !== undefined ? Boolean(modules.hasEspressoBeverage) : businessType === "CAFE",
        hasRawMaterialIntake: modules?.hasRawMaterialIntake !== undefined ? Boolean(modules.hasRawMaterialIntake) : businessType === "MANUFACTURING",
        hasPestControl: modules?.hasPestControl !== undefined ? Boolean(modules.hasPestControl) : true,
      },
    };

    const placedTemplates = await generateTailoredTemplatesForOrg(
      org.id,
      primaryOutlet.id,
      operationalAnswers
    );

    // 3. Update Organization Settings
    const currentSettings = typeof org.settings === "string" ? JSON.parse(org.settings || "{}") : (org.settings || {});
    const updatedSettings = {
      ...currentSettings,
      industryPreset: businessType,
      facilityName: operationalAnswers.facilityName,
      modules: operationalAnswers.modules,
      shifts: shiftList,
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
      tailoredTemplateCount: placedTemplates.length,
    };

    await prisma.organization.update({
      where: { id: org.id },
      data: {
        settings: JSON.stringify(updatedSettings),
        ...(contactPhone ? { contactPhone } : {}),
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workspace configured and compliance templates placed successfully",
      organizationId: org.id,
      templatesCount: placedTemplates.length,
      templates: placedTemplates.map((t) => ({ id: t.id, title: t.title, category: t.category })),
    });
  } catch (err: any) {
    console.error("[ONBOARDING_API_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to save onboarding configuration" }, { status: 500 });
  }
}
