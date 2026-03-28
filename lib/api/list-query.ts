export function buildListQuery(params: {
  page: number;
  limit: number;
  filters?: Record<string, unknown>;
  extra?: Record<string, string | undefined>;
}): string {
  const q = new URLSearchParams();
  q.set('page', String(params.page));
  q.set('limit', String(params.limit));
  if (params.filters && Object.keys(params.filters).length > 0) {
    q.set('filters', JSON.stringify(params.filters));
  }
  if (params.extra) {
    for (const [k, v] of Object.entries(params.extra)) {
      if (v !== undefined && v !== '') {
        q.set(k, v);
      }
    }
  }
  return q.toString();
}
