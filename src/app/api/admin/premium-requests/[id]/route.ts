import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db/prisma";

// PATCH — approve or reject a premium request
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, adminNote } = body;

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Status must be 'approved' or 'rejected'" },
      { status: 400 }
    );
  }

  const premiumRequest = await prisma.premiumRequest.findUnique({
    where: { id: parseInt(id, 10) },
  });

  if (!premiumRequest) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  // Update the request
  const updated = await prisma.premiumRequest.update({
    where: { id: parseInt(id, 10) },
    data: {
      status,
      adminNote: adminNote || null,
      reviewedAt: new Date(),
    },
  });

  // If approved, upgrade the user
  if (status === "approved") {
    const updateData: Record<string, unknown> = {
      premiumTier: premiumRequest.requestedTier,
      premiumSince: new Date(),
    };

    // Subscriber gets 30 days, legacy gets null (lifetime)
    if (premiumRequest.requestedTier === "subscriber") {
      const until = new Date();
      until.setDate(until.getDate() + 30);
      updateData.premiumUntil = until;
    } else {
      updateData.premiumUntil = null;
    }

    await prisma.user.update({
      where: { id: premiumRequest.userId },
      data: updateData,
    });
  }

  return NextResponse.json({ success: true, data: updated });
}
