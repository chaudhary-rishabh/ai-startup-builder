# AI Startup Builder

End-to-end platform that takes a startup idea from validation to launch using AI agents. Each phase — validate, plan, design, build, deploy, growth — is driven by specialized agents that generate code, tests, infrastructure, and growth strategies.

## Architecture

```
apps/
├── web/          Next.js 15 — founder dashboard, project workspace, phase UI
└── admin/        Next.js 15 — admin panel (users, billing, AI usage, audit)
packages/
├── db/           Drizzle ORM + PostgreSQL 16
├── ui/           Shared Radix UI + Tailwind components
├── types/        Shared TypeScript types
├── validators/   Zod schemas
└── config/       Shared eslint & tsconfig presets
```

Backend microservices sit behind an API gateway (`:4000`). Auth (`:4001`), Users (`:4002`), Projects (`:4003`), AI (`:4004`), RAG (`:4005`), Billing (`:4006`), Notifications (`:4007`).

> **Note:** All 7 microservices must be running before the web/admin apps are functional. `pnpm dev` at the root starts everything via Turborepo — individual services can also be started from their respective directories.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 18/19, Tailwind CSS, Radix UI, Framer Motion |
| State | Zustand, TanStack Query, React Hook Form |
| Backend | Node.js microservices (TypeScript) |
| Database | PostgreSQL 16 + Drizzle ORM, Redis 7 |
| AI Models | DeepSeek V4, DeepSeek R1, MiniMax M2.7, Gemini Flash |
| Auth | JWT (RS256), Google OAuth, TOTP-based MFA |
| Billing | Razorpay (subscriptions + one-time credits) |
| Email | Resend (transactional) |
| RAG | Pinecone vector DB + Gemini embeddings |
| Storage | AWS S3 |
| Infra | Docker Compose (local), AWS (prod) |
| Testing | Vitest (unit), Playwright (e2e), MSW (API mocks) |

## Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Docker** (for local Postgres + Redis)

## Setup

```bash
# 1. Clone and install
git clone <repo-url> && cd product
pnpm install

# 2. Start local infrastructure
docker compose up -d

# 3. Configure environment
cp .env.example .env.local
# Fill in required values (AI keys, OAuth credentials, etc.)
# Generate RS256 JWT keypair: pnpm generate-keys
# This writes JWT_PRIVATE_KEY and JWT_PUBLIC_KEY into .env.local

# 4. Run migrations and seed
pnpm db:migrate
pnpm seed

# 5. Start development
pnpm dev
# Web app   → http://localhost:3000
# Admin     → http://localhost:3001
# Gateway   → http://localhost:4000
# Requires: Docker services (step 2) + .env.local (step 3) must be complete first
```

## Commands

| Command | Description |
|---|---|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests (Vitest) |
| `pnpm test:e2e` | Run e2e tests (Playwright) — per app |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm db:migrate` | Apply database migrations |
| `pnpm db:generate` | Generate Drizzle schema types |
| `pnpm seed` | Seed database with sample data |
| `pnpm format` | Format with Prettier |

## Project Phases

1. **Validate** — AI validates the idea against market data
2. **Plan** — Generates feature scope, user flows, architecture
3. **Design** — Produces UI screens with design mode toggle
4. **Build** — Code generation agents (schema, API, backend, frontend, integration)
5. **Deploy** — E2e testing, CI/CD pipeline, deployment to production
6. **Growth** — AI-generated growth actions, feedback analysis, playbook


## Environment Variables

Copy `.env.example` to `.env.local`. The following are required to start:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_PRIVATE_KEY` / `JWT_PUBLIC_KEY` | RS256 keypair (run `pnpm generate-keys`) |
| `DEEPSEEK_API_KEY` | Primary AI model |
| `PINECONE_API_KEY` + `PINECONE_INDEX` | RAG layer |
| `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` | Billing |
| `RESEND_API_KEY` | Transactional email |

All other variables are optional or have defaults. See `.env.example` for the full reference.

## CI / CD

- **Lint** + **Typecheck** + **Tests** on every PR
- Husky + lint-staged for pre-commit checks
- Conventional commits enforced via commitlint
- Changesets for versioning

## License

Proprietary — all rights reserved.
