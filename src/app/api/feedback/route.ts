import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const VALID_TYPES = ['bug', 'feature', 'general'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, message, page, email } = body;

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        { success: false, error: 'Type must be one of: bug, feature, general' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Message must be at least 5 characters' },
        { status: 400 }
      );
    }

    await prisma.feedback.create({
      data: {
        type,
        message: message.trim(),
        page: page || null,
        email: email?.trim() || null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit feedback' },
      { status: 500 }
    );
  }
}
