# AudioPub Copilot Instructions

## Project Overview

AudioPub is a SvelteKit-based audio sharing platform with MariaDB backend. Users upload audio files, share them publicly, engage via comments/favorites, and subscribe to user feeds.

## Architecture

### Frontend/Routes (SvelteKit)
- **Framework**: SvelteKit 2.x with Node adapter
- **Layout**: `src/routes/` follows SvelteKit file-based routing (`+page.svelte`, `+page.server.ts`, `+server.ts`)
- **Key routes**: Home, Listen, Upload, Favorites, Profile, Notifications, Quickfeed (algorithm feed)
- **Authentication**: JWT cookies set in `hooks.server.ts`; user loaded via `event.locals.user`

### Database Layer (Sequelize-Typescript)
- **ORM**: Sequelize with TypeScript decorators (`sequelize-typescript`)
- **Database**: MariaDB (MySQL dialect)
- **Models** in `src/lib/server/database/models/`:
  - User, Audio, Comment, PlaysTracker, Notification, AudioFavorite, AudioFollow
  - Use decorators: `@Table`, `@Column`, `@PrimaryKey`, `@AllowNull`, `@BeforeCreate`, etc.
  - Relationships configured via `@HasMany`, `@BelongsTo` decorators
- **Initialization**: `src/lib/server/database/index.ts` exports sequelize instance with models

### Server-Side Logic
- **Authentication**: JWT-based; `User.generateToken()` creates tokens, stored in cookies
- **Email**: Mailgun integration via `src/lib/server/email.ts` (can disable with `NO_EMAIL=true`)
- **Audio Processing**: `src/lib/server/transcode.ts` uses FFmpeg to create AAC transcodes (`.aac` files)
- **User Status**: Models track `isBanned`, `isVerified`, `isTrusted` flags

### Data Structures

#### Clientside Types (`src/lib/types.ts`)
- `ClientsideUser`: id, name, displayName, isBanned, isVerified, isTrusted
- `ClientsideAudio`: title, description, plays, favoriteCount, createdAt, user, comments
- `ClientsideComment`: content, replies (nested), user, audio
- `NotificationType`: enum (comment, upload, system, favorite)
- **Key difference**: Clientside types use string IDs and numbers for timestamps

## Critical Developer Workflows

### Database Migrations
- Migrations stored in `.cjs` format (not `.js`) in `src/lib/server/database/migrations/`
- Run migrations: `npm run db:migrate`
- Create migration: `npm run db:create:migration -- migration-name` then rename `.js` to `.cjs`
- Undo: `npm run db:migrate:undo`
- **Fix step**: If migration creates `.js` files, run `npm run db:fix:migration` to rename to `.cjs`

### Development Build & Run
- `npm run dev`: Start dev server on default port (usually 5173)
- `npm run build`: Production build
- `npm run check`: Type-check without building
- `npm run check:watch`: Watch mode type-checking

### Required Environment Variables
```
DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD
JWT_SECRET
MAILGUN_API_KEY, MAILGUN_DOMAIN (optional, set NO_EMAIL=true to disable)
```

## Project-Specific Conventions

### Page Load Patterns
- Use `PageServerLoad` in `+page.server.ts` to fetch data server-side
- Example ([src/routes/+page.server.ts](src/routes/+page.server.ts#L25)): Validate query params, use `Audio.findAndCountAll()` with Sequelize options
- Pagination: offset-based (limit=30 per page)
- **Sorting edge cases**: `random` field uses `Sequelize.fn('RAND')`, `favoriteCount` uses subquery

### Form Actions Pattern
- Use `export const actions: Actions = { default: async (event) => { ... } }`
- Return `fail(status, data)` for errors, `redirect(303, path)` for success
- Example ([src/routes/login/+page.server.ts](src/routes/login/+page.server.ts)): Validate form data, compare passwords with bcrypt, set JWT cookie

### API Routes (`+server.ts`)
- Export `GET`, `POST`, `DELETE`, etc. as `RequestHandler`
- Return `Response` objects with proper headers
- Use `error(statusCode, message)` for HTTP errors
- Example ([src/routes/audio/[id]/+server.ts](src/routes/audio/[id]/+server.ts#L23)): Dev-only endpoint for local audio serving (production uses reverse proxy)

### Component Patterns
- Components in `src/lib/components/`; use `.svelte` extension
- Import types from `$lib/types` for type-safety
- Example ([src/lib/components/audio_item.svelte](src/lib/components/audio_item.svelte)): Renders ClientsideAudio with optional user actions

### Timezone Handling
- Timestamps in database stored as BIGINT (milliseconds since epoch)
- Use `date-fns` for parsing (imported in models)
- Clientside: convert to ISO strings or use `new Date(timestamp)`

## Integration Points & Dependencies

### External Services
- **Mailgun**: Email sending (if enabled); configure domain in .env
- **MariaDB**: Ensure listening on 127.0.0.1:3306 (hardcoded in database config)

### Reverse Proxy Requirement
- Audio files served via reverse proxy at `/audio/{id}` in production
- Local dev endpoint exists only in dev mode; production returns 403

### Special Routing
- `hooks.server.ts` checks for subdomain prefix "upload" and prepends `/upload` to pathname
- JWT token validation on every request; sets `event.locals.user` if valid

## Common Mistakes to Avoid

1. **Migration file extensions**: Migrations MUST be `.cjs` not `.js` (Sequelize requirement)
2. **Timestamp types**: Don't mix string dates and numbers; use consistent BIGINT in DB, convert on output
3. **Audio serving in production**: Never enable the `/audio/[id]` endpoint in production; use reverse proxy
4. **Clientside/Serverside types**: Models use sequelize attributes; exports use `ClientsideUser` for API responses
5. **JWT secret**: Missing `JWT_SECRET` throws error on startup; never commit `.env`

## File Organization Quick Reference

- **Routes/Pages**: `src/routes/[path]/+page.server.ts` (load), `+page.svelte` (UI)
- **API endpoints**: `src/routes/[path]/+server.ts` (GET, POST, DELETE)
- **Database logic**: `src/lib/server/database/models/` (model definitions)
- **Utilities**: `src/lib/server/` (email, transcode)
- **Types**: `src/lib/types.ts` (shared interfaces)
- **Components**: `src/lib/components/` (reusable Svelte components)

## When Modifying...

- **Adding a model**: Update `src/lib/server/database/index.ts` models array
- **Adding a route**: Create new folder under `src/routes/` with `+page.server.ts` or `+server.ts`
- **Changing auth logic**: Modify `hooks.server.ts` (runs on every request) or `User.generateToken()`
- **Database schema**: Create migration, ensure `.cjs` extension, update model definition
