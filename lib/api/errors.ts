const MAX_USER_MESSAGE_LEN = 4000;

function truncateForDisplay(s: string): string {
  const t = s.trim();
  if (t.length <= MAX_USER_MESSAGE_LEN) return t;
  return `${t.slice(0, MAX_USER_MESSAGE_LEN)}…`;
}

/**
 * Builds a readable message from typical NestJS / class-validator error JSON.
 */
export function formatApiErrorPayload(
  data: unknown,
  fallbackStatusText: string,
  statusCode?: number,
): string {
  const lines: string[] = [];

  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;

    const m = o.message;
    if (typeof m === 'string' && m.trim()) {
      lines.push(m.trim());
    } else if (Array.isArray(m)) {
      const msgs = m.map((x) => String(x).trim()).filter(Boolean);
      if (msgs.length) lines.push(msgs.join('\n'));
    }

    const nested = o.errors;
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      const fieldLines: string[] = [];
      for (const [key, v] of Object.entries(nested as Record<string, unknown>)) {
        if (Array.isArray(v)) {
          for (const item of v) {
            fieldLines.push(`${key}: ${String(item)}`);
          }
        } else if (v != null) {
          fieldLines.push(`${key}: ${String(v)}`);
        }
      }
      if (fieldLines.length) lines.push(fieldLines.join('\n'));
    }

    if (lines.length === 0) {
      const err = o.error;
      if (typeof err === 'string' && err.trim()) {
        lines.push(err.trim());
      }
    }
  }

  if (lines.length === 0) {
    const code = statusCode != null ? `${statusCode} ` : '';
    const base = fallbackStatusText?.trim() || 'Request failed';
    return truncateForDisplay(`${code}${base}`.trim());
  }

  const prefix = statusCode != null ? `[${statusCode}] ` : '';
  return truncateForDisplay(prefix + lines.join('\n\n'));
}

/**
 * Parse response body text and format API errors; non-JSON bodies return a trimmed snippet.
 */
export function formatApiErrorFromJsonText(
  text: string,
  fallbackStatusText: string,
  statusCode?: number,
): string {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    return formatApiErrorPayload(null, fallbackStatusText, statusCode);
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    return formatApiErrorPayload(parsed, fallbackStatusText, statusCode);
  } catch {
    return truncateForDisplay(trimmed);
  }
}

/** Stable message for `catch` / Alert bodies. */
export function getErrorMessage(e: unknown, fallback = 'Đã xảy ra lỗi'): string {
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  if (typeof e === 'string' && e.trim()) return e.trim();
  return fallback;
}
