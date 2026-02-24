import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const featuredId = parseInt(id, 10);
  if (isNaN(featuredId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const featured = await prisma.featuredAuction.findUnique({
    where: { id: featuredId },
  });

  if (!featured) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only the owner or an admin can remove
  if (featured.userId !== session.user.id && !session.user.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.featuredAuction.update({
    where: { id: featuredId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
