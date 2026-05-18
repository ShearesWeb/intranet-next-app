export interface FaqItem {
	id: string;
	question: string;
	answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
	{
		id: "faq-1",
		question: "What happens if I miss the Tuesday 23:59 weekly submission?",
		answer:
			"The week locks permanently and cannot be edited. The subsidy for that week becomes void unless JCRC grants an exception.",
	},
	{
		id: "faq-2",
		question: "Can I edit the initial subsidy declaration after submitting it?",
		answer:
			"Yes. You can edit declarations at any time, even after JCRC approval. However, editing an approved declaration will reset its status to 'Pending' and require JCRC to re-approve it.",
	},
	{
		id: "faq-3",
		question: "Can I increase a member's actual weekly hours later?",
		answer:
			"Yes, it is allowed, but do not expect the holiday subsidy to be approved. JCRC may reject it if the increase is unreasonable.",
	},
	{
		id: "faq-4",
		question: "What is considered a sound justification?",
		answer:
			"Valid examples include training schedules, competitions and events, hall events such as orientation, dry runs, and preparation work. Missing justification or vague reasons may lead to rejection.",
	},
	{
		id: "faq-5",
		question: "What if a member does not attend any sessions?",
		answer: "Set their hours to 0 for the affected week and add a remark.",
	},
	{
		id: "faq-6",
		question: "Can members view their hours?",
		answer:
			"No. Members cannot view their weekly hours. This is intentional to maintain the confidentiality of internal CCA submissions and to prevent members from disputing or refuting chair decisions.",
	},
	{
		id: "faq-7",
		question: "When are final subsidy results released?",
		answer:
			"Final subsidy results are reflected directly in the UHMS portal after JCRC and SHWeb complete the final calculation process. There will be no interim updates provided, as the results must be consolidated and verified with Housing Services before being published.",
	},
];

export const GUIDE_PHASES = [
	{ phase: "Phase 1", label: "Declaration" },
	{ phase: "Phase 2", label: "JCRC Approval" },
	{ phase: "Phase 3", label: "Weekly Submissions" },
	{ phase: "Phase 4", label: "Final Calculation" },
];
