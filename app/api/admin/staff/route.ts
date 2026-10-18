import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationId, userHasPermission } from "@/lib/permissions";

function safeJson(val: any, fallback: any = {}) {
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

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const organizationId = await resolveOrganizationId(user);

  try {
    // 1. Registered users
    const registeredUsers = await prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    });

    // 2. Non-login ground staff roster in organization.settings
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    const parsedSettings = safeJson(org?.settings, {});
    const customRoster: Array<{ id: string; name: string; role?: string }> =
      Array.isArray(parsedSettings.staffRoster) ? parsedSettings.staffRoster : [];

    // Unified staff list
    const combinedStaff: Array<{ id: string; name: string; role: string; isRegistered: boolean }> = [
      ...registeredUsers.map((u) => ({
        id: u.id,
        name: u.name,
        role: u.role,
        isRegistered: true,
      })),
      ...customRoster.map((r) => ({
        id: r.id || `staff-${r.name.replace(/\s+/g, "-").toLowerCase()}`,
        name: r.name,
        role: r.role || "Ground Staff / Cleaner",
        isRegistered: false,
      })),
    ];

    // Deduplicate by name
    const uniqueNames = new Set<string>();
    const deduplicated = combinedStaff.filter((s) => {
      const clean = s.name.trim().toLowerCase();
      if (!clean || uniqueNames.has(clean)) return false;
      uniqueNames.add(clean);
      return true;
    });

    return NextResponse.json({ staff: deduplicated });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load staff" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const organizationId = await resolveOrganizationId(user);

  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    user.role === "SUPERVISOR" ||
    user.role === "MANAGER" ||
    userHasPermission(user.permissions, "manage_team", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
  }

  try {
    const { name, role } = await req.json();
    const cleanName = (name || "").trim();
    if (!cleanName) {
      return NextResponse.json({ error: "Staff name is required" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });

    const parsedSettings = safeJson(org?.settings, {});
    const existingRoster: Array<{ id: string; name: string; role?: string }> =
      Array.isArray(parsedSettings.staffRoster) ? parsedSettings.staffRoster : [];

    // Check if already exists
    const exists = existingRoster.some((r) => r.name.toLowerCase() === cleanName.toLowerCase());
    if (!exists) {
      const newEntry = {
        id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: cleanName,
        role: (role || "Cleaner / Operator").trim(),
      };
      existingRoster.push(newEntry);
      parsedSettings.staffRoster = existingRoster;

      await prisma.organization.update({
        where: { id: organizationId },
        data: { settings: JSON.stringify(parsedSettings) },
      });
    }

    return NextResponse.json({
      success: true,
      staff: { name: cleanName, role: role || "Cleaner / Operator" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to add staff" }, { status: 500 });
  }
}
