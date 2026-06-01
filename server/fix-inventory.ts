import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const char = await prisma.character.findFirst({ where: { name: 'PussyDestroyer55' } });
  if (!char) { console.log('Not found'); return; }

  await prisma.character.update({
    where: { id: char.id },
    data: {
      inventory: [
        'Gutting knife',
        'Flare gun',
        'Hand-drawn map to the submerged ruins',
        'Waterproof satchel',
        'Lantern with oil',
        'Rope 30ft',
        'Dried rations x3',
        'Dry traveling clothes',
        'Healing salve',
        'Underwater breathing vial',
      ],
    },
  });
  console.log('Inventory fixed');
}

main().finally(() => prisma.$disconnect());
