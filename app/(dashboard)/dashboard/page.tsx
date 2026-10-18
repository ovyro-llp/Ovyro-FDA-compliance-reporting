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
      <div className="notion-doc-header">
        <div className="notion-doc-breadcrumb">
          <span>Workspace</span>
          <span className="notion-doc-breadcrumb-sep">/</span>
          <span>{currentOutlet.name}</span>
          <span className="notion-doc-breadcrumb-sep">/</span>
          <span className="active">Checklists</span>
        </div>

        <div className="notion-doc-title-row">
          <span className="notion-doc-icon">📋</span>
          <h1 className="notion-doc-title">Daily Operations & Compliance</h1>
        </div>

        <div className="notion-doc-meta-bar">
          <span className="notion-score-tag">{formatDate(today)}</span>
          <span className="notion-doc-tag">
            {doneCount} of {totalCount} completed
          </span>
          {doneCount === totalCount && totalCount > 0 && (
            <span className="notion-score-tag">✓ All Completed</span>
          )}
        </div>
      </div>

      <hr className="notion-hr" />

      {/* ─── Notion Database List (Checklists) ─────────────────────────────── */}
      {outletTemplates.length === 0 ? (
        <div className="callout callout-gray">
          <span className="icon">ℹ️</span>
          <div>
            <strong>No checklists configured.</strong> Add or enable templates for {currentOutlet.name} in{" "}
            <Link href="/admin/templates" style={{ color: '#2C2C2B', textDecoration: 'underline' }}>
              Admin Templates
            </Link>.
          </div>
        </div>
      ) : (
        <div className="notion-db-list">
          {outletTemplates.map((ot) => {
            const tpl = ot.template;
            const subs = submissionMap.get(tpl.id) || [];
            const isDone = subs.length > 0;
            const latestSub = subs[0];
            const icon = tpl.icon || "📋";

            return (
              <Link
                key={tpl.id}
                href={`/${currentOutlet.id}/${tpl.slug}`}
                className="notion-db-row"
              >
                <div className="notion-db-row-left">
                  <span className="notion-db-icon">{icon}</span>
                  <div className="notion-db-row-text">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="notion-db-title">{tpl.title}</span>
                      {tpl.frequency === "SHIFT_WISE" && (
                        <span className="notion-db-tag">Shift</span>
                      )}
                    </div>
                    <span className="notion-db-sub">
                      {isDone ? (
                        <span style={{ color: '#1F6B45', fontWeight: 500 }}>
                          ✓ Logged today by {latestSub.submittedBy?.name || "Staff"}
                        </span>
                      ) : (
                        <span>Pending daily entry</span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="notion-db-row-right">
                  {isDone ? (
                    <span className="notion-pill-done">
                      ✓ Done
                    </span>
                  ) : (
                    <span className="notion-pill-start">
                      Start →
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
