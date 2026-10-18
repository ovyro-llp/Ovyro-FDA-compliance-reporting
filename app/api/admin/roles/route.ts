import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationId, userHasPermission } from "@/lib/permissions";

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

  const user = session.user as { organizationId: string; role: string; email?: string };
  const organizationId = await resolveOrganizationId(user);

  try {
    const roles = await prisma.customRole.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      include: {
        _count: { select: { users: true } },
      },
    });

    const parsed = roles.map((r) => ({
      ...r,
      permissions: safeJson(r.permissions, []),
    }));

    return NextResponse.json({ roles: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_roles", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage roles permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  try {
    const body = await req.json();
    const { name, description, permissions } = body;

    if (!name) {
      return NextResponse.json({ error: "Role name is required" }, { status: 400 });
    }

    const permsString =
      typeof permissions === "string"
        ? permissions
        : JSON.stringify(Array.isArray(permissions) ? permissions : ["submit_checklists"]);

    const role = await prisma.customRole.create({
      data: {
        organizationId,
        name,
        description: description || "",
        permissions: permsString,
      },
    });


    return NextResponse.json({
      success: true,
      role: { ...role, permissions: safeJson(role.permissions) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to create role" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_roles", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage roles permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  try {
    const body = await req.json();
    const { id, name, description, permissions } = body;

    if (!id || !name) {
      return NextResponse.json({ error: "Role ID and name are required" }, { status: 400 });
    }

    const existing = await prisma.customRole.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    const permsString =
      typeof permissions === "string"
        ? permissions
        : JSON.stringify(Array.isArray(permissions) ? permissions : ["submit_checklists"]);

    const updated = await prisma.customRole.update({
      where: { id },
      data: {
        name,
        description: description !== undefined ? description : existing.description,
        permissions: permsString,
      },
    });

    return NextResponse.json({
      success: true,
      role: { ...updated, permissions: safeJson(updated.permissions) },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_roles", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage roles permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Role ID is required" }, { status: 400 });
  }

  try {
    const existing = await prisma.customRole.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Role not found" }, { status: 404 });
    }

    // Unlink users who have this role
    await prisma.user.updateMany({
      where: { customRoleId: id, organizationId },
      data: { customRoleId: null },
    });

    await prisma.customRole.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, deletedId: id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to delete role" }, { status: 500 });
  }
}
