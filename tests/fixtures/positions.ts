import type { PositionDef } from "./types";

// Position graph per CCA.
//
// Sports/culture CCAs (Volleyball, Basketball, Choir, Dance, Drama):
//   lead (no parent)
//   ├── vice (no children — keeps Alexis's flags off)
//   ├── team manager (no children — keeps Chloe's flags off, per spec § 5.2)
//   └── member (no children)
//
// Committee CCAs (SHWEB, SECC):
//   lead (no parent)
//   └── maincomm
//       └── subcomm (no children)
//
// JCRC:
//   maincomm (no parent — JCRC has no lead, per spec § 5.3)
//   └── blockcomm (no children — keeps Jasper's is_admin off; only is_jcrc)
//
// Derived-flag consequences (asserted in smoke test):
// - "lead" in any non-JCRC CCA → has children → is_admin = true
//   For culture/sports CCAs → also is_culture_sports_admin = true
// - "maincomm" in committee/JCRC → has children (subcomm/blockcomm) → is_admin = true
//   In JCRC → also is_jcrc; never is_culture_sports_admin (cca_type != culture/sports)
// - "vice", "team manager", "subcomm", "blockcomm", "member", "resident" → no children → no flags from chain.
//   `is_jcrc` still derives from CCA membership alone for anyone with a JCRC appointment.

export const POSITIONS: readonly PositionDef[] = [
	// Volleyball
	{ ccaKey: "volleyball", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "volleyball", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "volleyball", positionType: "team manager", name: "Team Manager", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "volleyball", positionType: "member", name: "Player", reportsTo: "Captain", capacity: 12 },

	// Basketball
	{ ccaKey: "basketball", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "basketball", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "basketball", positionType: "team manager", name: "Team Manager", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "basketball", positionType: "member", name: "Player", reportsTo: "Captain", capacity: 12 },

	// Choir
	{ ccaKey: "choir", positionType: "lead", name: "Conductor", reportsTo: null, capacity: 1 },
	{ ccaKey: "choir", positionType: "vice", name: "Vice Conductor", reportsTo: "Conductor", capacity: 1 },
	{ ccaKey: "choir", positionType: "member", name: "Chorister", reportsTo: "Conductor", capacity: 20 },

	// Dance
	{ ccaKey: "dance", positionType: "lead", name: "Captain", reportsTo: null, capacity: 1 },
	{ ccaKey: "dance", positionType: "vice", name: "Vice Captain", reportsTo: "Captain", capacity: 1 },
	{ ccaKey: "dance", positionType: "member", name: "Dancer", reportsTo: "Captain", capacity: 20 },

	// Drama
	{ ccaKey: "drama", positionType: "lead", name: "Director", reportsTo: null, capacity: 1 },
	{ ccaKey: "drama", positionType: "vice", name: "Assistant Director", reportsTo: "Director", capacity: 1 },
	{ ccaKey: "drama", positionType: "member", name: "Cast", reportsTo: "Director", capacity: 15 },

	// SHWEB
	{ ccaKey: "shweb", positionType: "lead", name: "President", reportsTo: null, capacity: 1 },
	{ ccaKey: "shweb", positionType: "maincomm", name: "Maincomm", reportsTo: "President", capacity: 5 },
	{ ccaKey: "shweb", positionType: "subcomm", name: "Subcomm", reportsTo: "Maincomm", capacity: 15 },

	// SECC
	{ ccaKey: "secc", positionType: "lead", name: "President", reportsTo: null, capacity: 1 },
	{ ccaKey: "secc", positionType: "maincomm", name: "Maincomm", reportsTo: "President", capacity: 5 },
	{ ccaKey: "secc", positionType: "subcomm", name: "Subcomm", reportsTo: "Maincomm", capacity: 15 },

	// JCRC — top is maincomm, not lead
	{ ccaKey: "jcrc", positionType: "maincomm", name: "Maincomm", reportsTo: null, capacity: 5 },
	{ ccaKey: "jcrc", positionType: "blockcomm", name: "Blockcomm", reportsTo: "Maincomm", capacity: 10 },
] as const;

export function findPosition(ccaKey: string, positionName: string): PositionDef {
	const pos = POSITIONS.find((p) => p.ccaKey === ccaKey && p.name === positionName);
	if (!pos) throw new Error(`Unknown position: ${ccaKey}/${positionName}`);
	return pos;
}
