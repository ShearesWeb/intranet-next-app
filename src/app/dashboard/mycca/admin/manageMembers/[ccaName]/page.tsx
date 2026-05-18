"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircleIcon, ArrowLeft, Volleyball } from "lucide-react";
import { useCcaMembers } from "@/features/cca/hooks/use-cca-members";
import { AddMemberModal } from "@/features/cca/components/add-member-modal";
import { MemberGroupTable } from "@/features/cca/components/member-group-table";
import { SaveErrorDialog } from "@/features/cca/components/save-error-dialog";

export default function ManageMembersPage() {
	const searchParams = useSearchParams();
	const ccaId = searchParams.get("ccaId");
	const {
		groupedMembers,
		cca,
		permissions,
		allPositions,
		loading,
		error,
		saving,
		saveErrors,
		setSaveErrors,
		pendingChanges,
		searchQuery,
		setSearchQuery,
		searchResults,
		searchLoading,
		searchUser,
		addMember,
		removeMember,
		updateStatus,
		updateCommitment,
		saveAll,
	} = useCcaMembers(ccaId);
	const [showAddMemberModal, setShowAddMemberModal] = useState(false);
	const isSports = permissions.ccaType === "sports";
	const isCulture = permissions.ccaType === "culture";
	const isSportsCulture = ["sports", "culture"].includes(permissions.ccaType);
	const leadershipMembers = [...(groupedMembers.lead || []), ...(groupedMembers.vice || [])];
	const existingMemberIds = useMemo(
		() =>
			Object.values(groupedMembers)
				.flat()
				.map((member) => member.user_id),
		[groupedMembers],
	);
	const totalFilteredMembers = existingMemberIds.length;
	const sections = [
		{ title: "Leadership", members: leadershipMembers, showActions: false, showAddButton: false },
		!isSportsCulture && {
			title: "Main Committee",
			members: groupedMembers.maincomm || [],
			showActions: true,
			showAddButton: false,
		},
		!isSportsCulture && {
			title: "Sub Committee",
			members: groupedMembers.subcomm || [],
			showActions: true,
			showAddButton: false,
		},
		isSportsCulture && {
			title: "Team Manager",
			members: groupedMembers.teamManager || [],
			showActions: false,
			showAddButton: false,
		},
		isSports && {
			title: "Final Cut - IHG Team Members (IVP)",
			members: groupedMembers.ivpIhgTeam || [],
			showActions: true,
			showAddButton: false,
		},
		isSports && {
			title: "Final Cut - IHG Team Members",
			members: groupedMembers.ihgTeam || [],
			showActions: true,
			showAddButton: false,
		},
		isSports && {
			title: "Final Cut Members",
			members: groupedMembers.finalCut || [],
			showActions: true,
			showAddButton: false,
		},
		isCulture && {
			title: "IVP Members",
			members: groupedMembers.firstCut || [],
			showActions: true,
			showAddButton: false,
		},
		{
			title: "Members",
			members: groupedMembers.members || [],
			showActions: true,
			showAddButton: true,
		},
	].filter(Boolean) as Array<{
		title: string;
		members: typeof leadershipMembers;
		showActions: boolean;
		showAddButton: boolean;
	}>;

	if (loading) return <LoadingSpinner message="Loading members..." />;
	if (error)
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<h1 className="text-2xl font-semibold">CCA Members</h1>
				<Card className="border-destructive/40 bg-destructive/5">
					<CardContent className="flex flex-col items-center gap-4 p-6">
						<p className="text-destructive font-medium text-center">{error}</p>
						<Button asChild variant="default">
							<Link href="/dashboard/mycca/admin">Back to My CCAs</Link>
						</Button>
					</CardContent>
				</Card>
			</div>
		);

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<h1 className="text-2xl font-semibold">CCA Members - {cca?.name}</h1>
				<div className="flex flex-wrap items-center gap-2">
					{pendingChanges.length > 0 && (
						<Button onClick={() => void saveAll()} disabled={saving} size="sm">
							{saving ? "Saving..." : `Save Members (${pendingChanges.length})`}
						</Button>
					)}
					<Button asChild variant="outline" size="sm" className="gap-2">
						<Link href="/dashboard/mycca/admin">
							<ArrowLeft className="h-4 w-4" />
							Back to my CCAs
						</Link>
					</Button>
				</div>
			</div>

			{pendingChanges.length > 0 && (
				<Alert>
					<AlertCircleIcon className="h-4 w-4" />
					<AlertDescription>
						<span>
							<strong>{pendingChanges.length}</strong> pending changes. Click &quot;Save
							Members&quot; to apply.
						</span>
					</AlertDescription>
				</Alert>
			)}

			{isSportsCulture && (
				<Card className="bg-muted/40">
					<CardContent className="text-sm text-muted-foreground py-3 pl-4">
						{permissions.canManageMembers
							? "You may add and remove members for your sports/culture CCA."
							: "Member management is currently not available."}
					</CardContent>
				</Card>
			)}

			{!isSportsCulture && !permissions.canManageMembers && (
				<Card className="bg-muted/40">
					<CardContent className="text-sm text-muted-foreground py-3 pl-4">
						{permissions.managementMessage || "Member management is currently not available."}
					</CardContent>
				</Card>
			)}
			{totalFilteredMembers === 0 && !isSportsCulture ? (
				<Card className="border-dashed bg-muted/40">
					<CardContent className="flex flex-col items-center justify-center py-16 text-center">
						<p className="text-lg text-muted-foreground mb-2">No members found for this CCA.</p>
						<p className="text-sm text-muted-foreground">
							Members will appear here when they are appointed to positions in this CCA.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-8">
					{sections.map((section) => (
						<MemberGroupTable
							key={section.title}
							title={section.title}
							members={section.members}
							canManage={permissions.canManageMembers}
							ccaType={permissions.ccaType}
							onRemoveMember={removeMember}
							onUpdateStatus={updateStatus}
							onUpdateCommitment={updateCommitment}
							onAddMember={() => setShowAddMemberModal(true)}
							showActions={section.showActions}
							showAddButton={section.showAddButton}
						/>
					))}
				</div>
			)}
			<Alert>
				<Volleyball className="size-4" />
				<AlertTitle>
					<strong>Total Members:</strong> {totalFilteredMembers}
				</AlertTitle>
			</Alert>
			<AddMemberModal
				open={showAddMemberModal}
				onOpenChange={setShowAddMemberModal}
				searchQuery={searchQuery}
				onSearchQueryChange={setSearchQuery}
				searchResults={searchResults}
				searchLoading={searchLoading}
				onSearch={searchUser}
				onAddMember={addMember}
				onRemoveMember={removeMember}
				allPositions={allPositions}
				isSportsCulture={isSportsCulture}
				existingMemberIds={existingMemberIds}
			/>
			<SaveErrorDialog errors={saveErrors} onClose={() => setSaveErrors([])} />
			{saving && <LoadingSpinner message="Saving changes..." overlay />}
		</div>
	);
}
