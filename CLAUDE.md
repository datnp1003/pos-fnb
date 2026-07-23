# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Dev server (Turbopack)
npm run build     # Production build
npm run lint      # ESLint

# Database
npx prisma migrate dev --name <name>   # Create + apply migration
npx prisma db seed                     # Seed default admin + sample data
npx prisma studio                      # Browse DB visually
```

No test runner is configured yet. The project needs unit/E2E tests (see README contributing section).

## Environment

Copy `.env.example` → `.env.local`. Required vars:

| Var | Purpose |
|-----|---------|
| `AUTH_SECRET` | NextAuth signing key (`openssl rand -base64 32`) |
| `AUTH_URL` | App URL for NextAuth callbacks |
| `DATABASE_URL` | PostgreSQL connection string |

Docker Compose assembles `DATABASE_URL` from `POSTGRES_DB/USER/PASSWORD` automatically.

## Architecture

### Next.js layout

`src/` is the Next.js root — all `@/*` imports resolve to `src/*`.

Route groups:
- `src/app/(auth)/` — public routes (login)
- `src/app/(pos)/` — protected POS modules: `dashboard`, `order`, `inventory`, `cash`, `reports`, `settings`

API routes are minimal: `api/auth/[...nextauth]`, `api/render-print`, `api/reports`.

### Data layer

**Database**: PostgreSQL via Prisma (`@prisma/adapter-pg`). Schema has 40+ models in `prisma/schema.prisma`. The README says SQLite but the actual stack uses PostgreSQL.

**Server actions**: All Prisma queries live in `src/server/{module}/actions.ts`. Pages call these directly — no separate REST API layer. Special files: `inventory/fifo.ts` (FIFO cost algorithm), `reports/excel.ts` (ExcelJS export).

**Client state**: Zustand for local UI state + TanStack React Query for server state/caching.

### Auth & permissions

NextAuth v5 beta with credentials provider. Config is **split**:
- `src/lib/auth.config.ts` — edge-compatible config (used in middleware)
- `src/lib/auth.ts` — full server config with Prisma adapter

Middleware (`src/middleware.ts`) enforces two JSON arrays stored on the session user:
- `permissions` — feature-level flags
- `scopes` — module access (`order`, `inventory`, `cash`, `reports`, `settings`, `dashboard`)

`"*"` in either array grants full admin access.

### i18n

Custom context provider, no external library. Dictionaries in `src/i18n/{locale}.ts` (en, vi, zh, ko, ja, pt). `src/lib/server-i18n.ts` for RSC-side translations. To add a language: copy `vi.ts` → translate → register in `src/i18n/dictionaries.ts`.

### UI

shadcn/ui components in `src/components/ui/`. Tailwind CSS v4 (PostCSS plugin, not CLI). Base UI React (`@base-ui/react`) used alongside shadcn. `src/lib/utils.ts` exports `cn()` (clsx + tailwind-merge).

### Printing

Dual-mode:
- **Server mode**: TCP socket to thermal printer on local network
- **Device mode**: Web Bluetooth API from browser (`src/hooks/useBluetoothPrinter`)

Print templates rendered server-side via `api/render-print`, then sent to printer.
