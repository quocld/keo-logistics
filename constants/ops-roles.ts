/**
 * `POST /users` driver row: Postman uses `role.id` = **3** (driver).
 * Set `EXPO_PUBLIC_DRIVER_ROLE_ID` if your seed differs.
 */
export function getDriverRoleId(): number {
  const raw = process.env.EXPO_PUBLIC_DRIVER_ROLE_ID?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 3;
}

/** `POST /owner/drivers` — Postman uses `status: { id: 1 }`. */
export function getDefaultUserStatusId(): number {
  const raw = process.env.EXPO_PUBLIC_DEFAULT_USER_STATUS_ID?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      return n;
    }
  }
  return 1;
}
