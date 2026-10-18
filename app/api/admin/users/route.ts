import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationId, userHasPermission } from "@/lib/permissions";
import { verifyPaywallOrReject } from "@/lib/paywall";
import bcrypt from "bcryptjs";

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
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_team", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage team permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      customRoleId: true,
      customRole: {
        select: { id: true, name: true, permissions: true },
      },
      permissions: true,
      isActive: true,
      createdAt: true,
      userOutlets: {
        select: {
          outletId: true,
          role: true,
          outlet: { select: { id: true, name: true, icon: true } },
        },
      },
      templateAccess: {
        select: {
          templateId: true,
          canSubmit: true,
          canVerify: true,
          template: { select: { id: true, title: true, icon: true } },
        },
      },
    },
  });

  const parsed = users.map((u) => ({
    ...u,
    permissions: safeJson(u.permissions, []),
  }));

  return NextResponse.json({ users: parsed });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_team", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage team permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { name, email, password, role, customRoleId, permissions, outletIds, templateAccess } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cleanEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const permsString =
    typeof permissions === "string"
      ? permissions
      : JSON.stringify(Array.isArray(permissions) ? permissions : ["submit_checklists"]);

  let validCustomRoleId = customRoleId || null;
  if (validCustomRoleId) {
    const roleExists = await prisma.customRole.findFirst({
      where: { id: validCustomRoleId, organizationId },
      select: { id: true },
    });
    if (!roleExists) validCustomRoleId = null;
  }

  const createdUser = await prisma.user.create({
    data: {
      organizationId,
      name,
      email: cleanEmail,
      passwordHash,
      role: role || "OPERATOR",
      customRoleId: validCustomRoleId,
      permissions: permsString,
    },
  });

  // Assign user to outlets
  if (Array.isArray(outletIds) && outletIds.length > 0) {
    const validOutlets = await prisma.outlet.findMany({
      where: { id: { in: outletIds }, organizationId },
      select: { id: true },
    });
    const validOutletIds = new Set(validOutlets.map((o) => o.id));

    for (const outletId of outletIds) {
      if (validOutletIds.has(outletId)) {
        await prisma.userOutlet.create({
          data: {
            userId: createdUser.id,
            outletId,
            role: role || "OPERATOR",
          },
        });
      }
    }
  }

  // Assign specific template access if provided
  if (Array.isArray(templateAccess) && templateAccess.length > 0) {
    const requestedTplIds = templateAccess.map((t: any) => (typeof t === "string" ? t : t.templateId));
    const validTemplates = await prisma.formTemplate.findMany({
      where: { id: { in: requestedTplIds }, organizationId },
      select: { id: true },
    });
    const validTplIds = new Set(validTemplates.map((t) => t.id));

    for (const item of templateAccess) {
      const tId = typeof item === "string" ? item : item.templateId;
      if (validTplIds.has(tId)) {
        await prisma.userTemplateAccess.create({
          data: {
            userId: createdUser.id,
            templateId: tId,
            canSubmit: item.canSubmit !== false,
            canVerify: !!item.canVerify,
          },
        });
      }
    }
  }

  return NextResponse.json({ success: true, user: createdUser }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_team", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage team permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { id, name, role, customRoleId, permissions, isActive, password, outletIds, templateAccess } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing user id" }, { status: 400 });

  // Multi-tenant IDOR protection: Verify target user belongs to the current organization
  const existingUser = await prisma.user.findFirst({
    where: { id, organizationId },
  });
  if (!existingUser) {
    return NextResponse.json({ error: "User not found or access denied" }, { status: 404 });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (role !== undefined) updateData.role = role;
  if (customRoleId !== undefined) {
    if (customRoleId) {
      const roleExists = await prisma.customRole.findFirst({
        where: { id: customRoleId, organizationId },
        select: { id: true },
      });
      updateData.customRoleId = roleExists ? customRoleId : null;
    } else {
      updateData.customRoleId = null;
    }
  }
  if (isActive !== undefined) updateData.isActive = isActive;
  if (password) updateData.passwordHash = await bcrypt.hash(password, 12);
  if (permissions !== undefined) {
    updateData.permissions = typeof permissions === "string" ? permissions : JSON.stringify(permissions);
  }

  const updatedUser = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  // Update outlet links if provided
  if (Array.isArray(outletIds)) {
    await prisma.userOutlet.deleteMany({ where: { userId: id } });
    const validOutlets = await prisma.outlet.findMany({
      where: { id: { in: outletIds }, organizationId },
      select: { id: true },
    });
    const validOutletIds = new Set(validOutlets.map((o) => o.id));

    for (const outletId of outletIds) {
      if (validOutletIds.has(outletId)) {
        await prisma.userOutlet.create({
          data: {
            userId: id,
            outletId,
            role: role || updatedUser.role,
          },
        });
      }
    }
  }

  // Update template access links if provided
  if (Array.isArray(templateAccess)) {
    await prisma.userTemplateAccess.deleteMany({ where: { userId: id } });
    const requestedTplIds = templateAccess.map((t: any) => (typeof t === "string" ? t : t.templateId));
    const validTemplates = await prisma.formTemplate.findMany({
      where: { id: { in: requestedTplIds }, organizationId },
      select: { id: true },
    });
    const validTplIds = new Set(validTemplates.map((t) => t.id));

    for (const item of templateAccess) {
      const tId = typeof item === "string" ? item : item.templateId;
      if (validTplIds.has(tId)) {
        await prisma.userTemplateAccess.create({
          data: {
            userId: id,
            templateId: tId,
            canSubmit: item.canSubmit !== false,
            canVerify: !!item.canVerify,
          },
        });
      }
    }
  }

  return NextResponse.json({ success: true, user: updatedUser });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_team", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage team permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

  // Prevent user deleting themselves
  if (session.user.id === id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { id, organizationId },
  });

  if (!existing) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Cascade cleanup relations
  await prisma.userOutlet.deleteMany({ where: { userId: id } });
  await prisma.userTemplateAccess.deleteMany({ where: { userId: id } });
  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true, message: "User removed successfully" });
}

