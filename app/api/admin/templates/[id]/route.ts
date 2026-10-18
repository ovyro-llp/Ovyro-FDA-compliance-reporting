import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { userHasPermission, resolveOrganizationId } from "@/lib/permissions";
import { verifyPaywallOrReject } from "@/lib/paywall";

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const organizationId = await resolveOrganizationId(user);
  const { id } = await params;

  try {
    const template = await prisma.formTemplate.findFirst({
      where: { id, organizationId },
      include: {
        outletTemplates: {
          select: { outletId: true, isEnabled: true },
        },
      },
    });

    if (!template) {
      return NextResponse.json({ error: "Report tab not found" }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        ...template,
        schema: safeJson(template.schema, {}),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_templates", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage Report Tabs permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { id } = await params;
  const body = await req.json();

  try {
    const existing = await prisma.formTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report tab not found" }, { status: 404 });
    }

    const { title, icon, description, frequency, category, schema, outletIds, isArchived } = body;

    const schemaString =
      schema !== undefined
        ? typeof schema === "string"
          ? schema
          : JSON.stringify(schema)
        : existing.schema;

    const updated = await prisma.formTemplate.update({
      where: { id },
      data: {
        title: title || existing.title,
        icon: icon || existing.icon,
        description: description !== undefined ? description : existing.description,
        frequency: frequency || existing.frequency,
        category: category || existing.category,
        isArchived: isArchived !== undefined ? Boolean(isArchived) : existing.isArchived,
        schema: schemaString,
        version: { increment: 1 },
      },
    });

    // Update outlet assignments if provided
    if (Array.isArray(outletIds)) {
      await prisma.outletTemplate.deleteMany({ where: { templateId: id } });
      const validOutlets = await prisma.outlet.findMany({
        where: { id: { in: outletIds }, organizationId },
        select: { id: true },
      });
      const validOutletIds = new Set(validOutlets.map((o) => o.id));

      for (const oId of outletIds) {
        if (validOutletIds.has(oId)) {
          await prisma.outletTemplate.create({
            data: {
              outletId: oId,
              templateId: id,
              isEnabled: true,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      template: {
        ...updated,
        schema: safeJson(updated.schema, {}),
      },
    });
  } catch (err: any) {
    console.error("Update report tab error:", err);
    return NextResponse.json({ error: err.message || "Failed to update report tab" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_templates", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage Report Tabs permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { id } = await params;

  try {
    const existing = await prisma.formTemplate.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Report tab not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const targetArchived = body.isArchived !== undefined ? Boolean(body.isArchived) : !existing.isArchived;

    const updated = await prisma.formTemplate.update({
      where: { id },
      data: {
        isArchived: targetArchived,
      },
    });

    return NextResponse.json({
      success: true,
      isArchived: updated.isArchived,
      message: updated.isArchived
        ? `"${updated.title}" has been archived and hidden from daily operations.`
        : `"${updated.title}" has been unarchived and restored to active checklists.`,
    });
  } catch (err: any) {
    console.error("Archive report tab error:", err);
    return NextResponse.json({ error: err.message || "Failed to update archive status" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_templates", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage Report Tabs permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { id } = await params;

  try {
    // 1. Delete associated outlet links
    await prisma.outletTemplate.deleteMany({ where: { templateId: id } });
    // 2. Delete user template access links
    await prisma.userTemplateAccess.deleteMany({ where: { templateId: id } });
    // 3. Delete form submissions for this template
    await prisma.formSubmission.deleteMany({ where: { templateId: id } });
    // 4. Delete the template itself
    await prisma.formTemplate.deleteMany({
      where: { id, organizationId },
    });

    return NextResponse.json({ success: true, message: "Report Tab deleted successfully" });
  } catch (err: any) {
    console.error("Delete report tab error:", err);
    return NextResponse.json({ error: err.message || "Failed to delete report tab" }, { status: 500 });
  }
}

