import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const factions = await Promise.all([
        prisma.faction.upsert({
            where: { name: 'The Iron Covenant' },
            update: {},
            create:{ name: 'The Iron Covenant', description: 'A militant order seeking order through force', color: '#c0392b', globalPower: 100 },
        }),
        prisma.faction.upsert({
            where: { name: 'The Verdant Circle' },
            update: {},
            create: { name: 'The Verdant Circle', description: 'Druids and naturalists guarding ancient sites', color: '#27ae60', globalPower: 80 },
        }),
        prisma.faction.upsert({
            where: { name: 'The Ashen Syndicate' },
            update: {},
            create: { name: 'The Ashen Syndicate', description: 'Shadow merchants conrtolling information and trade', color: '#8e44ad', globalPower: 90 },
        }),
    ]);

    const zones = [
        { name: 'The Ashen Wastes', lore: 'A scorched plain where ancient wars left the earth forever scarred. Ruins of a forgotten empire jut from the ash.', threatLevel: 4, factionControlId: factions[0].id },
        { name: 'Port Vel\'Thar', lore: 'A bustling harbor city at the crossroads of three trade routes. Corruption runs as deep as its docks.', threatLevel: 2, factionControlId: factions[2].id },
        { name: 'The Verdant Cradle', lore: 'Ancient forest where the oldest trees whisper memories of the world\'s first age.', threatLevel: 1, factionControlId: factions[1].id },
        { name: 'The Sunken Archives', lore: 'A partially flooded library complex build by a civilization predating written history.', threatLevel: 3, factionControlId: null },
        { name: 'Ironhold Citadel', lore: 'A fortress city carved into a mountain. The Iron Covenant\'s seat of power.', threatLevel: 3, factionControlId: factions[0].id },
        { name: 'The Whispering Mire', lore: 'Fog-covered wetlands haunted by spirits of those who died without resolution.', threatLevel: 3, factionControlId: null },
        { name: 'Vel\'Nara Crossing', lore: 'A bridge town spanning a massive canyon, neutral ground for all factions.', threatLevel: 2, factionControlId: null },
        { name: 'The Ember Peaks', lore: 'Active volcanic mountains home to fire elementals and dwarven forge-clans.', threatLevel: 5, factionControlId: null },
        { name: 'The Silver Reaches', lore: 'Frozen tundra under permanent aurora. Ancient colossi sleep beneath the ice.', threatLevel: 4, factionControlId: null },
        { name: 'Deepwater Hollow', lore: 'An underground ocean beneath the continent, accessible only through hidden caves.', threatLevel: 4, factionControlId: null },
        { name: 'The Amber Fields', lore: 'Vast farmlands preserved under a magical stasis - time moves slower here', threatLevel: 1, factionControlId: factions[1].id },
        { name: 'The Shattered Spire', lore: 'A broken tower that once pierced the sky. Magic behaves unpredictably in its shadow.', threatLevel: 5, factionControlId: null }, 
    ];

    for (const zone of zones) {
        await prisma.zone.upsert({
            where: { name: zone.name },
            update: {},
            create: zone,
        });
    }

    // Get all zones to attach quests
    const allZones = await prisma.zone.findMany();
    const zoneMap = Object.fromEntries(allZones.map(z => [z.name, z.id]));

    const quests = [
        { zoneName: 'The Ashen Wastes',    title: 'Embers of the Fallen',     briefing: 'A signal fire burns in the ruins ahead. Someone survived the last purge — or something lured them there.',  rewardXp: 120, rewardGold: 80  },
        { zoneName: 'The Ashen Wastes',    title: 'The Iron Covenant\'s Cache', briefing: 'Intel suggests a hidden armory lies beneath the ash fields. The Covenant denies its existence.',            rewardXp: 150, rewardGold: 100 },
        { zoneName: 'Port Vel\'Thar',      title: 'The Dockmaster\'s Debt',    briefing: 'A merchant hired you to recover a shipment stolen off the docks. The thief is still in the city.',            rewardXp: 80,  rewardGold: 120 },
        { zoneName: 'Port Vel\'Thar',      title: 'Syndicate Shadows',         briefing: 'Three Syndicate agents were seen entering the old lighthouse. None have come out.',                           rewardXp: 100, rewardGold: 90  },
        { zoneName: 'The Verdant Cradle',  title: 'The Withering',             briefing: 'Ancient trees at the heart of the Cradle are dying. The Circle believes something is poisoning the root network.', rewardXp: 90,  rewardGold: 60  },
        { zoneName: 'The Sunken Archives', title: 'Lost in Translation',       briefing: 'A scholar went into the archives two weeks ago to translate a pre-history text. She hasn\'t returned.',       rewardXp: 110, rewardGold: 70  },
        { zoneName: 'Ironhold Citadel',    title: 'A Crack in the Wall',       briefing: 'A section of the citadel\'s inner wall has been secretly bricked over. Someone doesn\'t want it found.',      rewardXp: 130, rewardGold: 85  },
        { zoneName: 'The Whispering Mire', title: 'Voices in the Fog',         briefing: 'Travelers report hearing their own voices calling to them from the mire. Two have followed the calls and vanished.', rewardXp: 140, rewardGold: 75  },
        { zoneName: 'Vel\'Nara Crossing',  title: 'Toll of Blood',             briefing: 'The bridge toll collector was found dead this morning. Traffic has stopped. Someone needs to find out why.',  rewardXp: 70,  rewardGold: 95  },
        { zoneName: 'The Ember Peaks',     title: 'The Forge-Clan Silence',    briefing: 'The dwarven forge-clan of Kragmoor has gone silent for 12 days. No smoke rises from their vents.',           rewardXp: 160, rewardGold: 110 },
        { zoneName: 'The Amber Fields',    title: 'The Stopped Clock',         briefing: 'In a village preserved by the stasis field, the same day has been repeating. The villagers don\'t know.',     rewardXp: 100, rewardGold: 80  },
        { zoneName: 'The Shattered Spire', title: 'Echo of the Archmage',      briefing: 'A magical echo of the Spire\'s last archmage is still active in the ruins, repeating a warning no one has decoded.', rewardXp: 200, rewardGold: 150 },
        { zoneName: 'Deepwater Hollow',    title: 'The Drowned Signal',        briefing: 'A rhythmic pulse has been emanating from the deepest cave system. Divers who investigated have not resurfaced.',   rewardXp: 150, rewardGold: 100 },
        { zoneName: 'The Silver Reaches',  title: 'The Waking Colossus',       briefing: 'Tremors beneath the tundra are growing stronger. Something ancient beneath the ice is beginning to stir.',          rewardXp: 170, rewardGold: 120 },
    ];

    for (const q of quests) {
        const zoneId = zoneMap[q.zoneName];
        if (!zoneId) continue;
        await prisma.quest.upsert({
            where: { id: `quest-${q.zoneName}-${q.title}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 30) },
            update: {},
            create: { id: `quest-${q.zoneName}-${q.title}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 30), zoneId, title: q.title, briefing: q.briefing, rewardXp: q.rewardXp, rewardGold: q.rewardGold },
        });
    }

    console.log('Seed complete: 3 factions, 12 zones, 12 quests');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());