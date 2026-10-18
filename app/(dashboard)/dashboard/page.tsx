import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { getTodayString, formatDate, resolveOrganizationId } from "@/lib/permissions";
import {
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Building2,
  Sparkles,
  Clock,
  ArrowRight,
  FileSpreadsheet,
  Calendar,
  Eye,
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
      <div className="empty-state-card">
        <h2>No facilities configured</h2>
        <p>Please add a facility or outlet from the Admin Console.</p>
        <Link href="/admin/outlets" className="btn-create-primary">
          Configure Outlets
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

  const totalTemplates = outletTemplates.length;
  const completedCount = outletTemplates.filter((ot) => submissionMap.has(ot.templateId)).length;
  const completionPercentage = totalTemplates > 0 ? Math.round((completedCount / totalTemplates) * 100) : 100;

  // Recent 10 submissions across all outlets for this tenant
  const recentFeed = await prisma.formSubmission.findMany({
    where: { organizationId },
    take: 8,
    orderBy: { createdAt: "desc" },
    include: {
      submittedBy: { select: { name: true } },
      template: { select: { title: true, icon: true } },
      outlet: { select: { name: true, icon: true } },
    },
  });


  return (
    <div className="dashboard-container">
      {/* Welcome Banner */}
      <div className="dashboard-hero-banner">
        <div className="hero-left">
          <span className="hero-date-badge flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600" /> {formatDate(today)}
          </span>
          <h1 className="hero-title">
            Welcome back, {user.name || "Operator"}!
          </h1>
          <p className="hero-subtitle">
            {user.organizationName || "Audit Management"} • Daily Operations & Food Safety Compliance
          </p>
        </div>

        <div className="hero-right">
          <div className="outlet-pill-badge">
            <span className="pill-icon flex items-center justify-center text-blue-600">
              <Building2 size={16} />
            </span>
            <div className="pill-details">
              <span className="pill-title">{currentOutlet.name}</span>
              <span className="pill-type">{currentOutlet.type}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Free Inspection Mode / Upgrade Banner */}
      {org?.billingStatus !== "PAID" && (
        <div style={{
          background: "#ffffff",
          border: "1px solid #bfdbfe",
          borderRadius: "16px",
          padding: "1.1rem 1.35rem",
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "1rem",
          boxShadow: "0 4px 12px rgba(37, 99, 235, 0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#eff6ff",
              color: "#2563eb",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Eye size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e3a8a" }}>
                Free Inspection Mode Active
              </div>
              <div style={{ fontSize: "0.825rem", color: "#475569", marginTop: "0.15rem" }}>
                All bespoke compliance SOPs are placed and ready for inspection. Subscribe to unlock shift logging, reports, and team management.
              </div>
            </div>
          </div>
          <Link
            href="/admin/billing"
            style={{
              background: "#2563eb",
              color: "#ffffff",
              padding: "0.6rem 1.25rem",
              borderRadius: "10px",
              fontWeight: 600,
              fontSize: "0.875rem",
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              whiteSpace: "nowrap",
            }}
          >
            Activate Subscription (₹500/mo) <ArrowRight size={15} />
          </Link>
        </div>
      )}

      {/* KPI Stats Row (Bento Grid) */}
      <div className="dashboard-kpi-grid">
        <div className="kpi-box">
          <div className="kpi-icon-wrap green">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="kpi-num">{completedCount}/{totalTemplates}</span>
            <span className="kpi-label">Today's Checklists Done</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-icon-wrap blue">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="kpi-num">{completionPercentage}%</span>
            <span className="kpi-label">Facility Completion Rate</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-icon-wrap amber">
            <ShieldCheck size={20} />
          </div>
          <div>
            <span className="kpi-num">
              {todaySubsubmissions.filter((s) => s.status === "VERIFIED" || s.supervisorSigned).length}
            </span>
            <span className="kpi-label">Supervisor Verified</span>
          </div>
        </div>

        <div className="kpi-box">
          <div className="kpi-icon-wrap purple">
            <Building2 size={20} />
          </div>
          <div>
            <span className="kpi-num">{outlets.length}</span>
            <span className="kpi-label">Active Facilities</span>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Checklists + Recent Activity */}
      <div className="dashboard-grid-layout">
        {/* Left: Active Checklists for the Selected Outlet */}
        <div className="dashboard-left-col">
          <div className="section-title-bar">
            <h2>Today's Report Tabs & SOPs</h2>
            <span className="sub-hint">Click any report tab to record or update today's logs</span>
          </div>

          <div className="checklists-cards-grid">
            {outletTemplates.length === 0 ? (
              <div className="empty-card">
                <p>No report tabs assigned to {currentOutlet.name}.</p>
                <Link href="/admin/templates" className="btn-secondary-link">
                  Manage Report Tabs in Admin Console
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
                    className={`checklist-card ${isDone ? "is-done" : "is-pending"}`}
                  >
                    <div className="checklist-card-top">
                      <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-semibold">
                        <FileSpreadsheet size={18} />
                      </div>
                      <span className={`status-tag ${isDone ? "done" : "pending"}`}>
                        {isDone ? (
                          <span className="flex items-center gap-1"><CheckCircle2 size={13} /> Completed</span>
                        ) : (
                          <span className="flex items-center gap-1"><Clock size={13} /> Pending</span>
                        )}
                      </span>
                    </div>

                    <h3 className="card-title">{tpl.title}</h3>
                    <p className="card-desc">
                      {tpl.description || `${tpl.frequency} inspection checklist`}
                    </p>

                    <div className="card-footer-meta">
                      {isDone ? (
                        <span>
                          By {latestSub.submittedBy?.name || "Staff"} • {latestSub.complianceScore ?? 100}% Score
                        </span>
                      ) : (
                        <span>Due today • Tap to record</span>
                      )}
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Live Activity Stream */}
        <div className="dashboard-right-col">
          <div className="section-title-bar">
            <h2>Live Audit Stream</h2>
          </div>

          <div className="activity-stream-card">
            {recentFeed.length === 0 ? (
              <p className="no-activity-text">No recent submissions recorded yet.</p>
            ) : (
              recentFeed.map((entry) => (
                <div key={entry.id} className="stream-item">
                  <div className="stream-icon flex items-center justify-center text-slate-600">
                    <FileSpreadsheet size={16} />
                  </div>
                  <div className="stream-info">
                    <span className="stream-title">
                      {entry.template?.title} ({entry.outlet?.name})
                    </span>
                    <span className="stream-by">
                      Logged by {entry.submittedBy?.name || "Staff"} • {entry.complianceScore ?? 100}% Score
                    </span>
                  </div>
                  <span className="stream-date">{entry.date}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
