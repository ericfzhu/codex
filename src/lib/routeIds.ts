import type { ParsedUrlQuery } from 'querystring';

/** Parse an optional item ID from a Next.js query string. */
export function parseItemId(value: ParsedUrlQuery[string]): number | null {
	if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
	const id = Number(value);
	return Number.isSafeInteger(id) ? id : null;
}

export function isValidItemId(id: number | null, itemCount: number): id is number {
	return id !== null && id >= 0 && id < itemCount;
}
