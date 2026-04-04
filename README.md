# keo-logistics

Monorepo gồm app (Expo) và API (NestJS).

| Thư mục   | Mô tả        |
| --------- | ------------ |
| `keo-app` | Ứng dụng mobile / web (Expo) |
| `keo-be`  | Backend NestJS |
| `docs`    | BRD / product spec + Postman collection (KeoTram Ops API) |

Quy trình làm việc với AI (BE trước → App sau): [`AGENTS.md`](AGENTS.md), `.cursor/rules/` (context theo file), `.cursor/agents/` (subagent: `backend-agent`, `app-agent`, `reviewer-agent`).

## Tài liệu

- [BRD — KeoTram Ops](docs/business.md)
- Postman: import [`docs/postman/keotram-ops-api.postman_collection.json`](docs/postman/keotram-ops-api.postman_collection.json) và cấu hình biến `baseUrl` (thường kèm `/api/v1`).
- Schema DB (chi tiết): [`keo-be/KEO_Ops_database.md`](keo-be/KEO_Ops_database.md) — bản trong `keo-app/` có thể lệch; nên đối chiếu migration thực tế trong `keo-be/`.

## Chạy local

```bash
# App
cd keo-app && npm install && npm start

# API (xem README / env trong keo-be)
cd keo-be && npm install && npm run start:dev
```

## Đồng bộ từ repo cũ (git subtree)

Nếu vẫn phát triển song song trên `keo-app` / `keo-be` riêng:

```bash
git fetch keo-app main && git subtree pull --prefix=keo-app keo-app main -m "Sync keo-app"
git fetch keo-be main && git subtree pull --prefix=keo-be keo-be main -m "Sync keo-be"
```

## CI

GitHub Actions (`.github/workflows/ci.yml`): lint + test cho từng package khi push/PR vào `main`.
