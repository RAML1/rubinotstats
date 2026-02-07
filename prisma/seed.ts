import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Seed the 11 RubinOT worlds
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
      create: {
        name: world.name,
        pvpType: world.pvpType,
        isActive: world.isActive,
      },
    });
    console.log(`Seeded world: ${world.name}`);
  }

  console.log('Database seed completed successfully!');
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
