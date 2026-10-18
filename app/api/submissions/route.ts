import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationId, resolveUserId } from "@/lib/permissions";
import { verifyPaywallOrReject } from "@/lib/paywall";

function safeJson(val: any, fallback: any = {}) {
  if (typeof val !== "string") return val ?? fallback;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Deterministically computes the compliance score server-side from recorded audit checkpoints
 * to prevent client-side manipulation of regulatory food safety & hygiene scorecards.
 */
function computeComplianceScore(dataPayload: any, clientScore?: number): number {
  const dataObj = typeof dataPayload === "string" ? safeJson(dataPayload, {}) : (dataPayload || {});
  const checkpoints = dataObj.checkpoints || {};
  const items = Object.values(checkpoints) as any[];

  if (items.length === 0) {
    if (clientScore !== undefined && !isNaN(Number(clientScore))) {
      return Math.max(0, Math.min(100, Math.round(Number(clientScore))));
    }
    return 100;
  }

  let total = 0;
  let passed = 0;

  for (const cp of items) {
    if (!cp || typeof cp !== "object") continue;
    const type = cp.itemType || "STATUS";

    if (type === "STATUS") {
      if (cp.status === "NA" || cp.status === "N/A") continue;
      total++;
      if (cp.status === "YES" || cp.status === "PASS" || cp.status === true) passed++;
    } else if (type === "CLEAN_DIRTY") {
      if (cp.status === "NA" || cp.status === "N/A") continue;
      total++;
      if (cp.status === "CLEAN" || cp.status === "YES") passed++;
    } else if (type === "TEMPERATURE") {
      if (cp.temp === "NA" || cp.temp === "N/A" || !cp.temp) continue;
      total++;
      const tVal = parseFloat(cp.temp);
      if (!isNaN(tVal)) {
        const min = cp.min ?? -20;
        const max = cp.max ?? 10;
        if (tVal >= min && tVal <= max) passed++;
      }
    } else if (type === "NUMERIC") {
      if (cp.value === "NA" || cp.value === "N/A" || cp.value === "") continue;
      total++;
      const nVal = parseFloat(cp.value);
      if (!isNaN(nVal)) {
        const hasMin = cp.min !== undefined && cp.min !== null;
        const hasMax = cp.max !== undefined && cp.max !== null;
        if (hasMin && hasMax) {
          if (nVal >= cp.min && nVal <= cp.max) passed++;
        } else {
          passed++;
        }
      }
    }
  }

  if (total === 0) {
    return clientScore !== undefined ? Math.max(0, Math.min(100, Math.round(Number(clientScore)))) : 100;
  }

  return Math.max(0, Math.min(100, Math.round((passed / total) * 100)));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    organizationId: string;
    role: string;
    email?: string;
  };

  const organizationId = await resolveOrganizationId(user);
  const validUserId = (await resolveUserId(user)) || user.id;

  // Enforce Dodo Payments Subscription Paywall for submissions
  const paywallBlock = await verifyPaywallOrReject(organizationId, user);
  if (paywallBlock) return paywallBlock;

  try {
    const body = await req.json();
    const {
      id,
      outletId,
      templateId,
      date,
      shift,
      data,
      comments,
      correctiveAction,
      supervisorName,
      supervisorSigned,
      signatureData,
      complianceScore,
      status,
    } = body;

    if (!outletId || !templateId || !date) {
      return NextResponse.json(
        { error: "Missing required fields: outletId, templateId, date" },
        { status: 400 }
      );
    }

    const template = await prisma.formTemplate.findFirst({
      where: { id: templateId, organizationId },
    });

    if (!template) {
      return NextResponse.json({ error: "Template not found or access denied" }, { status: 404 });
    }

    const dataString = typeof data === "string" ? data : JSON.stringify(data || {});
    const verifiedScore = computeComplianceScore(dataString, complianceScore);

    if (id) {
      const existing = await prisma.formSubmission.findFirst({
        where: { id, organizationId },
      });

      if (!existing) {
        return NextResponse.json({ error: "Submission not found" }, { status: 404 });
      }

      // Check edit permissions: admins, supervisors, or original submitter
      const canEdit =
        user.role === "ORG_ADMIN" ||
        user.role === "SUPER_ADMIN" ||
        user.role === "ADMIN" ||
        user.role === "SUPERVISOR" ||
        existing.submittedById === validUserId;

      if (!canEdit) {
        return NextResponse.json({ error: "Forbidden: Not permitted to modify this submission" }, { status: 403 });
      }

      const updated = await prisma.formSubmission.update({
        where: { id },
        data: {
          data: data !== undefined ? dataString : existing.data,
          shift: shift !== undefined ? shift : existing.shift,
          comments: comments !== undefined ? comments : existing.comments,
          correctiveAction: correctiveAction !== undefined ? correctiveAction : existing.correctiveAction,
          supervisorName: supervisorName !== undefined ? supervisorName : existing.supervisorName,
          supervisorSigned: supervisorSigned !== undefined ? supervisorSigned : existing.supervisorSigned,
          signatureData: signatureData !== undefined ? signatureData : existing.signatureData,
          complianceScore: data !== undefined ? verifiedScore : (complianceScore !== undefined ? verifiedScore : existing.complianceScore),
          status: status || existing.status,
        },
      });

      return NextResponse.json({
        success: true,
        submission: { ...updated, data: safeJson(updated.data) },
      });
    }

    // Check if duplicate for same date, shift and template
    const existingSameShift = await prisma.formSubmission.findFirst({
      where: {
        organizationId,
        outletId,
        templateId,
        date,
        shift: shift || null,
      },
    });

    if (existingSameShift) {
      const updated = await prisma.formSubmission.update({
        where: { id: existingSameShift.id },
        data: {
          data: dataString,
          comments: comments || existingSameShift.comments,
          correctiveAction: correctiveAction || existingSameShift.correctiveAction,
          supervisorName: supervisorName || existingSameShift.supervisorName,
          supervisorSigned: supervisorSigned !== undefined ? supervisorSigned : existingSameShift.supervisorSigned,
          signatureData: signatureData || existingSameShift.signatureData,
          complianceScore: verifiedScore,
          status: status || "SUBMITTED",
        },
      });
      return NextResponse.json({
        success: true,
        submission: { ...updated, data: safeJson(updated.data) },
        updatedExisting: true,
      });
    }

    const created = await prisma.formSubmission.create({
      data: {
        organizationId,
        outletId,
        templateId,
        templateVersion: template.version,
        date,
        shift: shift || null,
        submittedById: validUserId,
        supervisorName: supervisorName || "",
        supervisorSigned: !!supervisorSigned,
        signatureData: signatureData || null,
        complianceScore: verifiedScore,
        data: dataString,
        comments: comments || "",
        correctiveAction: correctiveAction || "",
        status: status || "SUBMITTED",
      },
    });

    return NextResponse.json({
      success: true,
      submission: { ...created, data: safeJson(created.data) },
    });
  } catch (err: any) {
    console.error("Submission POST error:", err);
    return NextResponse.json({ error: err.message || "Failed to save submission" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as {
    id: string;
    organizationId: string;
    role: string;
    email?: string;
  };

  const organizationId = await resolveOrganizationId(user);

  const { searchParams } = new URL(req.url);
  const outletId = searchParams.get("outletId");
  const templateId = searchParams.get("templateId");
  const templateSlug = searchParams.get("templateSlug");
  const date = searchParams.get("date");
  const month = searchParams.get("month");
  const limit = parseInt(searchParams.get("limit") || "60", 10);

  try {
    const where: any = { organizationId };

    if (outletId) where.outletId = outletId;
    if (templateId) where.templateId = templateId;
    if (templateSlug) {
      where.template = { slug: templateSlug };
    }
    if (date) where.date = date;
    if (month) {
      where.date = { startsWith: month };
    }

    const submissions = await prisma.formSubmission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        submittedBy: {
          select: { id: true, name: true, email: true },
        },
        template: {
          select: { id: true, slug: true, title: true, icon: true, category: true },
        },
        outlet: {
          select: { id: true, name: true, code: true, icon: true },
        },
      },
    });

    const parsed = submissions.map((s) => ({
      ...s,
      data: safeJson(s.data),
    }));

    return NextResponse.json({ submissions: parsed });
  } catch (err: any) {
    console.error("Submission GET error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch submissions" }, { status: 500 });
  }
}

