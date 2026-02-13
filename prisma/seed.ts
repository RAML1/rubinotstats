import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // 1. Seed the 11 RubinOT worlds
  const worlds = [
    { name: 'Elysian', pvpType: 'Optional PvP', isActive: true },
    { name: 'Lunarian', pvpType: 'Optional PvP', isActive: true },
    { name: 'Mystian', pvpType: 'Optional PvP', isActive: true },
    { name: 'Serenian', pvpType: 'Optional PvP', isActive: true },
    { name: 'Serenian II', pvpType: 'Optional PvP', isActive: true },
    { name: 'Serenian III', pvpType: 'Optional PvP', isActive: true },
    { name: 'Serenian IV', pvpType: 'Optional PvP', isActive: true },
    { name: 'Solarian', pvpType: 'Optional PvP', isActive: true },
    { name: 'Spectrum', pvpType: 'Optional PvP', isActive: true },
    { name: 'Tenebrium', pvpType: 'Hardcore PvP', isActive: true },
    { name: 'Vesperia', pvpType: 'Optional PvP', isActive: true },
  ];

  for (const world of worlds) {
    await prisma.world.upsert({
      where: { name: world.name },
      update: {},
      create: world,
    });
  }
  console.log(`Seeded ${worlds.length} worlds`);

  // 2. Seed auctions from JSON
  const auctionsPath = path.join(__dirname, '..', 'seeds', 'auctions.json');
  if (fs.existsSync(auctionsPath)) {
    const auctionsData = JSON.parse(fs.readFileSync(auctionsPath, 'utf-8'));
    const auctions = auctionsData.auctions || [];
    let auctionCount = 0;

    for (const a of auctions) {
      await prisma.auction.upsert({
        where: { externalId: a.externalId },
        update: {},
        create: {
          externalId: a.externalId,
          characterName: a.characterName,
          level: a.level,
          vocation: a.vocation,
          gender: a.gender,
          world: a.world,
          auctionStart: a.auctionStart,
          auctionEnd: a.auctionEnd,
          soldPrice: a.soldPrice,
          coinsPerLevel: a.coinsPerLevel,
          magicLevel: a.magicLevel,
          fist: a.fist,
          club: a.club,
          sword: a.sword,
          axe: a.axe,
          distance: a.distance,
          shielding: a.shielding,
          fishing: a.fishing,
          hitPoints: a.hitPoints,
          mana: a.mana,
          capacity: a.capacity,
          speed: a.speed,
          experience: a.experience,
          creationDate: a.creationDate,
          achievementPoints: a.achievementPoints,
          mountsCount: a.mountsCount,
          outfitsCount: a.outfitsCount,
          titlesCount: a.titlesCount,
          linkedTasks: a.linkedTasks,
          dailyRewardStreak: a.dailyRewardStreak,
          charmExpansion: a.charmExpansion,
          charmPoints: a.charmPoints,
          unusedCharmPoints: a.unusedCharmPoints,
          spentCharmPoints: a.spentCharmPoints,
          preySlots: a.preySlots,
          preyWildcards: a.preyWildcards,
          huntingTaskPoints: a.huntingTaskPoints,
          hirelings: a.hirelings,
          hirelingJobs: a.hirelingJobs,
          storeItemsCount: a.storeItemsCount,
          bossPoints: a.bossPoints,
          blessingsCount: a.blessingsCount,
          exaltedDust: a.exaltedDust,
          gold: a.gold,
          bestiary: a.bestiary,
          url: a.url,
        },
      });
      auctionCount++;
    }
    console.log(`Seeded ${auctionCount} auctions`);
  } else {
    console.log('No auctions seed file found, skipping');
  }

  // 3. Seed highscores from JSON
  const highscoresPath = path.join(__dirname, '..', 'seeds', 'highscores.json');
  if (fs.existsSync(highscoresPath)) {
    const highscoresData = JSON.parse(fs.readFileSync(highscoresPath, 'utf-8'));
    const entries = highscoresData.entries || [];
    let hsCount = 0;

    for (const h of entries) {
      const capturedDate = new Date(h.capturedDate);
      // Normalize to date-only for the @db.Date field
      capturedDate.setUTCHours(0, 0, 0, 0);

      await prisma.highscoreEntry.upsert({
        where: {
          characterName_world_category_capturedDate: {
            characterName: h.characterName,
            world: h.world,
            category: h.category,
            capturedDate,
          },
        },
        update: {},
        create: {
          characterName: h.characterName,
          world: h.world,
          vocation: h.vocation,
          level: h.level,
          category: h.category,
          rank: h.rank,
          score: BigInt(h.score),
          capturedDate,
        },
      });
      hsCount++;
    }
    console.log(`Seeded ${hsCount} highscore entries`);
  } else {
    console.log('No highscores seed file found, skipping');
  }

  console.log('Database seed completed!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Error during seeding:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
