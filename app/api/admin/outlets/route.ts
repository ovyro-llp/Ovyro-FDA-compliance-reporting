import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationId, resolveUserId, userHasPermission } from "@/lib/permissions";

function safeJson(val: any, fallback: any = []) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; email?: string };
  const organizationId = await resolveOrganizationId(user);

  try {
    const outlets = await prisma.outlet.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        outletTemplates: {
          where: {
            isEnabled: true,
            template: { isArchived: false },
          },
          include: {
            template: {
              select: { id: true, title: true, icon: true, category: true, slug: true },
            },
          },
        },
        _count: {
          select: { submissions: true, userOutlets: true },
        },
      },
    });


    const parsed = outlets.map((o) => ({
      ...o,
      shifts: safeJson(o.shifts, ["Morning", "Evening"]),
    }));

    return NextResponse.json({ outlets: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    (Array.isArray(user.permissions) && user.permissions.includes("manage_outlets"));

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: manage_outlets permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const validUserId = await resolveUserId(user);

  try {
    const body = await req.json();

    if (body.action === "duplicate") {
      const sourceOutletId = body.sourceOutletId;
      if (!sourceOutletId) {
        return NextResponse.json({ error: "sourceOutletId is required to duplicate" }, { status: 400 });
      }

      const sourceOutlet = await prisma.outlet.findFirst({
        where: { id: sourceOutletId, organizationId },
        include: {
          outletTemplates: {
            where: { isEnabled: true },
            orderBy: { order: "asc" },
          },
        },
      });

      if (!sourceOutlet) {
        return NextResponse.json({ error: "Source facility not found" }, { status: 404 });
      }

      const countCopies = await prisma.outlet.count({
        where: {
          organizationId,
          name: { startsWith: `${sourceOutlet.name} (Copy` },
        },
      });

      const copyName = countCopies > 0 ? `${sourceOutlet.name} (Copy ${countCopies + 1})` : `${sourceOutlet.name} (Copy)`;
      const copyCode = sourceOutlet.code ? `${sourceOutlet.code}-C${countCopies + 1}`.slice(0, 10) : null;

      const newOutlet = await prisma.outlet.create({
        data: {
          organizationId,
          name: copyName,
          code: copyCode,
          type: sourceOutlet.type,
          address: sourceOutlet.address,
          icon: sourceOutlet.icon,
          shifts: sourceOutlet.shifts,
        },
      });

      // Clone assigned templates
      for (const ot of sourceOutlet.outletTemplates) {
        await prisma.outletTemplate.create({
          data: {
            outletId: newOutlet.id,
            templateId: ot.templateId,
            order: ot.order,
            isEnabled: ot.isEnabled,
          },
        });
      }

      // Link creating user
      if (validUserId) {
        await prisma.userOutlet.upsert({
          where: { userId_outletId: { userId: validUserId, outletId: newOutlet.id } },
          update: {},
          create: {
            userId: validUserId,
            outletId: newOutlet.id,
            role: user.role,
          },
        });
      }

      const fullOutlet = await prisma.outlet.findUnique({
        where: { id: newOutlet.id },
        include: {
          outletTemplates: {
            include: {
              template: {
                select: { id: true, title: true, icon: true, category: true, slug: true },
              },
            },
          },
          _count: {
            select: { submissions: true, userOutlets: true },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: `Facility duplicated successfully with ${sourceOutlet.outletTemplates.length} report templates.`,
        outlet: { ...fullOutlet, shifts: safeJson(fullOutlet?.shifts) },
      });
    }

    const { name, code, type, address, icon, shifts, templateIds } = body;

    if (!name) {
      return NextResponse.json({ error: "Outlet name is required" }, { status: 400 });
    }

    const shiftsString =
      typeof shifts === "string"
        ? shifts
        : JSON.stringify(Array.isArray(shifts) ? shifts : ["Morning", "Evening"]);

    const outlet = await prisma.outlet.create({
      data: {
        organizationId,
        name,
        code: code || null,
        type: type || "RESTAURANT",
        address: address || "",
        icon: icon || "📍",
        shifts: shiftsString,
      },
    });

    // Assign templates - filter only valid templates belonging to this organization or existing in DB
    if (Array.isArray(templateIds) && templateIds.length > 0) {
      const existingTemplates = await prisma.formTemplate.findMany({
        where: { id: { in: templateIds }, organizationId },
        select: { id: true },
      });
      const validTplIds = new Set(existingTemplates.map((t) => t.id));

      for (const [idx, templateId] of templateIds.entries()) {
        if (validTplIds.has(templateId)) {
          await prisma.outletTemplate.create({
            data: {
              outletId: outlet.id,
              templateId,
              order: idx,
              isEnabled: true,
            },
          });
        }
      }
    }

    // Link creating user to the new outlet if user exists in DB
    if (validUserId) {
      await prisma.userOutlet.upsert({
        where: { userId_outletId: { userId: validUserId, outletId: outlet.id } },
        update: {},
        create: {
          userId: validUserId,
          outletId: outlet.id,
          role: user.role,
        },
      });
    }

    const fullOutlet = await prisma.outlet.findUnique({
      where: { id: outlet.id },
      include: {
        outletTemplates: {
          include: {
            template: {
              select: { id: true, title: true, icon: true, category: true, slug: true },
            },
          },
        },
        _count: {
          select: { submissions: true, userOutlets: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      outlet: { ...fullOutlet, shifts: safeJson(fullOutlet?.shifts) },
    });
  } catch (err: any) {
    console.error("Create outlet error:", err);
    return NextResponse.json({ error: err.message || "Failed to create outlet" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    (Array.isArray(user.permissions) && user.permissions.includes("manage_outlets"));

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: manage_outlets permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  try {
    const body = await req.json();
    const { id, name, code, type, address, icon, shifts, isActive, templateIds } = body;

    if (!id) {
      return NextResponse.json({ error: "Outlet id is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (code !== undefined) updateData.code = code || null;
    if (type !== undefined) updateData.type = type;
    if (address !== undefined) updateData.address = address;
    if (icon !== undefined) updateData.icon = icon;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (shifts !== undefined) {
      updateData.shifts = typeof shifts === "string" ? shifts : JSON.stringify(shifts);
    }

    const updated = await prisma.outlet.update({
      where: { id },
      data: updateData,
    });

    if (Array.isArray(templateIds)) {
      await prisma.outletTemplate.deleteMany({ where: { outletId: id } });
      const existingTemplates = await prisma.formTemplate.findMany({
        where: { id: { in: templateIds }, organizationId },
        select: { id: true },
      });
      const validTplIds = new Set(existingTemplates.map((t) => t.id));

      for (const [idx, tId] of templateIds.entries()) {
        if (validTplIds.has(tId)) {
          await prisma.outletTemplate.create({
            data: {
              outletId: id,
              templateId: tId,
              order: idx,
              isEnabled: true,
            },
          });
        }
      }
    }

    const fullOutlet = await prisma.outlet.findUnique({
      where: { id: updated.id },
      include: {
        outletTemplates: {
          include: {
            template: {
              select: { id: true, title: true, icon: true, category: true, slug: true },
            },
          },
        },
        _count: {
          select: { submissions: true, userOutlets: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      outlet: { ...fullOutlet, shifts: safeJson(fullOutlet?.shifts) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update outlet" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_outlets", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage facilities permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Outlet id is required" }, { status: 400 });
    }

    // Check count of remaining active outlets
    const count = await prisma.outlet.count({
      where: { organizationId, isActive: true },
    });

    if (count <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the only facility. Your organization must have at least one active facility." },
        { status: 400 }
      );
    }

    // Delete mappings & outlet
    await prisma.outletTemplate.deleteMany({ where: { outletId: id } });
    await prisma.userOutlet.deleteMany({ where: { outletId: id } });
    await prisma.formSubmission.deleteMany({ where: { outletId: id } });
    await prisma.outlet.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Facility deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete facility" }, { status: 500 });
  }
}


