import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

export async function GET() {
  try {
    const worldTypes = await prisma.worldType.findMany({
      orderBy: { worldName: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: worldTypes,
    });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to fetch world types' }, { status: 500 });
  }
}
