-- Test-only wiring (run by `make db-up`): point auth.email() at the JWT claims
-- so RLS resolves the persona, and create the authenticator role PostgREST uses.

CREATE OR REPLACE FUNCTION auth.email() RETURNS text LANGUAGE sql STABLE AS $func$
	SELECT coalesce(
		nullif(current_setting('request.jwt.claim.email', true), ''),
		(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
	)::text
$func$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
		CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'postgres';
	END IF;
END $$;

GRANT anon, authenticated, service_role TO authenticator;
