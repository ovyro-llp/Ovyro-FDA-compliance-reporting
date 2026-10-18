import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDodoClient, applyDodoSubscriptionToOrg, DODO_CONFIG } from "@/lib/dodo";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const client = getDodoClient();

    // Standard headers for webhook verification
    const headersList: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headersList[key.toLowerCase()] = value;
    });

    if (!DODO_CONFIG.webhookKey) {
      console.error("[DODO_WEBHOOK_CONFIG_ERROR]: DODO_WEBHOOK_KEY is not configured.");
      return NextResponse.json({ error: "Webhook verification key not configured" }, { status: 500 });
    }

    let event: any;
    try {
      // Cryptographically verify webhook signature using Dodo Payments webhook key
      event = client.webhooks.unwrap(rawBody, {
        headers: headersList,
        key: DODO_CONFIG.webhookKey,
      });
    } catch (verifyErr: any) {
      console.error("[DODO_WEBHOOK_SIGNATURE_INVALID]:", verifyErr.message);
      return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
    }

    if (!event || !event.type) {
      return NextResponse.json({ error: "Missing event type" }, { status: 400 });
    }

    console.log(`[DODO_WEBHOOK_EVENT] Received: ${event.type}`, {
      timestamp: event.timestamp,
      business_id: event.business_id,
    });

    const eventType = event.type;
    const eventData = event.data;

    // Handle subscription events (active, renewed, plan_changed, cancelled, failed, expired)
    if (eventType.startsWith("subscription.")) {
      const sub = eventData;
      const subId = sub.subscription_id;
      const orgId = sub.metadata?.organizationId;
      const customerEmail = sub.customer?.email?.toLowerCase();

      // Find organization by ID, existing dodoSubscriptionId, or email
      let org = null;
      if (orgId) {
        org = await prisma.organization.findUnique({ where: { id: orgId } });
      }
      if (!org && subId) {
        org = await prisma.organization.findUnique({ where: { dodoSubscriptionId: subId } });
      }
      if (!org && customerEmail) {
        org = await prisma.organization.findFirst({
          where: { contactEmail: { equals: customerEmail, mode: "insensitive" } },
        });
        if (!org) {
          const u = await prisma.user.findFirst({
            where: { email: { equals: customerEmail, mode: "insensitive" } },
            include: { organization: true },
          });
          if (u?.organization) org = u.organization;
        }
      }

      if (org) {
        await applyDodoSubscriptionToOrg(org.id, sub);
        console.log(`[DODO_WEBHOOK_PROCESSED] Successfully updated org ${org.name} (${org.id}) for event ${eventType}`);
      } else {
        console.warn(`[DODO_WEBHOOK_UNMATCHED] No organization matched for subscription ${subId} (${customerEmail})`);
      }
    }

    // Handle direct payment events (payment.succeeded, payment.failed)
    else if (eventType === "payment.succeeded") {
      const payment = eventData;
      const orgId = payment.metadata?.organizationId;
      const customerEmail = payment.customer?.email?.toLowerCase();
      const subId = payment.subscription_id;

      let org = null;
      if (orgId) {
        org = await prisma.organization.findUnique({ where: { id: orgId } });
      }
      if (!org && subId) {
        org = await prisma.organization.findUnique({ where: { dodoSubscriptionId: subId } });
      }
      if (!org && customerEmail) {
        org = await prisma.organization.findFirst({
          where: { contactEmail: { equals: customerEmail, mode: "insensitive" } },
        });
        if (!org) {
          const u = await prisma.user.findFirst({
            where: { email: { equals: customerEmail, mode: "insensitive" } },
            include: { organization: true },
          });
          if (u?.organization) org = u.organization;
        }
      }

      if (org) {
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const fee = payment.total_amount ? payment.total_amount / 100 : org.monthlyFee;

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            billingStatus: "PAID",
            status: "ACTIVE",
            lastPaymentDate: new Date(),
            nextBillingDate: nextMonth,
            paymentProvider: "DODO_PAYMENTS",
            ...(subId ? { dodoSubscriptionId: subId } : {}),
          },
        });

        await prisma.clientBilling.create({
          data: {
            organizationId: org.id,
            amount: fee,
            currency: payment.currency || "INR",
            billingCycle: org.billingInterval || "MONTHLY",
            status: "PAID",
            paidAt: new Date(),
            paymentMethod: "DODO_PAYMENTS",
            invoiceNumber: `DODO-PAY-${Date.now().toString().slice(-6)}`,
            dodoPaymentId: payment.payment_id,
            dodoSubscriptionId: subId || null,
            notes: `Dodo Payment Succeeded: ID ${payment.payment_id} (₹${fee})`,
          },
        });

        console.log(`[DODO_WEBHOOK_PAYMENT_PROCESSED] Org ${org.name} marked as PAID.`);
      }
    } else if (eventType === "payment.failed") {
      const payment = eventData;
      const orgId = payment.metadata?.organizationId;
      const subId = payment.subscription_id;

      let org = null;
      if (orgId) org = await prisma.organization.findUnique({ where: { id: orgId } });
      if (!org && subId) org = await prisma.organization.findUnique({ where: { dodoSubscriptionId: subId } });

      if (org) {
        await prisma.organization.update({
          where: { id: org.id },
          data: { billingStatus: "OVERDUE" },
        });

        await prisma.clientBilling.create({
          data: {
            organizationId: org.id,
            amount: payment.total_amount ? payment.total_amount / 100 : org.monthlyFee,
            currency: payment.currency || "INR",
            billingCycle: org.billingInterval || "MONTHLY",
            status: "OVERDUE",
            paymentMethod: "DODO_PAYMENTS",
            invoiceNumber: `DODO-FAIL-${Date.now().toString().slice(-6)}`,
            dodoPaymentId: payment.payment_id,
            notes: `Dodo Payment Failed: ${payment.payment_id} - ${payment.error_message || "Declined"}`,
          },
        });
      }
    }

    return NextResponse.json({ received: true, event: eventType });
  } catch (err: any) {
    console.error("[DODO_WEBHOOK_HANDLER_ERROR]:", err);
    return NextResponse.json({ error: err.message || "Webhook processing error" }, { status: 500 });
  }
}
