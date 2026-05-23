/**
 * Unwrap a Supabase relation join that may come back as an array, a single
 * object, or null/undefined depending on the join cardinality and whether the
 * FK is nullable.
 *
 * Supabase PostgREST returns `{ fk_table: { ... } }` for to-one joins but
 * sometimes wraps it in an array `{ fk_table: [{ ... }] }` depending on the
 * query shape. This helper normalises both forms to a single value or null.
 */
export function unwrapRelation<T>(value: T | T[] | null | undefined): T | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}
