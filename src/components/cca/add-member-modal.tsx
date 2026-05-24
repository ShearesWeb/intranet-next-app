"use client";

import React, { useEffect, useMemo, useState } from "react";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { CommitmentPeriod, UserSearchResult } from "@/types/members";
import { isChairPositionType } from "@/lib/cca/member-helpers";

interface AddMemberModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	searchQuery: string;
	onSearchQueryChange: (q: string) => void;
	searchResults: UserSearchResult[];
	searchLoading: boolean;
	onSearch: () => Promise<void>;
	onAddMember: (
		userId: number,
		userName: string,
		userEmail: string,
		userRoom?: string,
		positionId?: number,
		commitmentPeriod?: CommitmentPeriod,
	) => void;
	onRemoveMember: (userId: number, name: string) => void;
	allPositions: Array<{ id: number; name: string; position_type: string }>;
	isSportsCulture: boolean;
	existingMemberIds: number[];
}

export function AddMemberModal({
	open,
	onOpenChange,
	searchQuery,
	onSearchQueryChange,
	searchResults,
	searchLoading,
	onSearch,
	onAddMember,
	onRemoveMember,
	allPositions,
	isSportsCulture,
	existingMemberIds,
}: AddMemberModalProps) {
	const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
	const [selectedPositionId, setSelectedPositionId] = useState<number | undefined>();
	const [selectedCommitment, setSelectedCommitment] = useState<CommitmentPeriod>("full-year");
	const availablePositions = useMemo(
		() => allPositions.filter((position) => !isChairPositionType(position.position_type)),
		[allPositions],
	);

	useEffect(() => {
		if (!open) {
			setSelectedUser(null);
			setSelectedCommitment("full-year");
			setSelectedPositionId(availablePositions[0]?.id);
			return;
		}
		if (selectedPositionId === undefined && availablePositions[0]) {
			setSelectedPositionId(availablePositions[0].id);
		}
	}, [availablePositions, open, selectedPositionId]);

	const handleClose = () => {
		setSelectedUser(null);
		setSelectedCommitment("full-year");
		setSelectedPositionId(availablePositions[0]?.id);
		onSearchQueryChange("");
		onOpenChange(false);
	};

	const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			void onSearch();
		}
	};

	const handleSelectUser = (user: UserSearchResult) => {
		if (existingMemberIds.includes(user.id)) {
			onRemoveMember(user.id, user.name);
			return;
		}
		setSelectedUser(user);
		setSelectedPositionId((current) => current ?? availablePositions[0]?.id);
	};

	const handleConfirmAdd = () => {
		if (!selectedUser) return;
		onAddMember(
			selectedUser.id,
			selectedUser.name,
			selectedUser.email,
			selectedUser.room || undefined,
			selectedPositionId,
			selectedCommitment,
		);
		setSelectedUser(null);
		setSelectedCommitment("full-year");
		setSelectedPositionId(availablePositions[0]?.id);
	};

	if (!isSportsCulture) return null;

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : handleClose())}
		>
			<DialogContent className="max-w-[750px] max-h-[80vh] overflow-auto">
				<DialogHeader>
					<DialogTitle>Add Member</DialogTitle>
				</DialogHeader>
				{selectedUser ? (
					<div className="space-y-4">
						<div className="p-4 bg-gray-50 rounded-md">
							<p className="font-bold">{selectedUser.name}</p>
							<p className="text-sm text-gray-500">{selectedUser.email}</p>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Position</label>
							<select
								className="w-full border rounded p-2 bg-white"
								value={selectedPositionId ?? ""}
								onChange={(e) => setSelectedPositionId(Number(e.target.value))}
							>
								{availablePositions.map((position) => (
									<option key={position.id} value={position.id}>
										{position.name}
									</option>
								))}
							</select>
						</div>
						<div>
							<label className="block text-sm font-medium mb-1">Commitment Period</label>
							<select
								className="w-full border rounded p-2 bg-white"
								value={selectedCommitment}
								onChange={(e) => setSelectedCommitment(e.target.value as CommitmentPeriod)}
							>
								<option value="full-year">Full Year</option>
								<option value="semester-1">Semester 1</option>
								<option value="semester-2">Semester 2</option>
							</select>
						</div>
						<div className="flex justify-end gap-2 mt-6">
							<Button
								onClick={() => setSelectedUser(null)}
								variant="outline"
								className="bg-gray-100 hover:bg-gray-200"
							>
								Back
							</Button>
							<Button
								onClick={handleConfirmAdd}
								className="bg-green-600 hover:bg-green-500 text-white"
							>
								Confirm Add
							</Button>
						</div>
					</div>
				) : (
					<>
						<div className="flex gap-4 mb-4">
							<Input
								type="text"
								placeholder="Search by name / email / room..."
								value={searchQuery}
								onChange={(e) => onSearchQueryChange(e.target.value)}
								onKeyDown={handleSearchKeyDown}
								className="focus-visible:ring-[2px] focus-visible:ring-blue-500/20 focus-visible:border-blue-500 py-5 rounded-sm border border-gray-300 w-full pl-4"
							/>
							<Button
								onClick={() => void onSearch()}
								disabled={searchLoading}
								className="bg-blue-500 text-white hover:bg-blue-400 px-8 py-3 shadow-md font-bold cursor-pointer"
							>
								{searchLoading ? "Searching..." : "Search"}
							</Button>
						</div>
						{searchLoading && (
							<div className="flex items-center justify-center mt-4">
								<LoadingSpinner message="Searching users..." fullHeight={false} />
							</div>
						)}
						<div className="mt-4">
							<div className="space-y-2 max-h-64 overflow-y-auto">
								{searchResults.map((user) => {
									const isAdded = existingMemberIds.includes(user.id);
									return (
										<div
											key={user.id}
											className="flex justify-between items-center p-3 border border-gray-200 rounded-md bg-white shadow-sm"
										>
											<div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
												<strong className="font-bold">{user.name}</strong>
												<span className="text-gray-500">({user.email})</span>
												{user.room && <span className="text-gray-400">- {user.room}</span>}
											</div>
											<Button
												size="sm"
												onClick={() => handleSelectUser(user)}
												className={
													isAdded
														? "bg-red-500 text-white hover:bg-red-400 px-4 py-2 shadow-md font-bold cursor-pointer"
														: "bg-green-500 text-white hover:bg-green-400 px-4 py-2 shadow-md font-bold cursor-pointer"
												}
											>
												{isAdded ? "Remove" : "Add"}
											</Button>
										</div>
									);
								})}
							</div>
						</div>
					</>
				)}
				<div className="mt-6 flex justify-end">
					<Button
						onClick={handleClose}
						className="bg-gray-500 text-white hover:bg-gray-400 px-6 py-4 shadow-md font-bold cursor-pointer"
					>
						Close
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
