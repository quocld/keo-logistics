# Keo logistics — hướng dẫn agent / quy trình monorepo

Tài liệu này mô tả **thứ tự và trách nhiệm** khi làm feature chạm API. Cursor **không** tự chạy agent nền; áp dụng bằng cách mở đúng package, dùng **rules** `.cursor/rules/`, gọi **subagent** trong `.cursor/agents/` (ví dụ nhờ dùng subagent `backend-agent` / `app-agent` / `reviewer-agent`), hoặc `@AGENTS.md` trong chat.

## Nguồn contract (ưu tiên)

| Tài liệu | Vai trò |
| -------- | ------- |
| [`docs/business.md`](docs/business.md) | BRD, luồng nghiệp vụ, quyền, đối chiếu backend |
| [`docs/postman/keotram-ops-api.postman_collection.json`](docs/postman/keotram-ops-api.postman_collection.json) | Request/response mẫu, biến `baseUrl` (thường có `/api/v1`) |
| `keo-be/` (controller, DTO, entity) | Nguồn thực thi khi Postman/BRD chưa đủ chi tiết |

## Luồng 1 — Backend trước (`keo-be/`)

Dùng khi thêm/sửa API, DB, migration, rule server.

1. **Plan** (ngắn): endpoint, method, auth/role, body/query, status code, breaking change hay không.
2. **Implement** trong `keo-be/` (kèm migration nếu đổi schema).
3. **Lint:** `cd keo-be && npm run lint` — sửa hết lỗi trước khi coi xong.
4. **Không** thêm hoặc sửa test tự động (unit/e2e) trừ khi task nói rõ.
5. **Cập nhật contract:**
   - Postman: sửa [`docs/postman/keotram-ops-api.postman_collection.json`](docs/postman/keotram-ops-api.postman_collection.json) cho đúng API mới/thay đổi.
   - BRD: sửa [`docs/business.md`](docs/business.md) nếu đổi luồng nghiệp vụ, quyền, hoặc mục đối chiếu backend.

**Không** sửa `keo-app/` trong vai trò chỉ-backend trừ khi task yêu cầu full-stack.

## Luồng 2 — App sau (`keo-app/`)

Chỉ sau khi BE + Postman (+ BRD nếu cần) đã phản ánh đúng thay đổi.

1. **Đọc** `docs/business.md` và phần tương ứng trong Postman collection (hoặc đối chiếu DTO/controller trong `keo-be/`).
2. **Implement** types, `lib/api/*`, màn hình / navigation trong `keo-app/`.
3. **Lint:** `cd keo-app && npm run lint`.
4. **Không** thêm test tự động trừ khi task nói rõ.

**Không** sửa `keo-be/` trong vai trò chỉ-app trừ khi phát hiện lỗi API và task cho phép sửa BE.

## Checklist PR / handoff

- [ ] BE: code + `npm run lint` trong `keo-be`
- [ ] `docs/postman/…` (+ `docs/business.md` nếu ảnh hưởng nghiệp vụ)
- [ ] App: code + `npm run lint` trong `keo-app`

## CI

GitHub Actions có thể vẫn chạy test/lint toàn repo — đó là gate merge, độc lập với quy ước “agent không viết test” ở trên.
