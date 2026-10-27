import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import OnboardClient from "./OnboardClient";
import { DODO_CONFIG } from "@/lib/dodo";

export const metadata = {
  title: "Tailor Your Workspace | Food Safety Reporting",
};

export default async function OnboardingPage(props: {
  searchParams: Promise<{ payment_error?: string; paywall?: string; reason?: string; session_id?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await auth();
  if (!session?.user) {
    redirect("/login?tab=register");
  }

  const sessionUser = session.user as { organizationId?: string; id?: string; email?: string; name?: string };

  let organization = null;
  if (sessionUser.organizationId) {
    organization = await prisma.organization.findUnique({
      where: { id: sessionUser.organizationId },
      include: {
        outlets: { take: 1 },
      },
    });
  }

  if (!organization && sessionUser.email) {
    const userInDb = await prisma.user.findUnique({
      where: { email: sessionUser.email },
      include: {
        organization: {
          include: { outlets: { take: 1 } },
        },
      },
    });
    organization = userInDb?.organization || null;
  }

  if (!organization) {
    redirect("/dashboard");
  }

  return (
    <OnboardClient
      user={{
        name: sessionUser.name || "Chef / Manager",
        email: sessionUser.email || "",
      }}
      organization={{
        id: organization.id,
        name: organization.name,
        contactPhone: organization.contactPhone,
        billingStatus: organization.billingStatus,
        primaryOutlet: organization.outlets[0] ? {
          id: organization.outlets[0].id,
          name: organization.outlets[0].name,
          type: organization.outlets[0].type,
        } : null,
      }}
      products={DODO_CONFIG.products}
      initialPaymentError={Boolean(searchParams.payment_error)}
      initialPaywall={Boolean(searchParams.paywall)}
    />
  );
}
