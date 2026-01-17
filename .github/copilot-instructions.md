## Workflow Rules
- **Context**: Before implementing, check `git log` to understand recent changes and context.
- **Commits**: Always provide a semantic commit message (e.g., `feat:`, `fix:`, `refactor:`) after implementation.

## Core Tech
- **Stack**: SvelteKit + MariaDB + Sequelize-Typescript.
- **Auth**: JWT in cookies; `hooks.server.ts` sets `event.locals.user`.
- **Database**: `src/lib/server/database/models/`. Use UUID IDs.
- **Audio**: Transcoded to `.aac` via FFmpeg in `transcode.ts`.

## Key Workflows
- **Migrations**: Create via `npm run db:create:migration`. Must be `.cjs` (use `npm run db:fix:migration`).
- **Audio Serving**: Local dev uses `/audio/[id]` endpoint. Production **must** use reverse proxy.

## Implementation Rules
- **Visibility**: Filter audios by `{ isTrusted: true }` unless user is admin.
- **Interactions**: Always use `src/lib/server/interactions.ts` for comments/notifications.
- **Types**: Use `ClientsideUser/Audio/Comment` from `src/lib/types.ts` for frontend data.
- **UI**: Use `dialogStore` from `$lib/stores/dialog.ts`, not `window.confirm`.
- **Time**: DB stores BIGINT (ms). Client converts to `Date`.
- **Subdomains**: `hooks.server.ts` maps `upload.*` host to `/upload` route.
- **AI**: Track AI origin via `x-from-ai` header in `event.locals.isFromAi`.
