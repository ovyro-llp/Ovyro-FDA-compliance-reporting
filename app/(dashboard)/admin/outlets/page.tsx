import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import OutletManagerClient from "./OutletManagerClient";

function safeJson(val: any, fallback: any = []) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export default async function AdminOutletsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const canAccess =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    (Array.isArray(user.permissions) && user.permissions.includes("manage_outlets"));

  if (!canAccess) {
    redirect("/dashboard");
  }

  const organizationId = await resolveOrganizationId(user);

  const [rawOutlets, templates] = await Promise.all([
    prisma.outlet.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },

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
    }),
    prisma.formTemplate.findMany({
      where: { organizationId: user.organizationId, isArchived: false },
      select: { id: true, title: true, icon: true, category: true },
    }),
  ]);

  const outlets = rawOutlets.map((o) => ({
    ...o,
    shifts: safeJson(o.shifts, ["Morning", "Evening"]),
  }));

  return (
    <OutletManagerClient
      initialOutlets={JSON.parse(JSON.stringify(outlets))}
      allTemplates={JSON.parse(JSON.stringify(templates))}
    />
  );
}

