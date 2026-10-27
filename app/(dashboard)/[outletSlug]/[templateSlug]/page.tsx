import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import DynamicFormRenderer from "@/components/DynamicFormRenderer";

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

interface PageProps {
  params: Promise<{
    outletSlug: string;
    templateSlug: string;
  }>;
}

export const dynamic = "force-dynamic";

export default async function DynamicSheetPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as {
    id: string;
    name: string;
    email: string;
    role: string;
    organizationId: string;
  };

  const organizationId = await resolveOrganizationId(user);
  const { outletSlug, templateSlug } = await params;

  // Don't intercept reserved routes
  if (["admin", "dashboard", "login", "api"].includes(outletSlug)) {
    notFound();
  }

  // Find outlet by id or code
  const outlet = await prisma.outlet.findFirst({
    where: {
      organizationId,
      OR: [
        { id: outletSlug },
        { code: outletSlug },
        { code: outletSlug.toUpperCase() },
      ],
      isActive: true,
    },
  });

  if (!outlet) {
    notFound();
  }

  const activeOutlet = outlet;

  // Find template by slug or ID
  const cleanSlug = decodeURIComponent(templateSlug).toLowerCase().trim();
  const template = await prisma.formTemplate.findFirst({
    where: {
      organizationId,
      OR: [
        { slug: templateSlug },
        { slug: cleanSlug },
        { id: templateSlug },
      ],
      isArchived: false,
    },
  });

  if (!template) {
    notFound();
  }

  // Verify that the template is assigned and enabled for this specific facility
  const outletTemplate = await prisma.outletTemplate.findFirst({
    where: {
      outletId: activeOutlet.id,
      templateId: template.id,
      isEnabled: true,
    },
  });

  if (!outletTemplate) {
    notFound();
  }

  // Get active staff for this organization/outlet (registered users + non-login ground staff)
  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { name: true },
      orderBy: { name: "asc" },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    }),
  ]);

  const parsedSettings = safeJson(org?.settings, {});
  const groundStaffRoster: any[] = Array.isArray(parsedSettings.staffRoster)
    ? parsedSettings.staffRoster
    : [];

  const rawStaffList = [
    ...users.map((u) => u.name),
    ...groundStaffRoster.map((g: any) => (typeof g === "string" ? g : g?.name)),
  ].filter(Boolean);

  const seen = new Set<string>();
  const availableStaff = rawStaffList.filter((name) => {
    const lower = name.trim().toLowerCase();
    if (seen.has(lower)) return false;
    seen.add(lower);
    return true;
  });

  const parsedShifts = safeJson(activeOutlet.shifts, ["Morning", "Evening"]);
  const parsedSchema = safeJson(template.schema, { sections: [] });

  return (
    <div className="dynamic-sheet-page">
      <DynamicFormRenderer
        outlet={{
          id: activeOutlet.id,
          name: activeOutlet.name,
          code: activeOutlet.code,
          icon: activeOutlet.icon,
          shifts: Array.isArray(parsedShifts) ? parsedShifts : ["Morning", "Evening"],
        }}
        template={{
          id: template.id,
          slug: template.slug,
          title: template.title,
          category: template.category,
          icon: template.icon,
          description: template.description,
          frequency: template.frequency,
          schema: parsedSchema,
        }}
        currentUser={{
          id: user.id,
          name: user.name || "User",
          email: user.email,
          role: user.role,
        }}
        availableStaff={availableStaff.length > 0 ? availableStaff : undefined}
      />
    </div>
  );
}


