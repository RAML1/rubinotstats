import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-helpers';
import { isPremium } from '@/lib/utils/premium';
import prisma from '@/lib/db/prisma';
import { estimateCharacterValue, type CharacterStats } from '@/lib/utils/character-valuation';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPremium({ premiumTier: session.user.premiumTier, premiumUntil: session.user.premiumUntil })) {
    return NextResponse.json({ error: 'Premium required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const characterName = searchParams.get('characterName');

  if (!characterName) {
    return NextResponse.json({ error: 'characterName is required' }, { status: 400 });
  }

  try {
    // Look up character in our database
    const character = await prisma.character.findFirst({
      where: { name: { equals: characterName, mode: 'insensitive' } },
      include: {
        world: true,
        characterSnapshots: {
          orderBy: { capturedDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!character || character.characterSnapshots.length === 0) {
      return NextResponse.json({ error: 'Character not found or no data available' }, { status: 404 });
    }

    const snapshot = character.characterSnapshots[0];

    // Look up charm points from highscore entries
    const charmEntry = await prisma.highscoreEntry.findFirst({
      where: {
        characterName: { equals: characterName, mode: 'insensitive' },
        category: 'Charm Points',
      },
      orderBy: { capturedDate: 'desc' },
    });

    const stats: CharacterStats = {
      level: snapshot.level ?? 1,
      vocation: character.vocation || 'None',
      magicLevel: snapshot.magicLevel,
      skills: {
        fist: snapshot.fist,
        club: snapshot.club,
        sword: snapshot.sword,
        axe: snapshot.axe,
        distance: snapshot.distance,
        shielding: snapshot.shielding,
        fishing: snapshot.fishing,
      },
      charmPoints: charmEntry ? Number(charmEntry.score) : null,
    };

    const valuation = await estimateCharacterValue(stats);

    if (!valuation) {
      return NextResponse.json({
        success: true,
        data: null,
        message: 'Not enough comparable auction data to estimate value',
      });
    }

    return NextResponse.json({ success: true, data: valuation });
  } catch (error) {
    console.error('Valuation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
