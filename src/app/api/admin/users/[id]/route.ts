import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db/prisma";

// PATCH — update user premium tier directly
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
  const { premiumTier, premiumUntil } = body;

  if (!["free", "legacy", "subscriber"].includes(premiumTier)) {
    return NextResponse.json(
      { error: "Invalid tier" },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = { premiumTier };

  if (premiumTier === "free") {
    updateData.premiumSince = null;
    updateData.premiumUntil = null;
  } else if (premiumTier === "legacy") {
    updateData.premiumSince = new Date();
    updateData.premiumUntil = null;
  } else if (premiumTier === "subscriber") {
    updateData.premiumSince = new Date();
    updateData.premiumUntil = premiumUntil
      ? new Date(premiumUntil)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ success: true, data: user });
}
