import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { nextUrl, auth: session } = req as any;
  const isLoggedIn = !!session;
  const isPublicAuthPage = nextUrl.pathname === "/login" || nextUrl.pathname === "/onboard" || nextUrl.pathname === "/register";
  const isApiRoute = nextUrl.pathname.startsWith("/api");

  if (isApiRoute) return NextResponse.next();

  if (!isLoggedIn && !isPublicAuthPage) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }
  if (isLoggedIn && nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  // Dynamic Granular RBAC Route Protection
  const pathname = nextUrl.pathname;
  if (pathname.startsWith("/admin")) {
    const role = session?.user?.role;
    const permissions: string[] = Array.isArray(session?.user?.permissions)
      ? session.user.permissions
      : [];

    const isMasterAdmin =
      role === "ORG_ADMIN" || role === "SUPER_ADMIN" || role === "ADMIN";

    if (pathname.startsWith("/admin/platform")) {
      const isOwner =
        role === "SUPER_ADMIN" ||
        role === "PLATFORM_OWNER" ||
        session?.user?.email === "admin@reporting.app" ||
        (process.env.PLATFORM_OWNER_EMAIL && session?.user?.email === process.env.PLATFORM_OWNER_EMAIL);
      if (!isOwner) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
    }

    if (!isMasterAdmin) {
      if (pathname.startsWith("/admin/templates") && !permissions.includes("manage_templates")) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      if (pathname.startsWith("/admin/outlets") && !permissions.includes("manage_outlets")) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      if (
        pathname.startsWith("/admin/users") &&
        !permissions.includes("manage_team") &&
        !permissions.includes("manage_roles")
      ) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
      if (
        pathname.startsWith("/admin/reports") &&
        !permissions.includes("view_reports") &&
        !permissions.includes("export_audit_pack")
      ) {
        return NextResponse.redirect(new URL("/dashboard", nextUrl));
      }
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
