import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { userHasPermission, resolveOrganizationId } from "@/lib/permissions";
import { verifyPaywallOrReject } from "@/lib/paywall";

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

  const user = session.user as { organizationId: string; role: string; email?: string };
  const organizationId = await resolveOrganizationId(user);

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // "active" | "archived" | "all"

  const where: any = { organizationId };
  if (status === "active") {
    where.isArchived = false;
  } else if (status === "archived") {
    where.isArchived = true;
  }

  try {
    const templates = await prisma.formTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        outletTemplates: {
          include: {
            outlet: {
              select: { id: true, name: true, code: true, icon: true },
            },
          },
        },
        _count: {
          select: { submissions: true },
        },
      },
    });

    const parsed = templates.map((t) => ({
      ...t,
      schema: safeJson(t.schema, {}),
    }));

    return NextResponse.json({ templates: parsed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { organizationId: string; role: string; permissions?: string[]; email?: string };
  const canManage =
    user.role === "ORG_ADMIN" ||
    user.role === "SUPER_ADMIN" ||
    user.role === "ADMIN" ||
    userHasPermission(user.permissions, "manage_templates", user.role);

  if (!canManage) {
    return NextResponse.json({ error: "Forbidden: Manage templates permission required" }, { status: 403 });
  }

  const organizationId = await resolveOrganizationId(user);

  // Paywall check: modifying or creating templates requires active Dodo subscription
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  try {
    const body = await req.json();
    const { title, slug, category, icon, description, frequency, schema, outletIds } = body;

    if (!title) {
      return NextResponse.json({ error: "Template title is required" }, { status: 400 });
    }

    let cleanSlug = (slug || title)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]/g, "-");

    // Check if slug already exists in this organization
    const existingSlug = await prisma.formTemplate.findFirst({
      where: { organizationId, slug: cleanSlug },
    });

    if (existingSlug) {
      cleanSlug = `${cleanSlug}-${Date.now().toString().slice(-4)}`;
    }

    const template = await prisma.formTemplate.create({
      data: {
        organizationId,
        title,
        slug: cleanSlug,
        category: category || "CUSTOM",
        icon: icon || "📋",
        description: description || "",
        frequency: frequency || "DAILY",
        schema: typeof schema === "string" ? schema : JSON.stringify(schema || { sections: [] }),
      },
    });


    // Assign to outlets if provided
    if (Array.isArray(outletIds) && outletIds.length > 0) {
      const validOutlets = await prisma.outlet.findMany({
        where: { id: { in: outletIds }, organizationId },
        select: { id: true },
      });
      const validOutletIds = new Set(validOutlets.map((o) => o.id));

      for (const [idx, outletId] of outletIds.entries()) {
        if (validOutletIds.has(outletId)) {
          await prisma.outletTemplate.create({
            data: {
              outletId,
              templateId: template.id,
              order: idx,
              isEnabled: true,
            },
          });
        }
      }
    }


    return NextResponse.json({
      success: true,
      template: { ...template, schema: safeJson(template.schema) },
    });
  } catch (err: any) {
    console.error("Create template error:", err);
    return NextResponse.json({ error: err.message || "Failed to create template" }, { status: 500 });
  }
}
