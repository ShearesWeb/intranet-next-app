// Domain factories + lookup helpers for integration tests. Every builder here
// is imported by at least one test under tests/integration/**. IDs in the seeded
// DB are NOT stable across reseeds (sequences advance), so tests resolve them at
// runtime by name/email rather than hard-coding them.

import type { PersonaPgClient } from "./pg-client";

// ---------------------------------------------------------------------------
// Runtime ID lookups (run as the persona client — these target public-SELECT
// tables: users, ccas, cca_positions are all readable by every role).
// ---------------------------------------------------------------------------

// The `authenticated` role is granted SELECT on users.email (directory
// projection), so an authenticated persona client can resolve ids by email.
export async function userIdByEmail(client: PersonaPgClient, email: string): Promise<number> {
	const r = await client.query("SELECT id FROM users WHERE email = $1", [email]);
	if (!r.rows[0]) throw new Error(`No user with email ${email}`);
	return r.rows[0].id as number;
}

export async function positionId(
	client: PersonaPgClient,
	ccaName: string,
	positionName: string,
): Promise<number> {
	const r = await client.query(
		`SELECT cp.id
		   FROM cca_positions cp
		   JOIN ccas c ON c.id = cp.cca_id
		  WHERE c.name = $1 AND cp.name = $2`,
		[ccaName, positionName],
	);
	if (!r.rows[0]) throw new Error(`No position ${positionName} in CCA ${ccaName}`);
	return r.rows[0].id as number;
}

// ---------------------------------------------------------------------------
// Privileged seeding inside a persona transaction.
//
// pgClientAsPersona issues `SET ROLE authenticated` (or anon) at construction.
// Because it is a single pg connection, we can temporarily `RESET ROLE` to the
// owning superuser to seed prerequisite rows, then restore the persona role —
// all inside one BEGIN/ROLLBACK so nothing leaks. Used to set up rows the
// persona under test could not (or should not be able to) create themselves.
// ---------------------------------------------------------------------------

export async function asOwner<T>(
	client: PersonaPgClient,
	personaEmail: string | null,
	body: () => Promise<T>,
): Promise<T> {
	await client.query("RESET ROLE");
	try {
		return await body();
	} finally {
		if (personaEmail === null) {
			await client.query("SET ROLE anon");
		} else {
			await client.query("SET ROLE authenticated");
		}
	}
}

export type SubsidyEnvelopeOverrides = {
	positionId: number;
	day?: string;
	hours?: number;
	status?: "pending" | "approved" | "rejected";
	createdBy: number;
};

// Seeds a cca_subsidies envelope as the table owner and returns its id. The
// caller must already be inside a transaction and have RESET ROLE (see asOwner).
export async function insertSubsidyEnvelope(
	client: PersonaPgClient,
	o: SubsidyEnvelopeOverrides,
): Promise<number> {
	const r = await client.query(
		`INSERT INTO cca_subsidies (position_id, day, hours, status, created_by)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		[o.positionId, o.day ?? "2026-01-15", o.hours ?? 4, o.status ?? "pending", o.createdBy],
	);
	return r.rows[0].id as number;
}

export type UserSubsidyOverrides = {
	subsidyId: number;
	userId: number;
	hours?: number;
	createdBy: number;
};

// Seeds a cca_user_subsidies row as owner. The parent envelope must already be
// 'approved' (a trigger enforces this). Returns the new row id.
export async function insertUserSubsidy(
	client: PersonaPgClient,
	o: UserSubsidyOverrides,
): Promise<number> {
	const r = await client.query(
		`INSERT INTO cca_user_subsidies (subsidy_id, user_id, hours, created_by)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		[o.subsidyId, o.userId, o.hours ?? 2, o.createdBy],
	);
	return r.rows[0].id as number;
}
