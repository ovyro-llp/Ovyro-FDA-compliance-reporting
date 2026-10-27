import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { resolveOrganizationId } from "@/lib/permissions";
import { checkSubscriptionAccess } from "@/lib/paywall";
import { getDodoClient, DODO_CONFIG } from "@/lib/dodo";
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

  // 1. If returning from payment gateway with a checkout session_id, verify session
  if (searchParams.session_id) {
    try {
      const client = getDodoClient();
      const checkoutSession = await client.checkoutSessions.retrieve(searchParams.session_id);
      const paymentStatus = checkoutSession?.payment_status;

      // Security check: verify this checkout session actually belongs to current organization/user
      const sessionOrgId = (checkoutSession as any)?.metadata?.organizationId;
      const sessionCustomerEmail = (checkoutSession as any)?.customer?.email?.toLowerCase();
      const userEmail = (user.email || "").toLowerCase();

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
        // Payment failed or incomplete (e.g. 3DS bank authentication failure)
        await prisma.clientBilling.updateMany({
          where: { dodoSessionId: searchParams.session_id },
          data: {
            status: "OVERDUE",
            notes: `Checkout failed (status: ${paymentStatus || "failed"})`,
          },
        });
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            billingStatus: "PENDING",
          },
        });

        // Redirect back to /onboard payment step with explicit failure notification
        redirect(`/onboard?payment_error=failed&session_id=${searchParams.session_id}`);
      }
    } catch (err: any) {
      if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      console.error("[SETUP_PAGE_DODO_VERIFY_ERROR]:", err.message);
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
