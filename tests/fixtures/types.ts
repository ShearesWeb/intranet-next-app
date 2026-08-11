// Single source of truth — types shared by personas.ts, ccas.ts, positions.ts, and generate.ts.
// Mirrors the public schema from vendor/intranet/db/changelogs/.

/** `enum.cca_kind`. Called `cca_type` before the refactor; that name now means something else. */
export type CcaKind = "sports" | "culture" | "committee" | "jcrc" | "adhoc" | "supplementary";

/** `enum.cca_tier`. Values gained hyphens in the refactor. */
export type CcaTier = "tier-1" | "tier-2" | "none";

export type PositionType =
	| "lead"
	| "vice"
	| "blockcomm"
	| "maincomm"
	| "subcomm"
	| "team-manager"
	| "member"
	| "resident";

export type StayPeriod = "full-year" | "semester-1" | "semester-2";

export type Block = "A" | "B" | "C" | "D" | "E";

// Keys are stable string identifiers used as references; they are NOT inserted into the DB.
export type CcaKey =
	| "volleyball"
	| "basketball"
	| "choir"
	| "dance"
	| "drama"
	| "shweb"
	| "secc"
	| "jcrc";

export type Cca = {
	key: CcaKey;
	name: string;
	kind: CcaKind;
	tier: CcaTier;
	description: string;
};

// A position record. `reportsTo` is the position name (within the same CCA) this reports to.
// "lead" positions typically have `reportsTo: null`. JCRC's top is "maincomm" with `reportsTo: null`.
export type PositionDef = {
	ccaKey: CcaKey;
	positionType: PositionType;
	name: string; // human-readable name, unique within CCA (matches users.room — name unique per cca_id constraint)
	reportsTo: string | null; // name of another position in the same CCA, or null for the top
	capacity: number | null;
};

export type Appointment = {
	ccaKey: CcaKey;
	positionName: string; // matches PositionDef.name in the same CCA
	points: number;
};

export type PersonaKey =
	| "anonymous"
	| "aria"
	| "mason"
	| "chloe"
	| "declan"
	| "alexis"
	| "sienna"
	| "kai"
	| "harper"
	| "ezra"
	| "layla"
	| "jasper"
	| "brielle"
	| "nova"
	| "willow"
	| "sage";

/**
 * Role predicates as the schema now derives them.
 *
 * `is_chair` and `is_jcrc` come straight off `my_profile`. The old `is_admin`
 * flag had exactly `is_chair`'s meaning — the caller manages at least one
 * position — so it maps across unchanged. `is_culture_sports_chair` is app
 * policy derived from `my_profile.appointments`, not a column.
 */
export type ExpectedDerivedFlags = {
	is_chair: boolean;
	is_jcrc: boolean;
	is_culture_sports_chair: boolean;
};

export type Persona = {
	key: PersonaKey;
	// `anonymous` is the unauthenticated sentinel — has no user row.
	email: string | null;
	name: string | null;
	matric: string | null; // NUS format, e.g. "A0123456X"
	room: string | null; // canonical "SH/<block>/<floor>/<unit>" form
	stayPeriod: StayPeriod;
	appointments: Appointment[];
	expected: ExpectedDerivedFlags;
};
