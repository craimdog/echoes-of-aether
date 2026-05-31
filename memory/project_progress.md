---
name: project-progress
description: Current build status of Echoes of Aether — which phases and steps are complete, what was last worked on
metadata:
  type: project
---

## Build Status as of 2026-05-30

**Phase 1 — Foundation: COMPLETE**
- Monorepo scaffolding (npm workspaces: client, server, shared)
- Docker Compose: Postgres 16 (pgvector) + Redis 7
- Shared types package (@aether/shared) — ESM build, Vite alias pointing to source TS
- Prisma schema + initial migration (all models: User, Character, Zone, Faction, Quest, QuestSession, WorldEvent, LoreFragment, Guild, GuildMember)
- DB seeded: 3 factions, 12 zones, 12 quests
- Fastify server with JWT auth (register, login, refresh, logout, me)
- Character CRUD routes + Zone browse + zone quests endpoint
- React client: Vite + Tailwind + Zustand + React Query
- Auth pages (Login, Register), Dashboard, Character creation, Character detail

**Phase 2 — AI Core: MOSTLY COMPLETE**
- Anthropic singleton — model: claude-sonnet-4-6
- prompt-builder.ts: system prompt with zone/character/quest/event context
- ai.service.ts: streaming quest responses, mutation extraction, Redis session history (20-turn sliding window, 2hr TTL)
- quest.service.ts: startQuestSession, endQuestSession
- Socket.io plugin registered on Fastify server
- Quest routes: /start, /input, /end, /:sessionId
- QuestPage client UI: streaming chat interface, opening narration fires once via ref guard
- End-to-end quest flow WORKING with live AI streaming

**Still TODO in Phase 2:**
- BullMQ workers for world mutation processing (worldMutation JSON parsed but not written to DB)
- pgvector lore fragment storage + semantic retrieval injection into system prompt

**Phase 3 — Real-Time: NOT STARTED**
- Zone rooms (socket infrastructure exists but not wired to presence/chat UI)
- Zone chat UI
- World events feed on map page

**Phase 4 — Social & World: NOT STARTED**
- Faction system UI
- Guild CRUD + membership + XP
- World map page
- Admin panel

**Phase 5 — Deploy: NOT STARTED**
- GitHub Actions CI
- Railway (server) + Vercel (client)
- Sentry error monitoring

**Why:** Learning project targeting all fullstack disciplines. Each phase ships before next starts.
**How to apply:** Pick up from BullMQ world mutation workers (Phase 2 completion), then Phase 3 real-time.
