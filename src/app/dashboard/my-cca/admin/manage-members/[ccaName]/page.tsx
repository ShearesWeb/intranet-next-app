"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { AlertCircleIcon, Users } from "lucide-react";
import { useCcaMembers } from "@/hooks/use-cca-members";
import { AddMemberModal } from "@/components/cca/add-member-modal";
import { MemberGroupTable } from "@/components/cca/member-group-table";
import { SaveErrorDialog } from "@/components/cca/save-error-dialog";
import { PageHeader } from "@/components/layout/page-header";
import { ErrorCard } from "@/components/layout/error-card";
import { EmptyState } from "@/components/layout/empty-state";
import { DashboardTableSkeleton } from "@/components/layout/dashboard-skeletons";

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

	if (loading) return <DashboardTableSkeleton rows={6} cols={5} />;
	if (error)
		return (
			<div className="flex flex-col space-y-6 p-4 md:p-6">
				<PageHeader title="CCA Members" />
				<ErrorCard error={error} backHref="/dashboard/my-cca/admin" backLabel="Back to My CCAs" />
			</div>
		);

	const saveButton =
		pendingChanges.length > 0 ? (
			<Button
				onClick={() => void saveAll()}
				size="sm"
				isLoading={saving}
				loadingText="Saving…"
			>
				{`Save Members (${pendingChanges.length})`}
			</Button>
		) : undefined;

	return (
		<div className="flex flex-col space-y-6 p-4 md:p-6">
			<PageHeader
				title={`CCA Members - ${cca?.name ?? ""}`}
				actions={saveButton}
				backHref="/dashboard/my-cca/admin"
				backLabel="Back to my CCAs"
			/>

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
				<EmptyState
					title="No members found for this CCA."
					description="Members will appear here when they are appointed to positions in this CCA."
				/>
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
			<div className="flex items-center gap-2 text-sm text-muted-foreground border-t pt-4">
				<Users className="h-4 w-4" />
				<span>
					Total Members: <strong className="text-foreground">{totalFilteredMembers}</strong>
				</span>
			</div>
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
