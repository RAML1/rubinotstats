import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-helpers";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await Promise.all([
      prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW CONCURRENTLY world_leaders_mv"),
      prisma.$executeRawUnsafe("REFRESH MATERIALIZED VIEW CONCURRENTLY top_exp_gainers_mv"),
    ]);
    return NextResponse.json({ success: true, message: "Materialized views refreshed" });
  } catch (error) {
    console.error("Failed to refresh materialized views:", error);
    return NextResponse.json(
      { success: false, error: "Failed to refresh views" },
      { status: 500 }
    );
  }
}
