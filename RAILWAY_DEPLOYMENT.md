# Railway Deployment Guide — Reporting SaaS

This guide explains how to deploy **Reporting Software** as a production-grade multi-tenant SaaS application on [Railway](https://railway.app) with PostgreSQL.

---

## 1. Create a New Project on Railway

1. Go to your [Railway Dashboard](https://railway.app/dashboard).
2. Click **New Project** $\rightarrow$ **Provision PostgreSQL** (or connect your existing external Supabase database).
3. If using Railway PostgreSQL, Railway automatically provides the `DATABASE_URL` connection variable.

---

## 2. Deploy from GitHub

1. In Railway, click **+ New** $\rightarrow$ **GitHub Repo**.
2. Select your repository (`Ovyro-reporting`).
3. Railway will automatically detect Next.js and apply the configuration in [railway.json](file:///Users/hrushi/Downloads/Desktop%20offline/vibe%20coding/Reporting%20software%20/hygiene-app/railway.json).

---

## 3. Configure Environment Variables in Railway

In your web service settings under **Variables**, set:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (or Supabase pooled connection string) | Primary database connection |
| `DIRECT_URL` | Optional: `${{Postgres.DATABASE_URL}}` (or Supabase direct 5432 string) | Direct connection for schema migrations |
| `AUTH_SECRET` | Generate a 32+ character random secret string | e.g. `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://${{RAILWAY_PUBLIC_DOMAIN}}` | Your Railway public application domain |
| `NODE_ENV` | `production` | Enables production optimizations |

---

## 4. Production Build & Startup Workflow

The project includes an optimized [railway.json](file:///Users/hrushi/Downloads/Desktop%20offline/vibe%20coding/Reporting%20software%20/hygiene-app/railway.json) configuration:
1. **Build Step (`npx prisma generate && npm run build`)**: Generates Prisma client types and compiles the production Next.js application.
2. **Deploy Step (`npx prisma db push && npm run db:seed && npm start`)**:
   - `prisma db push` synchronizes all schema models with PostgreSQL.
   - `db:seed` contains an automated safety guard: it only seeds starter templates and default admin account if the database is brand new. On subsequent restarts or redeploys, it protects and preserves all client data.
   - `npm start` binds to `0.0.0.0` and listens on Railway's dynamic `$PORT`.

---

## 5. Logging In

For production security, demo autofill buttons have been removed from the public sign-in page.

- **Initial Admin Account (First Deployment)**:
  - **Email**: `admin@reporting.app`
  - **Password**: `Admin@123`
  - *(Recommended: Change email & password from the Admin panel after first login).*
- **Self-Service Registration**:
  - Any new customer/restaurant operator can click **✨ Create Account** directly on `/login` to register a workspace with automated facility provisioning.
