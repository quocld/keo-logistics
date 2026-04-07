/**
 * Diễn đạt giờ kiểu nói thường (vd. 5 giờ sáng, 4 giờ chiều).
 * Dùng giờ local của thiết bị theo `Date`.
 */
export function formatViHourPhrase(d: Date): string {
  const h = d.getHours();
  const m = d.getMinutes();

  let phrase: string;
  if (h === 0) {
    phrase = '12 giờ đêm';
  } else if (h >= 1 && h <= 4) {
    phrase = `${h} giờ sáng`;
  } else if (h >= 5 && h <= 11) {
    phrase = `${h} giờ sáng`;
  } else if (h === 12) {
    phrase = '12 giờ trưa';
  } else if (h >= 13 && h <= 17) {
    phrase = `${h - 12} giờ chiều`;
  } else if (h >= 18 && h <= 21) {
    phrase = `${h - 12} giờ tối`;
  } else {
    phrase = `${h - 12} giờ đêm`;
  }

  if (m === 0) return phrase;
  return `${phrase} ${m} phút`;
}

export function parseReceiptDateTime(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Ngày dạng 8/4/2026 + giờ kiểu nói (vd. 4 giờ chiều 15 phút) */
export function formatReceiptDateAndTimeVi(raw: unknown): { dateLine: string; timeLine: string } {
  const d = parseReceiptDateTime(raw);
  if (!d) {
    return { dateLine: '—', timeLine: '' };
  }
  const dateLine = d.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });
  const timeLine = formatViHourPhrase(d);
  return { dateLine, timeLine };
}
