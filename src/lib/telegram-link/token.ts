const LINK_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function isLinkToken(value: unknown): value is string {
	return typeof value === "string" && LINK_TOKEN_PATTERN.test(value);
}
