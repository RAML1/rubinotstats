import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';
import { requireAdmin } from '@/lib/auth-helpers';

const VALID_STATUSES = ['open', 'planned', 'completed', 'declined'];

// PATCH: Admin-only status update
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { status } = body;

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const updated = await prisma.featureRequest.update({
      where: { id: requestId },
      data: { status },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Feature request PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Admin-only hard delete of a feature request (votes cascade-delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminSession = await requireAdmin();
    if (!adminSession) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
    }

    const { id } = await params;
    const requestId = parseInt(id);
    if (isNaN(requestId)) {
      return NextResponse.json({ success: false, error: 'Invalid ID' }, { status: 400 });
    }

    const existing = await prisma.featureRequest.findUnique({ where: { id: requestId } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });
    }

    await prisma.featureRequest.delete({ where: { id: requestId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feature request DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
