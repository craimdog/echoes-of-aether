# Echoes of Aether — Project Context for Claude

This file tells Claude everything it needs to assist effectively on this project.
Always read this before generating code, architecture advice, or debugging help.

---

## What this project is

A browser-based multiplayer text RPG with an AI Dungeon Master (Claude via Anthropic API).
Players create characters, explore a persistent world divided into zones, and undertake quests
narrated in real-time by AI. Player decisions mutate world state permanently — towns can fall,
factions can shift power, lore evolves.

This is a personal fullstack learning project. Prioritize clear, well-structured code over
premature optimization. Favor explicit patterns over magic.

---

## Monorepo structure

```
/
├── client/          React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── store/          Zustand stores
│   │   ├── hooks/
│   │   ├── lib/            API client, socket client, utils
│   │   └── types/          Shared TS types (mirrored from /shared)
│   └── vite.config.ts
│
├── server/          Node.js + Fastify backend
│   ├── src/
│   │   ├── routes/         Fastify route handlers
│   │   ├── plugins/        Fastify plugins (auth, db, redis, socket)
│   │   ├── services/       Business logic (quest, world, guild, ai)
│   │   ├── workers/        BullMQ workers
│   │   ├── jobs/           BullMQ job definitions
│   │   ├── lib/            Prisma client, Redis client, Anthropic client
│   │   └── types/
│   └── prisma/
│       └── schema.prisma
│
├── shared/          Types and constants shared between client and server
│   └── src/
│       ├── types.ts
│       └── constants.ts
│
├── docker-compose.yml
└── claude.md        ← you are here
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, Zustand, Socket.io-client, React Query |
| Backend | Node.js 20, Fastify 4, TypeScript, Socket.io, BullMQ |
| Database | PostgreSQL 16 with Prisma ORM |
| Cache / PubSub | Redis 7 (ioredis) |
| Vector search | pgvector extension on PostgreSQL |
| AI | Anthropic API (`claude-sonnet-4-20250514`), streaming enabled |
| Auth | JWT (access: 15min, refresh: 7 days), httpOnly cookies |
| Jobs | BullMQ for world event processing and AI summary jobs |
| Dev infra | Docker Compose (postgres + redis), tsx for server hot reload |
| Deploy | Railway (server + workers) + Vercel (client) |
| CI/CD | GitHub Actions |
| Monitoring | Sentry (errors), Pino (structured logging) |

---

## Key conventions

### TypeScript
- Strict mode enabled everywhere (`"strict": true`)
- No `any` — use `unknown` and narrow, or define a proper type
- Shared types live in `/shared/src/types.ts` — import from there in both client and server
- Zod for runtime validation of all API inputs and AI JSON outputs

### API design
- REST for CRUD operations (auth, characters, guilds, zones)
- WebSocket (Socket.io) for real-time events only — do not use polling
- All REST routes prefixed with `/api/v1/`
- Consistent response envelope: `{ success: true, data: T }` or `{ success: false, error: string, code: string }`
- HTTP status codes must be semantically correct

### Database
- All DB access goes through Prisma — no raw SQL except for pgvector similarity queries
- Migrations via `prisma migrate dev` — never edit migration files manually
- Soft deletes for characters (`deletedAt` timestamp) — hard deletes only for test data
- Use Prisma transactions for any operation that touches multiple tables atomically

### Auth
- Auth plugin attaches `request.user` (type: `AuthUser`) on protected routes
- Decorator `preHandler: [server.authenticate]` marks a route as protected
- Never log tokens, passwords, or full user objects
- Refresh token rotation: issue a new refresh token on every use, invalidate the old one

### AI integration
- Anthropic client is a singleton in `server/src/lib/anthropic.ts`
- All AI calls go through `server/src/services/ai.service.ts` — never call the API directly from a route handler
- Stream responses to the client over WebSocket — do not buffer the full response server-side
- System prompt construction lives in `server/src/services/prompt-builder.ts`
- Always wrap AI calls in try/catch; fall back to a canned error message, never surface raw API errors to clients
- Session message history is stored in Redis with key `quest-session:{sessionId}` and TTL of 2 hours

### Real-time / WebSocket
- Socket.io rooms: `zone:{zoneId}` and `guild:{guildId}` and `world` (global feed)
- Event names are typed constants in `/shared/src/constants.ts` — never use raw strings
- Server-to-client events: `zone:event`, `zone:chat`, `world:event`, `quest:chunk`, `quest:end`
- Client-to-server events: `zone:chat`, `quest:input`
- Always validate socket payloads with Zod before processing

### BullMQ jobs
- Two queues: `world-events` and `ai-summaries`
- Workers live in `server/src/workers/`
- Jobs must be idempotent — safe to retry on failure
- Job payloads are typed; store only IDs, not full objects

### Error handling
- Use Fastify's built-in error handling — throw `createError(statusCode, message)` from `@fastify/sensible`
- Log all unexpected errors with `request.log.error`
- Client shows friendly messages; never expose stack traces or DB errors to the browser

### Testing
- Unit tests with Vitest
- Integration tests for route handlers using Fastify's `inject()`
- Test files colocated: `foo.service.test.ts` next to `foo.service.ts`
- No mocking of Prisma in integration tests — use a test database seeded via `prisma db seed`

---

## Prisma schema (abbreviated)

```prisma
model User {
  id           String      @id @default(cuid())
  email        String      @unique
  username     String      @unique
  passwordHash String
  role         Role        @default(PLAYER)
  characters   Character[]
  createdAt    DateTime    @default(now())
}

model Character {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id])
  name       String
  class      Class
  level      Int       @default(1)
  xp         Int       @default(0)
  hp         Int
  mp         Int
  gold       Int       @default(100)
  inventory  Json      @default("[]")
  isAlive    Boolean   @default(true)
  deletedAt  DateTime?
  zoneId     String
  zone       Zone      @relation(fields: [zoneId], references: [id])
  factionId  String?
  faction    Faction?  @relation(fields: [factionId], references: [id])
  sessions   QuestSession[]
  guildMembership GuildMember?
}

model Zone {
  id               String    @id @default(cuid())
  name             String
  lore             String
  threatLevel      Int       @default(1)
  factionControlId String?
  faction          Faction?  @relation(fields: [factionControlId], references: [id])
  quests           Quest[]
  characters       Character[]
  worldEvents      WorldEvent[]
  loreFragments    LoreFragment[]
  updatedAt        DateTime  @updatedAt
}

enum Role   { PLAYER ADMIN }
enum Class  { MAGE RANGER PALADIN ROGUE }
```

---

## Environment variables

```bash
# server/.env
DATABASE_URL=postgresql://user:pass@localhost:5432/aether
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=sk-ant-...
JWT_ACCESS_SECRET=...        # min 32 chars
JWT_REFRESH_SECRET=...       # min 32 chars, different from access
COOKIE_SECRET=...
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173

# client/.env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

---

## AI prompt structure

Quest sessions use this message structure:

```
[System prompt — built fresh each session]
  - World context (zone name, lore summary, current faction control, threat level)
  - Character sheet (name, class, level, HP, inventory summary, faction allegiance)
  - Recent world events in this zone (last 5)
  - Top 5 lore fragments retrieved via pgvector similarity search
  - Active quest brief
  - Behavioral instructions (tone, response length, JSON mutation format)

[Message history — last N turns from Redis, sliding window]

[New user input]
```

The AI is instructed to end each response with an optional JSON block in this format
when a significant world mutation occurs:

```json
{
  "worldMutation": {
    "type": "FACTION_SHIFT | ZONE_THREAT_CHANGE | LORE_FRAGMENT | QUEST_COMPLETE",
    "zoneId": "...",
    "payload": {}
  }
}
```

The server strips and processes this block before streaming the narrative to the client.

---

## Common tasks (how to ask Claude for help)

When asking for help on this project, reference this file and be specific about:

1. **Which layer** you're working in (client route, server service, worker, etc.)
2. **The relevant types** — paste the Prisma model or TypeScript type if custom
3. **What you've tried** — include the current code and the error or unexpected behavior
4. **What you want** — new feature, bug fix, refactor, test coverage, etc.

Example prompt:
> "I'm in `server/src/services/quest.service.ts`. I need to implement `startQuestSession()`.
> It should: load the character + zone from DB, build a system prompt via prompt-builder,
> store the initial messages in Redis, and return the sessionId.
> Here's my current Character type: [paste]. How should I structure this?"

---

## What Claude should never do on this project

- Suggest using `express` — this project uses Fastify
- Use `var` or omit types in TypeScript
- Put business logic directly in route handlers — it belongs in services
- Suggest `localStorage` for auth tokens — we use httpOnly cookies
- Use `console.log` — use `request.log` (Pino) in server code
- Make direct Anthropic API calls from anywhere except `ai.service.ts`
- Suggest polling as an alternative to WebSockets for real-time features
