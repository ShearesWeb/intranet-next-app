export interface ApplicantDiff {
	toAdd: number[];
	toRemove: number[];
	rankings: { user_id: number; ranking: number }[];
}

export function diffApplicantsForSave(
	position: { id: number; applicants: { id: number }[] },
	originalOrders: Record<number, number[]>,
): ApplicantDiff {
	const originalApplicantIds = originalOrders[position.id] ?? [];
	const currentApplicantIds = position.applicants.map((app) => app.id);

	const toAdd = currentApplicantIds.filter((id) => !originalApplicantIds.includes(id));
	const toRemove = originalApplicantIds.filter((id) => !currentApplicantIds.includes(id));
	const rankings = position.applicants.map((a, i) => ({ user_id: a.id, ranking: i + 1 }));

	return { toAdd, toRemove, rankings };
}
