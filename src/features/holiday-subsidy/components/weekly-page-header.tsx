"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save } from "lucide-react";

export interface WeeklyPageHeaderProps {
	title: string;
	description: string;
	backHref: string;
	backLabel: string;
	/**
	 * When provided, the back button uses an onClick handler (e.g. for unsaved
	 * change confirmation). When omitted, the back button renders as a Next.js
	 * <Link>.
	 */
	onBackClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
	/**
	 * Optional save action. When omitted (e.g. approvals page), no save button is
	 * rendered and callers can place their own actions in `extraActions`.
	 */
	onSave?: () => void;
	saveDisabled?: boolean;
	saveLabel?: string;
	savingLabel?: string;
	isSaving?: boolean;
	/** Optional additional action buttons rendered in the action group. */
	extraActions?: React.ReactNode;
}

export function WeeklyPageHeader({
	title,
	description,
	backHref,
	backLabel,
	onBackClick,
	onSave,
	saveDisabled,
	saveLabel = "Save Changes",
	savingLabel = "Saving...",
	isSaving = false,
	extraActions,
}: WeeklyPageHeaderProps) {
	const backButton = onBackClick ? (
		<Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto" onClick={onBackClick}>
			<ArrowLeft className="h-4 w-4" />
			{backLabel}
		</Button>
	) : (
		<Link href={backHref}>
			<Button variant="outline" size="lg" className="gap-2 w-full sm:w-auto">
				<ArrowLeft className="h-4 w-4" />
				{backLabel}
			</Button>
		</Link>
	);

	return (
		<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
			<div>
				<h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
				<p className="text-muted-foreground mt-2 text-sm md:text-base">{description}</p>
			</div>
			<div className="flex flex-col sm:flex-row gap-2">
				{backButton}
				{onSave && (
					<Button
						onClick={onSave}
						disabled={saveDisabled}
						size="lg"
						className="px-6 shadow-md font-semibold gap-2 disabled:opacity-50 w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
					>
						<Save className="h-4 w-4" />
						{isSaving ? savingLabel : saveLabel}
					</Button>
				)}
				{extraActions}
			</div>
		</div>
	);
}
