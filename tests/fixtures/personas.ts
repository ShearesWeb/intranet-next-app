import type { Persona } from "./types";

// Spec § 5.2 — 15 personas + anonymous. Rooms use canonical SH/<block>/<floor>/<unit> form.
// `expected` flags must match what the `authenticated_user_roles` view computes from
// the position graph in positions.ts. Drift fails the Task 11 smoke test.
export const PERSONAS: readonly Persona[] = [
	{
		key: "anonymous",
		email: null,
		name: null,
		matric: null,
		room: null,
		stayPeriod: "full-year",
		appointments: [],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "aria",
		email: "aria.tan.sg@gmail.com",
		name: "Aria Tan",
		matric: "A0250001A",
		room: "SH/A/2/203",
		stayPeriod: "full-year",
		appointments: [],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "mason",
		email: "mason.lim.99@gmail.com",
		name: "Mason Lim",
		matric: "A0250002B",
		room: "SH/B/3/315",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Player", points: 0 }],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "chloe",
		email: "chloe.ng.j@gmail.com",
		name: "Chloe Ng",
		matric: "A0250003C",
		room: "SH/C/1/108",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Team Manager", points: 0 }],
		// team manager has no children in the graph → no admin flag
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "declan",
		email: "declanho.sg@gmail.com",
		name: "Declan Ho",
		matric: "A0250004D",
		room: "SH/A/4/412",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Captain", points: 0 }],
		// lead has children (vice, team manager, member) → is_admin; sports → is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "alexis",
		email: "alexis.goh.99@gmail.com",
		name: "Alexis Goh",
		matric: "A0250005E",
		room: "SH/D/2/202",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "volleyball", positionName: "Vice Captain", points: 0 }],
		// vice has members reporting to it → is_admin; Volleyball is sports → is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "sienna",
		email: "sienna.lee.j@gmail.com",
		name: "Sienna Lee",
		matric: "A0250006F",
		room: "SH/B/2/210",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "choir", positionName: "Chorister", points: 0 }],
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "kai",
		email: "kai.koh.96@gmail.com",
		name: "Kai Koh",
		matric: "A0250007G",
		room: "SH/C/4/401",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "choir", positionName: "Conductor", points: 0 }],
		// lead Choir (culture) → is_admin + is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "harper",
		email: "harper.tan.2k@gmail.com",
		name: "Harper Tan",
		matric: "A0250008H",
		room: "SH/E/1/115",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "Subcomm", points: 0 }],
		// subcomm has no children → no flags
		expected: { is_admin: false, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "ezra",
		email: "ezrasim.nus@gmail.com",
		name: "Ezra Sim",
		matric: "A0250009I",
		room: "SH/A/3/301",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "Maincomm", points: 0 }],
		// maincomm has subcomm child → is_admin. SHWEB is committee, not culture/sports → not CSA
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "layla",
		email: "layla.ng.97@gmail.com",
		name: "Layla Ng",
		matric: "A0250010J",
		room: "SH/D/4/405",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "shweb", positionName: "President", points: 0 }],
		// lead SHWEB (committee) → is_admin only, NOT is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: false },
	},
	{
		key: "jasper",
		email: "jasper.chua.sg@gmail.com",
		name: "Jasper Chua",
		matric: "A0250011K",
		room: "SH/B/4/406",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "jcrc", positionName: "Blockcomm", points: 0 }],
		// blockcomm has no children → no admin; any JCRC appointment → is_jcrc
		expected: { is_admin: false, is_jcrc: true, is_culture_sports_admin: false },
	},
	{
		key: "brielle",
		email: "brielle.koh.j@gmail.com",
		name: "Brielle Koh",
		matric: "A0250012L",
		room: "SH/C/3/312",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "jcrc", positionName: "Maincomm", points: 0 }],
		// maincomm JCRC has blockcomm child → is_admin; JCRC → is_jcrc; not culture/sports
		expected: { is_admin: true, is_jcrc: true, is_culture_sports_admin: false },
	},
	{
		key: "nova",
		email: "nova.tay.sg@gmail.com",
		name: "Nova Tay",
		matric: "A0250013M",
		room: "SH/A/1/105",
		stayPeriod: "full-year",
		appointments: [
			{ ccaKey: "basketball", positionName: "Captain", points: 0 },
			{ ccaKey: "secc", positionName: "Subcomm", points: 0 },
		],
		// lead Basketball (sports) → is_admin + is_culture_sports_admin
		// subcomm SECC has no children → contributes nothing
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "willow",
		email: "willow.rahman.gg@gmail.com",
		name: "Willow Rahman",
		matric: "A0250014N",
		room: "SH/D/1/108",
		stayPeriod: "full-year",
		appointments: [{ ccaKey: "dance", positionName: "Captain", points: 0 }],
		// lead Dance (culture) → is_admin + is_culture_sports_admin
		expected: { is_admin: true, is_jcrc: false, is_culture_sports_admin: true },
	},
	{
		key: "sage",
		email: "sage.lim.97@gmail.com",
		name: "Sage Lim",
		matric: "A0250015O",
		room: "SH/E/3/305",
		stayPeriod: "full-year",
		appointments: [
			{ ccaKey: "drama", positionName: "Director", points: 0 },
			{ ccaKey: "jcrc", positionName: "Maincomm", points: 0 },
		],
		// lead Drama (culture) → is_admin + is_culture_sports_admin
		// maincomm JCRC → is_admin (additive, same flag); is_jcrc
		expected: { is_admin: true, is_jcrc: true, is_culture_sports_admin: true },
	},
] as const;

export function personaByKey(key: string): Persona {
	const p = PERSONAS.find((x) => x.key === key);
	if (!p) throw new Error(`Unknown persona key: ${key}`);
	return p;
}

export function authenticatedPersonas(): readonly Persona[] {
	return PERSONAS.filter((p) => p.email !== null);
}
