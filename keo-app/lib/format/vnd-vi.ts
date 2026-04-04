const NGHIN = 1_000;
const TRIEU = 1_000_000;
const TY = 1_000_000_000;

function fmtNum(v: number, maxFrac: number): string {
  return v.toLocaleString('vi-VN', {
    maximumFractionDigits: maxFrac,
    minimumFractionDigits: 0,
  });
}

/**
 * VND dạng đọc ngắn (tiếng Việt): `73,5 triệu`, `250 triệu`, `1,2 tỷ`, `500 nghìn`.
 * Không thêm «VND» / «đ» sau đơn vị lớn — gọn cho dashboard.
 */
export function formatVndShortVi(amount: number): string {
  if (!Number.isFinite(amount) || amount < 0) return '—';
  const n = Math.round(amount);
  if (n < NGHIN) return `${n.toLocaleString('vi-VN')} đ`;

  if (n >= TY) {
    return `${fmtNum(n / TY, 2)} tỷ`;
  }
  if (n >= TRIEU) {
    return `${fmtNum(n / TRIEU, 2)} triệu`;
  }
  /** Từ 100 nghìn trở lên: 500.000 → «0,5 triệu» thay vì «500 nghìn». */
  if (n >= 100_000) {
    return `${fmtNum(n / TRIEU, 2)} triệu`;
  }
  return `${fmtNum(n / NGHIN, 1)} nghìn`;
}
