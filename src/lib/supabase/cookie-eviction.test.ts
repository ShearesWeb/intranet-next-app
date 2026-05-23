import { describe, expect, it } from "vitest";
import { extractSupabaseProjref, findForeignSupabaseCookies } from "./cookie-eviction";

describe("extractSupabaseProjref", () => {
	it("returns the first hostname label of a supabase.co URL", () => {
		expect(extractSupabaseProjref("https://mlklfakrvuvkftgowzts.supabase.co")).toBe(
			"mlklfakrvuvkftgowzts",
		);
	});

	it("returns null for a non-URL string", () => {
		expect(extractSupabaseProjref("")).toBeNull();
		expect(extractSupabaseProjref("not a url")).toBeNull();
	});

	it("returns null for a URL whose hostname is not a supabase.co subdomain", () => {
		expect(extractSupabaseProjref("https://example.com")).toBeNull();
	});
});

describe("findForeignSupabaseCookies", () => {
	const currentRef = "mlklfakrvuvkftgowzts";

	it("flags sb-<otherref>-* cookies as foreign", () => {
		const names = ["sb-fekyehxztmfdnuknfmeq-auth-token.0", "sb-fekyehxztmfdnuknfmeq-auth-token.1"];
		expect(findForeignSupabaseCookies(names, currentRef)).toEqual(names);
	});

	it("preserves cookies for the current projref", () => {
		const names = [
			`sb-${currentRef}-auth-token.0`,
			`sb-${currentRef}-auth-token.1`,
			`sb-${currentRef}-auth-token-code-verifier`,
		];
		expect(findForeignSupabaseCookies(names, currentRef)).toEqual([]);
	});

	it("ignores non-sb cookies entirely", () => {
		const names = ["sidebar:state", "ph_phc_abc", "__next_hmr_refresh_hash__"];
		expect(findForeignSupabaseCookies(names, currentRef)).toEqual([]);
	});

	it("does not flag malformed sb-* cookies (no second hyphen)", () => {
		expect(findForeignSupabaseCookies(["sb-", "sb-foo"], currentRef)).toEqual([]);
	});

	it("returns only the foreign ones when mixed input given", () => {
		const names = [
			`sb-${currentRef}-auth-token.0`,
			"sb-jsajbspexukgtnqczppq-auth-token.0",
			"sidebar:state",
			"sb-qxpkcpncqimbdbcxbdrq-auth-token-code-verifier",
		];
		expect(findForeignSupabaseCookies(names, currentRef)).toEqual([
			"sb-jsajbspexukgtnqczppq-auth-token.0",
			"sb-qxpkcpncqimbdbcxbdrq-auth-token-code-verifier",
		]);
	});

	it("returns empty array when currentRef is null (defensive: never evict)", () => {
		const names = ["sb-foreign-auth-token.0"];
		expect(findForeignSupabaseCookies(names, null)).toEqual([]);
	});
});
