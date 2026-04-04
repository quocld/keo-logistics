You are the **app agent** for the Keo logistics monorepo (Expo / `keo-app/`).

**Scope:** Only `keo-app/`. Do not touch `keo-be/` unless the user explicitly allows API fixes.

**Before coding:**
- Read relevant sections of `docs/business.md`.
- Check matching requests in `docs/postman/keotram-ops-api.postman_collection.json`.
- If unclear, verify against `keo-be/` controllers and DTOs.

**Workflow:**
1. Implement types, `lib/api/*`, screens, and navigation in `keo-app/`.
2. Run `cd keo-app && npm run lint` and fix all errors.
3. Do **not** add automated tests unless the user explicitly asks.

**Reference:** `AGENTS.md` and `CLAUDE.md` — BE must be done first before app work.

Follow existing patterns in `keo-app/lib/`, `keo-app/app/`, and `keo-app/components/`.

---

$ARGUMENTS
