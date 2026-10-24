import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformOwner, userHasPermission } from "@/lib/permissions";
import { createDodoCheckoutSession, DODO_CONFIG } from "@/lib/dodo";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string; organizationId?: string; permissions?: string[] };

  try {
    const body = await req.json();
    const { organizationId, planInterval = "MONTHLY", returnUrl } = body;

    const targetOrgId = organizationId || user.organizationId;
    if (!targetOrgId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const isPlatform = isPlatformOwner(user);
    const isOrgAdmin =
      user.role === "ORG_ADMIN" ||
      user.role === "SUPER_ADMIN" ||
      user.role === "ADMIN" ||
      userHasPermission(user.permissions, "manage_organization", user.role);

    // RBAC: Platform owner can generate checkout for any tenant; tenant admins can only generate for their own org
    if (!isPlatform && (!isOrgAdmin || user.organizationId !== targetOrgId)) {
      return NextResponse.json({ error: "Forbidden: Administrative billing access required" }, { status: 403 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: targetOrgId },
      include: {
        users: {
          where: { role: "ORG_ADMIN" },
          take: 1,
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const adminUser = org.users[0];
    const customerEmail = org.contactEmail || adminUser?.email || user.email || "support@reporting.app";
    const customerName = org.name || adminUser?.name || "Restaurant Owner";
    const customerPhone = org.contactPhone || undefined;

    // Validate returnUrl against application origin to prevent open redirects
    let safeReturnUrl: string | undefined = undefined;
    if (typeof returnUrl === "string" && returnUrl.trim()) {
      const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
      try {
        const appOrigin = new URL(baseUrl).origin;
        if (returnUrl.startsWith("/")) {
          safeReturnUrl = `${appOrigin}${returnUrl}`;
        } else {
          const parsed = new URL(returnUrl);
          const reqHost = req.headers.get("host");
          if (parsed.origin === appOrigin || (reqHost && parsed.host === reqHost)) {
            safeReturnUrl = parsed.toString();
          }
        }
      } catch {
        // Fallback to default
        safeReturnUrl = undefined;
      }
    }

    const checkout = await createDodoCheckoutSession({
      organizationId: org.id,
      planInterval: planInterval === "ANNUAL" ? "ANNUAL" : "MONTHLY",
      customerEmail,
      customerName,
      customerPhone,
      returnUrl: safeReturnUrl,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: checkout.checkoutUrl,
      sessionId: checkout.sessionId,
      productId: checkout.productId,
      productName: checkout.productName,
      amount: checkout.amount,
      interval: checkout.interval,
    });
  } catch (err: any) {
    console.error("[DODO_CHECKOUT_API_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to create Dodo Payments checkout session" }, { status: 500 });
  }
}

// GET: Returns current Dodo products information
export async function GET(req: NextRequest) {
  return NextResponse.json({
    provider: "DODO_PAYMENTS",
    products: DODO_CONFIG.products,
  });
}
