export const FAQ_ITEMS = [
	{
		value: "item-1",
		question: "How many CCAs should I list as preferences?",
		answer:
			"As many as you'd genuinely be happy joining. Listing only one or two means the algorithm has nothing to fall back on if those fill up first — you may end up unmatched. There is no penalty for listing many.",
	},
	{
		value: "item-2",
		question: "Will making a popular CCA my #1 preference hurt my chances?",
		answer:
			"No. The algorithm always tries your #1 first. Ranking a competitive CCA lower only makes it harder to get in — always put what you actually want most at the top.",
	},
	{
		value: "item-3",
		question: "Can I change my preferences after submitting?",
		answer:
			"Yes, anytime before the deadline. The algorithm runs only once submissions close — until then you can add, remove, and re-order your preferences freely.",
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
			"This happens when every CCA you listed filled up with applicants they preferred. The fix is to add more preferences — especially less competitive positions as backups.",
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
