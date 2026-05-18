export const ALGORITHM_STEPS = [
	{
		number: 1,
		title: "You rank your picks",
		icon: "Users" as const,
		description:
			"You pick the positions you'd join and order them — favorite first. The algorithm starts by applying to your #1 on your behalf.",
	},
	{
		number: 2,
		title: "CCAs sort applicants",
		icon: "Activity" as const,
		description:
			"Each CCA looks at every applicant and tentatively holds onto the ones they prefer (up to their capacity). Anyone bumped tries their next preference.",
	},
	{
		number: 3,
		title: "Repeat until stable",
		icon: "Heart" as const,
		description:
			"Bumped applicants try #2, then #3, and so on. The algorithm stops when no one is moving — the result is mathematically stable: no pair can swap and be happier.",
	},
] as const;

export const FAQ_ITEMS = [
	{
		value: "item-1",
		question: "How many CCAs should I rank?",
		answer:
			"As many as you'd genuinely be happy joining. Ranking only one or two means the algorithm has nothing to fall back on if those fill up first — you may end up unmatched. There is no penalty for ranking many.",
	},
	{
		value: "item-2",
		question: "Will ranking a popular CCA #1 hurt my chances?",
		answer:
			"No. The algorithm always tries your #1 first. Ranking a competitive CCA lower only makes it harder to get in — always rank what you actually want most at the top.",
	},
	{
		value: "item-3",
		question: "Can I change my picks after submitting?",
		answer:
			"Yes, anytime before the deadline. The algorithm runs only once submissions close — until then you can add, remove, and re-order your picks freely.",
	},
	{
		value: "item-4",
		question: "Does submitting early give me priority?",
		answer:
			"No. The submission timestamp is ignored. Take time to think through your real preferences.",
	},
	{
		value: "item-5",
		question: "What if I don't get matched to anything?",
		answer:
			"This happens when every CCA you ranked filled up with applicants they preferred. The fix is to rank more positions — especially less competitive ones as backups.",
	},
	{
		value: "item-6",
		question: "How many CCAs can I join in total?",
		answer: `You are generally allowed to join:\n- Two Maincomms\n- One Maincomm and one Subcomm\n- Three Subcomms\n\nAnything else requires an appeal to JCRC through the appeal form in the Shearites channel.`,
		list: ["Two Maincomms", "One Maincomm and one Subcomm", "Three Subcomms"],
		footer:
			"Anything else requires an appeal to JCRC through the appeal form in the Shearites channel.",
	},
] as const;
