import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import SetupWizardClient from "./SetupWizardClient";

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export default async function SetupWizardPage(props: {
  searchParams: Promise<{ session_id?: string; payment_status?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/onboard/setup${searchParams.session_id ? `?session_id=${searchParams.session_id}` : ""}`);
  }

  const user = session.user as {
    id?: string;
    organizationId?: string;
    role?: string;
    email?: string;
    name?: string;
  };

  const organizationId = await resolveOrganizationId(user);

  // Load organization, outlets, templates, and staff roster
  const [org, outlets, rawTemplates, registeredUsers] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        billingStatus: true,
        settings: true,
      },
    }),
    prisma.outlet.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, code: true, icon: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.formTemplate.findMany({
      where: { organizationId, isArchived: false },
      select: {
        id: true,
        slug: true,
        title: true,
        category: true,
        icon: true,
        description: true,
        frequency: true,
        schema: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.user.findMany({
      where: { organizationId, isActive: true },
      select: { id: true, name: true, role: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!org) {
    redirect("/login");
  }

  const parsedSettings = safeJson(org.settings, {});
  const groundStaffRoster: Array<{ id: string; name: string; role?: string }> =
    Array.isArray(parsedSettings.staffRoster) ? parsedSettings.staffRoster : [];

  const combinedStaff = [
    ...registeredUsers.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      isRegistered: true,
    })),
    ...groundStaffRoster.map((g) => ({
      id: g.id || `staff-${g.name.replace(/\s+/g, "-").toLowerCase()}`,
      name: g.name,
      role: g.role || "Cleaner / Operator",
      isRegistered: false,
    })),
  ];

  // Deduplicate
  const seenNames = new Set<string>();
  const initialStaff = combinedStaff.filter((s) => {
    const key = (s.name || "").toLowerCase().trim();
    if (!key || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  });

  const templates = rawTemplates.map((t) => ({
    ...t,
    schema: safeJson(t.schema, { sections: [] }),
  }));

  return (
    <SetupWizardClient
      organization={{
        id: org.id,
        name: org.name,
        plan: org.plan,
        billingStatus: org.billingStatus,
      }}
      initialOutlets={outlets}
      initialTemplates={templates}
      initialStaff={initialStaff}
      currentUser={{
        name: user.name || "Owner",
        email: user.email || "",
        role: user.role || "ORG_ADMIN",
      }}
      sessionId={searchParams.session_id}
    />
  );
}
