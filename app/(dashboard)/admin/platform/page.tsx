import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { isPlatformOwner } from "@/lib/permissions";
import PlatformClient from "./PlatformClient";

export default async function PlatformAdminPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;
  if (!isPlatformOwner(user)) {
    redirect("/dashboard");
  }

  const [
    totalClients,
    totalUsers,
    totalOutlets,
    totalSubmissions,
    organizations,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
    prisma.outlet.count(),
    prisma.formSubmission.count(),
    prisma.organization.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: {
            users: true,
            outlets: true,
            templates: true,
            submissions: true,
          },
        },
        billingRecords: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
  ]);

  let totalRevenueReceived = 0;
  let totalRevenuePending = 0;

  for (const org of organizations) {
    const fee = org.monthlyFee || 4999;
    if (org.billingStatus === "PAID") {
      totalRevenueReceived += fee;
    } else {
      totalRevenuePending += fee;
    }
  }

  const metrics = {
    totalClients,
    totalUsers,
    totalOutlets,
    totalSubmissions,
    totalRevenueReceived,
    totalRevenuePending,
    mrr: totalRevenueReceived + totalRevenuePending,
  };

  const parsedOrgs = organizations.map((o) => ({
    ...o,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
    nextBillingDate: o.nextBillingDate ? o.nextBillingDate.toISOString() : null,
    billingRecords: (o.billingRecords || []).map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      dueDate: b.dueDate.toISOString(),
      paidAt: b.paidAt ? b.paidAt.toISOString() : null,
    })),
  }));

  return (
    <PlatformClient
      initialMetrics={metrics}
      initialOrganizations={parsedOrgs as any}
    />
  );
}
