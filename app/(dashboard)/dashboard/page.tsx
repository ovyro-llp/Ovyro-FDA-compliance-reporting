import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTodayString, formatDate, resolveOrganizationId } from "@/lib/permissions";
import {
  CheckCircle2,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Calendar,
  Sparkles,
} from "lucide-react";

interface PageProps {
  searchParams: Promise<{ outlet?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as {
    id: string;
    name: string;
    role: string;
    organizationId: string;
    organizationName?: string;
    email?: string;
  };

  const organizationId = await resolveOrganizationId(user);
  const resolvedParams = (await searchParams) || {};
  const cookieStore = await cookies();

  // Load organization billing status
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { billingStatus: true, plan: true },
  });

  // Load all tenant outlets
  const outlets = await prisma.outlet.findMany({
    where: { organizationId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (outlets.length === 0) {
    return (
      <div className="empty-state-card text-center py-16 px-6">
        <h2 className="text-xl font-bold text-slate-800">No Facilities Configured</h2>
        <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">
          Add your first outlet or kitchen to begin daily compliance logging.
        </p>
        <Link href="/admin/outlets" className="btn-primary mt-6 inline-flex">
          Add Facility
        </Link>
      </div>
    );
  }

  const selectedOutletId =
    resolvedParams.outlet ||
    cookieStore.get("pnr_outlet")?.value ||
    outlets[0]?.id;

  const currentOutlet =
    outlets.find((o) => o.id === selectedOutletId) || outlets[0];

  const today = getTodayString();

  // Fetch dynamic templates assigned to current outlet
  const outletTemplates = await prisma.outletTemplate.findMany({
    where: { outletId: currentOutlet.id, isEnabled: true },
    include: {
      template: true,
    },
    orderBy: { order: "asc" },
  });

  // Fetch today's submissions for this outlet
  const todaySubsubmissions = await prisma.formSubmission.findMany({
    where: {
      outletId: currentOutlet.id,
      date: today,
    },
    include: {
      submittedBy: { select: { name: true } },
      template: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const submissionMap = new Map<string, any[]>();
  todaySubsubmissions.forEach((sub) => {
    const arr = submissionMap.get(sub.templateId) || [];
    arr.push(sub);
    submissionMap.set(sub.templateId, arr);
  });

  const totalCount = outletTemplates.length;
  const doneCount = outletTemplates.filter((ot) => submissionMap.has(ot.templateId)).length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="notion-page-container">
      {/* ─── Notion Breadcrumb & Header ─────────────────────────────────────── */}
      <div className="notion-breadcrumb">
        <span>Workspace</span>
        <span>/</span>
        <span>{currentOutlet.name}</span>
        <span>/</span>
        <span className="text-slate-900 font-semibold">Checklists</span>
      </div>

      <div className="notion-page-icon">📋</div>

      <h1 className="notion-title">Daily Operations & Compliance</h1>

      <div className="notion-meta">
        <span className="notion-tag blue">{formatDate(today)}</span>
        <span className="notion-tag">{currentOutlet.name}</span>
        <span>·</span>
        <span>{doneCount} of {totalCount} completed</span>
        {doneCount === totalCount && totalCount > 0 ? (
          <span className="notion-tag green">✓ All Done</span>
        ) : null}
      </div>

      <hr className="notion-hr" />

      {/* ─── Notion List View (Checklists) ─────────────────────────────────── */}
      <div className="notion-list-stack">
        {outletTemplates.length === 0 ? (
          <div className="callout callout-gray">
            <span className="icon">ℹ️</span>
            <div>
              <strong>No checklists configured.</strong> Add or enable templates for {currentOutlet.name} in{" "}
              <Link href="/admin/templates" className="text-blue-600 underline">
                Admin Templates
              </Link>.
            </div>
          </div>
        ) : (
          outletTemplates.map((ot) => {
            const tpl = ot.template;
            const subs = submissionMap.get(tpl.id) || [];
            const isDone = subs.length > 0;
            const latestSub = subs[0];
            const icon = tpl.icon || "📋";

            return (
              <Link
                key={tpl.id}
                href={`/${currentOutlet.id}/${tpl.slug}`}
                className="notion-row-item"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span className="notion-row-icon">{icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="notion-row-title">{tpl.title}</span>
                      {tpl.frequency === "SHIFT_WISE" && (
                        <span className="notion-tag">Shift</span>
                      )}
                    </div>
                    <div className="notion-row-sub">
                      {isDone ? (
                        <span className="text-emerald-700 font-medium">
                          ✓ Logged today by {latestSub.submittedBy?.name || "Staff"}
                        </span>
                      ) : (
                        <span>Tap to complete inspection</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {isDone ? (
                    <span className="notion-badge-done">
                      <CheckCircle2 size={13} /> Completed
                    </span>
                  ) : (
                    <span className="notion-badge-start">
                      Start <ArrowRight size={13} />
                    </span>
                  )}
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
