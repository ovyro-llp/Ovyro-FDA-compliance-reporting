import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { isPlatformOwner } from "@/lib/permissions";
import { checkSubscriptionAccess } from "@/lib/paywall";
import { getDodoClient, syncOrganizationWithDodo, applyDodoSubscriptionToOrg, DODO_CONFIG } from "@/lib/dodo";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string; organizationId?: string };
  if (!user.organizationId) {
    return NextResponse.json({ error: "No organization assigned" }, { status: 400 });
  }

  const check = await checkSubscriptionAccess(user.organizationId, user);
  return NextResponse.json({
    isPaid: check.isPaid,
    billingStatus: check.billingStatus,
    plan: check.plan,
    dodoSubscriptionId: check.dodoSubscriptionId,
    message: check.message,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as { role?: string; email?: string; organizationId?: string };

  try {
    const body = await req.json().catch(() => ({}));
    const { organizationId, sessionId } = body;

    const client = getDodoClient();

    // Case 1: Reconcile specific checkout session returned from Dodo Payments
    if (sessionId) {
      const targetOrgId = organizationId || user.organizationId;
      if (!targetOrgId) {
        return NextResponse.json({ error: "Target organization ID required" }, { status: 400 });
      }

      if (!isPlatformOwner(user) && user.organizationId !== targetOrgId) {
        return NextResponse.json({ error: "Forbidden: Cannot sync billing for another organization" }, { status: 403 });
      }

      const checkoutSession = await client.checkoutSessions.retrieve(sessionId);
      if (!checkoutSession) {
        return NextResponse.json({ error: "Checkout session not found" }, { status: 404 });
      }

      const sessionStatus = (checkoutSession as any).payment_status || (checkoutSession as any).status;
      const isSuccessful =
        sessionStatus === "succeeded" ||
        sessionStatus === "paid" ||
        sessionStatus === "complete" ||
        sessionStatus === "completed";

      if (!isSuccessful) {
        // Mark billing as overdue/failed and ensure org is NOT active paid
        await prisma.clientBilling.updateMany({
          where: { dodoSessionId: sessionId },
          data: {
            status: "OVERDUE",
            notes: `Dodo checkout attempt not successful (status: ${sessionStatus || "pending"})`,
          },
        });
        await prisma.organization.update({
          where: { id: targetOrgId },
          data: {
            billingStatus: "PENDING",
          },
        });

        return NextResponse.json(
          {
            error: `Payment has not succeeded yet (status: ${sessionStatus || "pending"}). Subscription not activated.`,
            paymentStatus: sessionStatus || "pending",
          },
          { status: 400 }
        );
      }

      const sessionOrgId = (checkoutSession as any).metadata?.organizationId;
      if (sessionOrgId && sessionOrgId !== targetOrgId) {
        return NextResponse.json(
          { error: "Forbidden: Checkout session belongs to a different organization" },
          { status: 403 }
        );
      }

      const org = await prisma.organization.findUnique({ where: { id: targetOrgId } });
      if (org) {
        // Find or update ClientBilling
        await prisma.clientBilling.updateMany({
          where: { dodoSessionId: sessionId },
          data: {
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: "DODO_PAYMENTS",
            notes: `Dodo checkout verified for session ${sessionId}`,
          },
        });

        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        await prisma.organization.update({
          where: { id: targetOrgId },
          data: {
            billingStatus: "PAID",
            status: "ACTIVE",
            lastPaymentDate: new Date(),
            nextBillingDate: nextMonth,
          },
        });

        return NextResponse.json({
          success: true,
          message: "Checkout session verified and organization activated",
          session: checkoutSession,
        });
      }
    }

    // Case 2: Sync single organization
    const targetOrgId = organizationId || user.organizationId;
    if (targetOrgId && (!isPlatformOwner(user) || organizationId)) {
      if (!isPlatformOwner(user) && user.organizationId !== targetOrgId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const syncResult = await syncOrganizationWithDodo(targetOrgId);
      return NextResponse.json({
        success: true,
        result: syncResult,
      });
    }

    // Case 3: Global SaaS sync across all organizations (Platform Owner only)
    if (!isPlatformOwner(user)) {
      return NextResponse.json({ error: "Platform owner access required for global sync" }, { status: 403 });
    }

    const organizations = await prisma.organization.findMany();
    const subsList = await client.subscriptions.list();
    const items = (subsList as any).items || (subsList as any).data || [];

    const syncReport = [];

    for (const org of organizations) {
      // Find matching Dodo subscription
      const matched = items.find((s: any) => {
        return (
          s.subscription_id === org.dodoSubscriptionId ||
          s.metadata?.organizationId === org.id ||
          (org.contactEmail && s.customer?.email?.toLowerCase() === org.contactEmail.toLowerCase())
        );
      });

      if (matched) {
        const res = await applyDodoSubscriptionToOrg(org.id, matched);
        syncReport.push({
          organization: org.name,
          slug: org.slug,
          status: "SYNCED",
          dodoStatus: res.dodoStatus,
          subscriptionId: res.subscriptionId,
        });
      } else {
        syncReport.push({
          organization: org.name,
          slug: org.slug,
          status: "NO_ACTIVE_SUB",
          currentBillingStatus: org.billingStatus,
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalOrganizations: organizations.length,
      report: syncReport,
    });
  } catch (err: any) {
    console.error("[PAYMENTS_SYNC_API_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Failed to sync payment status" }, { status: 500 });
  }
}
