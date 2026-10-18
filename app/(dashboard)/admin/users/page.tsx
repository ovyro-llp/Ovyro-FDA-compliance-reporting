import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const canAccess =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    (Array.isArray(user.permissions) &&
      (user.permissions.includes("manage_team") || user.permissions.includes("manage_roles")));

  if (!canAccess) {
    redirect("/dashboard");
  }

  const organizationId = await resolveOrganizationId(user);

  const [users, outlets, templates, roles] = await Promise.all([
    prisma.user.findMany({
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
    }),
    prisma.outlet.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, icon: true },
    }),
    prisma.formTemplate.findMany({
      where: { organizationId, isArchived: false },
      select: { id: true, title: true, icon: true, category: true, slug: true },
    }),
    prisma.customRole.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, description: true, permissions: true },
    }),
  ]);


  const parsedUsers = users.map((u) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(u.permissions || "[]");
    } catch {
      perms = [];
    }
    return {
      ...u,
      permissions: perms,
    };
  });

  const parsedRoles = roles.map((r) => {
    let perms: string[] = [];
    try {
      perms = JSON.parse(r.permissions || "[]");
    } catch {
      perms = [];
    }
    return {
      ...r,
      permissions: perms,
    };
  });

  return (
    <UsersClient
      initialUsers={JSON.parse(JSON.stringify(parsedUsers))}
      outlets={JSON.parse(JSON.stringify(outlets))}
      templates={JSON.parse(JSON.stringify(templates))}
      customRoles={JSON.parse(JSON.stringify(parsedRoles))}
    />
  );
}
