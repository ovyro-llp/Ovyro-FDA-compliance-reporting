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
    <div className="dashboard-simple-wrapper">
      {/* ─── Compact, Focused Header ────────────────────────────────────────── */}
      <div className="dashboard-simple-header">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 tracking-wide uppercase">
            <Calendar size={13} className="text-blue-600" />
            <span>{formatDate(today)}</span>
            <span>•</span>
            <span className="text-slate-700 font-bold">{currentOutlet.name}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 tracking-tight">
            Today's Checklists
          </h1>
        </div>

        {/* Clean Progress Pill */}
        <div className="progress-badge-clean">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-slate-600">Progress</span>
            <span className={doneCount === totalCount && totalCount > 0 ? "text-emerald-600" : "text-blue-600"}>
              {doneCount} of {totalCount} Done
            </span>
          </div>
          <div className="progress-track-clean">
            <div
              className={`progress-fill-clean ${doneCount === totalCount && totalCount > 0 ? "bg-emerald-500" : "bg-blue-600"}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── Free Inspection Banner (Minimal & Dismissible/Compact) ──────────── */}
      {org?.billingStatus !== "PAID" && (
        <div className="minimal-upgrade-card">
          <div className="flex items-center gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <Sparkles size={16} />
            </span>
            <p className="text-xs sm:text-sm font-medium text-slate-700">
              <strong className="text-slate-900">Preview Mode:</strong> Full checklists available for free inspection.
            </p>
          </div>
          <Link href="/admin/billing" className="minimal-upgrade-btn">
            Upgrade Plan <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* ─── Mobile-First Checklists Card List ─────────────────────────────────── */}
      <div className="checklist-stack">
        {outletTemplates.length === 0 ? (
          <div className="empty-state-card text-center py-12 px-4 bg-white rounded-2xl border border-slate-200">
            <FileSpreadsheet size={32} className="mx-auto text-slate-400 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No checklists assigned to {currentOutlet.name}</p>
            <Link href="/admin/templates" className="text-xs font-bold text-blue-600 mt-2 inline-block hover:underline">
              Assign Checklists in Admin →
            </Link>
          </div>
        ) : (
          outletTemplates.map((ot) => {
            const tpl = ot.template;
            const subs = submissionMap.get(tpl.id) || [];
            const isDone = subs.length > 0;
            const latestSub = subs[0];

            return (
              <Link
                key={tpl.id}
                href={`/${currentOutlet.id}/${tpl.slug}`}
                className={`sheet-row-card ${isDone ? "status-completed" : "status-pending"}`}
              >
                <div className="sheet-row-main">
                  <div className={`sheet-row-icon ${isDone ? "icon-done" : "icon-pending"}`}>
                    {isDone ? <CheckCircle2 size={22} /> : <FileSpreadsheet size={22} />}
                  </div>

                  <div className="sheet-row-text">
                    <div className="flex items-center gap-2">
                      <h2 className="sheet-row-title">{tpl.title}</h2>
                      {tpl.frequency === "SHIFT_WISE" && (
                        <span className="sheet-tag-shift">Shift</span>
                      )}
                    </div>
                    <div className="sheet-row-meta">
                      {isDone ? (
                        <span className="text-emerald-700 font-medium">
                          Logged by {latestSub.submittedBy?.name || "Staff"}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-normal">
                          Tap to fill checklist
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="sheet-row-action">
                  {isDone ? (
                    <span className="pill-badge-done">
                      <CheckCircle2 size={14} /> Completed
                    </span>
                  ) : (
                    <span className="pill-badge-start">
                      Start <ArrowRight size={14} />
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
