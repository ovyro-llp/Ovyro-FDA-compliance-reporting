import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import TemplateManagerClient from "./TemplateManagerClient";

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export default async function AdminTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  const canAccess =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    (Array.isArray(user.permissions) && user.permissions.includes("manage_templates"));

  if (!canAccess) {
    redirect("/dashboard");
  }

  const organizationId = await resolveOrganizationId(user);

  const [rawTemplates, rawOutlets] = await Promise.all([
    prisma.formTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: {
        outletTemplates: {
          select: { outletId: true, isEnabled: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
    }),
    prisma.outlet.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, icon: true, shifts: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);


  const templates = rawTemplates.map((t) => ({
    ...t,
    schema: safeJson(t.schema, { sections: [] }),
  }));

  const outlets = rawOutlets.map((o) => ({
    ...o,
    shifts: safeJson(o.shifts, ["Morning", "Evening"]),
  }));

  return (
    <TemplateManagerClient
      initialTemplates={JSON.parse(JSON.stringify(templates))}
      outlets={JSON.parse(JSON.stringify(outlets))}
    />
  );
}

