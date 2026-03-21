# UIGen

AI-powered React component generator with live preview. Playground/toy project.

## Commands

- `npm run dev` — start dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm test` — run all tests (Vitest)
- `npm run setup` — install deps + Prisma generate + migrate
- `npm run db:reset` — reset database

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 + shadcn/ui (components in `src/components/ui/`)
- Prisma + SQLite (`prisma/schema.prisma`, db at `prisma/dev.db`)
- Anthropic Claude via Vercel AI SDK (`@ai-sdk/anthropic` + `ai`)
- Vitest + React Testing Library + jsdom
- Auth: JWT (jose) + bcrypt, httpOnly cookies

## Project Structure

- `src/app/` — Next.js pages and API routes
 `src/actions/` — server actions (auth, projects)
- `src/components/` — UI components (chat, editor, preview, auth)
- `src/lib/` — utilities, contexts, file system, transform, prompts, auth
- `src/hooks/` — React hooks
- `prisma/` — schema and migrations

## Conventions

- Path alias: `@/*` maps to `./src/*`
- Prisma client output: `src/generated/prisma`
- Tests live next to source in `__tests__/` directories
- Dev server requires `NODE_OPTIONS='--require ./node-compat.cjs'`
