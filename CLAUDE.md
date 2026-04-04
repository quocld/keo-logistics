# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

**keo-logistics** is a monorepo for **KeoTram Ops** — a Vietnamese logistics platform for timber (keo tràm) transport chains. Drivers and owners use a mobile/web app (Expo); a NestJS backend handles trips, weight receipts, driver tracking, approvals, and financial reporting.

| Directory | Purpose |
| --------- | ------- |
| `keo-app/` | Mobile + web app (Expo Router, React Native) |
| `keo-be/` | REST API (NestJS, TypeORM, PostgreSQL) |
| `docs/` | BRD (`docs/business.md`) and Postman collection (API contract) |

---

## Development commands

### Backend (`keo-be/`)

```bash
cd keo-be

npm run start:dev          # Run in watch mode
npm run lint               # ESLint — must pass before committing
npm run format             # Prettier

npm run migration:generate # Generate migration from schema changes
npm run migration:run      # Apply pending migrations
npm run migration:revert   # Roll back last migration

npm test                   # Unit tests
npm run test:watch         # Unit tests in watch mode
npm run test:cov           # Coverage report
npm run test:e2e           # E2E tests (requires Docker)
npm run test:e2e:relational:docker  # E2E with Docker compose

npm run seed:run:relational:roles-status  # Seed roles & statuses
npm run seed:run:relational:admin         # Seed admin user

npm run build              # Compile TypeScript
npm run start:prod         # Run compiled server
```

**Local stack** (PostgreSQL, Maildev, Adminer):
```bash
cd keo-be && docker compose up -d
```
Copy `keo-be/env-example-relational` → `keo-be/.env` and fill in secrets.

### App (`keo-app/`)

```bash
cd keo-app

npm start          # Start Expo dev server (all platforms)
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
npm run web        # Web browser
npm run lint       # Expo lint — must pass before committing
```

Copy `keo-app/.env.example` → `keo-app/.env` and set `EXPO_PUBLIC_API_URL`.

---

## Feature workflow (important)

**Backend first, app second.**

1. **Plan** the API change: endpoint, method, auth/role, request/response shape, migration needed?
2. **Implement** in `keo-be/` (include migration if schema changes).
3. **Lint:** `cd keo-be && npm run lint` — fix all errors.
4. **Update contracts:**
   - `docs/postman/keotram-ops-api.postman_collection.json` — always update for API changes.
   - `docs/business.md` — update if business rules, roles, or flows change.
5. Only then implement in `keo-app/` (types → `lib/api/*` → screens).
6. **Lint:** `cd keo-app && npm run lint`.

Do **not** add or modify automated tests (unit/e2e) unless the task explicitly asks for it.

**Scope discipline:** When working on `keo-be/`, don't touch `keo-app/` (and vice versa) unless the task is explicitly full-stack.

---

## Architecture

### Backend (`keo-be/src/`)

The backend is organized by NestJS feature modules:

- **`ops/`** — core domain: all business logic lives here.
  - `domain/` — enums, pure business logic utilities
  - `dto/` — request/response DTOs (class-validator)
  - `infrastructure/` — TypeORM entities and repositories
  - `presentation/` — controllers and services
  - Key entities: `Trip`, `Receipt`, `HarvestArea`, `WeighingStation`, `DriverProfile`, `Vehicle`, `DriverLocation`, `VehicleLocation`, `FinanceRecord`
- **`auth/`**, **`auth-google/`**, **`auth-apple/`** — JWT + OAuth strategies
- **`users/`** — user profiles, role assignment
- **`files/`** — S3 upload, presigned URLs
- **`notifications/`** — Expo push notifications, BullMQ worker
- **`database/`** — TypeORM config, migrations, seeds
- **`analytics/`** — dashboard aggregations
- **`config/`** — typed environment config (uses `env.example`)
- **`logging/`** — Better Stack structured logging

All routes are under `/api/v1/`. Role-based guards enforce `driver` vs `owner` vs `admin` access.

### App (`keo-app/`)

File-based routing via Expo Router:

```
app/
  index.tsx                  # Entry/redirect
  (auth)/                    # Login screens
  (app)/
    _layout.tsx              # Main layout with auth guard
    (tabs)/                  # Bottom tab navigator
      index.tsx              # Home / dashboard
      drivers.tsx            # Owner: driver list + live map
      harvest-areas.tsx
      weighing-stations.tsx
      receipt-approval.tsx   # Owner: approve/reject receipts
      vehicles.tsx
      settings.tsx
    driver/                  # Driver-specific screens
    receipt/                 # Receipt creation/detail
    harvest-area/
    ...
lib/
  api/         # All API client functions (one file per domain)
  auth/        # Auth state and token storage
  types/       # Shared TypeScript interfaces (mirrors backend DTOs)
  tracking/    # Background GPS logic
  push/        # Push notification registration
  config.ts    # API base URL from env
```

### Data flow

```
Mobile App (keo-app)
    ↓  REST + JWT
NestJS API (keo-be)
    ↓
PostgreSQL (TypeORM) + Redis (BullMQ + location cache)
    ↓ background workers
Push notifications (Expo SDK) + Email (Nodemailer)
```

### Key business flows

- **Trip lifecycle:** `planned` → `in_progress` → `completed` / `cancelled`. GPS is logged to `vehicle_locations` throughout.
- **Receipt lifecycle:** submitted → `pending` (owner review) → `approved` / `rejected`. Approval triggers finance record creation and trip stat updates.
- **Live tracking:** driver app POSTs GPS every ~10–60 s; backend caches last-known position in Redis; owner app polls `/owner/drivers/locations/latest`.

---

## Contracts and documentation

| Source | Role |
| ------ | ---- |
| `docs/business.md` | BRD: user roles, business rules, feature list |
| `docs/postman/keotram-ops-api.postman_collection.json` | Request/response examples; `baseUrl` includes `/api/v1` |
| `keo-be/KEO_Ops_database.md` | Full DB schema with relationships |

When API behavior is unclear, check this priority order: Postman collection → `docs/business.md` → controller/DTO source in `keo-be/`.

---

## CI

`.github/workflows/ci.yml` runs on push/PR to `main`:
- `keo-app`: `npm ci` + `npm run lint`
- `keo-be`: `npm ci` + `npm run lint` + `npm test`

Lint and tests must pass before merging.

---

## Subtree sync

`keo-app` and `keo-be` are git subtrees from their own repos:
```bash
git fetch keo-app main && git subtree pull --prefix=keo-app keo-app main -m "Sync keo-app"
git fetch keo-be main  && git subtree pull --prefix=keo-be  keo-be  main -m "Sync keo-be"
```
