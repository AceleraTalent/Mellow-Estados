# Mellow & Banana Operations

Internal client operations system for moving Mellow & Banana clients through a configurable four-stage brand lifecycle.

## Stack

- Next.js App Router
- React + TypeScript
- Prisma
- PostgreSQL
- dnd-kit
- bcrypt-backed credential sessions persisted in PostgreSQL

## Local setup

1. Create `.env` from `.env.example`.
2. Set `DATABASE_URL` to a PostgreSQL database.
3. Install dependencies:

```bash
npm install
```

4. Push the schema and seed realistic data:

```bash
npx prisma db push
npm run prisma:seed
```

5. Start the app:

```bash
npm run dev
```

Seed login:

```text
admin@mellow.local
mellow123
```

## Implemented MVP surface

- Login/logout with persistent sessions.
- PostgreSQL data model for users, teams, stage definitions, client-stage instances, task templates, tasks, comments, activity logs, and sessions.
- Automatic planned timeline generation when a client is created.
- Preserved planned dates and separate actual dates.
- Transactional client creation and stage transitions.
- Client health: on track, due soon, delayed, completed.
- Days in current stage and stage deadline on the primary client list.
- Client list with search, health/stage filters, and sorting.
- Client board grouped by current stage with persisted ADMIN movement.
- Client detail with timeline, current stage, tasks, activity, and advance-stage action.
- Task list and task board with persisted status movement.
- Teams and basic administration for users, stage duration editing, and task templates.

Default stages in the seed data:

- Entrevistas & Propuesta de Valor
- Landscape
- Brand Strategy
- Brand Design

## Notes

The repository started empty except for `client-operations-codex-plan.md`; all application files were added from that product specification.
