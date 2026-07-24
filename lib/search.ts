const POSTGREST_FILTER_META = /[%_,().*]/g;

/**
 * Keep Supabase/PostgREST filter strings boring. The JS client does not
 * parameterize `.or()` expressions, so user search terms must be normalized
 * before being interpolated into filter syntax.
 */
export function safeSearchTerm(input: string, maxLength = 80) {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(POSTGREST_FILTER_META, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function safeIlikePattern(input: string, maxLength = 80) {
  const term = safeSearchTerm(input, maxLength);
  return term ? `%${term}%` : '';
}
