# keo-logistics

Monorepo gồm app (Expo) và API (NestJS).

| Thư mục   | Mô tả        |
| --------- | ------------ |
| `keo-app` | Ứng dụng mobile / web (Expo) |
| `keo-be`  | Backend NestJS |

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
