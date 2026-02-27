import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

// GET — fetch current user's premium requests
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requests = await prisma.premiumRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ success: true, data: requests });
}

// POST — create a new premium request
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { characterName, requestedTier, rcAmount, transactionDate } = body;

  if (!characterName || !requestedTier) {
    return NextResponse.json(
      { error: "Character name and tier are required" },
      { status: 400 }
    );
  }

  if (!["legacy", "subscriber"].includes(requestedTier)) {
    return NextResponse.json(
      { error: "Invalid tier. Must be 'legacy' or 'subscriber'" },
      { status: 400 }
    );
  }

  // Check for existing pending request
  const existing = await prisma.premiumRequest.findFirst({
    where: { userId: session.user.id, status: "pending" },
  });

  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending request. Please wait for it to be reviewed." },
      { status: 409 }
    );
  }

  const premiumRequest = await prisma.premiumRequest.create({
    data: {
      userId: session.user.id,
      characterName,
      requestedTier,
      rcAmount: rcAmount ? parseInt(rcAmount, 10) : null,
      transactionDate: transactionDate ? new Date(transactionDate) : null,
    },
  });

  return NextResponse.json({ success: true, data: premiumRequest });
}
