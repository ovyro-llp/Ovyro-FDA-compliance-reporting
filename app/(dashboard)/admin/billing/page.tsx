import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import BillingClient from "./BillingClient";
import { DODO_CONFIG } from "@/lib/dodo";

export const metadata = {
  title: "Subscription & Billing | Food Safety Reporting",
};

export default async function BillingPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user as { organizationId?: string; role?: string; email?: string; name?: string };

  if (!user.organizationId) {
    redirect("/dashboard");
  }

  const organization = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: {
      billingRecords: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
    },
  });

  if (!organization) {
    redirect("/dashboard");
  }

  return (
    <BillingClient
      organization={JSON.parse(JSON.stringify(organization))}
      products={DODO_CONFIG.products}
      userRole={user.role || "STAFF"}
    />
  );
}
