"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useOutlet } from "./OutletContext";
import OutletSelector from "./OutletSelector";
import { isPlatformOwner } from "@/lib/permissions";

interface SidebarProps {
  user: {
    id?: string;
    name?: string | null;
    email?: string | null;
    role?: string | null;
    customRoleTitle?: string | null;
    permissions?: string[];
    organizationName?: string;
  };
  sheetStatuses?: Record<string, boolean | null>;
}

import {
  LayoutDashboard,
  FileCheck2,
  Store,
  Users,
  BarChart3,
  CreditCard,
  LogOut,
  Menu,
  X,
  Crown,
  ShieldCheck,
  Building2,
  ChevronLeft,
} from "lucide-react";

export default function Sidebar({ user, sheetStatuses = {} }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeOutlet, loading } = useOutlet();

  const isFormPage = pathname !== "/dashboard" && !pathname.startsWith("/admin");

  const isMasterAdmin =
    user?.role === "ORG_ADMIN" ||
    user?.role === "SUPER_ADMIN" ||
    user?.role === "ADMIN";

  const userPerms = Array.isArray(user?.permissions) ? user.permissions : [];

  const canManageTemplates = isMasterAdmin || userPerms.includes("manage_templates");
  const canManageOutlets = isMasterAdmin || userPerms.includes("manage_outlets");
  const canManageTeam = isMasterAdmin || userPerms.includes("manage_team") || userPerms.includes("manage_roles");
  const canViewReports = isMasterAdmin || userPerms.includes("view_reports") || userPerms.includes("export_audit_pack");

  const hasAnyManagementAccess =
    canManageTemplates || canManageOutlets || canManageTeam || canViewReports;

  const userName = user?.name || user?.email || "User";
  const userRoleDisplay = user?.customRoleTitle || user?.role || "STAFF";

  const initials =
    userName
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "U";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const templates = activeOutlet?.templates || [];

  return (
    <>
      {/* ─── Mobile Top App Bar (Apple HIG Touch Optimized) ────────────────── */}
      <header className="mobile-topbar">
        {isFormPage ? (
          <div className="flex items-center justify-between w-full">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-xs font-bold text-blue-600 py-1.5 pr-2">
              <ChevronLeft size={18} />
              <span>Dashboard</span>
            </Link>
            <span className="text-xs font-bold text-slate-700 truncate max-w-[160px]">
              {activeOutlet?.name || "Checklist"}
            </span>
          </div>
        ) : (
          <>
            <button
              className="mobile-hamburger-btn"
              onClick={() => setMobileOpen((o) => !o)}
              aria-label="Toggle Navigation Menu"
              aria-expanded={mobileOpen}
            >
              <span className="hamburger-icon">{mobileOpen ? <X size={20} /> : <Menu size={20} />}</span>
            </button>

            <Link href="/dashboard" className="mobile-brand" onClick={() => setMobileOpen(false)}>
              <span className="brand-icon flex items-center justify-center text-blue-600">
                <ShieldCheck size={20} />
              </span>
              <span className="brand-text">OVYRO</span>
            </Link>

            <div className="mobile-status-pill">
              <span className="pill-dot" />
              <span className="truncate max-w-[130px]">
                {activeOutlet?.name || "Facility"}
              </span>
            </div>
          </>
        )}
      </header>

      {/* ─── Backdrop overlay for mobile drawer ────────────────────────────── */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ─── Main Sidebar / Slide-Over Drawer ──────────────────────────────── */}
      <nav className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-header">
            <h1 className="flex items-center gap-2">
              <ShieldCheck className="text-blue-600" size={24} /> OVYRO
            </h1>
            <button
              className="sidebar-close-btn mobile-only"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              <X size={20} />
            </button>
          </div>
          <p>{user?.organizationName || "Audit & Compliance Management"}</p>

          {/* Dynamic Outlet Switcher */}
          <OutletSelector />
        </div>

        <div className="sidebar-nav">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`nav-item ${pathname === "/dashboard" ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <span className="nav-icon"><LayoutDashboard size={18} /></span>
            <span className="nav-label">Dashboard</span>
          </Link>

          {/* Active Outlet Checklists / Sheets */}
          <div className="nav-section-title">
            <span>Checklists</span>
          </div>

          {loading ? (
            <div className="sidebar-loading-item">Loading...</div>
          ) : templates.length === 0 ? (
            <div className="sidebar-empty-hint">No checklists assigned</div>
          ) : (
            templates.map((tpl) => {
              const route = `/${activeOutlet?.id}/${tpl.slug}`;
              const isActive = pathname === route || pathname.endsWith(`/${tpl.slug}`);
              return (
                <Link
                  key={tpl.id}
                  href={route}
                  onClick={() => setMobileOpen(false)}
                  className={`nav-item ${isActive ? "active" : ""}`}
                >
                  <span className="nav-icon"><FileCheck2 size={18} /></span>
                  <span className="nav-label">{tpl.title}</span>
                </Link>
              );
            })
          )}

          {/* Management Console (Dynamic RBAC Guarded) */}
          {hasAnyManagementAccess && (
            <>
              <div className="nav-section-title admin-section">
                <span>Manage</span>
              </div>

              {canManageTemplates && (
                <Link
                  href="/admin/templates"
                  className={`nav-item ${pathname.startsWith("/admin/templates") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-icon"><FileCheck2 size={18} /></span>
                  <span className="nav-label">Form Templates</span>
                </Link>
              )}

              {canManageOutlets && (
                <Link
                  href="/admin/outlets"
                  className={`nav-item ${pathname.startsWith("/admin/outlets") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-icon"><Store size={18} /></span>
                  <span className="nav-label">Outlets</span>
                </Link>
              )}

              {canManageTeam && (
                <Link
                  href="/admin/users"
                  className={`nav-item ${pathname.startsWith("/admin/users") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-icon"><Users size={18} /></span>
                  <span className="nav-label">Team & Roles</span>
                </Link>
              )}

              {canViewReports && (
                <Link
                  href="/admin/reports"
                  className={`nav-item ${pathname.startsWith("/admin/reports") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-icon"><BarChart3 size={18} /></span>
                  <span className="nav-label">Reports & Exports</span>
                </Link>
              )}

              {isMasterAdmin && (
                <Link
                  href="/admin/billing"
                  className={`nav-item ${pathname.startsWith("/admin/billing") ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="nav-icon"><CreditCard size={18} /></span>
                  <span className="nav-label">Billing</span>
                </Link>
              )}
            </>
          )}

          {/* SaaS Commercial Center (Platform Owner Only) */}
          {isPlatformOwner(user) && (
            <>
              <div className="nav-section-title admin-section">
                <span>Platform</span>
              </div>
              <Link
                href="/admin/platform"
                className={`nav-item ${pathname.startsWith("/admin/platform") ? "active" : ""}`}
                onClick={() => setMobileOpen(false)}
              >
                <span className="nav-icon"><Crown size={18} /></span>
                <span className="nav-label">Clients & Billing</span>
              </Link>
            </>
          )}
        </div>

        {/* User Info & Log out */}
        <div className="sidebar-footer">
          <div className="user-profile-widget">
            <div className="user-avatar-circle">{initials}</div>
            <div className="user-meta">
              <span className="user-name">{userName}</span>
              <span className="user-role-badge" title={userRoleDisplay}>{userRoleDisplay}</span>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="sidebar-logout-btn"
            title="Sign out"
            aria-label="Sign out"
          >
            <span className="logout-icon"><LogOut size={16} /></span>
            <span>Sign Out</span>
          </button>
        </div>
      </nav>

      {/* ─── Mobile Bottom Tab Bar (Apple HIG 1-Thumb Ergonomics) ─────────── */}
      {!isFormPage && (
        <div className="mobile-bottom-nav">
          <Link
            href="/dashboard"
            className={`mobile-tab-item ${pathname === "/dashboard" ? "active" : ""}`}
            onClick={() => setMobileOpen(false)}
          >
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>

          {canManageTemplates && (
            <Link
              href="/admin/templates"
              className={`mobile-tab-item ${pathname.startsWith("/admin/templates") ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <FileCheck2 size={20} />
              <span>Templates</span>
            </Link>
          )}

          {canManageOutlets && (
            <Link
              href="/admin/outlets"
              className={`mobile-tab-item ${pathname.startsWith("/admin/outlets") ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Store size={20} />
              <span>Facilities</span>
            </Link>
          )}

          {canManageTeam && (
            <Link
              href="/admin/users"
              className={`mobile-tab-item ${pathname.startsWith("/admin/users") ? "active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <Users size={20} />
              <span>Roles</span>
            </Link>
          )}

          <button
            type="button"
            className={`mobile-tab-item ${mobileOpen ? "active" : ""}`}
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Open menu drawer"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </div>
      )}
    </>
  );
}
