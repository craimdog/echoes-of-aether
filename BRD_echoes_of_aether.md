# Business Requirements Document
## Echoes of Aether — AI-Driven Multiplayer RPG

**Version:** 1.0  
**Date:** 2026-05-30  
**Author:** Personal Project  
**Status:** Draft

---

## 1. Overview

Echoes of Aether is a browser-based, multiplayer text RPG where an AI Dungeon Master (powered by Claude) narrates a persistent, living world that evolves based on player decisions. Players create characters, undertake quests, form guilds, and participate in real-time world events — all within a world whose lore, factions, and geography mutate permanently over time.

This project is primarily a learning exercise targeting every major fullstack discipline: real-time systems, AI integration, complex relational data modeling, authentication, and production deployment.

---

## 2. Goals & Success Criteria

### Primary Goals
- Build a feature-complete fullstack application from scratch to production
- Gain hands-on experience with WebSockets, AI streaming APIs, relational databases, auth flows, and CI/CD
- Produce a portfolio-quality project that demonstrates architectural maturity

### Success Criteria
- A player can register, create a character, and complete a full AI-narrated quest session
- Two or more players can interact in real-time in a shared world zone
- The world state (towns, factions, lore) persists and mutates across sessions
- The app is deployed to a public URL with CI/CD pipeline

---

## 3. Scope

### In Scope (MVP)
- User registration, login, and JWT-based auth
- Character creation (class, name, stats)
- AI-powered quest narration via Anthropic API (streaming)
- Persistent character state (HP, inventory, XP, level)
- World map with zones (each zone has its own state and lore)
- Real-time zone chat and combat events via WebSockets
- Guild creation and membership
- Basic faction system (allegiance affects AI narration)
- Admin panel to inspect world state

### Out of Scope (Future)
- Mobile native app
- Voice narration / TTS
- Economy / player trading marketplace
- Procedural map generation
- Paid tiers / subscriptions

---

## 4. User Roles

| Role | Description |
|------|-------------|
| Guest | Can browse the world map and lore wiki; cannot play |
| Player | Registered user with one or more characters |
| Guild Master | Player who created a guild; can manage members and declare guild events |
| World Admin | Operator with access to the admin panel; can seed events and inspect DB |

---

## 5. Core Features

### 5.1 Authentication & Accounts
- Email + password registration with bcrypt hashing
- JWT access tokens (15 min) + refresh tokens (7 days) stored in httpOnly cookies
- OAuth option (Google) via Passport.js — phase 2
- Account settings: username, avatar, email change, password reset via email token

### 5.2 Character System
- Each account can hold up to 3 characters
- Character attributes: Name, Class (Mage / Ranger / Paladin / Rogue), Level, XP, HP, MP, Gold, Inventory (JSON array), Active Quest ID, Faction Allegiance
- Stats derived from level + class archetype (formula stored server-side)
- Character death is permanent (roguelike mode, toggleable per character at creation)

### 5.3 AI Dungeon Master (Core Feature)
- Each quest session opens a conversation with Claude
- System prompt includes: zone lore, character sheet, faction state, recent world events, active quest brief
- Player inputs are sent as user turns; Claude responds with streamed narrative
- The AI can: describe scenes, present choices, resolve actions, describe combat outcomes
- At session end, AI generates a structured JSON summary: XP gained, items found, world mutations triggered
- World mutations from the summary are written to the DB by a background job (BullMQ)
- Token budget per session: ~8,000 tokens. Session history stored in Redis for context continuity

### 5.4 World State & Zones
- World consists of ~12 zones (e.g. The Ashen Wastes, Port Vel'Thar, The Verdant Cradle)
- Each zone has: a name, lore description, controlling faction, threat level (1–5), list of active quests, and event log
- Zone state is stored in PostgreSQL and cached in Redis
- Player actions that trigger mutations (burn a town, forge an alliance) are queued as world events
- A cron job every 10 minutes processes queued world events and updates zone state
- Faction standings are global — if enough players side with one faction, it gains territory

### 5.5 Real-Time Layer
- Socket.io rooms per zone
- Events broadcast to zone room: player enters/leaves, combat resolved, world event triggered, chat message
- A global "World Events" feed (visible on the map page) streams significant mutations to all connected clients
- Typing indicator shown in zone chat
- Max 50 concurrent users per zone room (soft limit; enforced server-side)

### 5.6 Guilds
- Any level 5+ character can found a guild (costs 500 gold)
- Guild fields: name, emblem color, description, member list, XP pool, tier (1–5)
- Guild XP accumulates from member quests; tiers unlock perks (shared storage, guild quests)
- Guild Master can: invite, kick, promote to officer, disband
- Guild war mechanic (phase 2)

### 5.7 Lore Memory (Vector Search)
- Key lore fragments generated by the AI are stored as embeddings in pgvector
- Before each quest session, a semantic search retrieves the top-5 most relevant lore chunks for the current zone + character history
- This gives the AI "long-term memory" without blowing the context window

### 5.8 Admin Panel
- Protected route (`/admin`) behind admin role check
- View: live connected users, zone states, faction standings, recent world events
- Actions: trigger a world event manually, reset a zone, ban a user, inspect character state
- Built with a simple React dashboard (no external admin library)

---

## 6. Data Models (Key Entities)

```
User           id, email, passwordHash, username, createdAt, role
Character      id, userId, name, class, level, xp, hp, mp, gold, inventory, factionId, zoneId, isAlive
Zone           id, name, lore, factionControlId, threatLevel, createdAt, updatedAt
Faction        id, name, description, color, globalPower
Quest          id, zoneId, title, briefing, rewardXp, rewardGold, isActive
QuestSession   id, characterId, questId, messages (JSONB), status, startedAt, endedAt
WorldEvent     id, zoneId, description, triggeredByCharId, processed, createdAt
LoreFragment   id, zoneId, content, embedding (vector), createdAt
Guild          id, name, founderId, emblemColor, xpPool, tier, createdAt
GuildMember    guildId, characterId, role (master/officer/member), joinedAt
```

---

## 7. Technical Architecture

```
Browser (React + Vite)
    │
    ├── REST API (Fastify)  ← JWT auth middleware
    │       │
    │       ├── PostgreSQL via Prisma ORM
    │       ├── Redis (sessions, zone cache, Socket.io adapter)
    │       └── BullMQ workers (world event processing, AI summaries)
    │
    ├── WebSocket (Socket.io)  ← same Node process
    │
    └── Anthropic API  ← called server-side only (key never exposed to client)
```

---

## 8. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Quest AI response first token | < 1 second |
| WebSocket message latency | < 200ms (same region) |
| API response time (p95) | < 400ms |
| Concurrent users (MVP) | 100 |
| Uptime target | 99% (personal project SLA) |
| Auth token security | httpOnly cookies, CSRF protection |
| Data persistence | PostgreSQL with daily automated backups |

---

## 9. Phased Roadmap

### Phase 1 — Foundation (Weeks 1–3)
- Project scaffolding (monorepo with `/client`, `/server`, `/shared`)
- Docker Compose dev environment (Postgres, Redis)
- Auth system (register, login, refresh tokens)
- Character creation and persistence
- Basic zone browsing (read-only)

### Phase 2 — AI Core (Weeks 4–6)
- Anthropic API integration with streaming
- Quest session start/continue/end flow
- AI summary → world mutation pipeline (BullMQ)
- Lore fragment storage + pgvector retrieval

### Phase 3 — Real-Time (Weeks 7–8)
- Socket.io zone rooms
- Zone chat
- Real-time world events feed on map page
- Live player presence indicators

### Phase 4 — Social & World (Weeks 9–11)
- Faction system
- Guild creation, membership, XP
- World map UI with zone states
- Admin panel

### Phase 5 — Polish & Deploy (Weeks 12–14)
- CI/CD via GitHub Actions
- Dockerized production deploy to Railway or Render
- Error monitoring (Sentry)
- Performance profiling + Redis caching audit
- README, demo video, portfolio write-up

---

## 10. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| AI response cost spirals | Medium | Per-session token cap; rate limit quest starts per account |
| World state conflicts (concurrent mutations) | Medium | Serialize world event processing through BullMQ queue |
| Context window overflow in long sessions | High | Sliding window + lore injection via vector search |
| WebSocket scaling beyond 1 server | Low (MVP) | Redis Socket.io adapter already in stack for future horizontal scaling |
| Scope creep stalls project | High | Hard phase gates; ship each phase before starting next |

---

## 11. Open Questions
- Should character death be the default or opt-in per character?
- How granular should faction allegiance be — binary or a spectrum score?
- Do guild quests use the same AI session flow as solo quests?
- Should lore mutations be visible immediately or revealed to players gradually?
