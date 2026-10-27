import { prisma } from "@/lib/db";

export function safeJsonParse(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

export interface PermissionDefinition {
  key: string;
  label: string;
  description: string;
  category: "EXECUTION" | "AUDIT" | "MANAGEMENT";
}

export const SYSTEM_PERMISSIONS: PermissionDefinition[] = [
  {
    key: "submit_checklists",
    label: "Submit Daily Checklists",
    description: "Can record shift checklists, temperature readings, and equipment logs.",
    category: "EXECUTION",
  },
  {
    key: "supervisor_signoff",
    label: "Supervisor Verification & Digital Sign-off",
    description: "Can review completed logs, verify corrective actions, and apply digital sign-off.",
    category: "AUDIT",
  },
  {
    key: "view_reports",
    label: "View Audit Reports & Analytics",
    description: "Can view facility audit scorecards and submission history.",
    category: "AUDIT",
  },
  {
    key: "export_audit_pack",
    label: "Export Compliance & FSSAI/HACCP Packs",
    description: "Can export CSV, Excel, and print audit reports for regulatory inspectors.",
    category: "AUDIT",
  },
  {
    key: "manage_templates",
    label: "Manage Dynamic Checklists & Templates",
    description: "Can create, edit, and assign custom checklist templates in Template Builder.",
    category: "MANAGEMENT",
  },
  {
    key: "manage_outlets",
    label: "Manage Facilities & Outlets",
    description: "Can create, edit locations, and configure operational shifts.",
    category: "MANAGEMENT",
  },
  {
    key: "manage_team",
    label: "Manage Team & Assignments",
    description: "Can create team members, invite staff, and assign facility & checklist access.",
    category: "MANAGEMENT",
  },
  {
    key: "manage_roles",
    label: "Create & Edit Security Roles",
    description: "Can define custom dynamic roles and configure security permission sets.",
    category: "MANAGEMENT",
  },
  {
    key: "edit_submissions",
    label: "Edit Historical Submissions",
    description: "Can modify or correct past submitted checklist logs and notes.",
    category: "MANAGEMENT",
  },
];

export interface OutletSummary {
  id: string;
  name: string;
  code: string | null;
  type: string;
  icon: string;
  shifts: string[];
}

export interface TemplateSummary {
  id: string;
  slug: string;
  title: string;
  category: string;
  icon: string;
  description: string | null;
  frequency: string;
  schema: any;
  canSubmit?: boolean;
  canVerify?: boolean;
}

export async function getTenantOutlets(
  organizationId: string,
  userId?: string,
  userRole?: string
): Promise<OutletSummary[]> {
  try {
    let whereClause: any = { organizationId, isActive: true };

    // If user is OPERATOR, only show outlets they have access to
    if (userRole === "OPERATOR" && userId) {
      whereClause.userOutlets = {
        some: { userId },
      };
    }

    const outlets = await prisma.outlet.findMany({
      where: whereClause,
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        code: true,
        type: true,
        icon: true,
        shifts: true,
      },
    });

    return outlets.map((o) => ({
      ...o,
      shifts: safeJsonParse(o.shifts, ["Morning", "Evening"]),
    }));
  } catch (err) {
    console.error("Error fetching tenant outlets:", err);
    return [];
  }
}

export async function getOutletTemplates(
  outletId: string,
  userId?: string,
  userRole?: string
): Promise<TemplateSummary[]> {
  try {
    const outletTemplates = await prisma.outletTemplate.findMany({
      where: { outletId, isEnabled: true, template: { isArchived: false } },
      include: {
        template: {
          include: {
            userAccess: userId ? { where: { userId } } : false,
          },
        },
      },
      orderBy: { order: "asc" },
    });

    return outletTemplates
      .filter((ot) => {
        if (!ot.template || ot.template.isArchived) return false;
        // If user is ORG_ADMIN or SUPER_ADMIN or SUPERVISOR, all templates are visible
        if (!userId || userRole === "ORG_ADMIN" || userRole === "SUPER_ADMIN" || userRole === "ADMIN" || userRole === "SUPERVISOR") {
          return true;
        }
        // If user has specific template assignments, filter accordingly
        const access = (ot.template as any).userAccess;
        if (!access || access.length === 0) return true; // default accessible if no restrictions
        return access.some((a: any) => a.canSubmit);
      })
      .map((ot) => ({
        id: ot.template.id,
        slug: ot.template.slug,
        title: ot.template.title,
        category: ot.template.category,
        icon: ot.template.icon,
        description: ot.template.description,
        frequency: ot.template.frequency,
        schema: safeJsonParse(ot.template.schema, {}),
      }));

  } catch (err) {
    console.error("Error fetching outlet templates:", err);
    return [];
  }
}

export function userHasPermission(userPermissions: string[] | string | undefined, requiredKey: string, role?: string): boolean {
  if (role === "ORG_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN") return true;
  const list = Array.isArray(userPermissions)
    ? userPermissions
    : typeof userPermissions === "string"
    ? safeJsonParse(userPermissions, [])
    : [];
  return list.includes(requiredKey);
}

export function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getDayName(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", { weekday: "long" });
}

export async function resolveOrganizationId(sessionUser: {
  organizationId?: string;
  email?: string;
}): Promise<string> {
  // 1. Try provided organizationId
  if (sessionUser?.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: sessionUser.organizationId },
      select: { id: true },
    });
    if (org) return org.id;
  }

  // 2. Try looking up user by email in database
  if (sessionUser?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      select: { organizationId: true },
    });
    if (dbUser?.organizationId) {
      const org = await prisma.organization.findUnique({
        where: { id: dbUser.organizationId },
        select: { id: true },
      });
      if (org) return org.id;
    }
  }

  // 3. Reject unauthenticated/unscoped tenant access
  throw new Error("Tenant isolation violation: Unable to determine organizationId for current session");
}

export async function resolveUserId(sessionUser: {
  id?: string;
  email?: string;
}): Promise<string | null> {
  if (sessionUser?.id) {
    const u = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { id: true },
    });
    if (u) return u.id;
  }

  if (sessionUser?.email) {
    const u = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      select: { id: true },
    });
    if (u) return u.id;
  }

  return null;
}

export function isPlatformOwner(user?: { role?: string | null; email?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "PLATFORM_OWNER") return true;
  if (process.env.PLATFORM_OWNER_EMAIL && user.email === process.env.PLATFORM_OWNER_EMAIL) return true;
  return false;
}

export function isDeveloperUser(user?: { role?: string | null; email?: string | null } | null): boolean {
  if (!user) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "PLATFORM_OWNER") return true;
  const email = (user.email || "").toLowerCase().trim();
  if (
    email === "admin@reporting.app" ||
    email === "supervisor@reporting.app" ||
    email.endsWith("@reporting.app") ||
    email === "ovyrollp@gmail.com" ||
    email.includes("dev@") ||
    (process.env.PLATFORM_OWNER_EMAIL && email === process.env.PLATFORM_OWNER_EMAIL.toLowerCase()) ||
    (process.env.DEVELOPER_EMAIL && email === process.env.DEVELOPER_EMAIL.toLowerCase())
  ) {
    return true;
  }
  return false;
}
