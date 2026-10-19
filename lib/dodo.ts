import DodoPayments from "dodopayments";
import { prisma } from "@/lib/db";

// Exclusive Dodo Payments Configuration & Product IDs
export const DODO_CONFIG = {
  apiKey: process.env.DODO_PAYMENTS_API_KEY || "",
  environment: (process.env.DODO_PAYMENTS_ENVIRONMENT as "live_mode" | "test_mode") || "live_mode",
  webhookKey: process.env.DODO_WEBHOOK_KEY || process.env.DODO_PAYMENTS_WEBHOOK_SECRET || "",
  products: {
    MONTHLY: {
      id: process.env.DODO_PRODUCT_ID_MONTHLY || "pdt_0Npwj88UTNHuZ8GdvRcnV",
      name: "OVYRO FDA Reporting",
      planCode: "PRO",
      interval: "MONTHLY" as const,
      priceINR: 500,
      pricePaise: 50000,
      description: "Daily FDA & Food Compliance Reports — Monthly Subscription",
    },
    ANNUAL: {
      id: process.env.DODO_PRODUCT_ID_ANNUAL || "pdt_0NpwjFgGyqgduafnph03e",
      planCode: "ENTERPRISE",
      interval: "ANNUAL" as const,
      name: "OVYRO FDA Reporting Extended",
      priceINR: 5000,
      pricePaise: 500000,
      description: "Daily FDA & Food Compliance Reports — Annual Extended (Save ₹1,000/yr)",
    },
  },
};

let _dodoClient: DodoPayments | null = null;

export function getDodoClient(): DodoPayments {
  if (!DODO_CONFIG.apiKey) {
    throw new Error("Missing DODO_PAYMENTS_API_KEY environment variable. Please configure it in .env");
  }
  if (!_dodoClient) {
    _dodoClient = new DodoPayments({
      bearerToken: DODO_CONFIG.apiKey,
      environment: DODO_CONFIG.environment,
    });
  }
  return _dodoClient;
}

export interface CreateCheckoutParams {
  organizationId: string;
  planInterval?: "MONTHLY" | "ANNUAL";
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  returnUrl?: string;
}

/**
 * Creates a real Dodo Payments checkout session for a SaaS tenant organization.
 * This is the ONLY gateway used to collect payments.
 */
function formatE164Phone(phone?: string | null): string | undefined {
  if (!phone) return undefined;
  const cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
  if (!cleaned) return undefined;

  if (/^\+[1-9]\d{9,14}$/.test(cleaned)) {
    return cleaned;
  }
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }
  return undefined;
}

export async function createDodoCheckoutSession({
  organizationId,
  planInterval = "MONTHLY",
  customerEmail,
  customerName,
  customerPhone,
  returnUrl,
}: CreateCheckoutParams) {
  const client = getDodoClient();
  const product = planInterval === "ANNUAL" ? DODO_CONFIG.products.ANNUAL : DODO_CONFIG.products.MONTHLY;

  const defaultReturn = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/admin/platform?payment_status=success&session_id={CHECKOUT_SESSION_ID}&org=${organizationId}`;

  const safePhone = formatE164Phone(customerPhone);
  const customerData: { email: string; name: string; phone_number?: string } = {
    email: customerEmail.trim().toLowerCase(),
    name: customerName.trim() || "Valued Customer",
  };
  if (safePhone) {
    customerData.phone_number = safePhone;
  }

  const session = await client.checkoutSessions.create({
    product_cart: [
      {
        product_id: product.id,
        quantity: 1,
      },
    ],
    customer: customerData,
    return_url: returnUrl || defaultReturn,
    metadata: {
      organizationId,
      planInterval,
      productId: product.id,
      productName: product.name,
      appName: "OVYRO_FDA_REPORTING",
    },
  });

  // Persist billing checkout attempt in database
  const invoiceNumber = `DODO-${Date.now().toString().slice(-6)}`;
  await prisma.clientBilling.create({
    data: {
      organizationId,
      amount: product.priceINR,
      currency: "INR",
      billingCycle: product.interval,
      status: "PENDING",
      paymentMethod: "DODO_PAYMENTS",
      invoiceNumber,
      dodoSessionId: session.session_id,
      checkoutUrl: session.checkout_url || null,
      notes: `Dodo Payments Checkout initiated for ${product.name} (Session: ${session.session_id})`,
    },
  });

  // Update organization product metadata
  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      dodoProductId: product.id,
      billingInterval: product.interval,
      monthlyFee: product.priceINR,
      plan: product.planCode,
      paymentProvider: "DODO_PAYMENTS",
    },
  });

  return {
    sessionId: session.session_id,
    checkoutUrl: session.checkout_url,
    productId: product.id,
    productName: product.name,
    amount: product.priceINR,
    interval: product.interval,
  };
}

/**
 * Reconciles and syncs an organization's subscription status directly from Dodo Payments API.
 */
export async function syncOrganizationWithDodo(organizationId: string) {
  const client = getDodoClient();

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      billingRecords: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!org) {
    throw new Error(`Organization ${organizationId} not found`);
  }

  // 1. If we have a specific dodoSubscriptionId, query it directly
  if (org.dodoSubscriptionId) {
    try {
      const sub = await client.subscriptions.retrieve(org.dodoSubscriptionId);
      return await applyDodoSubscriptionToOrg(org.id, sub);
    } catch (err: any) {
      console.warn(`[DODO_SYNC] Error retrieving subscription ${org.dodoSubscriptionId}:`, err.message);
    }
  }

  // 2. Otherwise search recent subscriptions by customer email or metadata
  try {
    const subsList = await client.subscriptions.list();
    const items = (subsList as any).items || (subsList as any).data || [];

    // Find subscription matching org ID or email
    const matched = items.find((s: any) => {
      const metaOrg = s.metadata?.organizationId;
      const email = s.customer?.email?.toLowerCase();
      return (
        metaOrg === organizationId ||
        (org.contactEmail && email === org.contactEmail.toLowerCase())
      );
    });

    if (matched) {
      return await applyDodoSubscriptionToOrg(org.id, matched);
    }
  } catch (err: any) {
    console.error(`[DODO_SYNC_LIST_ERROR]:`, err.message);
  }

  return {
    synced: false,
    message: "No active Dodo Payments subscription found yet",
    organization: org,
  };
}

/**
 * Helper to update database state based on a Dodo Subscription object.
 */
export async function applyDodoSubscriptionToOrg(organizationId: string, sub: any) {
  const dodoStatus = (sub.status || "").toLowerCase();
  let billingStatus = "PENDING";
  let orgStatus = "ACTIVE";

  if (dodoStatus === "active") {
    billingStatus = "PAID";
    orgStatus = "ACTIVE";
  } else if (dodoStatus === "cancelled" || dodoStatus === "expired") {
    billingStatus = "CANCELLED";
    orgStatus = "SUSPENDED";
  } else if (dodoStatus === "past_due" || dodoStatus === "failed" || dodoStatus === "on_hold") {
    billingStatus = "OVERDUE";
  }

  const nextBilling = sub.next_billing_date ? new Date(sub.next_billing_date) : null;
  const isAnnual = sub.product_id === DODO_CONFIG.products.ANNUAL.id;
  const planCode = isAnnual ? "ENTERPRISE" : "PRO";
  const interval = isAnnual ? "ANNUAL" : "MONTHLY";
  const fee = isAnnual ? DODO_CONFIG.products.ANNUAL.priceINR : DODO_CONFIG.products.MONTHLY.priceINR;

  const updatedOrg = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      dodoSubscriptionId: sub.subscription_id,
      dodoCustomerId: sub.customer?.customer_id || null,
      dodoProductId: sub.product_id,
      billingStatus,
      status: orgStatus,
      plan: planCode,
      billingInterval: interval,
      monthlyFee: fee,
      nextBillingDate: nextBilling,
      paymentProvider: "DODO_PAYMENTS",
      lastPaymentDate: billingStatus === "PAID" ? new Date() : undefined,
    },
  });

  // Record payment in ClientBilling if active
  if (billingStatus === "PAID") {
    const existingPayment = await prisma.clientBilling.findFirst({
      where: {
        organizationId,
        dodoSubscriptionId: sub.subscription_id,
        status: "PAID",
      },
    });

    if (!existingPayment) {
      await prisma.clientBilling.create({
        data: {
          organizationId,
          amount: fee,
          currency: sub.currency || "INR",
          billingCycle: interval,
          status: "PAID",
          paidAt: new Date(),
          paymentMethod: "DODO_PAYMENTS",
          invoiceNumber: `DODO-SUB-${Date.now().toString().slice(-6)}`,
          dodoSubscriptionId: sub.subscription_id,
          notes: `Verified Dodo Payments Subscription: ${sub.subscription_id} (${sub.product_name || "OVYRO FDA"})`,
        },
      });
    }
  }

  return {
    synced: true,
    subscriptionId: sub.subscription_id,
    dodoStatus,
    billingStatus,
    organization: updatedOrg,
  };
}
