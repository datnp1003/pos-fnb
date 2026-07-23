# Repository Guidelines

## Project Structure & Module Organization
The app uses Next.js 16 with the App Router. Main code lives in `src/`: `src/app` contains route groups such as `(auth)` and `(pos)`, `src/components` holds shared UI, `src/hooks` contains client hooks, `src/lib` contains utilities and auth/db helpers, `src/server` holds server-side actions, and `src/i18n` stores language dictionaries and providers. Database files live in `prisma/` (`schema.prisma`, `seed.ts`). Static assets are in `public/`, reference docs in `docs/`, and product screenshots in `screenshots/`.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the local dev server with Next.js.
- `npm run build`: create a production build.
- `npm run start`: serve the production build locally.
- `npm run lint`: run ESLint across the repo.
- `npx prisma migrate dev --name <change>`: create and apply a local schema migration.
- `npx prisma db seed`: load default seed data.

## Coding Style & Naming Conventions
Use TypeScript and existing path aliases such as `@/lib/...`. Follow the repo’s current style: double quotes, semicolons, and PascalCase for React components (`DeviceProvider.tsx`), kebab-case for hook files (`use-bluetooth-printer.ts`), and camelCase for variables and functions. Prefer server logic in `src/server` or `src/lib`, not inside UI components. Run `npm run lint` before submitting changes. This repo uses `eslint.config.mjs` with `eslint-config-next` core-web-vitals and TypeScript rules.

## Testing Guidelines
There is no committed automated test suite yet, even though Playwright is installed. For now, linting is the minimum validation gate. When adding tests, keep them next to the feature as `*.test.ts` or `*.test.tsx`, and prefer high-value coverage for Prisma workflows, auth, and order/cash/report flows. Document manual verification steps in the PR when automation is not available.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commit style, for example `feat(i18n): add portuguese translation` and `fix(docker): remove non-existent src/generated`. Keep commits scoped and imperative. PRs should include: a short problem/solution summary, linked issue if applicable, schema or env changes, and screenshots for UI updates. If you change `prisma/schema.prisma`, include the migration and note any seed impact.

## Configuration Notes
Copy `.env.example` to `.env.local` for local setup. Keep secrets out of Git. Because this project uses Next.js 16, check `node_modules/next/dist/docs/` before introducing new framework patterns or changing routing/runtime behavior.
