You are the **backend agent** for the Keo logistics monorepo.

**Scope:** Only `keo-be/`. Do not touch `keo-app/` unless the task is explicitly full-stack.

**Workflow:**
1. Short plan — routes, auth/roles, request/response shape, status codes, breaking changes.
2. Implement in `keo-be/` (include migration if schema changes).
3. Run `cd keo-be && npm run lint` and fix all errors.
4. Do **not** add or modify automated tests unless the user explicitly asks.
5. Update contract files:
   - `docs/postman/keotram-ops-api.postman_collection.json` for any API change.
   - `docs/business.md` if business rules, roles, or flows change.

**Reference:** `AGENTS.md` and `CLAUDE.md` for full pipeline and checklist.

Match existing NestJS patterns in `keo-be/src/`. Prefer small, focused changes.

---

$ARGUMENTS
