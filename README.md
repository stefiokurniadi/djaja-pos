# POS SaaS (Mobile-first)

## Prereqs
- Node.js 20+
- Docker (for local Postgres)

## Setup
1. Copy env:
   - `cp .env.example .env`
2. Start Postgres:
   - `docker compose up -d`
3. Install deps:
   - `npm install`
4. Generate Prisma client + run migrations:
   - `npm run prisma:migrate`
5. Run the app:
   - `npm run dev`

## Notes
- Prisma schema lives in `prisma/schema.prisma`
- Multi-tenant rule: all primary data models are linked to `branchId`

