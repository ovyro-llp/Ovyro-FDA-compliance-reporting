import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import { checkSubscriptionAccess } from "@/lib/paywall";
import { getDodoClient, DODO_CONFIG, applyDodoSubscriptionToOrg } from "@/lib/dodo";
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
  searchParams: Promise<{
    session_id?: string;
    subscription_id?: string;
    payment_id?: string;
    status?: string;
    email?: string;
    payment_status?: string;
  }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();

  if (!session?.user) {
    redirect(`/login?callbackUrl=/onboard/setup`);
  }

  const user = session.user as {
    id?: string;
    organizationId?: string;
    role?: string;
    email?: string;
    name?: string;
  };

  const organizationId = await resolveOrganizationId(user);

  // 1. If returning from payment gateway with subscription_id, payment_id, or valid session_id
  const hasSubId = !!searchParams.subscription_id;
  const hasPayId = !!searchParams.payment_id;
  const hasValidSessionId = !!searchParams.session_id && !searchParams.session_id.includes("{");

  if (hasSubId || hasPayId || hasValidSessionId) {
    try {
      const client = getDodoClient();
      const userEmail = (user.email || "").toLowerCase();

      // Case A: Subscription ID returned by gateway (e.g. sub_0NqeOHClvVHLaO32jFMLN)
      if (searchParams.subscription_id) {
        const sub = await client.subscriptions.retrieve(searchParams.subscription_id);
        const subOrgId = (sub as any)?.metadata?.organizationId;
        const subEmail = (sub as any)?.customer?.email?.toLowerCase();

        if (
          (subOrgId && subOrgId !== organizationId) ||
          (!subOrgId && subEmail && subEmail !== userEmail)
        ) {
          redirect("/onboard?payment_error=unauthorized_session");
        }

        const subStatus = (sub.status || "").toLowerCase();
        if (subStatus === "active" || subStatus === "succeeded") {
          await applyDodoSubscriptionToOrg(organizationId, sub);
        } else {
          redirect(`/onboard?payment_error=failed&sub_status=${subStatus}`);
        }
      }
      // Case B: Payment ID returned by gateway
      else if (searchParams.payment_id) {
        const payment = await client.payments.retrieve(searchParams.payment_id);
        const payOrgId = (payment as any)?.metadata?.organizationId;
        const payEmail = (payment as any)?.customer?.email?.toLowerCase();

        if (
          (payOrgId && payOrgId !== organizationId) ||
          (!payOrgId && payEmail && payEmail !== userEmail)
        ) {
          redirect("/onboard?payment_error=unauthorized_session");
        }

        const payStatus = (payment.status || "").toLowerCase();
        if (payStatus === "succeeded" || payStatus === "paid") {
          const isAnnual = (payment as any)?.metadata?.planInterval === "ANNUAL";
          const nextBilling = new Date();
          if (isAnnual) {
            nextBilling.setFullYear(nextBilling.getFullYear() + 1);
          } else {
            nextBilling.setMonth(nextBilling.getMonth() + 1);
          }

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              billingStatus: "PAID",
              status: "ACTIVE",
              plan: isAnnual ? "ENTERPRISE" : "PRO",
              billingInterval: isAnnual ? "ANNUAL" : "MONTHLY",
              monthlyFee: isAnnual ? DODO_CONFIG.products.ANNUAL.priceINR : DODO_CONFIG.products.MONTHLY.priceINR,
              lastPaymentDate: new Date(),
              nextBillingDate: nextBilling,
              paymentProvider: "DODO_PAYMENTS",
            },
          });
        } else {
          redirect(`/onboard?payment_error=failed&payment_status=${payStatus}`);
        }
      }
      // Case C: Valid Checkout Session ID returned
      else if (hasValidSessionId) {
        const checkoutSession = await client.checkoutSessions.retrieve(searchParams.session_id!);
        const paymentStatus = checkoutSession?.payment_status;

        const sessionOrgId = (checkoutSession as any)?.metadata?.organizationId;
        const sessionCustomerEmail = (checkoutSession as any)?.customer?.email?.toLowerCase();

        if (
          (sessionOrgId && sessionOrgId !== organizationId) ||
          (!sessionOrgId && sessionCustomerEmail && sessionCustomerEmail !== userEmail)
        ) {
          redirect("/onboard?payment_error=unauthorized_session");
        }

        const isAnnual =
          (checkoutSession as any)?.metadata?.planInterval === "ANNUAL" ||
          (checkoutSession as any)?.product_cart?.[0]?.product_id === DODO_CONFIG.products.ANNUAL.id;

        if (paymentStatus === "succeeded") {
          const nextBilling = new Date();
          if (isAnnual) {
            nextBilling.setFullYear(nextBilling.getFullYear() + 1);
          } else {
            nextBilling.setMonth(nextBilling.getMonth() + 1);
          }

          await prisma.organization.update({
            where: { id: organizationId },
            data: {
              billingStatus: "PAID",
              status: "ACTIVE",
              plan: isAnnual ? "ENTERPRISE" : "PRO",
              billingInterval: isAnnual ? "ANNUAL" : "MONTHLY",
              monthlyFee: isAnnual ? DODO_CONFIG.products.ANNUAL.priceINR : DODO_CONFIG.products.MONTHLY.priceINR,
              lastPaymentDate: new Date(),
              nextBillingDate: nextBilling,
            },
          });

          await prisma.clientBilling.updateMany({
            where: { dodoSessionId: searchParams.session_id },
            data: {
              status: "PAID",
              paidAt: new Date(),
              billingCycle: isAnnual ? "ANNUAL" : "MONTHLY",
              amount: isAnnual ? DODO_CONFIG.products.ANNUAL.priceINR : DODO_CONFIG.products.MONTHLY.priceINR,
              paymentMethod: "DODO_PAYMENTS",
              notes: `Checkout verified for session ${searchParams.session_id}`,
            },
          });
        } else {
          redirect(`/onboard?payment_error=failed&session_id=${searchParams.session_id}`);
        }
      }
    } catch (err: any) {
      if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      console.error("[SETUP_PAGE_VERIFY_ERROR]:", err.message);
    }
  }

  // 2. Strict paywall guard: developers bypass; non-developers MUST be active PAID
  const paywallCheck = await checkSubscriptionAccess(organizationId, user);
  if (!paywallCheck.isPaid) {
    redirect("/onboard?paywall=true");
  }

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
