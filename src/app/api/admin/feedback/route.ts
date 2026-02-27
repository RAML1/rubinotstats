import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/auth-helpers";

export async function GET() {
  try {
    const session = await requireAdmin();
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: feedback });
  } catch (error) {
    console.error("Admin feedback GET error:", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
