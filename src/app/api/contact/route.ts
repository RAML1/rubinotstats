import { NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

const VALID_CONTACT_TYPES = ['discord', 'telegram'];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, contactType, contactValue, message } = body;

    if (!contactType || !VALID_CONTACT_TYPES.includes(contactType)) {
      return NextResponse.json(
        { success: false, error: 'Contact type must be discord or telegram' },
        { status: 400 }
      );
    }

    if (!contactValue || typeof contactValue !== 'string' || contactValue.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Contact handle is required' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim().length < 5) {
      return NextResponse.json(
        { success: false, error: 'Message must be at least 5 characters' },
        { status: 400 }
      );
    }

    await prisma.contactMessage.create({
      data: {
        name: name?.trim()?.substring(0, 100) || null,
        contactType,
        contactValue: contactValue.trim().substring(0, 255),
        message: message.trim(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Contact API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to submit message' },
      { status: 500 }
    );
  }
}
