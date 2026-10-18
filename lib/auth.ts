import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

if (!process.env.AUTH_SECRET) {
  process.env.AUTH_SECRET =
    process.env.NEXTAUTH_SECRET ||
    "saas_reporting_secure_jwt_secret_2026_super_session_key_7781";
}

if (process.env.NEXTAUTH_URL && !process.env.NEXTAUTH_URL.startsWith("http://") && !process.env.NEXTAUTH_URL.startsWith("https://")) {
  process.env.NEXTAUTH_URL = `https://${process.env.NEXTAUTH_URL}`;
}

if (process.env.AUTH_URL && !process.env.AUTH_URL.startsWith("http://") && !process.env.AUTH_URL.startsWith("https://")) {
  process.env.AUTH_URL = `https://${process.env.AUTH_URL}`;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password).trim();

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email },
            include: {
              organization: {
                select: { id: true, name: true, slug: true, plan: true },
              },
              customRole: {
                select: { id: true, name: true, permissions: true },
              },
              userOutlets: {
                select: { outletId: true, role: true },
              },
              templateAccess: {
                select: { templateId: true, canSubmit: true, canVerify: true },
              },
            },
          });
        } catch (dbError: any) {
          console.error("[AUTH_DATABASE_ERROR]:", dbError.message || dbError);
          throw new Error("DATABASE_UNREACHABLE");
        }

        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        let permissionsList: string[] = [];
        try {
          permissionsList = JSON.parse(user.permissions || "[]");
        } catch {
          permissionsList = [];
        }

        // Merge custom role permissions if assigned
        if (user.customRole?.permissions) {
          try {
            const rolePerms = JSON.parse(user.customRole.permissions);
            permissionsList = Array.from(new Set([...permissionsList, ...rolePerms]));
          } catch {}
        }

        return {
          id: user.id,
          name: user.name || user.email.split("@")[0],
          email: user.email,
          role: user.role,
          customRoleTitle: user.customRole?.name || user.role,
          permissions: permissionsList,
          organizationId: user.organizationId,
          organizationName: user.organization?.name || "Organization",
          organizationSlug: user.organization?.slug || "",
          plan: user.organization?.plan || "STARTER",
          outletIds: user.userOutlets.map((uo) => uo.outletId),
          templateAccess: user.templateAccess,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name || (user.email ? user.email.split("@")[0] : "User");
        token.role = (user as any).role || "OPERATOR";
        token.customRoleTitle = (user as any).customRoleTitle || "Staff";
        token.permissions = (user as any).permissions || [];
        token.organizationId = (user as any).organizationId;
        token.organizationName = (user as any).organizationName;
        token.organizationSlug = (user as any).organizationSlug;
        token.plan = (user as any).plan;
        token.outletIds = (user as any).outletIds || [];
        token.templateAccess = (user as any).templateAccess || [];
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id as string;
        (session.user as any).role = (token.role as string) || "OPERATOR";
        (session.user as any).customRoleTitle = token.customRoleTitle as string;
        (session.user as any).permissions = (token.permissions as string[]) || [];
        (session.user as any).organizationId = token.organizationId as string;
        (session.user as any).organizationName = token.organizationName as string;
        (session.user as any).organizationSlug = token.organizationSlug as string;
        (session.user as any).plan = token.plan as string;
        (session.user as any).outletIds = token.outletIds as string[];
        (session.user as any).templateAccess = token.templateAccess || [];
        session.user.name = (token.name as string) || session.user.name || "User";
      }
      return session;
    },
  },
});
