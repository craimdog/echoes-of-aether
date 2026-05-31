import { prisma } from '../lib/prisma.js';

export async function storeLoreFragment(zoneId: string, content: string) {
    return prisma.loreFragment.create({ data: { zoneId, content } });
}

export async function getRelevantLore(zoneId: string, keywords: string, limit = 5): Promise<string[]> {
    // Keyword-based retrieval using PostgreSQL full-text search
    // Swap this query for a pgvector similarity search when an embeddings provider is configured
    const fragments = await prisma.$queryRaw<{ content: string }[]>`
        SELECT content
        FROM "LoreFragment"
        WHERE "zoneId" = ${zoneId}
            AND to_tsvector('english', content) @@ plainto_tsquery('english', ${keywords})
        ORDER BY "createdAt" DESC
        LIMIT ${limit}
    `;

    // Fall back to most recent fragments if keyword search returns nothing
    if (fragments.length === 0) {
        const recent = await prisma.loreFragment.findMany({
            where: { zoneId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: { content: true },
        });
        return recent.map(f => f.content);
    }

    return fragments.map(f => f.content);
}