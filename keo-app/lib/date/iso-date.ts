/** Parse API / form value `YYYY-MM-DD` to local calendar date (noon) to avoid TZ drift. */
export function parseIsoDateToLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

/** Format local date as `YYYY-MM-DD` for API payloads. */
export function toIsoDateString(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Short Vietnamese display e.g. 15/3/2026 */
export function formatIsoDateVi(iso: string): string {
  const d = parseIsoDateToLocal(iso);
  if (!d) return '';
  return d.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
}
