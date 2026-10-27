import { prisma } from "@/lib/db";
import { isPlatformOwner, isDeveloperUser } from "@/lib/permissions";
import { NextResponse } from "next/server";

export interface PaywallCheckResult {
  isPaid: boolean;
  billingStatus: string;
  plan: string;
  dodoSubscriptionId?: string | null;
  message?: string;
}

/**
 * Checks whether an organization has an active, paid Dodo Payments subscription.
 * Unsubscribed organizations are granted read-only template preview access,
 * but blocked from write actions (submissions, edits, employee creation).
 */
export async function checkSubscriptionAccess(
  organizationId: string,
  user?: { role?: string | null; email?: string | null } | null
): Promise<PaywallCheckResult> {
  // 1. Platform Owners & Developer Logins always bypass paywall with full active enterprise access
  if (isPlatformOwner(user) || isDeveloperUser(user)) {
    return {
      isPaid: true,
      billingStatus: "PAID",
      plan: "ENTERPRISE",
    };
  }

  // 2. Query Organization Billing Status from Database
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      billingStatus: true,
      plan: true,
      dodoSubscriptionId: true,
      monthlyFee: true,
    },
  });

  if (!org) {
    return {
      isPaid: false,
      billingStatus: "UNKNOWN",
      plan: "NONE",
      message: "Organization not found.",
    };
  }

  const isPaid = org.billingStatus === "PAID";

  return {
    isPaid,
    billingStatus: org.billingStatus,
    plan: org.plan,
    dodoSubscriptionId: org.dodoSubscriptionId,
    message: isPaid
      ? undefined
      : "Active subscription required. Upgrade to submit daily shift reports or modify templates.",
  };
}

/**
 * Middleware helper for API routes: returns a 402 Payment Required NextResponse
 * if organization does not hold an active subscription.
 */
export async function verifyPaywallOrReject(
  organizationId: string,
  user?: { role?: string | null; email?: string | null } | null
): Promise<NextResponse | null> {
  const check = await checkSubscriptionAccess(organizationId, user);
  if (!check.isPaid) {
    return NextResponse.json(
      {
        error: "Active subscription required to perform this action.",
        paywall: true,
        billingStatus: check.billingStatus,
        requiredAction: "UPGRADE_SUBSCRIPTION",
      },
      { status: 402 }
    );
  }
  return null;
}
