"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppLayout } from "@/components/layout/app-layout";
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

	if (loading)
		return (
			<AppLayout>
				<LoadingSpinner message="Loading members..." />
			</AppLayout>
		);
	if (error)
		return (
			<AppLayout>
				<div className="flex-1 p-6">
					<div className="mb-6">
						<h1 className="text-2xl font-bold text-gray-800">CCA Members</h1>
					</div>
					<Card className="bg-red-50 border-red-200">
						<CardContent className="flex flex-col items-center p-6 gap-4">
							<p className="text-red-700 font-medium text-center">⚠️ {error}</p>
							<Link href="/dashboard/mycca/admin">
								<Button
									variant="default"
									className="bg-blue-500 text-white hover:bg-blue-400 px-6 py-4 shadow-md font-bold cursor-pointer"
								>
									Back to My CCAs
								</Button>
							</Link>
						</CardContent>
					</Card>
				</div>
			</AppLayout>
		);

	return (
		<AppLayout>
			<div className="flex flex-col space-y-4 p-4">
				<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
					<h1 className="text-2xl font-semibold">CCA Members - {cca?.name}</h1>
					<div className="flex flex-wrap items-center gap-4">
						{pendingChanges.length > 0 && (
							<Button
								onClick={() => void saveAll()}
								disabled={saving}
								size="lg"
								className="bg-green-500 text-white hover:bg-green-400 px-6 py-4 shadow-md font-bold cursor-pointer"
							>
								{saving ? "Saving..." : `Save Members (${pendingChanges.length})`}
							</Button>
						)}
						<Link href="/dashboard/mycca/admin">
							<Button variant="outline" size="lg" className="px-6 py-4">
								<ArrowLeft className="h-4 w-4" />
								Back to my CCAs
							</Button>
						</Link>
					</div>
				</div>

				{pendingChanges.length > 0 && (
					<Alert className="mb-4 bg-yellow-50 border-amber-600 py-3 rounded-sm">
						<AlertCircleIcon color="#a96800" />
						<AlertDescription className="text-yellow-700 ml-1">
							<span>
								<strong>{pendingChanges.length}</strong> pending changes. Click &quot;Save
								Members&quot; to apply.
							</span>
						</AlertDescription>
					</Alert>
				)}

				{isSportsCulture && (
					<Card className="mb-4 bg-sky-50 border-blue-400 py-3 rounded-sm">
						<CardContent className="text-sky-900 text-sm pl-4">
							{permissions.canManageMembers
								? "You may add and remove members for your sports/culture CCA."
								: "Member management is currently not available."}
						</CardContent>
					</Card>
				)}

				{!isSportsCulture && !permissions.canManageMembers && (
					<Card className="mb-4 bg-slate-50 border-slate-300 py-3 rounded-sm">
						<CardContent className="text-slate-700 text-sm pl-4">
							{permissions.managementMessage || "Member management is currently not available."}
						</CardContent>
					</Card>
				)}
				{totalFilteredMembers === 0 && !isSportsCulture ? (
					<div className="flex flex-col items-center justify-center py-16 text-center text-gray-500 bg-gray-50 rounded-md">
						<p className="text-lg mb-2">📋 No members found for this CCA.</p>
						<p className="text-sm text-gray-400">
							Members will appear here when they are appointed to positions in this CCA.
						</p>
					</div>
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
				<Alert className="bg-blue-500/10 dark:bg-blue-600/20 text-blue-500 border-none">
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
		</AppLayout>
	);
}
