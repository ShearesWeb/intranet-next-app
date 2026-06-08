"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

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
	 * Optional save action. When omitted (e.g. read-only pages), no save button is
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
	saveLabel = "Save for the week",
	savingLabel = "Saving...",
	isSaving = false,
	extraActions,
}: WeeklyPageHeaderProps) {
	const backButton = onBackClick ? (
		<Button variant="outline" size="sm" className="gap-2" onClick={onBackClick}>
			<ArrowLeft className="h-4 w-4" />
			{backLabel}
		</Button>
	) : (
		<Button asChild variant="outline" size="sm" className="gap-2">
			<Link href={backHref}>
				<ArrowLeft className="h-4 w-4" />
				{backLabel}
			</Link>
		</Button>
	);

	return (
		<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-semibold">{title}</h1>
				<p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
			</div>
			<div className="flex flex-wrap gap-2">
				{backButton}
				{onSave && (
					<Button
						onClick={onSave}
						disabled={saveDisabled}
						isLoading={isSaving}
						loadingText={savingLabel}
						size="sm"
					>
						{saveLabel}
					</Button>
				)}
				{extraActions}
			</div>
		</div>
	);
}
