"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { ConflictCard } from "@/components/facilities/conflict-card";
import { OverrideDialog } from "@/components/facilities/override-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConflictView } from "@/types/facilities";
import { toast } from "sonner";
import { AlertTriangle, Shield } from "lucide-react";

export default function ConflictsPage() {
	const { user } = useAuth();
	const [myConflicts, setMyConflicts] = useState<ConflictView[]>([]);
	const [allConflicts, setAllConflicts] = useState<ConflictView[]>([]);
	const [loading, setLoading] = useState(true);
	const [overrideTarget, setOverrideTarget] = useState<ConflictView | null>(null);

	const isJcrc = user?.is_jcrc || user?.is_admin;

	const userCcaIds = useMemo(() => {
		if (!user) return [];
		return user.appointments
			.filter((a) => a.position_type === "lead" || a.position_type === "vice")
			.map((a) => a.cca_id);
	}, [user]);

	const isChair = userCcaIds.length > 0;

	const fetchConflicts = useCallback(async () => {
		setLoading(true);
		try {
			const fetches: Promise<void>[] = [];

			if (isChair) {
				fetches.push(
					fetch("/api/facilities/conflicts")
						.then((r) => r.json())
						.then((json) => setMyConflicts(json.data ?? [])),
				);
			}

			if (isJcrc) {
				fetches.push(
					fetch("/api/facilities/admin/conflicts")
						.then((r) => r.json())
						.then((json) => setAllConflicts(json.data ?? [])),
				);
			}

			await Promise.all(fetches);
		} catch {
			toast.error("Failed to load conflicts");
		} finally {
			setLoading(false);
		}
	}, [isChair, isJcrc]);

	useEffect(() => {
		fetchConflicts();
	}, [fetchConflicts]);

	const sortedMine = [...myConflicts].sort((a, b) => a.days_until_booking - b.days_until_booking);

	const escalated = allConflicts
		.filter((c) => c.escalated)
		.sort((a, b) => a.days_until_booking - b.days_until_booking);

	const sortedAll = [...allConflicts].sort((a, b) => a.days_until_booking - b.days_until_booking);

	function handleOverride(facilityId: number) {
		const conflict = allConflicts.find((c) => c.facility.id === facilityId);
		if (conflict) setOverrideTarget(conflict);
	}

	if (!isChair && !isJcrc) {
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="Facility Conflicts" />
				<EmptyState
					icon={Shield}
					title="Access Denied"
					description="You need to be a CCA chair to view conflicts."
				/>
			</div>
		);
	}

	const defaultTab = isChair ? "mine" : "escalated";

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title="Facility Conflicts"
				description={
					isJcrc
						? "Resolve conflicts for your CCAs or override contested slots as JCRC"
						: "Active conflicts involving your CCA — resolve by yielding or contacting the other party"
				}
			/>

			{isJcrc ? (
				<Tabs defaultValue={defaultTab}>
					<TabsList>
						{isChair && <TabsTrigger value="mine">My Conflicts ({sortedMine.length})</TabsTrigger>}
						<TabsTrigger value="escalated">
							Escalated ({escalated.length})
							{escalated.length > 0 && <AlertTriangle className="ml-1 h-3 w-3 text-[#f87171]" />}
						</TabsTrigger>
						<TabsTrigger value="all">All Conflicts ({sortedAll.length})</TabsTrigger>
					</TabsList>

					{isChair && (
						<TabsContent value="mine">
							<ConflictList
								loading={loading}
								conflicts={sortedMine}
								userCcaIds={userCcaIds}
								onYield={fetchConflicts}
								emptyTitle="No active conflicts"
								emptyDescription="When multiple CCAs claim the same slot, conflicts appear here."
							/>
						</TabsContent>
					)}

					<TabsContent value="escalated">
						<ConflictList
							loading={loading}
							conflicts={escalated}
							userCcaIds={userCcaIds}
							onYield={fetchConflicts}
							showOverride
							onOverride={handleOverride}
							emptyTitle="No escalated conflicts"
							emptyDescription="Conflicts auto-escalate 3 days before the booking date."
						/>
					</TabsContent>

					<TabsContent value="all">
						<ConflictList
							loading={loading}
							conflicts={sortedAll}
							userCcaIds={userCcaIds}
							onYield={fetchConflicts}
							showOverride
							onOverride={handleOverride}
							emptyTitle="No active conflicts"
							emptyDescription="All slot claims are uncontested."
						/>
					</TabsContent>
				</Tabs>
			) : (
				<ConflictList
					loading={loading}
					conflicts={sortedMine}
					userCcaIds={userCcaIds}
					onYield={fetchConflicts}
					emptyTitle="No active conflicts"
					emptyDescription="When multiple CCAs claim the same slot, conflicts appear here."
				/>
			)}

			<OverrideDialog
				conflict={overrideTarget}
				onClose={() => setOverrideTarget(null)}
				onSuccess={fetchConflicts}
			/>
		</div>
	);
}

function ConflictList({
	loading,
	conflicts,
	userCcaIds,
	onYield,
	showOverride,
	onOverride,
	emptyTitle,
	emptyDescription,
}: {
	loading: boolean;
	conflicts: ConflictView[];
	userCcaIds: number[];
	onYield: () => void;
	showOverride?: boolean;
	onOverride?: (facilityId: number, winningCcaId: number) => void;
	emptyTitle: string;
	emptyDescription: string;
}) {
	if (loading) {
		return <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>;
	}

	if (conflicts.length === 0) {
		return <EmptyState icon={AlertTriangle} title={emptyTitle} description={emptyDescription} />;
	}

	return (
		<div className="mt-3 space-y-3">
			{conflicts.map((conflict) => (
				<ConflictCard
					key={conflict.facility.id}
					conflict={conflict}
					userCcaIds={userCcaIds}
					onYield={onYield}
					showOverride={showOverride}
					onOverride={onOverride}
				/>
			))}
		</div>
	);
}
